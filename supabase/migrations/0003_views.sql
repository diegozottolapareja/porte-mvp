-- ─── PORTE — Paso 2: vistas de cálculo (reemplazan calculos.ts) ───────────

create view v_ventas_detalle as
select
  v.*,
  coalesce(i.total_cobrado, 0) as total_cobrado,
  v.venta_final - coalesce(i.total_cobrado, 0) as saldo_pendiente,
  (coalesce(v.mater,0) + coalesce(v.mo,0) + coalesce(v.ind_vend,0)
   + coalesce(v.imp,0) + coalesce(v.comerc,0)) as costo_estimado,
  coalesce(e.total_egresado, 0)
    - (coalesce(v.mater,0) + coalesce(v.mo,0) + coalesce(v.ind_vend,0)
       + coalesce(v.imp,0) + coalesce(v.comerc,0)) as desvio_costo,
  case
    when v.venc_cobro is not null
     and (v.venta_final - coalesce(i.total_cobrado,0)) > 0
     and v.venc_cobro < current_date
    then current_date - v.venc_cobro
    else null
  end as dias_mora
from ventas v
left join (
  select id_obra, sum(monto) as total_cobrado
  from ingresos
  where activo and estado = 'Confirmado'
  group by id_obra
) i on i.id_obra = v.id
left join (
  select id_obra, sum(monto) as total_egresado
  from egresos
  where activo and estado <> 'Pendiente'
  group by id_obra
) e on e.id_obra = v.id;

create view v_proveedores_saldo as
select
  p.*,
  p.saldo_inicial + coalesce(d.deuda_pendiente, 0) as saldo_cc_actual
from proveedores p
left join (
  select proveedor_id, sum(monto) as deuda_pendiente
  from egresos
  where activo and estado = 'Pendiente' and proveedor_id is not null
  group by proveedor_id
) d on d.proveedor_id = p.id_prov;
