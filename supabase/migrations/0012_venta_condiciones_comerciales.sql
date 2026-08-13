-- ─── PORTE — Paso 12: Presupuesto → Venta como flujo de dos pasos ─────────
-- Antes: aceptar un presupuesto (estado_comercial → 'Aceptado') creaba la
-- venta automáticamente vía fn_aceptar_presupuesto, sin condiciones
-- comerciales. Ahora: aceptar solo cambia el estado; la venta se crea recién
-- al "Convertir en venta" desde la UI (ver convertirEnVenta() en store.tsx),
-- con las condiciones comerciales completas.

drop trigger if exists trg_aceptar_presupuesto on presupuestos;
drop function if exists fn_aceptar_presupuesto();

-- Condiciones comerciales obligatorias para crear una venta, sin importar el
-- punto de entrada (UI, futuros integradores) — entrega_real queda afuera a
-- propósito, se completa después desde el detalle de la venta.
-- Trigger BEFORE INSERT (no UPDATE): protege la creación sin afectar updates
-- posteriores sobre ventas ya existentes (ej. cambiar estado operativo).
create or replace function fn_validar_condiciones_comerciales()
returns trigger as $$
begin
  if new.cond_pago is null or trim(new.cond_pago) = ''
     or new.venc_cobro is null
     or new.caja_intenc is null or trim(new.caja_intenc) = ''
     or new.entrega_compr is null
     or new.resp_op is null or trim(new.resp_op) = '' then
    raise exception 'CONDICIONES_COMERCIALES_INCOMPLETAS: faltan condiciones comerciales obligatorias (condición de pago, vencimiento de cobro, caja intención, entrega comprometida, responsable) para crear la venta';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_validar_condiciones_comerciales
  before insert on ventas
  for each row
  execute function fn_validar_condiciones_comerciales();
