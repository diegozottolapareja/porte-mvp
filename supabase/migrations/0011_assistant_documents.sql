-- ─── PORTE — Paso 11: carga e interpretación de archivos en el chat ─────────
-- Extiende el asistente (0010) para aceptar adjuntos (PDF/JPG/PNG). El
-- Document Processing Service clasifica y extrae datos, pero nunca ejecuta
-- nada directo: el resultado normalizado queda en `pending_extraction` hasta
-- que el usuario confirma por texto o voz, y ahí el Action Executor lo
-- ejecuta como cualquier otra acción del chat. No se persisten los archivos
-- originales — solo metadata y el resultado estructurado, para auditoría.

alter table conversations
  add column pending_extraction jsonb,
  add column pending_extraction_type text;

create table assistant_documents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid references conversation_messages(id) on delete set null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  file_hash text not null,
  document_type text,
  confidence numeric(3, 2),
  data jsonb,
  validation_errors jsonb,
  action_name text,
  action_result jsonb,
  error text,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now()
);

create index assistant_documents_conversation_id_idx on assistant_documents (conversation_id, created_at);
-- Dedup: mismo archivo re-subido en la misma conversación reusa la extracción ya hecha.
create index assistant_documents_file_hash_idx on assistant_documents (conversation_id, file_hash);

alter table assistant_documents enable row level security;

-- Mismo criterio que conversation_messages: solo el backend (service role)
-- escribe, la PWA únicamente lee los documentos de sus propias conversaciones.
create policy "lectura_propios_documentos" on assistant_documents for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id and (c.user_id = auth.uid() or auth_role() = 'admin')
    )
  );
