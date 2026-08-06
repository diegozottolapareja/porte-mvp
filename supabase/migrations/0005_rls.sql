-- ─── PORTE — Paso 4: Row Level Security ────────────────────────────────────
-- Lectura: admin y data_entry en todas las tablas de negocio.
-- Escritura (insert/update): admin y data_entry en las 8 entidades del Excel.
-- config_lists: todos leen, solo admin escribe.
-- Sin policy de DELETE en ninguna tabla — el borrado siempre es UPDATE activo=false.

alter table presupuestos enable row level security;
alter table ventas enable row level security;
alter table ingresos enable row level security;
alter table egresos enable row level security;
alter table proveedores enable row level security;
alter table gastos_fijos enable row level security;
alter table variaciones enable row level security;
alter table aprendizajes enable row level security;
alter table config_lists enable row level security;

create or replace function auth_role() returns app_role as $$
  select role from profiles where id = auth.uid()
$$ language sql stable security definer;

-- ── presupuestos ──
create policy "lectura_autenticados" on presupuestos for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on presupuestos for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on presupuestos for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── ventas ──
create policy "lectura_autenticados" on ventas for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on ventas for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on ventas for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── ingresos ──
create policy "lectura_autenticados" on ingresos for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on ingresos for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on ingresos for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── egresos ──
create policy "lectura_autenticados" on egresos for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on egresos for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on egresos for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── proveedores ──
create policy "lectura_autenticados" on proveedores for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on proveedores for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on proveedores for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── gastos_fijos ──
create policy "lectura_autenticados" on gastos_fijos for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on gastos_fijos for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on gastos_fijos for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── variaciones ──
create policy "lectura_autenticados" on variaciones for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on variaciones for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on variaciones for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── aprendizajes ──
create policy "lectura_autenticados" on aprendizajes for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on aprendizajes for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on aprendizajes for update
  using (auth_role() in ('admin', 'data_entry'));

-- ── config_lists ──
create policy "config_lectura" on config_lists for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "config_escritura_admin" on config_lists for insert
  with check (auth_role() = 'admin');
create policy "config_actualizacion_admin" on config_lists for update
  using (auth_role() = 'admin');
