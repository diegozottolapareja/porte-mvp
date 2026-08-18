-- ─── PORTE — Paso 19: módulo financiero (2/4) — cheques, tarjetas y compromisos_pago ──
-- Un egreso sigue siendo el gasto/obligación (no se toca su semántica). Lo que
-- faltaba es el evento financiero real: cuándo y cómo esa plata efectivamente
-- sale de una caja. compromisos_pago es ese evento — un egreso puede tener
-- 1..N (ej. compra dividida en transferencia + cheque + cuenta corriente).

-- ─── cheques ────────────────────────────────────────────────────────────────
-- Reemplaza el flag ad-hoc egresos.estado='Emitido' + fechaEmision/
-- fechaAcreditacion que usa hoy el checkbox "Es un cheque" de EgresoFormPage.
create type cheque_estado as enum ('EMITIDO', 'ENTREGADO', 'DEBITADO', 'RECHAZADO', 'ANULADO');

create table cheques (
  id uuid primary key default gen_random_uuid(),
  numero text,
  banco text,
  monto numeric(14,2) not null,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  fecha_acreditacion date,
  caja_id uuid references cajas(id),
  estado cheque_estado not null default 'EMITIDO',
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table cheques enable row level security;
create policy "lectura_autenticados" on cheques for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on cheques for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on cheques for update
  using (auth_role() in ('admin', 'data_entry'));

-- ─── tarjetas_credito / resumenes_tarjeta ───────────────────────────────────
-- Sin datos seed: no hay tarjeta cargada hoy en Porte. Cada cuota de una
-- compra con tarjeta es un compromiso_pago propio, agrupado por resumen
-- (mismo período de cierre) para poder pagar el resumen completo de una vez.
create table tarjetas_credito (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  banco text,
  caja_debito_id uuid references cajas(id),
  dia_cierre integer not null check (dia_cierre between 1 and 28),
  dia_vencimiento integer not null check (dia_vencimiento between 1 and 28),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table tarjetas_credito enable row level security;
create policy "lectura_autenticados" on tarjetas_credito for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on tarjetas_credito for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on tarjetas_credito for update
  using (auth_role() in ('admin', 'data_entry'));

create type resumen_tarjeta_estado as enum ('PENDIENTE', 'PAGADO');

create table resumenes_tarjeta (
  id uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references tarjetas_credito(id),
  periodo text not null,
  fecha_cierre date not null,
  fecha_vencimiento date not null,
  monto numeric(14,2) not null default 0,
  estado resumen_tarjeta_estado not null default 'PENDIENTE',
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (tarjeta_id, periodo)
);

alter table resumenes_tarjeta enable row level security;
create policy "lectura_autenticados" on resumenes_tarjeta for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on resumenes_tarjeta for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on resumenes_tarjeta for update
  using (auth_role() in ('admin', 'data_entry'));

-- ─── compromisos_pago ───────────────────────────────────────────────────────
create type compromiso_estado as enum ('PENDIENTE', 'PAGADO', 'CANCELADO');

create table compromisos_pago (
  id uuid primary key default gen_random_uuid(),
  egreso_id text references egresos(ref),
  monto numeric(14,2) not null,
  metodo_pago_id uuid references metodos_pago(id),
  fecha_vencimiento date not null,
  fecha_acreditacion date,
  caja_id uuid references cajas(id),
  estado compromiso_estado not null default 'PENDIENTE',
  cheque_id uuid references cheques(id),
  tarjeta_id uuid references tarjetas_credito(id),
  resumen_tarjeta_id uuid references resumenes_tarjeta(id),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create index compromisos_pago_egreso_id_idx on compromisos_pago (egreso_id);
create index compromisos_pago_fecha_vencimiento_idx on compromisos_pago (fecha_vencimiento) where estado = 'PENDIENTE';
create index compromisos_pago_fecha_acreditacion_idx on compromisos_pago (fecha_acreditacion) where estado = 'PAGADO';

alter table compromisos_pago enable row level security;
create policy "lectura_autenticados" on compromisos_pago for select
  using (auth_role() in ('admin', 'data_entry'));
create policy "escritura_autenticados" on compromisos_pago for insert
  with check (auth_role() in ('admin', 'data_entry'));
create policy "actualizacion_autenticados" on compromisos_pago for update
  using (auth_role() in ('admin', 'data_entry'));

-- ─── fn_marcar_compromiso_pagado: única vía que mueve caja real ────────────
-- Marcar pagado un compromiso PENDIENTE (cheque debitado, cuenta corriente
-- saldada, resumen de tarjeta pagado) vive acá — una sola función, no
-- duplicada en el frontend — y cascadea al cheque/resumen relacionado.
create or replace function fn_marcar_compromiso_pagado(
  p_compromiso_id uuid,
  p_fecha date default current_date,
  p_caja_id uuid default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_cheque_id uuid;
  v_resumen_id uuid;
begin
  update compromisos_pago
    set estado = 'PAGADO',
        fecha_acreditacion = p_fecha,
        caja_id = coalesce(p_caja_id, caja_id),
        updated_at = now()
  where id = p_compromiso_id and estado = 'PENDIENTE'
  returning cheque_id, resumen_tarjeta_id into v_cheque_id, v_resumen_id;

  if not found then
    raise exception 'COMPROMISO_NO_PENDIENTE: el compromiso % no existe o ya no está pendiente', p_compromiso_id;
  end if;

  if v_cheque_id is not null then
    update cheques set estado = 'DEBITADO', fecha_acreditacion = p_fecha, updated_at = now()
    where id = v_cheque_id;
  end if;

  if v_resumen_id is not null then
    update resumenes_tarjeta set estado = 'PAGADO', updated_at = now() where id = v_resumen_id;
    update compromisos_pago
      set estado = 'PAGADO', fecha_acreditacion = p_fecha, updated_at = now()
      where resumen_tarjeta_id = v_resumen_id and estado = 'PENDIENTE';
  end if;
end;
$$;
