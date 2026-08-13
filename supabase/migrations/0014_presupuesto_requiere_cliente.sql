-- ─── PORTE — Paso 14: no se puede crear un presupuesto sin cliente existente ──
-- Regla de negocio protegida a nivel de base para que no dependa únicamente
-- del frontend, del endpoint /api/presupuestos o del prompt del asistente —
-- ningún punto de entrada puede saltearla. Solo en INSERT: no afecta updates
-- sobre presupuestos ya existentes.

create or replace function fn_validar_cliente_presupuesto()
returns trigger as $$
begin
  if not exists (
    select 1 from clientes
    where lower(trim(nombre)) = lower(trim(new.cliente)) and activo
  ) then
    raise exception 'CLIENTE_NO_EXISTE: el cliente "%" no existe. Debe crearse antes de crear el presupuesto.', new.cliente;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_validar_cliente_presupuesto
  before insert on presupuestos
  for each row
  execute function fn_validar_cliente_presupuesto();
