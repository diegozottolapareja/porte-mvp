-- ─── PORTE — Paso 1: esquema base ──────────────────────────────────────────
-- Nombres de columna en snake_case, montos como numeric(14,2), fechas como
-- date, timestamps como timestamptz. Una tabla por entidad del Excel original.

-- ─── Perfiles y roles ──────────────────────────────────────────────────────
create type app_role as enum ('admin', 'data_entry');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  role app_role not null default 'data_entry',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Listas maestras (00_CONFIG) ──────────────────────────────────────────
create table config_lists (
  clave text primary key,
  valores text[] not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- ─── 05_PROVEEDORES ─────────────────────────────────────────────────────────
-- Se crea antes de presupuestos/ventas/egresos/gastos_fijos porque esas la referencian.
create table proveedores (
  id_prov text primary key,
  nombre text not null,
  rubro text,
  contacto text,
  telefono text,
  condicion_habitual text,
  plazo_dias integer,
  cuenta_banco text,
  tipo_caja text,
  saldo_inicial numeric(14,2) not null default 0,
  fecha_saldo_inicial date,
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 01_PRESUPUESTOS ───────────────────────────────────────────────────────
create table presupuestos (
  id text primary key,
  id_num integer,
  fecha date not null,
  cliente text not null,
  descripcion text,
  categoria text,
  responsable text,
  costo_mat numeric(14,2),
  costo_mo numeric(14,2),
  ind_vendidos numeric(14,2),
  impuestos numeric(14,2),
  comercial numeric(14,2),
  beneficio numeric(14,2),
  monto_total numeric(14,2) generated always as (
    coalesce(costo_mat,0) + coalesce(costo_mo,0) + coalesce(ind_vendidos,0)
    + coalesce(impuestos,0) + coalesce(comercial,0) + coalesce(beneficio,0)
  ) stored,
  estado_comercial text not null default 'En presupuestación',
  vencimiento date,
  observaciones text,
  enviado boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 02_VENTAS ──────────────────────────────────────────────────────────────
create table ventas (
  id text primary key references presupuestos(id),
  cliente text not null,
  monto_total numeric(14,2) not null,
  mater numeric(14,2), mo numeric(14,2), ind_vend numeric(14,2),
  imp numeric(14,2), comerc numeric(14,2), benef numeric(14,2),
  fecha_cierre timestamptz not null,
  cond_pago text,
  dias integer,
  venc_cobro date,
  caja_intenc text,
  venta_final numeric(14,2) not null,
  motivo_dif text,
  entrega_compr date,
  entrega_real date,
  estado_op text not null default 'Pendiente',
  resp_op text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 03_INGRESOS ────────────────────────────────────────────────────────────
create table ingresos (
  ref text primary key,
  fecha date not null,
  tipo_ingreso text not null,
  id_obra text references ventas(id),
  concepto text,
  monto numeric(14,2) not null,
  cuenta text,
  caja text,
  estado text not null default 'Confirmado',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 04_EGRESOS ─────────────────────────────────────────────────────────────
create table egresos (
  ref text primary key,
  fecha date not null,
  tipo_egreso text not null,
  id_obra text references ventas(id),
  proveedor_id text references proveedores(id_prov),
  categoria text not null,
  monto numeric(14,2) not null,
  cuenta text,
  caja text,
  estado text not null default 'Confirmado',
  fecha_emision date,
  fecha_acreditacion date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 06_GASTOS_FIJOS ────────────────────────────────────────────────────────
-- estado: PREVISTO | PAGADO | VENCIDO — coincide con el frontend actual
-- (data/gastosFijos.ts), no con PREVISTO|PAGADO|ANULADO del spec original.
create table gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  concepto text not null,
  categoria text,
  monto_previsto numeric(14,2),
  monto_real numeric(14,2),
  periodicidad text,
  cuenta text,
  tipo_caja text,
  proveedor_id text references proveedores(id_prov),
  estado text not null default 'PREVISTO',
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 07_VARIACIONES ─────────────────────────────────────────────────────────
create table variaciones (
  id_var text primary key,
  fecha date not null,
  id_pres text references presupuestos(id),
  cliente text,
  tipo_var text,
  descripcion text,
  valor_anterior text,
  valor_nuevo text,
  impacto numeric(14,2),
  canal text,
  presup_nuevo text references presupuestos(id),
  registrado_por text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ─── 08_APRENDIZAJES ────────────────────────────────────────────────────────
create table aprendizajes (
  id_apr text primary key,
  fecha_cierre date not null,
  id_pres text references presupuestos(id),
  cliente text,
  categoria text,
  que_salio_bien text,
  que_salio_mal text,
  causa_desvio text,
  haria_diferente text,
  aplica_a_futuras boolean default false,
  registrado_por text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
