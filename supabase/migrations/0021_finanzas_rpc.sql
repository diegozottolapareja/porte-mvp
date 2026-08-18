-- ─── PORTE — Paso 21: módulo financiero (4/4) — RPC de Caja/Disponible/Proyección/Flujo ──
-- Toda la lógica vive acá (Postgres), no en React: get_caja_actual es la
-- única fuente de "cuánta plata hay realmente ahora"; get_disponible_financiero
-- y get_proyeccion_caja se apoyan en ella para no recalcular caja real dos
-- veces. Ningún cálculo mezcla ventas/costos (resultado operativo) con estos.

-- ─── get_caja_actual: saldo real por caja a una fecha de corte ─────────────
-- Fuente de "pagado" = compromisos_pago (egresos) + gastos_fijos ya PAGADOs,
-- nunca `egresos.monto` directo (un egreso puede tener compromisos todavía
-- pendientes — sección 13 del pedido).
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
      and coalesce(i.fecha_acreditacion, case when i.estado = 'Confirmado' then i.fecha end) <= fecha_corte
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
    where g.activo and g.estado = 'PAGADO' and g.fecha <= fecha_corte
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

-- ─── get_pendiente_acreditacion: sección 5 del pedido ───────────────────────
create or replace function get_pendiente_acreditacion(fecha_corte date default current_date, caja_id_param uuid default null)
returns numeric
language sql
stable
as $$
  select coalesce(sum(i.monto * (1 - coalesce(mc.comision_porcentaje, 0))), 0)
  from ingresos i
  left join metodos_cobro mc on mc.id = i.metodo_cobro_id
  where i.activo
    and i.fecha_acreditacion is not null
    and i.fecha_acreditacion > fecha_corte
    and (caja_id_param is null or i.caja_id = caja_id_param)
$$;

-- ─── get_disponible_financiero: sección 14 del pedido ──────────────────────
-- caja_actual = hoy (no fecha_desde: "no confundir con el saldo bancario
-- actual" — el corte de caja real siempre es hoy, el rango solo acota qué
-- cobros/compromisos futuros se suman/restan encima).
-- cobros_confirmados_periodo excluye lo que ya está en caja_actual (fecha_
-- acreditacion <= hoy) para no contarlo dos veces.
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
    where i.activo
      and i.fecha_acreditacion is not null
      and i.fecha_acreditacion > current_date
      and i.fecha_acreditacion between fecha_desde and fecha_hasta
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
    select coalesce(sum(g.monto_previsto), 0) as total
    from gastos_fijos g
    where g.activo
      and g.estado in ('PREVISTO', 'VENCIDO')
      and g.fecha between fecha_desde and fecha_hasta
      and (caja_id_param is null or g.caja_id = caja_id_param)
  )
  select
    caja.total, cobros.total, compromisos.total, gastos.total,
    caja.total + cobros.total - compromisos.total - gastos.total
  from caja, cobros, compromisos, gastos;
$$;

-- ─── get_proyeccion_caja: sección 15 del pedido ────────────────────────────
-- Día 0 arranca en caja real actual (hoy), no en fecha_desde — ver comentario
-- de arriba. El promedio histórico se suma desde el día 1 en adelante, nunca
-- reemplaza los ingresos confirmados de ese día (se suman, igual que el Excel).
-- Pagos del día: fecha_vencimiento de compromisos_pago PENDIENTE + gastos
-- fijos PREVISTO/VENCIDO — nunca fecha_acreditacion, según pide la sección 15.
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
    where i.activo and i.fecha_acreditacion = v_dia
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

-- ─── get_flujo_caja: sección 17 del pedido — plata que realmente entró/salió ──
-- Agrupa por fecha_acreditacion/fecha real de pago, nunca por fecha de
-- operación ni de creación. No mezcla ventas/costos (eso es resultado
-- operativo, reporte aparte).
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
    -- fecha_acreditacion cargada (dato previo a este módulo) sí entró a caja,
    -- en su fecha_operacion — omitirlo lo haría desaparecer del histórico.
    select i.monto, coalesce(i.fecha_acreditacion, case when i.estado = 'Confirmado' then i.fecha end) as fecha_real
    from ingresos i
    where i.activo and (caja_id_param is null or i.caja_id = caja_id_param)
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
      select extract(month from g.fecha)::int as mes, coalesce(g.monto_real, g.monto_previsto) as total
      from gastos_fijos g
      where g.activo and g.estado = 'PAGADO'
        and extract(year from g.fecha)::int = anio
        and (caja_id_param is null or g.caja_id = caja_id_param)
    ) x group by mes
  ),
  salidas_previas as (
    select coalesce(sum(total), 0) as total from (
      select cp.monto as total from compromisos_pago cp
      where cp.estado = 'PAGADO' and cp.fecha_acreditacion is not null
        and extract(year from cp.fecha_acreditacion)::int < anio
        and (caja_id_param is null or cp.caja_id = caja_id_param)
      union all
      select coalesce(g.monto_real, g.monto_previsto) as total from gastos_fijos g
      where g.activo and g.estado = 'PAGADO' and extract(year from g.fecha)::int < anio
        and (caja_id_param is null or g.caja_id = caja_id_param)
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
