-- ─── PORTE — Paso 16: dedupe global de documentos ya cargados ───────────────
-- api/assistant/upload.ts pasa a crear los presupuestos de un documento en el
-- mismo request (sin pasar por confirmación por chat). used_action_ids marca
-- qué presupuestos se crearon a partir de una extracción — si un archivo con
-- el mismo file_hash se vuelve a subir (misma conversación u otra), se avisa
-- que ya fue cargado en vez de reprocesarlo o duplicar el presupuesto.

alter table assistant_documents
  add column used_action_ids jsonb;

-- El dedupe pasa a ser global (no por conversación): resubir el mismo archivo
-- en otra conversación también tiene que encontrar la extracción ya usada.
drop index if exists assistant_documents_file_hash_idx;
create index assistant_documents_file_hash_idx on assistant_documents (file_hash, created_at desc);
