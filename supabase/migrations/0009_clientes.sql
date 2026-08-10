-- ─── PORTE — Paso 9: maestro de Clientes ───────────────────────────────────
-- No existía en el esquema original (00-08 del Excel) — lo agrega la fase de
-- comparación contra el diseño. `ventas.cliente`/`presupuestos.cliente` siguen
-- siendo texto libre: esta tabla es un maestro independiente, todavía sin FK
-- desde ventas/presupuestos (ver nota en ClienteDetailPage sobre matching por nombre).

create table clientes (
  id_cli text primary key,
  nombre text not null,
  contacto text,
  telefono text,
  direccion text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table clientes enable row level security;

create policy "lectura_autenticados" on clientes for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on clientes for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on clientes for update
  using (auth_role() in ('admin', 'data_entry'));
