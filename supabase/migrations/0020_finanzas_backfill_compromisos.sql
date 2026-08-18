-- ─── PORTE — Paso 20: módulo financiero (3/4) — backfill de compromisos_pago ──
-- Los egresos ya cargados (demo y cualquier fila real anterior a este módulo)
-- no tienen compromiso_pago propio todavía — sin esto, Caja actual/Proyección
-- ignorarían todo el historial. Se deriva un compromiso por egreso activo,
-- interpretando su `estado` actual (no hay otro dato disponible):
--   'Confirmado'  → ya se pagó: PAGADO, fecha_acreditacion = egreso.fecha.
--   'Pendiente'/'Incompleto' → todavía no se pagó: PENDIENTE, vencimiento =
--     egreso.fecha (mejor aproximación disponible, no hay vencimiento real cargado).
--   'Emitido'     → el flag ad-hoc de "cheque" de EgresoFormPage: se migra a
--     una fila real en `cheques` (EMITIDO, sin número/banco — no se cargaban)
--     + compromiso PENDIENTE linkeado, vencimiento = fecha_acreditacion ya
--     cargada (o fecha si faltara).
-- metodo_pago_id queda null en todo el backfill (no hay forma de saber cuál
-- fue) — no lo necesitan get_caja_actual/get_disponible_financiero/
-- get_proyeccion_caja, que solo leen estado/fechas/monto/caja.

insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, fecha_acreditacion, caja_id, estado, created_by)
select ref, monto, fecha, fecha, caja_id, 'PAGADO', created_by
from egresos
where activo and estado = 'Confirmado';

insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, created_by)
select ref, monto, fecha, caja_id, 'PENDIENTE', created_by
from egresos
where activo and estado in ('Pendiente', 'Incompleto');

-- Loop en vez de INSERT...SELECT con RETURNING: necesitamos volver a
-- correlacionar cada cheque nuevo con SU egreso de origen (uno a uno) para
-- crear el compromiso correspondiente, y RETURNING no puede traer de vuelta
-- columnas de `egresos` que no forman parte de la fila insertada en `cheques`.
do $$
declare
  r record;
  v_cheque_id uuid;
begin
  for r in select ref, monto, fecha, fecha_emision, fecha_acreditacion, caja_id, created_by
           from egresos where activo and estado = 'Emitido'
  loop
    insert into cheques (numero, banco, monto, fecha_emision, fecha_vencimiento, caja_id, estado, created_by)
    values (null, null, r.monto, coalesce(r.fecha_emision, r.fecha), coalesce(r.fecha_acreditacion, r.fecha), r.caja_id, 'EMITIDO', r.created_by)
    returning id into v_cheque_id;

    insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, cheque_id, created_by)
    values (r.ref, r.monto, coalesce(r.fecha_acreditacion, r.fecha), r.caja_id, 'PENDIENTE', v_cheque_id, r.created_by);
  end loop;
end $$;
