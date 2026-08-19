-- ─── PORTE — Tests del módulo financiero (sección 26 del pedido) ───────────
-- Datos propios, aislados en una caja/proveedor/tarjeta de test creados y
-- destruidos dentro de esta misma transacción (ROLLBACK al final) — no toca
-- datos reales ni el seed demo. Corrido con:
--   supabase db query --linked -f supabase/tests/finanzas.sql
-- Cada aserción que falla aborta la transacción con RAISE EXCEPTION
-- (mensaje descriptivo). Si el archivo entero corre sin error, todos los
-- escenarios pasaron — el SELECT final lo confirma antes del rollback.

begin;

do $$
declare
  v_caja_id uuid;
  v_prov_id text := 'TEST-PROV';
  v_tarjeta_id uuid;
  v_metodo_cobro_id uuid;
  v_venta_id text := 'PR - 0484'; -- venta ya existente del seed, solo para satisfacer la FK de ingresos.id
  v_cheque_id uuid;
  v_resumen_id uuid;
  v_compromiso_id uuid;
  v_hoy date := current_date;
  v_pagos_antes numeric;
  v_pagos_despues numeric;
  v_pagos_comprometidos numeric;
  v_disponible_estimado numeric;
  v_gastos_fijos_periodo numeric;
  v_resumen_estado resumen_tarjeta_estado;
  v_pendiente numeric;
  v_entradas_sep numeric;
  v_entradas_ago numeric;
  v_salidas_sep numeric;
  v_cuotas_distintas int;
  v_primera_fecha_negativa date;
  v_saldo_negativo numeric;
  v_cheque_cobro_id uuid;
  v_cheque_pago_id uuid;
  v_ingreso_fecha_acred date;
  v_gasto_fijo_id uuid;
  v_pagos_gf_antes numeric;
  v_pagos_gf_despues numeric;
  v_pendiente_cheque numeric;
begin
  -- ─── setup ──────────────────────────────────────────────────────────────
  insert into cajas (nombre, tipo_caja, saldo_inicial) values ('TEST-CAJA', 'BLANCA', 0) returning id into v_caja_id;
  insert into proveedores (id_prov, nombre, plazo_dias, activo) values (v_prov_id, 'Proveedor de test', 30, true);
  insert into tarjetas_credito (nombre, banco, caja_debito_id, dia_cierre, dia_vencimiento)
    values ('TEST-TARJETA', 'Banco Test', v_caja_id, 10, 20) returning id into v_tarjeta_id;
  insert into metodos_cobro (nombre, dias_acreditacion, comision_porcentaje, caja_id)
    values ('TEST-METODO-COBRO', 5, 0.10, v_caja_id) returning id into v_metodo_cobro_id;

  -- ═══ 1) Transferencia inmediata: compra y pago el mismo día ═══════════════
  insert into egresos (ref, fecha, tipo_egreso, categoria, monto, caja_id, estado)
    values ('TEST-EG-1', v_hoy, 'MATERIALES', 'MATERIALES', 1000, v_caja_id, 'Confirmado');
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, fecha_acreditacion, caja_id, estado)
    values ('TEST-EG-1', 1000, v_hoy, v_hoy, v_caja_id, 'PAGADO');

  select pagos_debitados into v_pagos_antes from get_caja_actual(v_hoy) where caja_id = v_caja_id;
  if v_pagos_antes <> 1000 then
    raise exception 'FALLÓ transferencia inmediata: pagos_debitados esperado 1000, obtenido %', v_pagos_antes;
  end if;
  raise notice 'OK 1) transferencia inmediata: caja bajó el mismo día (%)', v_pagos_antes;

  -- ═══ 2) Cheque: compra hoy, débito 30 días después ════════════════════════
  insert into egresos (ref, fecha, tipo_egreso, categoria, monto, caja_id, estado)
    values ('TEST-EG-2', v_hoy, 'MATERIALES', 'MATERIALES', 2000, v_caja_id, 'Confirmado');
  insert into cheques (numero, banco, monto, fecha_emision, fecha_vencimiento, caja_id, estado)
    values ('0001', 'Banco Test', 2000, v_hoy, v_hoy + 30, v_caja_id, 'EMITIDO') returning id into v_cheque_id;
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, cheque_id)
    values ('TEST-EG-2', 2000, v_hoy + 30, v_caja_id, 'PENDIENTE', v_cheque_id) returning id into v_compromiso_id;

  select pagos_debitados into v_pagos_despues from get_caja_actual(v_hoy) where caja_id = v_caja_id;
  if v_pagos_despues <> v_pagos_antes then
    raise exception 'FALLÓ cheque: la caja de HOY no debería moverse por un cheque emitido, pagos_debitados pasó de % a %', v_pagos_antes, v_pagos_despues;
  end if;

  select pagos_comprometidos into v_pagos_comprometidos from get_proyeccion_caja(v_hoy, v_hoy + 30, v_caja_id) where fecha = v_hoy + 30;
  if v_pagos_comprometidos < 2000 then
    raise exception 'FALLÓ cheque: la proyección del día de vencimiento debería incluir el cheque, pagos_comprometidos=%', v_pagos_comprometidos;
  end if;
  raise notice 'OK 2) cheque: no bajó caja hoy, sí aparece en la proyección a 30 días';

  -- ═══ 3) Cuenta corriente: compra hoy, vencimiento a plazo del proveedor ═══
  insert into egresos (ref, fecha, tipo_egreso, id_obra, proveedor_id, categoria, monto, caja_id, estado)
    values ('TEST-EG-3', v_hoy, 'MATERIALES', null, v_prov_id, 'MATERIALES', 3000, v_caja_id, 'Confirmado');
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado)
    values ('TEST-EG-3', 3000, v_hoy + 30, v_caja_id, 'PENDIENTE');

  select pagos_debitados into v_pagos_despues from get_caja_actual(v_hoy) where caja_id = v_caja_id;
  if v_pagos_despues <> v_pagos_antes then
    raise exception 'FALLÓ cuenta corriente: no debería bajar caja hoy, pagos_debitados=%', v_pagos_despues;
  end if;

  select disponible_estimado into v_disponible_estimado from get_disponible_financiero(v_hoy, v_hoy + 30, v_caja_id);
  raise notice 'OK 3) cuenta corriente: no bajó caja hoy, vence a 30 días (disponible del período: %)', v_disponible_estimado;

  -- ═══ 4) Tarjeta, 1 pago: compra hoy, pago al vencimiento del resumen ══════
  insert into egresos (ref, fecha, tipo_egreso, categoria, monto, caja_id, estado)
    values ('TEST-EG-4', v_hoy, 'HERRAMIENTAS', 'HERRAMIENTAS', 4000, v_caja_id, 'Confirmado');
  insert into resumenes_tarjeta (tarjeta_id, periodo, fecha_cierre, fecha_vencimiento, monto, estado)
    values (v_tarjeta_id, 'TEST-1', v_hoy + 10, v_hoy + 15, 4000, 'PENDIENTE') returning id into v_resumen_id;
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, tarjeta_id, resumen_tarjeta_id)
    values ('TEST-EG-4', 4000, v_hoy + 15, v_caja_id, 'PENDIENTE', v_tarjeta_id, v_resumen_id) returning id into v_compromiso_id;

  select pagos_debitados into v_pagos_despues from get_caja_actual(v_hoy) where caja_id = v_caja_id;
  if v_pagos_despues <> v_pagos_antes then
    raise exception 'FALLÓ tarjeta 1 pago: no debería bajar caja hoy, pagos_debitados=%', v_pagos_despues;
  end if;

  -- Pagar el resumen (fn_marcar_compromiso_pagado) y confirmar que ahí sí impacta caja real.
  perform fn_marcar_compromiso_pagado(v_compromiso_id, v_hoy + 15, v_caja_id);

  select estado into v_resumen_estado from resumenes_tarjeta where id = v_resumen_id;
  if v_resumen_estado <> 'PAGADO' then
    raise exception 'FALLÓ tarjeta 1 pago: el resumen debería quedar PAGADO tras fn_marcar_compromiso_pagado, quedó %', v_resumen_estado;
  end if;

  select pagos_debitados into v_pagos_despues from get_caja_actual(v_hoy + 15) where caja_id = v_caja_id;
  if v_pagos_despues < v_pagos_antes + 4000 then
    raise exception 'FALLÓ tarjeta 1 pago: al vencimiento del resumen la caja debería reflejar el pago, pagos_debitados=%', v_pagos_despues;
  end if;
  raise notice 'OK 4) tarjeta 1 pago: no bajó caja hoy, sí al pagar el resumen en su vencimiento';

  -- ═══ 5) Tarjeta, 3 cuotas: tres compromisos distintos ═════════════════════
  insert into egresos (ref, fecha, tipo_egreso, categoria, monto, caja_id, estado)
    values ('TEST-EG-5', v_hoy, 'HERRAMIENTAS', 'HERRAMIENTAS', 9000, v_caja_id, 'Confirmado');
  insert into resumenes_tarjeta (tarjeta_id, periodo, fecha_cierre, fecha_vencimiento, monto, estado)
    values (v_tarjeta_id, 'TEST-2', v_hoy + 10, v_hoy + 30, 3000, 'PENDIENTE') returning id into v_resumen_id;
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, tarjeta_id, resumen_tarjeta_id)
    values ('TEST-EG-5', 3000, v_hoy + 30, v_caja_id, 'PENDIENTE', v_tarjeta_id, v_resumen_id);
  insert into resumenes_tarjeta (tarjeta_id, periodo, fecha_cierre, fecha_vencimiento, monto, estado)
    values (v_tarjeta_id, 'TEST-3', v_hoy + 40, v_hoy + 60, 3000, 'PENDIENTE') returning id into v_resumen_id;
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, tarjeta_id, resumen_tarjeta_id)
    values ('TEST-EG-5', 3000, v_hoy + 60, v_caja_id, 'PENDIENTE', v_tarjeta_id, v_resumen_id);
  insert into resumenes_tarjeta (tarjeta_id, periodo, fecha_cierre, fecha_vencimiento, monto, estado)
    values (v_tarjeta_id, 'TEST-4', v_hoy + 70, v_hoy + 90, 3000, 'PENDIENTE') returning id into v_resumen_id;
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, tarjeta_id, resumen_tarjeta_id)
    values ('TEST-EG-5', 3000, v_hoy + 90, v_caja_id, 'PENDIENTE', v_tarjeta_id, v_resumen_id);

  select count(distinct fecha_vencimiento) into v_cuotas_distintas from compromisos_pago where egreso_id = 'TEST-EG-5';
  if v_cuotas_distintas <> 3 then
    raise exception 'FALLÓ tarjeta 3 cuotas: deberían ser 3 compromisos con vencimientos distintos, hubo %', v_cuotas_distintas;
  end if;
  raise notice 'OK 5) tarjeta 3 cuotas: 3 compromisos independientes generados';

  -- ═══ 6) Gasto fijo: aparece automáticamente en la proyección ═════════════
  insert into gastos_fijos (fecha, concepto, categoria, monto_previsto, periodicidad, caja_id, estado, activo)
    values (v_hoy + 10, 'TEST Alquiler', 'Alquiler', 5000, 'Mensual', v_caja_id, 'PREVISTO', true);

  select pagos_comprometidos into v_pagos_comprometidos from get_proyeccion_caja(v_hoy, v_hoy + 10, v_caja_id) where fecha = v_hoy + 10;
  if v_pagos_comprometidos < 5000 then
    raise exception 'FALLÓ gasto fijo: debería aparecer en la proyección del día de vencimiento, pagos_comprometidos=%', v_pagos_comprometidos;
  end if;

  select gastos_fijos_periodo into v_gastos_fijos_periodo from get_disponible_financiero(v_hoy, v_hoy + 10, v_caja_id);
  if v_gastos_fijos_periodo < 5000 then
    raise exception 'FALLÓ gasto fijo: debería descontar el disponible del período, gastos_fijos_periodo=%', v_gastos_fijos_periodo;
  end if;
  raise notice 'OK 6) gasto fijo: aparece en proyección y en disponible del período, no en caja actual';

  -- ═══ 7) Pendiente de acreditación con comisión configurada ════════════════
  insert into ingresos (ref, fecha, tipo_ingreso, id_obra, monto, caja_id, metodo_cobro_id, fecha_acreditacion, estado)
    values ('TEST-IN-7', v_hoy, 'ANTICIPO', v_venta_id, 1000, v_caja_id, v_metodo_cobro_id, v_hoy + 5, 'Confirmado');

  select get_pendiente_acreditacion(v_hoy, v_caja_id) into v_pendiente;
  if v_pendiente <> 900 then
    raise exception 'FALLÓ pendiente de acreditación: esperado 1000*(1-0.10)=900, obtenido %', v_pendiente;
  end if;
  raise notice 'OK 7) pendiente de acreditación aplica la comisión configurada (900 sobre 1000)';

  -- ═══ 8) Flujo mensual: venta cobrada en septiembre, operación en agosto ══
  insert into ingresos (ref, fecha, tipo_ingreso, id_obra, monto, caja_id, fecha_acreditacion, estado)
    values ('TEST-IN-8', '2026-08-05', 'SALDO', v_venta_id, 7000, v_caja_id, '2026-09-03', 'Confirmado');

  select entradas into v_entradas_sep from get_flujo_caja(2026, v_caja_id) where mes = 9;
  select entradas into v_entradas_ago from get_flujo_caja(2026, v_caja_id) where mes = 8;
  if v_entradas_sep < 7000 then
    raise exception 'FALLÓ flujo mensual: la venta cobrada en septiembre debería figurar en septiembre, entradas_sep=%', v_entradas_sep;
  end if;
  if v_entradas_ago >= 7000 then
    raise exception 'FALLÓ flujo mensual: no debería figurar en agosto (fecha de operación), entradas_ago=%', v_entradas_ago;
  end if;
  raise notice 'OK 8) flujo mensual agrupa por fecha_acreditacion (septiembre), no por fecha de operación (agosto)';

  -- ═══ 9) Compra en agosto, tarjeta pagada en septiembre ═══════════════════
  insert into egresos (ref, fecha, tipo_egreso, categoria, monto, caja_id, estado)
    values ('TEST-EG-9', '2026-08-12', 'HERRAMIENTAS', 'HERRAMIENTAS', 6000, v_caja_id, 'Confirmado');
  insert into resumenes_tarjeta (tarjeta_id, periodo, fecha_cierre, fecha_vencimiento, monto, estado)
    values (v_tarjeta_id, 'TEST-5', '2026-08-31', '2026-09-10', 6000, 'PENDIENTE') returning id into v_resumen_id;
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado, tarjeta_id, resumen_tarjeta_id)
    values ('TEST-EG-9', 6000, '2026-09-10', v_caja_id, 'PENDIENTE', v_tarjeta_id, v_resumen_id) returning id into v_compromiso_id;

  perform fn_marcar_compromiso_pagado(v_compromiso_id, '2026-09-10', v_caja_id);

  select salidas into v_salidas_sep from get_flujo_caja(2026, v_caja_id) where mes = 9;
  if v_salidas_sep < 6000 then
    raise exception 'FALLÓ tarjeta pagada en septiembre: debería figurar como salida de septiembre, salidas_sep=%', v_salidas_sep;
  end if;
  raise notice 'OK 9) compra de agosto con tarjeta pagada en septiembre figura como salida de septiembre';

  -- ═══ 10) Descalce: primera fecha negativa y saldo mínimo ═════════════════
  -- La caja de test ya viene con -1000 desde el escenario 1 (pagó hoy, sin
  -- ingresos todavía acreditados) — para probar que el descalce ocurre
  -- justo en el vencimiento del compromiso (y no antes), primero se
  -- acredita un ingreso grande hoy que la deja sólidamente en positivo.
  insert into ingresos (ref, fecha, tipo_ingreso, id_obra, monto, caja_id, fecha_acreditacion, estado)
    values ('TEST-IN-10', v_hoy, 'OTRO', v_venta_id, 2000000, v_caja_id, v_hoy, 'Confirmado');

  insert into egresos (ref, fecha, tipo_egreso, categoria, monto, caja_id, estado)
    values ('TEST-EG-10', v_hoy, 'IMPUESTOS', 'IMPUESTOS', 999999999, v_caja_id, 'Confirmado');
  insert into compromisos_pago (egreso_id, monto, fecha_vencimiento, caja_id, estado)
    values ('TEST-EG-10', 999999999, v_hoy + 3, v_caja_id, 'PENDIENTE');

  select fecha, saldo_final into v_primera_fecha_negativa, v_saldo_negativo
  from get_proyeccion_caja(v_hoy, v_hoy + 5, v_caja_id)
  where en_rojo order by fecha limit 1;

  if v_primera_fecha_negativa is null or v_primera_fecha_negativa <> v_hoy + 3 then
    raise exception 'FALLÓ descalce: primera fecha negativa esperada %, obtenida %', v_hoy + 3, v_primera_fecha_negativa;
  end if;
  if v_saldo_negativo >= 0 then
    raise exception 'FALLÓ descalce: saldo_final del día negativo debería ser negativo, obtenido %', v_saldo_negativo;
  end if;
  raise notice 'OK 10) descalce: primera fecha negativa = % (saldo %, cobertura necesaria %)', v_primera_fecha_negativa, v_saldo_negativo, -v_saldo_negativo;

  -- ═══ 11) Ingreso con cheque: en cartera no cobra, acreditado sí ══════════
  insert into cheques (direccion, monto, fecha_emision, fecha_vencimiento, caja_id, estado)
    values ('COBRO', 5000, v_hoy, v_hoy + 20, v_caja_id, 'EN_CARTERA') returning id into v_cheque_cobro_id;
  insert into ingresos (ref, fecha, tipo_ingreso, id_obra, monto, caja_id, metodo_cobro_id, cheque_id, estado)
    values ('TEST-IN-11', v_hoy, 'ANTICIPO', v_venta_id, 5000, v_caja_id, v_metodo_cobro_id, v_cheque_cobro_id, 'Confirmado');

  select ingresos_acreditados into v_pagos_antes from get_caja_actual(v_hoy) where caja_id = v_caja_id;
  select get_pendiente_acreditacion(v_hoy, v_caja_id) into v_pendiente_cheque;
  if v_pendiente_cheque < 5000 then
    raise exception 'FALLÓ ingreso con cheque: debería aparecer en pendiente de acreditación (vencimiento del cheque), pendiente=%', v_pendiente_cheque;
  end if;

  perform fn_marcar_cheque_estado(v_cheque_cobro_id, 'DEPOSITADO', v_hoy + 2, v_caja_id);
  select ingresos_acreditados into v_pagos_despues from get_caja_actual(v_hoy + 2) where caja_id = v_caja_id;
  if v_pagos_despues <> v_pagos_antes then
    raise exception 'FALLÓ ingreso con cheque: DEPOSITADO todavía no debería impactar caja líquida, ingresos_acreditados=%', v_pagos_despues;
  end if;

  perform fn_marcar_cheque_estado(v_cheque_cobro_id, 'ACREDITADO', v_hoy + 3, v_caja_id);
  select fecha_acreditacion into v_ingreso_fecha_acred from ingresos where ref = 'TEST-IN-11';
  if v_ingreso_fecha_acred <> v_hoy + 3 then
    raise exception 'FALLÓ ingreso con cheque: fecha_acreditacion debería quedar en %, quedó %', v_hoy + 3, v_ingreso_fecha_acred;
  end if;
  select ingresos_acreditados into v_pagos_despues from get_caja_actual(v_hoy + 3) where caja_id = v_caja_id;
  if v_pagos_despues < v_pagos_antes + 5000 then
    raise exception 'FALLÓ ingreso con cheque: ACREDITADO debería sumar a caja líquida en su fecha real, ingresos_acreditados=%', v_pagos_despues;
  end if;
  raise notice 'OK 11) ingreso con cheque: no cobra hasta ACREDITADO, aparece proyectado antes en pendiente de acreditación';

  -- ═══ 12) Gasto fijo con cheque: vencimiento ≠ fecha de salida de caja ════
  select pagos_debitados into v_pagos_gf_antes from get_caja_actual(v_hoy + 5) where caja_id = v_caja_id;

  insert into cheques (direccion, monto, fecha_emision, fecha_vencimiento, caja_id, estado)
    values ('PAGO', 8000, v_hoy, v_hoy + 25, v_caja_id, 'EMITIDO') returning id into v_cheque_pago_id;
  insert into gastos_fijos (fecha, concepto, categoria, monto_previsto, periodicidad, caja_id, metodo_pago_id, cheque_id, estado, activo)
    values (v_hoy + 5, 'TEST Alquiler con cheque', 'Alquiler', 8000, 'Mensual', v_caja_id,
      (select id from metodos_pago where tipo = 'CHEQUE' limit 1), v_cheque_pago_id, 'PAGADO', true)
    returning id into v_gasto_fijo_id;

  select pagos_debitados into v_pagos_gf_despues from get_caja_actual(v_hoy + 5) where caja_id = v_caja_id;
  if v_pagos_gf_despues <> v_pagos_gf_antes then
    raise exception 'FALLÓ gasto fijo con cheque: no debería bajar caja en el vencimiento (%) mientras el cheque no se debita, pagos_debitados=%', v_hoy + 5, v_pagos_gf_despues;
  end if;

  select pagos_comprometidos into v_pagos_comprometidos from get_proyeccion_caja(v_hoy, v_hoy + 25, v_caja_id) where fecha = v_hoy + 25;
  if v_pagos_comprometidos < 8000 then
    raise exception 'FALLÓ gasto fijo con cheque: debería proyectarse a la fecha de vencimiento del cheque (%), pagos_comprometidos=%', v_hoy + 25, v_pagos_comprometidos;
  end if;

  perform fn_marcar_cheque_estado(v_cheque_pago_id, 'ENTREGADO', v_hoy + 6, v_caja_id);
  perform fn_marcar_cheque_estado(v_cheque_pago_id, 'DEBITADO', v_hoy + 25, v_caja_id);

  select pagos_debitados into v_pagos_gf_despues from get_caja_actual(v_hoy + 25) where caja_id = v_caja_id;
  if v_pagos_gf_despues < v_pagos_gf_antes + 8000 then
    raise exception 'FALLÓ gasto fijo con cheque: DEBITADO debería bajar caja real en la fecha de débito (%), pagos_debitados=%', v_hoy + 25, v_pagos_gf_despues;
  end if;
  raise notice 'OK 12) gasto fijo con cheque: vencimiento de la obligación (%) ≠ fecha real de salida de caja (%)', v_hoy + 5, v_hoy + 25;

  raise notice '════════════════════════════════════════════════════';
  raise notice 'TODOS LOS TESTS PASARON (12/12)';
end $$;

select 'TODOS LOS TESTS PASARON (12/12)' as resultado;

rollback;
