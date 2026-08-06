-- ─── PORTE — Paso 3: trigger de transición Presupuesto → Venta ────────────
-- Equivalente al onEdit() del sistema original / procesarAceptacionPresupuesto()
-- del frontend, pero corriendo en la base — no bypasseable desde el cliente.

create or replace function fn_aceptar_presupuesto()
returns trigger as $$
begin
  if new.estado_comercial = 'Aceptado'
     and (old.estado_comercial is distinct from 'Aceptado') then

    if new.cliente is null or trim(new.cliente) = ''
       or new.monto_total is null or new.monto_total <= 0 then
      raise exception 'No se puede aceptar un presupuesto sin cliente o sin monto cargado';
    end if;

    insert into ventas (
      id, cliente, monto_total, mater, mo, ind_vend, imp, comerc, benef,
      fecha_cierre, venta_final, estado_op, created_by
    )
    values (
      new.id, new.cliente, new.monto_total,
      new.costo_mat, new.costo_mo, new.ind_vendidos, new.impuestos, new.comercial, new.beneficio,
      now(), new.monto_total, 'Pendiente', new.created_by
    )
    on conflict (id) do nothing;

  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_aceptar_presupuesto
  after update on presupuestos
  for each row
  execute function fn_aceptar_presupuesto();
