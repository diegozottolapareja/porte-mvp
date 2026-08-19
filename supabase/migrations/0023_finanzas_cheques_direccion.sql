-- ─── PORTE — Paso 23: cheques centralizados (1/2) — dirección y columnas ────
-- Extiende el modelo de cheques (hoy solo usado por Egresos, vía
-- compromisos_pago.cheque_id) para que Ingresos y Gastos Fijos lo reutilicen
-- en vez de crear ChequeIngreso/ChequeGastoFijo aparte. `direccion` distingue
-- un cheque que emitimos (PAGO, el caso existente) de uno que recibimos
-- (COBRO, nuevo). Los nuevos valores de `cheque_estado` van en un archivo
-- aparte de los que los usan (CHECK/funciones, en 0024) porque Postgres no
-- permite usar un valor de enum recién agregado dentro de la misma
-- transacción en que se agregó.

create type cheque_direccion as enum ('PAGO', 'COBRO');

-- Todo cheque existente hoy es de Egresos (lo emitimos) — default 'PAGO'
-- para no romper datos ya cargados.
alter table cheques add column direccion cheque_direccion not null default 'PAGO';

-- Cadena de cobro (Ingresos): EN_CARTERA → DEPOSITADO → ACREDITADO | RECHAZADO.
-- Sin endoso ni cesión por ahora — fuera de alcance.
alter type cheque_estado add value if not exists 'EN_CARTERA';
alter type cheque_estado add value if not exists 'DEPOSITADO';
alter type cheque_estado add value if not exists 'ACREDITADO';

-- ─── enlace directo del cheque a su origen ──────────────────────────────────
-- Ingresos y Gastos Fijos no tienen una tabla de "compromiso" como Egresos —
-- son un registro plano, así que el cheque se enlaza directo. Egresos sigue
-- enlazando indirecto vía compromisos_pago.cheque_id, sin cambios.
alter table ingresos add column cheque_id uuid references cheques(id);
alter table gastos_fijos add column cheque_id uuid references cheques(id);

-- `fecha` en gastos_fijos sigue siendo el vencimiento de la obligación —
-- nunca se reinterpreta. `fecha_pago_efectivo` es la fecha real en que la
-- plata efectivamente sale de caja: igual a `fecha` cuando se paga
-- inmediato, distinta (fecha de débito del cheque) cuando se paga con
-- cheque. Arranca null: un gasto fijo pagado con cheque no impacta caja
-- hasta que el cheque se marca DEBITADO (ver fn_marcar_cheque_estado, 0024).
alter table gastos_fijos add column fecha_pago_efectivo date;
