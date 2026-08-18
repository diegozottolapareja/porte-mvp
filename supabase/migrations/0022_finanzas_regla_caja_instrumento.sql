-- ─── PORTE — Paso 22: regla de negocio caja Negra/Blanca vs instrumento ────
-- Caja Negra (efectivo no declarado) solo admite instrumentos INMEDIATO
-- (efectivo/transferencia) — cheque, cuenta corriente y tarjeta de crédito
-- dejan rastro formal y solo pueden imputarse a una caja Blanca. La regla se
-- aplica acá (trigger) para que alcance a cualquier camino de escritura —
-- formulario, asistente de IA, o el UPDATE que hace fn_marcar_compromiso_pagado
-- al saldar un compromiso — y además se refleja en los formularios ocultando
-- las combinaciones inválidas (no se duplica la regla en dos lados).

-- ─── metodos_cobro gana `tipo`, igual que metodos_pago ─────────────────────
-- Hoy todo método de cobro existente es equivalente a INMEDIATO (el ingreso
-- ya está en caja al cargarse) — se deja el campo para cuando exista un
-- método de cobro no inmediato (ej. cheque de cliente).
alter table metodos_cobro add column tipo metodo_pago_tipo not null default 'INMEDIATO';

-- ─── gastos_fijos gana método de pago opcional ──────────────────────────────
alter table gastos_fijos add column metodo_pago_id uuid references metodos_pago(id);

-- ─── regla central: caja Negra + instrumento no inmediato = inválido ───────
create or replace function fn_validar_instrumento_caja(p_caja_id uuid, p_tipo metodo_pago_tipo)
returns void
language plpgsql
as $$
declare
  v_tipo_caja text;
begin
  if p_caja_id is null or p_tipo is null then return; end if;
  select tipo_caja into v_tipo_caja from cajas where id = p_caja_id;
  if v_tipo_caja = 'NEGRA' and p_tipo <> 'INMEDIATO' then
    raise exception 'CAJA_NEGRA_INSTRUMENTO_INVALIDO: la caja % es Negra y solo admite instrumentos INMEDIATO (efectivo/transferencia); % requiere caja Blanca', p_caja_id, p_tipo;
  end if;
end;
$$;

create or replace function trg_compromisos_pago_check_caja() returns trigger language plpgsql as $$
declare v_tipo metodo_pago_tipo;
begin
  select tipo into v_tipo from metodos_pago where id = new.metodo_pago_id;
  perform fn_validar_instrumento_caja(new.caja_id, v_tipo);
  return new;
end;
$$;
drop trigger if exists trg_compromisos_pago_caja on compromisos_pago;
create trigger trg_compromisos_pago_caja before insert or update on compromisos_pago
for each row execute function trg_compromisos_pago_check_caja();

create or replace function trg_cheques_check_caja() returns trigger language plpgsql as $$
begin
  perform fn_validar_instrumento_caja(new.caja_id, 'CHEQUE'::metodo_pago_tipo);
  return new;
end;
$$;
drop trigger if exists trg_cheques_caja on cheques;
create trigger trg_cheques_caja before insert or update on cheques
for each row execute function trg_cheques_check_caja();

create or replace function trg_tarjetas_check_caja() returns trigger language plpgsql as $$
begin
  perform fn_validar_instrumento_caja(new.caja_debito_id, 'TARJETA_CREDITO'::metodo_pago_tipo);
  return new;
end;
$$;
drop trigger if exists trg_tarjetas_caja on tarjetas_credito;
create trigger trg_tarjetas_caja before insert or update on tarjetas_credito
for each row execute function trg_tarjetas_check_caja();

create or replace function trg_gastos_fijos_check_caja() returns trigger language plpgsql as $$
declare v_tipo metodo_pago_tipo;
begin
  if new.metodo_pago_id is null then return new; end if;
  select tipo into v_tipo from metodos_pago where id = new.metodo_pago_id;
  perform fn_validar_instrumento_caja(new.caja_id, v_tipo);
  return new;
end;
$$;
drop trigger if exists trg_gastos_fijos_caja on gastos_fijos;
create trigger trg_gastos_fijos_caja before insert or update on gastos_fijos
for each row execute function trg_gastos_fijos_check_caja();

create or replace function trg_ingresos_check_caja() returns trigger language plpgsql as $$
declare v_tipo metodo_pago_tipo;
begin
  if new.metodo_cobro_id is null then return new; end if;
  select tipo into v_tipo from metodos_cobro where id = new.metodo_cobro_id;
  perform fn_validar_instrumento_caja(new.caja_id, v_tipo);
  return new;
end;
$$;
drop trigger if exists trg_ingresos_caja on ingresos;
create trigger trg_ingresos_caja before insert or update on ingresos
for each row execute function trg_ingresos_check_caja();

-- ─── proteger también la configuración de métodos (pantalla Config) ────────
create or replace function trg_metodos_pago_check_caja() returns trigger language plpgsql as $$
begin
  perform fn_validar_instrumento_caja(new.caja_id, new.tipo);
  return new;
end;
$$;
drop trigger if exists trg_metodos_pago_caja on metodos_pago;
create trigger trg_metodos_pago_caja before insert or update on metodos_pago
for each row execute function trg_metodos_pago_check_caja();

create or replace function trg_metodos_cobro_check_caja() returns trigger language plpgsql as $$
begin
  perform fn_validar_instrumento_caja(new.caja_id, new.tipo);
  return new;
end;
$$;
drop trigger if exists trg_metodos_cobro_caja on metodos_cobro;
create trigger trg_metodos_cobro_caja before insert or update on metodos_cobro
for each row execute function trg_metodos_cobro_check_caja();
