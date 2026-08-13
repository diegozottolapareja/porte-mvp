import { createAdminClient, authenticateRequest } from '../_lib/supabaseAdmin.js';
import { processDocument } from '../_lib/documentProcessingService.js';
import { validateExpense, validateIncome, validateBudget, validateBudgetGroup, type PresupuestoPayload } from '../_lib/documentValidation.js';
import type { DocumentExtractionEnvelope, ExtractedDocumentData } from '../_lib/documentSchemas.js';

export const config = { runtime: 'edge' };

// Runtime edge, igual que el resto de api/* — el handler recibe un Request/
// Response de verdad (Web API). Con el runtime Node.js por defecto, el
// handler(request: Request) de acá NUNCA recibió un Request real (Vercel
// pasa su propio req con helpers de Node, sin .headers.get) — eso rompía
// la autenticación en producción con "request.headers.get is not a
// function", enmascarado antes por el bug de resolución de módulos ESM.
//
// Nunca ejecuta ninguna acción acá: clasifica, extrae, valida y deja el
// resultado en `conversations.pending_extraction`. La confirmación por texto
// o voz (api/assistant/message.ts) es la que dispara el Action Executor.

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

function summarizeExpense(fileName: string, data: ExtractedDocumentData): { text: string; ready: boolean } {
  const validation = validateExpense(data);
  if (!validation.ok) {
    return { text: `"${fileName}": parece un egreso, pero faltan datos: ${validation.missingFields.join(', ')}. ¿Me los pasás?`, ready: false };
  }
  const p = validation.payload!;
  const warn = validation.warnings.length > 0 ? ` (ojo: ${validation.warnings.join('; ')})` : '';
  return {
    text: `"${fileName}": encontré un egreso de $${p.monto.toLocaleString('es-AR')} a ${p.proveedor} (${p.categoria})${warn}. Me falta la cuenta y la caja para cargarlo — ¿cuáles uso? Decime y confirmo.`,
    ready: true,
  };
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

function summarizeBudget(fileName: string, data: ExtractedDocumentData): { text: string; ready: boolean; payload?: PresupuestoPayload } {
  const validation = validateBudget(data);
  if (!validation.ok) {
    return { text: `"${fileName}": no pude identificar el cliente en el documento — ese dato no lo puedo inventar, ¿me decís para quién es este presupuesto?`, ready: false };
  }
  const p = validation.payload!;
  const total = p.costoMat + p.costoMo + (p.indVendidos ?? 0) + (p.impuestos ?? 0) + (p.comercial ?? 0) + (p.beneficio ?? 0);
  const incompleteNote = p.estadoComercial === 'Incompleto'
    ? ` — ojo: ${validation.warnings.join('; ')}. Lo voy a marcar "Incompleto" para que lo revises después`
    : '';
  return {
    text: `"${fileName}": encontré un presupuesto para ${p.cliente} (${p.categoria}) por $${total.toLocaleString('es-AR')}${incompleteNote}. ¿Lo cargo?`,
    ready: true,
    payload: p,
  };
}

function summarizeBudgetGroup(fileName: string, documents: ExtractedDocumentData[]): { text: string; ready: boolean; payload?: PresupuestoPayload[] } {
  const validation = validateBudgetGroup(documents);
  if (!validation.ok) {
    return { text: `"${fileName}": encontré varios presupuestos, pero a algunos no les pude identificar el cliente: ${validation.missingFields.join(' / ')}. ¿Los revisamos?`, ready: false };
  }
  const payload = validation.payload!;
  const total = payload.reduce((acc, p) => acc + p.costoMat + p.costoMo + (p.indVendidos ?? 0) + (p.impuestos ?? 0) + (p.comercial ?? 0) + (p.beneficio ?? 0), 0);
  const incompletos = payload.filter((p) => p.estadoComercial === 'Incompleto').length;
  const incompleteNote = incompletos > 0 ? ` (${incompletos} con datos que faltaban en el documento — quedan marcados "Incompleto" para revisar después)` : '';
  return {
    text: `"${fileName}": encontré ${payload.length} presupuestos por un total de $${total.toLocaleString('es-AR')}${incompleteNote}. ¿Los importo todos?`,
    ready: true,
    payload,
  };
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
        const { data: cached } = await supabase
          .from('assistant_documents')
          .select('document_type, data, confidence')
          .eq('conversation_id', conversationId)
          .eq('file_hash', fileHash)
          .not('document_type', 'is', null)
          .limit(1)
          .maybeSingle();

        let envelope: DocumentExtractionEnvelope;
        let usage = { promptTokens: 0, completionTokens: 0 };

        if (cached) {
          envelope = { documentType: cached.document_type, confidence: cached.confidence ?? 0, data: (cached.data as { data?: ExtractedDocumentData })?.data ?? null, documents: (cached.data as { documents?: ExtractedDocumentData[] })?.documents ?? null };
        } else {
          const processed = await processDocument({ name, mimeType: file.type, bytes });
          envelope = processed.envelope;
          usage = processed.usage;
        }

        let summaryLine: string;
        let ready = false;
        // Para budget/budget_group, lo que va a pending_extraction es el payload ya
        // validado y con defaults aplicados (validateBudget/validateBudgetGroup) —
        // no el envelope crudo — así el modelo solo repite esos campos tal cual al
        // llamar a la tool, sin tener que recalcular defaults por su cuenta.
        let pendingData: unknown = envelope.documentType === 'budget_group' ? envelope.documents : envelope.data;

        if (envelope.documentType === 'expense' && envelope.data) {
          ({ text: summaryLine, ready } = summarizeExpense(name, envelope.data));
        } else if (envelope.documentType === 'income' && envelope.data) {
          ({ text: summaryLine, ready } = summarizeIncome(name, envelope.data));
        } else if (envelope.documentType === 'budget' && envelope.data) {
          const result = summarizeBudget(name, envelope.data);
          summaryLine = result.text;
          ready = result.ready;
          if (result.payload) pendingData = result.payload;
        } else if (envelope.documentType === 'budget_group' && envelope.documents) {
          const result = summarizeBudgetGroup(name, envelope.documents);
          summaryLine = result.text;
          ready = result.ready;
          if (result.payload) pendingData = result.payload;
        } else {
          summaryLine = `"${name}": no pude identificar con seguridad qué tipo de documento es (confianza ${Math.round((envelope.confidence ?? 0) * 100)}%). ¿Es un egreso, un ingreso o un presupuesto?`;
        }

        summaries.push({ name, size: file.size, documentType: envelope.documentType, confidence: envelope.confidence, summary: summaryLine });

        if (!primary && envelope.documentType !== 'unknown') {
          primary = { documentType: envelope.documentType, data: pendingData, ready };
        }

        await supabase.from('assistant_documents').insert({
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
        });
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
