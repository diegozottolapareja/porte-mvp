-- ─── PORTE — Paso 24: cheques centralizados (2/2) — validación, RPC y reglas de caja ──
-- Continúa 0023 (que solo agregó columnas/valores de enum, en archivo aparte
-- por la restricción de Postgres de no poder usar un valor de enum recién
-- agregado en la misma transacción). Acá va todo lo que efectivamente usa
-- los estados nuevos: el CHECK que ata dirección↔estado, el RPC que avanza
-- el estado de un cheque de Ingreso/Gasto Fijo, y el ajuste a las 5 RPC de
-- caja/proyección para que un cheque pendiente nunca impacte caja real antes
-- de tiempo pero sí aparezca proyectado a su fecha de vencimiento — mismo
-- criterio que ya aplican los compromisos_pago PENDIENTE de Egresos.

-- ─── integridad: cada dirección solo admite su propia cadena de estados ────
alter table cheques add constraint cheques_direccion_estado_check check (
  (direccion = 'PAGO' and estado in ('EMITIDO', 'ENTREGADO', 'DEBITADO', 'RECHAZADO', 'ANULADO'))
  or
  (direccion = 'COBRO' and estado in ('EN_CARTERA', 'DEPOSITADO', 'ACREDITADO', 'RECHAZADO', 'ANULADO'))
);

-- ─── fn_marcar_cheque_estado: única vía que avanza un cheque de Ingreso/Gasto Fijo ──
-- Espejo de fn_marcar_compromiso_pagado (0019) para los dos orígenes que no
-- pasan por compromisos_pago. Egresos sigue usando fn_marcar_compromiso_pagado
-- sin cambios — este RPC nunca toca compromisos_pago. Al llegar a un estado
-- terminal que mueve caja (ACREDITADO en un cobro, DEBITADO en un pago)
-- cascadea la fecha real al origen enlazado; RECHAZADO/ANULADO/intermedios
-- solo actualizan el cheque.
create or replace function fn_marcar_cheque_estado(
  p_cheque_id uuid,
  p_nuevo_estado cheque_estado,
  p_fecha date default current_date,
  p_caja_id uuid default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_estado_actual cheque_estado;
begin
  select estado into v_estado_actual from cheques where id = p_cheque_id;
  if not found then
    raise exception 'CHEQUE_NO_ENCONTRADO: no existe el cheque %', p_cheque_id;
  end if;
  if v_estado_actual in ('DEBITADO', 'ACREDITADO', 'RECHAZADO', 'ANULADO') then
    raise exception 'CHEQUE_ESTADO_TERMINAL: el cheque % ya está en estado terminal (%)', p_cheque_id, v_estado_actual;
  end if;

  update cheques
    set estado = p_nuevo_estado,
        fecha_acreditacion = case when p_nuevo_estado in ('DEBITADO', 'ACREDITADO') then p_fecha else fecha_acreditacion end,
        caja_id = coalesce(p_caja_id, caja_id),
        updated_at = now()
  where id = p_cheque_id;

  if p_nuevo_estado = 'ACREDITADO' then
    update ingresos set fecha_acreditacion = p_fecha, caja_id = coalesce(p_caja_id, caja_id), updated_at = now()
    where cheque_id = p_cheque_id;
  elsif p_nuevo_estado = 'DEBITADO' then
    update gastos_fijos set fecha_pago_efectivo = p_fecha, caja_id = coalesce(p_caja_id, caja_id), updated_at = now()
    where cheque_id = p_cheque_id;
  end if;
end;
$$;

-- ─── get_caja_actual: agrega el fallback de ingresos/gastos con cheque ─────
-- Antes: un ingreso 'Confirmado' sin fecha_acreditacion caía en `fecha`
-- (pensado para datos legacy pre-método de cobro). Un ingreso con
-- metodo_cobro_id (incluye cheque) siempre debe traer su propia
-- fecha_acreditacion — si no la tiene todavía (cheque en cartera/depositado)
-- no debe contar como caja real. Mismo criterio para gastos_fijos: uno con
-- cheque_id no usa `fecha` (vencimiento) como salida de caja, usa
-- fecha_pago_efectivo (null hasta que el cheque se debita).
create or replace function get_caja_actual(fecha_corte date default current_date)
returns table (
  caja_id uuid,
  caja_nombre text,
  saldo_inicial numeric,
  ingresos_acreditados numeric,
  pagos_debitados numeric,
  saldo_actual numeric
)
language sql
stable
as $$
  with ingresos_ac as (
    select i.caja_id, sum(i.monto) as total
    from ingresos i
    where i.activo
      and coalesce(i.fecha_acreditacion, case when i.estado = 'Confirmado' and i.metodo_cobro_id is null then i.fecha end) <= fecha_corte
    group by i.caja_id
  ),
  pagos_compromisos as (
    select cp.caja_id, sum(cp.monto) as total
    from compromisos_pago cp
    where cp.estado = 'PAGADO' and cp.fecha_acreditacion <= fecha_corte
    group by cp.caja_id
  ),
  pagos_gastos_fijos as (
    select g.caja_id, sum(coalesce(g.monto_real, g.monto_previsto)) as total
    from gastos_fijos g
    where g.activo and g.estado = 'PAGADO'
      and coalesce(g.fecha_pago_efectivo, case when g.cheque_id is null then g.fecha end) <= fecha_corte
    group by g.caja_id
  ),
  pagos as (
    select caja_id, sum(total) as total from (
      select * from pagos_compromisos union all select * from pagos_gastos_fijos
    ) x group by caja_id
  )
  select
    c.id, c.nombre, c.saldo_inicial,
    coalesce(ia.total, 0), coalesce(p.total, 0),
    c.saldo_inicial + coalesce(ia.total, 0) - coalesce(p.total, 0)
  from cajas c
  left join ingresos_ac ia on ia.caja_id = c.id
  left join pagos p on p.caja_id = c.id
  where c.activo
  order by c.nombre;
$$;

-- ─── get_pendiente_acreditacion: suma también cheques de cobro pendientes ──
-- Antes solo miraba fecha_acreditacion (nula mientras el cheque no se
-- acredita). Ahora, si el ingreso trae un cheque todavía no rechazado ni
-- anulado, usa su fecha_vencimiento como estimación — mismo criterio que
-- get_disponible_financiero/get_proyeccion_caja de abajo.
create or replace function get_pendiente_acreditacion(fecha_corte date default current_date, caja_id_param uuid default null)
returns numeric
language sql
stable
as $$
  select coalesce(sum(i.monto * (1 - coalesce(mc.comision_porcentaje, 0))), 0)
  from ingresos i
  left join metodos_cobro mc on mc.id = i.metodo_cobro_id
  left join cheques ch on ch.id = i.cheque_id
  where i.activo
    and coalesce(i.fecha_acreditacion, case when ch.estado not in ('RECHAZADO', 'ANULADO') then ch.fecha_vencimiento end) is not null
    and coalesce(i.fecha_acreditacion, case when ch.estado not in ('RECHAZADO', 'ANULADO') then ch.fecha_vencimiento end) > fecha_corte
    and (caja_id_param is null or i.caja_id = caja_id_param)
$$;

-- ─── get_disponible_financiero: cheques pendientes entran a cobros/gastos ──
create or replace function get_disponible_financiero(fecha_desde date, fecha_hasta date, caja_id_param uuid default null)
returns table (
  caja_actual numeric,
  cobros_confirmados_periodo numeric,
  compromisos_periodo numeric,
  gastos_fijos_periodo numeric,
  disponible_estimado numeric
)
language sql
stable
as $$
  with caja as (
    select coalesce(sum(saldo_actual), 0) as total
    from get_caja_actual(current_date) g
    where caja_id_param is null or g.caja_id = caja_id_param
  ),
  cobros as (
    select coalesce(sum(i.monto), 0) as total
    from ingresos i
    left join cheques ch on ch.id = i.cheque_id
    where i.activo
      and coalesce(i.fecha_acreditacion, case when ch.estado not in ('RECHAZADO', 'ANULADO') then ch.fecha_vencimiento end) is not null
      and coalesce(i.fecha_acreditacion, case when ch.estado not in ('RECHAZADO', 'ANULADO') then ch.fecha_vencimiento end) > current_date
      and coalesce(i.fecha_acreditacion, case when ch.estado not in ('RECHAZADO', 'ANULADO') then ch.fecha_vencimiento end) between fecha_desde and fecha_hasta
      and (caja_id_param is null or i.caja_id = caja_id_param)
  ),
  compromisos as (
    select coalesce(sum(cp.monto), 0) as total
    from compromisos_pago cp
    where cp.estado = 'PENDIENTE'
      and cp.fecha_vencimiento between fecha_desde and fecha_hasta
      and (caja_id_param is null or cp.caja_id = caja_id_param)
  ),
  gastos as (
    select coalesce(sum(x.monto), 0) as total
    from (
      select g.monto_previsto as monto, g.fecha as fecha, g.caja_id as caja_id
      from gastos_fijos g
      where g.activo and g.estado in ('PREVISTO', 'VENCIDO')
      union all
      select coalesce(g.monto_real, g.monto_previsto) as monto, ch.fecha_vencimiento as fecha, g.caja_id as caja_id
      from gastos_fijos g
      join cheques ch on ch.id = g.cheque_id
      where g.activo and g.estado = 'PAGADO' and g.fecha_pago_efectivo is null
        and ch.estado not in ('RECHAZADO', 'ANULADO')
    ) x
    where x.fecha between fecha_desde and fecha_hasta
      and (caja_id_param is null or x.caja_id = caja_id_param)
  )
  select
    caja.total, cobros.total, compromisos.total, gastos.total,
    caja.total + cobros.total - compromisos.total - gastos.total
  from caja, cobros, compromisos, gastos;
$$;

-- ─── get_proyeccion_caja: cheques pendientes se proyectan en su vencimiento ──
create or replace function get_proyeccion_caja(fecha_desde date, fecha_hasta date, caja_id_param uuid default null)
returns table (
  fecha date,
  saldo_inicial_dia numeric,
  ingresos_confirmados numeric,
  ingresos_estimados numeric,
  pagos_comprometidos numeric,
  saldo_final numeric,
  en_rojo boolean
)
language plpgsql
stable
as $$
declare
  v_saldo numeric;
  v_promedio numeric;
  v_dia date;
  v_idx int := 0;
  v_ing_conf numeric;
  v_ing_est numeric;
  v_pagos numeric;
  v_final numeric;
begin
  select coalesce(sum(saldo_actual), 0) into v_saldo
  from get_caja_actual(current_date) g
  where caja_id_param is null or g.caja_id = caja_id_param;

  select coalesce(sum(i.monto), 0) / 30.0 into v_promedio
  from ingresos i
  where i.activo and i.fecha_acreditacion is not null
    and i.fecha_acreditacion between current_date - 29 and current_date
    and (caja_id_param is null or i.caja_id = caja_id_param);

  v_dia := fecha_desde;
  while v_dia <= fecha_hasta loop
    select coalesce(sum(i.monto), 0) into v_ing_conf
    from ingresos i
    left join cheques ch on ch.id = i.cheque_id
    where i.activo
      and coalesce(i.fecha_acreditacion, case when ch.estado not in ('RECHAZADO', 'ANULADO') then ch.fecha_vencimiento end) = v_dia
      and (caja_id_param is null or i.caja_id = caja_id_param);

    v_ing_est := round(case when v_idx = 0 then 0 else v_promedio end, 2);

    select coalesce(sum(x.monto), 0) into v_pagos
    from (
      select cp.monto from compromisos_pago cp
      where cp.estado = 'PENDIENTE' and cp.fecha_vencimiento = v_dia
        and (caja_id_param is null or cp.caja_id = caja_id_param)
      union all
      select coalesce(g.monto_real, g.monto_previsto) from gastos_fijos g
      where g.activo and g.estado in ('PREVISTO', 'VENCIDO') and g.fecha = v_dia
        and (caja_id_param is null or g.caja_id = caja_id_param)
      union all
      select coalesce(g.monto_real, g.monto_previsto) from gastos_fijos g
      join cheques ch on ch.id = g.cheque_id
      where g.activo and g.estado = 'PAGADO' and g.fecha_pago_efectivo is null
        and ch.estado not in ('RECHAZADO', 'ANULADO') and ch.fecha_vencimiento = v_dia
        and (caja_id_param is null or g.caja_id = caja_id_param)
    ) x;

    v_final := v_saldo + v_ing_conf + v_ing_est - v_pagos;

    fecha := v_dia;
    saldo_inicial_dia := v_saldo;
    ingresos_confirmados := v_ing_conf;
    ingresos_estimados := v_ing_est;
    pagos_comprometidos := v_pagos;
    saldo_final := v_final;
    en_rojo := v_final < 0;
    return next;

    v_saldo := v_final;
    v_dia := v_dia + 1;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

-- ─── get_flujo_caja: la salida de un gasto fijo con cheque cuenta en su débito real ──
create or replace function get_flujo_caja(anio int, caja_id_param uuid default null)
returns table (
  mes int,
  entradas numeric,
  salidas numeric,
  flujo_neto numeric,
  saldo_inicial numeric,
  saldo_final numeric
)
language sql
stable
as $$
  with ingresos_realizados as (
    -- Mismo fallback que get_caja_actual: un ingreso legacy 'Confirmado' sin
    -- metodo_cobro_id ni fecha_acreditacion (dato previo a este módulo) sí
    -- entró a caja, en su fecha_operacion. Un ingreso con metodo_cobro_id
    -- (incluye cheque) nunca cae acá salvo que ya tenga fecha_acreditacion real.
    select i.monto, coalesce(i.fecha_acreditacion, case when i.estado = 'Confirmado' and i.metodo_cobro_id is null then i.fecha end) as fecha_real
    from ingresos i
    where i.activo and (caja_id_param is null or i.caja_id = caja_id_param)
  ),
  gastos_fijos_realizados as (
    -- Un gasto fijo PAGADO con cheque_id usa fecha_pago_efectivo (null
    -- mientras el cheque no se debita, así que no cuenta como flujo
    -- realizado todavía); uno sin cheque sigue usando `fecha` como antes.
    select coalesce(g.monto_real, g.monto_previsto) as monto,
           coalesce(g.fecha_pago_efectivo, case when g.cheque_id is null then g.fecha end) as fecha_real
    from gastos_fijos g
    where g.activo and g.estado = 'PAGADO' and (caja_id_param is null or g.caja_id = caja_id_param)
  ),
  meses as (
    select generate_series(1, 12) as mes
  ),
  entradas_mes as (
    select extract(month from fecha_real)::int as mes, sum(monto) as total
    from ingresos_realizados
    where fecha_real is not null and extract(year from fecha_real)::int = anio
    group by 1
  ),
  entradas_previas as (
    select coalesce(sum(monto), 0) as total
    from ingresos_realizados
    where fecha_real is not null and extract(year from fecha_real)::int < anio
  ),
  salidas_mes as (
    select mes, sum(total) as total from (
      select extract(month from cp.fecha_acreditacion)::int as mes, cp.monto as total
      from compromisos_pago cp
      where cp.estado = 'PAGADO' and cp.fecha_acreditacion is not null
        and extract(year from cp.fecha_acreditacion)::int = anio
        and (caja_id_param is null or cp.caja_id = caja_id_param)
      union all
      select extract(month from fecha_real)::int as mes, monto as total
      from gastos_fijos_realizados
      where fecha_real is not null and extract(year from fecha_real)::int = anio
    ) x group by mes
  ),
  salidas_previas as (
    select coalesce(sum(total), 0) as total from (
      select cp.monto as total from compromisos_pago cp
      where cp.estado = 'PAGADO' and cp.fecha_acreditacion is not null
        and extract(year from cp.fecha_acreditacion)::int < anio
        and (caja_id_param is null or cp.caja_id = caja_id_param)
      union all
      select monto as total from gastos_fijos_realizados
      where fecha_real is not null and extract(year from fecha_real)::int < anio
    ) x
  ),
  base as (
    select coalesce((select sum(saldo_inicial) from cajas where activo and (caja_id_param is null or id = caja_id_param)), 0)
      + (select total from entradas_previas)
      - (select total from salidas_previas) as saldo
  ),
  flujo as (
    select
      m.mes,
      coalesce(e.total, 0) as entradas,
      coalesce(s.total, 0) as salidas,
      coalesce(e.total, 0) - coalesce(s.total, 0) as flujo_neto
    from meses m
    left join entradas_mes e on e.mes = m.mes
    left join salidas_mes s on s.mes = m.mes
  )
  select
    f.mes, f.entradas, f.salidas, f.flujo_neto,
    (select saldo from base) + coalesce(sum(f.flujo_neto) over (order by f.mes rows between unbounded preceding and 1 preceding), 0),
    (select saldo from base) + sum(f.flujo_neto) over (order by f.mes rows between unbounded preceding and current row)
  from flujo f
  order by f.mes;
$$;
