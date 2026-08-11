-- ─── PORTE — Paso 10: chat del asistente ────────────────────────────────────
-- Reemplaza el flujo Telegram + n8n: la PWA habla directo con el asistente
-- (texto o voz transcripta) y este ejecuta acciones (ej. crear presupuesto)
-- a través del Action Executor del backend. No se persiste el audio, solo el
-- texto (escrito o transcripto).

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text,
  transcribed boolean not null default false,
  action_name text,
  action_params jsonb,
  action_result jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index conversation_messages_conversation_id_idx on conversation_messages (conversation_id, created_at);

alter table conversations enable row level security;
alter table conversation_messages enable row level security;

-- auth_role() ya existe (definida en 0005_rls.sql).

create policy "lectura_propias_conversaciones" on conversations for select
  using (user_id = auth.uid() or auth_role() = 'admin');
create policy "escritura_propias_conversaciones" on conversations for insert
  with check (user_id = auth.uid());

-- Los mensajes solo los escribe el backend (service role, bypassea RLS) —
-- la PWA únicamente los lee para mostrar el historial de su propia conversación.
create policy "lectura_propios_mensajes" on conversation_messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id and (c.user_id = auth.uid() or auth_role() = 'admin')
    )
  );
