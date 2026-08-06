-- ─── PORTE — Paso 1b: poblar config_lists desde src/modules/porte/data/config.ts ──

insert into config_lists (clave, valores) values
  ('CATEGORIA',          array['PORTON','CORTINA','ESTRUCTURA','FRENTE ASADOR','SERVICIO','OTRO']),
  ('ESTADO_COMERCIAL',   array['Pedido','En presupuestación','Enviado','En negociación','Aceptado','Rechazado','Represupuestado','Cancelado']),
  ('ESTADO_OPERATIVO',   array['Pendiente','Planificado','En fabricación','En montaje','Entregado','Cerrado']),
  ('CUENTAS',            array['Banco Macro','MercadoPago','Efectivo Blanco','Efectivo Negro']),
  ('TIPO_CAJA',          array['BLANCA','NEGRA']),
  ('TIPO_INGRESO',       array['ANTICIPO','SALDO','PAGO PARCIAL','OTRO']),
  ('TIPO_EGRESO',        array['MATERIALES','MANO DE OBRA','FLETE','COMBUSTIBLE','HERRAMIENTAS','SERVICIOS','IMPUESTOS','OTROS']),
  ('CATEG_DIRECTOS',     array['MATERIALES','MANO DE OBRA','FLETE','HERRAMIENTAS','SERVICIOS']),
  ('CATEG_INDIRECTOS',   array['ALQUILER','SUELDOS','SERVICIOS','IMPUESTOS','HERRAMIENTAS','COMBUSTIBLE','OTROS']),
  ('CONDICION_PAGO',     array['Transferencia','Efectivo','Tarjeta','Cheque','Otro']),
  ('TIPO_VARIACION',     array['Precio','Plazo de entrega','Alcance del trabajo','Forma de pago','Material especificado','Condición de cobro','Cancelación parcial','Otro']),
  ('CAUSA_DESVIO',       array['Diseño','Materiales','Proveedor','Montaje','Cliente','Estimación','Otro']),
  ('CATEG_GASTO_FIJO',   array['Alquiler','Sueldos','Servicios','Impuestos','Herramientas','Combustible','Otros']),
  ('RESPONSABLE',        array['Gonza']);
