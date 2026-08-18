-- ─── PORTE — Paso 18: módulo financiero (1/4) — cajas y métodos de cobro/pago ──
-- Hasta ahora `cuenta` (texto libre: "Banco Macro", "MercadoPago", ...) y
-- `caja` (BLANCA/NEGRA) en ingresos/egresos/gastos_fijos eran solo etiquetas,
-- sin una entidad real con saldo. `cajas` la agrega sin romper esas columnas:
-- se seedea 1:1 desde los valores de CONFIG_LISTS.CUENTAS ya en uso y se suma
-- `caja_id` como FK nueva y nullable — `cuenta`/`caja` de texto siguen
-- funcionando igual que hoy para toda la UI existente.

-- ─── cajas ──────────────────────────────────────────────────────────────────
create table cajas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo_caja text not null,
  saldo_inicial numeric(14,2) not null default 0,
  fecha_saldo_inicial date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table cajas enable row level security;
create policy "lectura_autenticados" on cajas for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on cajas for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on cajas for update
  using (auth_role() in ('admin', 'data_entry'));

-- Sin saldo inicial cargado (no hay dato real de arranque): 0 y fecha_saldo_inicial
-- en null, así get_caja_actual (paso 4) no le pone un piso arbitrario.
insert into cajas (nombre, tipo_caja) values
  ('Banco Macro',     'BLANCA'),
  ('MercadoPago',      'BLANCA'),
  ('Efectivo Blanco',  'BLANCA'),
  ('Efectivo Negro',   'NEGRA');

-- ─── caja_id en las tablas existentes que hoy solo tienen `cuenta` texto ────
alter table ingresos add column caja_id uuid references cajas(id);
alter table egresos add column caja_id uuid references cajas(id);
alter table gastos_fijos add column caja_id uuid references cajas(id);

update ingresos i set caja_id = c.id from cajas c where c.nombre = i.cuenta;
update egresos e set caja_id = c.id from cajas c where c.nombre = e.cuenta;
update gastos_fijos g set caja_id = c.id from cajas c where c.nombre = g.cuenta;

-- ─── fechas financieras de ingresos: fecha_operacion ya existe como `fecha` ──
-- (no se renombra para no romper nada existente) — se agrega el resto.
alter table ingresos
  add column metodo_cobro_id uuid,
  add column fecha_acreditacion date;

-- ─── metodos_cobro ──────────────────────────────────────────────────────────
create table metodos_cobro (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  dias_acreditacion integer not null default 0,
  comision_porcentaje numeric(5,4) not null default 0,
  caja_id uuid references cajas(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table ingresos
  add constraint ingresos_metodo_cobro_id_fkey foreign key (metodo_cobro_id) references metodos_cobro(id);

alter table metodos_cobro enable row level security;
create policy "lectura_autenticados" on metodos_cobro for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on metodos_cobro for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on metodos_cobro for update
  using (auth_role() in ('admin', 'data_entry'));

-- Un método de cobro por caja existente — mismo criterio que `cuenta` hoy.
-- dias_acreditacion=0 y comision=0: no se inventan valores de negocio
-- reales (ej. "MercadoPago 4 días / 6%" del pedido es solo ilustrativo);
-- el cliente los ajusta desde Configuración.
insert into metodos_cobro (nombre, dias_acreditacion, comision_porcentaje, caja_id)
  select nombre, 0, 0, id from cajas;

-- ─── metodos_pago ───────────────────────────────────────────────────────────
create type metodo_pago_tipo as enum ('INMEDIATO', 'CHEQUE', 'CUENTA_CORRIENTE', 'TARJETA_CREDITO');

create table metodos_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo metodo_pago_tipo not null,
  caja_id uuid references cajas(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table metodos_pago enable row level security;
create policy "lectura_autenticados" on metodos_pago for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on metodos_pago for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on metodos_pago for update
  using (auth_role() in ('admin', 'data_entry'));

-- caja_id es solo la sugerencia por defecto al elegir el método en el form
-- de egreso — el compromiso_pago generado siempre permite elegir otra caja.
insert into metodos_pago (nombre, tipo, caja_id) values
  ('Transferencia',    'INMEDIATO',        (select id from cajas where nombre = 'Banco Macro')),
  ('Efectivo',          'INMEDIATO',        (select id from cajas where nombre = 'Efectivo Blanco')),
  ('Cheque',            'CHEQUE',           (select id from cajas where nombre = 'Banco Macro')),
  ('Cuenta corriente',  'CUENTA_CORRIENTE', null),
  ('Tarjeta',           'TARJETA_CREDITO',  null);
