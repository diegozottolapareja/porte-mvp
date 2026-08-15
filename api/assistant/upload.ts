import { createAdminClient, authenticateRequest } from '../_lib/supabaseAdmin.js';
import { processDocument } from '../_lib/documentProcessingService.js';
import { validateExpense, validateIncome, validateBudget, type PresupuestoPayload, type EgresoPayload } from '../_lib/documentValidation.js';
import { executeAction } from '../_lib/actionExecutor.js';
import type { DocumentExtractionEnvelope, ExtractedDocumentData } from '../_lib/documentSchemas.js';

export const config = { runtime: 'edge' };

// Runtime edge, igual que el resto de api/* — el handler recibe un Request/
// Response de verdad (Web API). Con el runtime Node.js por defecto, el
// handler(request: Request) de acá NUNCA recibió un Request real (Vercel
// pasa su propio req con helpers de Node, sin .headers.get) — eso rompía
// la autenticación en producción con "request.headers.get is not a
// function", enmascarado antes por el bug de resolución de módulos ESM.
//
// Ingresos: clasifica, extrae, valida y deja el resultado en
// `conversations.pending_extraction` — la confirmación por texto o voz
// (api/assistant/message.ts) es la que dispara el Action Executor.
//
// Presupuestos (budget/budget_group) y facturas de compra (expense): se
// crean directo acá, en el mismo request — el upload en sí es la acción, sin
// pasar por "¿lo cargo?" en el chat (el cliente/proveedor, si no existe, se
// crea al vuelo). No hay otra forma de confirmarlo aparte de subir el
// archivo. Las facturas quedan siempre "Incompleto": todavía no hay forma de
// asociar un egreso cargado por factura a una venta/obra.

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Excel/Word deshabilitados temporalmente — ver documentProcessingService.ts.
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 5;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'archivo';
  return base.slice(0, 200);
}

interface FileSummary {
  name: string;
  size: number;
  documentType?: string;
  confidence?: number;
  summary: string;
  error?: string;
}

function summarizeIncome(fileName: string, data: ExtractedDocumentData): { text: string; ready: boolean } {
  const validation = validateIncome(data);
  if (!validation.ok) {
    return { text: `"${fileName}": parece un ingreso, pero faltan datos: ${validation.missingFields.join(', ')}. ¿Me los pasás?`, ready: false };
  }
  const p = validation.payload!;
  const warn = validation.warnings.length > 0 ? ` (ojo: ${validation.warnings.join('; ')})` : '';
  return {
    text: `"${fileName}": encontré un ingreso de $${p.monto.toLocaleString('es-AR')} (${p.tipoIngreso})${warn}. Me falta la cuenta y la caja para cargarlo — ¿cuáles uso? Decime y confirmo.`,
    ready: true,
  };
}

// Los presupuestos y las facturas extraídos de un documento se crean directo
// en este mismo request (sin pasar por "¿lo cargo?" en el chat) — ver
// handler más abajo.

interface BudgetItem {
  assistantDocId: string;
  payload: PresupuestoPayload;
  summaryRef: FileSummary;
}

interface InvoiceItem {
  assistantDocId: string;
  payload: EgresoPayload;
  summaryRef: FileSummary;
  comprobantePath?: string;
}

type EntityStatus = 'existing' | 'created' | 'create_failed';

function normalizeName(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function formatBudgetLine(payload: PresupuestoPayload, createdId: string, montoTotal: number, clienteStatus: EntityStatus): string {
  const clienteNote = clienteStatus === 'created'
    ? 'cliente nuevo (contacto pendiente de completar)'
    : clienteStatus === 'create_failed'
      ? 'no se pudo verificar el cliente'
      : 'cliente ya existente';
  const incompleteNote = payload.estadoComercial === 'Incompleto' ? ' Quedó marcado "Incompleto" para revisar a mano.' : '';
  return `${createdId} para "${payload.cliente}" ($${montoTotal.toLocaleString('es-AR')}) — ${clienteNote}.${incompleteNote}`;
}

function formatInvoiceLine(payload: EgresoPayload, ref: string, proveedorStatus: EntityStatus): string {
  const proveedorNote = proveedorStatus === 'created' ? 'proveedor nuevo' : 'proveedor ya existente';
  return `${ref}: ${payload.categoria} de $${payload.monto.toLocaleString('es-AR')} a "${payload.proveedor}" (${proveedorNote}). Quedó marcado "Incompleto" — todavía no se asocia a una venta/obra.`;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Solo se permite POST' }, 405);
  }

  const supabase = createAdminClient();
  const user = await authenticateRequest(request, supabase);
  if (!user) {
    return jsonResponse({ success: false, error: 'No autorizado' }, 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ success: false, error: 'Se esperaba multipart/form-data' }, 400);
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return jsonResponse({ success: false, error: 'Falta al menos un archivo' }, 400);
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return jsonResponse({ success: false, error: `Máximo ${MAX_FILES_PER_UPLOAD} archivos por mensaje` }, 400);
  }

  const caption = typeof form.get('text') === 'string' ? (form.get('text') as string).trim() : '';
  let conversationId = typeof form.get('conversationId') === 'string' ? (form.get('conversationId') as string) : undefined;

  try {
    if (!conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      if (error || !conversation) throw new Error(`Error creando conversación: ${error?.message}`);
      conversationId = conversation.id;
    }

    const fileNames = files.map((f) => sanitizeFileName(f.name)).join(', ');
    const userMessageContent = caption ? `${caption} [Adjuntó: ${fileNames}]` : `[Adjuntó: ${fileNames}]`;
    await supabase.from('conversation_messages').insert({ conversation_id: conversationId, role: 'user', content: userMessageContent });

    const summaries: FileSummary[] = [];
    let primary: { documentType: string; data: unknown; ready: boolean } | undefined;
    const budgetItems: BudgetItem[] = [];
    const invoiceItems: InvoiceItem[] = [];
    const linesBySummary = new Map<FileSummary, string[]>();
    const skippedBySummary = new Map<FileSummary, number>();

    for (const file of files) {
      const name = sanitizeFileName(file.name);

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        summaries.push({ name, size: file.size, summary: `"${name}": tipo de archivo no soportado (${file.type || 'desconocido'}). Solo PDF, JPG o PNG.`, error: 'unsupported_type' });
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        summaries.push({ name, size: file.size, summary: `"${name}": pesa más de ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB, no lo pude procesar.`, error: 'too_large' });
        continue;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileHash = await sha256Hex(bytes);

      try {
        // Dedupe global (no por conversación): si este archivo ya generó un
        // presupuesto antes — en esta conversación o en otra — no se reprocesa
        // ni se vuelve a crear nada.
        const { data: cached } = await supabase
          .from('assistant_documents')
          .select('document_type, data, confidence, used_action_ids')
          .eq('file_hash', fileHash)
          .not('document_type', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached && Array.isArray(cached.used_action_ids) && cached.used_action_ids.length > 0) {
          const entityNote = cached.document_type === 'expense' ? 'egreso' : 'presupuesto';
          summaries.push({
            name,
            size: file.size,
            documentType: cached.document_type ?? undefined,
            summary: `"${name}": ya había sido cargado (${entityNote} ${cached.used_action_ids.join(', ')}) — no se hizo ninguna acción.`,
          });
          continue;
        }

        let envelope: DocumentExtractionEnvelope;
        let usage = { promptTokens: 0, completionTokens: 0 };

        if (cached) {
          envelope = { documentType: cached.document_type, confidence: cached.confidence ?? 0, data: (cached.data as { data?: ExtractedDocumentData })?.data ?? null, documents: (cached.data as { documents?: ExtractedDocumentData[] })?.documents ?? null };
        } else {
          const processed = await processDocument({ name, mimeType: file.type, bytes });
          envelope = processed.envelope;
          usage = processed.usage;
        }

        const { data: insertedDoc, error: insertDocError } = await supabase
          .from('assistant_documents')
          .insert({
            conversation_id: conversationId,
            file_name: name,
            mime_type: file.type,
            size_bytes: file.size,
            file_hash: fileHash,
            document_type: envelope.documentType,
            confidence: envelope.confidence,
            data: envelope.documentType === 'budget_group' ? { documents: envelope.documents } : { data: envelope.data },
            prompt_tokens: usage.promptTokens,
            completion_tokens: usage.completionTokens,
          })
          .select('id')
          .single();
        if (insertDocError || !insertedDoc) throw new Error(`Error guardando el documento: ${insertDocError?.message}`);
        const assistantDocId = insertedDoc.id as string;

        if (envelope.documentType === 'expense' && envelope.data) {
          // Factura de compra: se crea directo más abajo, junto con el resto del
          // lote — acá solo se valida y se deja reservado el lugar del reporte.
          const validation = validateExpense(envelope.data);
          const summaryEntry: FileSummary = { name, size: file.size, documentType: envelope.documentType, confidence: envelope.confidence, summary: '' };
          summaries.push(summaryEntry);
          if (validation.ok) {
            // Se guarda el archivo original en Storage para poder verlo después
            // desde el egreso creado — si falla, no bloquea la carga del egreso,
            // solo queda sin adjunto.
            const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
            const comprobantePath = `egresos/${assistantDocId}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('comprobantes')
              .upload(comprobantePath, bytes, { contentType: file.type });
            if (uploadError) {
              console.error('[upload] error guardando comprobante en Storage:', uploadError);
            }
            invoiceItems.push({
              assistantDocId,
              payload: validation.payload!,
              summaryRef: summaryEntry,
              comprobantePath: uploadError ? undefined : comprobantePath,
            });
          } else {
            summaryEntry.summary = `"${name}": encontré una factura pero no pude identificar el proveedor o el monto en el documento — no la cargué, esos datos no los puedo inventar. Decime esos datos o cargala a mano.`;
            summaryEntry.error = 'missing_proveedor';
          }
        } else if (envelope.documentType === 'income' && envelope.data) {
          const { text, ready } = summarizeIncome(name, envelope.data);
          summaries.push({ name, size: file.size, documentType: envelope.documentType, confidence: envelope.confidence, summary: text });
          if (!primary) primary = { documentType: envelope.documentType, data: envelope.data, ready };
        } else if (envelope.documentType === 'budget' && envelope.data) {
          // Presupuesto único: se crea directo más abajo, junto con el resto del
          // lote — acá solo se valida y se deja reservado el lugar del reporte.
          const validation = validateBudget(envelope.data);
          const summaryEntry: FileSummary = { name, size: file.size, documentType: envelope.documentType, confidence: envelope.confidence, summary: '' };
          summaries.push(summaryEntry);
          if (validation.ok) {
            budgetItems.push({ assistantDocId, payload: validation.payload!, summaryRef: summaryEntry });
          } else {
            summaryEntry.summary = `"${name}": encontré un presupuesto pero no pude identificar el cliente en el documento — no lo cargué, ese dato no lo puedo inventar. Decime quién es o cargalo a mano.`;
            summaryEntry.error = 'missing_cliente';
          }
        } else if (envelope.documentType === 'budget_group' && envelope.documents) {
          // Documento con varios presupuestos: cada uno se valida por separado —
          // los que no tienen cliente se saltean sin bloquear a los demás.
          const summaryEntry: FileSummary = { name, size: file.size, documentType: envelope.documentType, confidence: envelope.confidence, summary: '' };
          summaries.push(summaryEntry);
          let pushed = 0;
          let skipped = 0;
          for (const doc of envelope.documents) {
            const validation = validateBudget(doc);
            if (validation.ok) {
              budgetItems.push({ assistantDocId, payload: validation.payload!, summaryRef: summaryEntry });
              pushed++;
            } else {
              skipped++;
            }
          }
          if (pushed === 0) {
            summaryEntry.summary = `"${name}": encontré ${envelope.documents.length} presupuestos, pero no pude identificar el cliente en ninguno — no cargué ninguno.`;
            summaryEntry.error = 'missing_cliente';
          } else if (skipped > 0) {
            skippedBySummary.set(summaryEntry, skipped);
          }
        } else {
          summaries.push({
            name,
            size: file.size,
            documentType: envelope.documentType,
            confidence: envelope.confidence,
            summary: `"${name}": no pude identificar con seguridad qué tipo de documento es (confianza ${Math.round((envelope.confidence ?? 0) * 100)}%). ¿Es un egreso, un ingreso o un presupuesto?`,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        summaries.push({ name, size: file.size, summary: `"${name}": no pude procesarlo (${message}).`, error: 'processing_failed' });
        await supabase.from('assistant_documents').insert({
          conversation_id: conversationId,
          file_name: name,
          mime_type: file.type,
          size_bytes: file.size,
          file_hash: fileHash,
          error: message,
        });
      }
    }

    // Todos los presupuestos detectados en este upload (uno o varios archivos,
    // uno o varios por budget_group) se crean juntos, en un solo lote atómico —
    // el usuario no confirma nada, el upload en sí ya es la acción.
    if (budgetItems.length > 0) {
      const { data: clientesExistentes } = await supabase.from('clientes').select('nombre').eq('activo', true);
      const nombresConocidos = new Set((clientesExistentes ?? []).map((c) => normalizeName(c.nombre)));
      const clienteStatus = new Map<string, EntityStatus>();

      for (const item of budgetItems) {
        const key = normalizeName(item.payload.cliente);
        if (clienteStatus.has(key)) continue;
        if (nombresConocidos.has(key)) {
          clienteStatus.set(key, 'existing');
          continue;
        }
        // Un documento comercial externo casi nunca trae el contacto del
        // cliente — se crea con placeholder en vez de bloquear la carga.
        const created = await executeAction('create_cliente', { nombre: item.payload.cliente, emailPrincipal: 'pendiente@completar.com' }, user.id);
        clienteStatus.set(key, created.ok ? 'created' : 'create_failed');
      }

      const batchResult = await executeAction('create_budget_batch', { items: budgetItems.map((i) => i.payload) }, user.id);
      const usedIdsByDoc = new Map<string, string[]>();

      if (batchResult.ok) {
        const creados = (batchResult.data as Array<{ id: string; monto_total: number | null }>) ?? [];
        budgetItems.forEach((item, i) => {
          const created = creados[i];
          if (!created) return;
          const status = clienteStatus.get(normalizeName(item.payload.cliente)) ?? 'existing';
          const total = created.monto_total ?? (item.payload.costoMat + item.payload.costoMo + (item.payload.indVendidos ?? 0) + (item.payload.impuestos ?? 0) + (item.payload.comercial ?? 0) + (item.payload.beneficio ?? 0));

          if (!linesBySummary.has(item.summaryRef)) linesBySummary.set(item.summaryRef, []);
          linesBySummary.get(item.summaryRef)!.push(formatBudgetLine(item.payload, created.id, total, status));

          if (!usedIdsByDoc.has(item.assistantDocId)) usedIdsByDoc.set(item.assistantDocId, []);
          usedIdsByDoc.get(item.assistantDocId)!.push(created.id);
        });

        for (const [assistantDocId, ids] of usedIdsByDoc) {
          await supabase.from('assistant_documents').update({ used_action_ids: ids }).eq('id', assistantDocId);
        }
      } else {
        for (const item of budgetItems) {
          if (!linesBySummary.has(item.summaryRef)) linesBySummary.set(item.summaryRef, []);
          linesBySummary.get(item.summaryRef)!.push(`"${item.payload.cliente}": no se pudo crear (${batchResult.error}).`);
        }
      }
    }

    // Las facturas detectadas en este upload se crean una por una (no hay
    // "expense_group" — un documento de factura trae siempre un solo egreso).
    // Se procesan en secuencia (await, no Promise.all) porque create_egreso
    // crea el proveedor al vuelo si no existe, leyendo la tabla en cada
    // llamada — la secuencialidad evita crear el mismo proveedor nuevo dos
    // veces cuando dos facturas del mismo lote comparten proveedor.
    if (invoiceItems.length > 0) {
      const { data: proveedoresExistentes } = await supabase.from('proveedores').select('nombre').eq('activo', true);
      const nombresConocidos = new Set((proveedoresExistentes ?? []).map((p) => normalizeName(p.nombre)));

      for (const item of invoiceItems) {
        const key = normalizeName(item.payload.proveedor);
        const proveedorStatus: EntityStatus = nombresConocidos.has(key) ? 'existing' : 'created';
        nombresConocidos.add(key);

        const result = await executeAction('create_egreso', { ...item.payload, comprobantePath: item.comprobantePath }, user.id);

        if (!linesBySummary.has(item.summaryRef)) linesBySummary.set(item.summaryRef, []);
        if (result.ok) {
          const created = result.data as { ref: string } | undefined;
          linesBySummary.get(item.summaryRef)!.push(formatInvoiceLine(item.payload, created?.ref ?? '?', proveedorStatus));
          if (created?.ref) {
            await supabase.from('assistant_documents').update({ used_action_ids: [created.ref] }).eq('id', item.assistantDocId);
          }
        } else {
          linesBySummary.get(item.summaryRef)!.push(`"${item.payload.proveedor}": no se pudo crear (${result.error}).`);
        }
      }
    }

    for (const [summaryRef, lines] of linesBySummary) {
      const skipped = skippedBySummary.get(summaryRef);
      const isGroup = summaryRef.documentType === 'budget_group';
      const header = isGroup ? `"${summaryRef.name}": se cargaron ${lines.length} presupuesto(s):\n- ` : `"${summaryRef.name}": `;
      const tail = skipped ? `\n(${skipped} más no se cargaron por falta de cliente)` : '';
      summaryRef.summary = header + lines.join('\n- ') + tail;
    }

    if (primary) {
      await supabase
        .from('conversations')
        .update({ pending_extraction: primary.data, pending_extraction_type: primary.documentType })
        .eq('id', conversationId);
    }

    const extraNote = files.length > 1 && primary
      ? '\n\n(Vamos de a uno — confirmá o corregí este y seguimos con el resto.)'
      : '';
    const assistantText = summaries.map((s) => s.summary).join('\n') + extraNote;

    await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantText,
    });

    return jsonResponse(
      {
        success: true,
        conversationId,
        message: assistantText,
        pendingAction: !!primary,
        files: summaries.map((s) => ({ name: s.name, size: s.size, documentType: s.documentType, error: s.error })),
      },
      200,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return jsonResponse({ success: false, error: message }, 500);
  }
}
