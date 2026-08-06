// ─── Genera supabase/migrations/0008_seed_data.sql desde los MOCK_* actuales ──
// Uso: npx tsx scripts/gen-seed.ts > supabase/migrations/0008_seed_data.sql

import { MOCK_PRESUPUESTOS } from '../src/modules/porte/data/presupuestos'
import { MOCK_VENTAS } from '../src/modules/porte/data/ventas'
import { MOCK_INGRESOS } from '../src/modules/porte/data/ingresos'
import { MOCK_EGRESOS } from '../src/modules/porte/data/egresos'
import { MOCK_PROVEEDORES } from '../src/modules/porte/data/proveedores'
import { MOCK_GASTOS_FIJOS } from '../src/modules/porte/data/gastosFijos'
import { MOCK_VARIACIONES } from '../src/modules/porte/data/variaciones'
import { MOCK_APRENDIZAJES } from '../src/modules/porte/data/aprendizajes'

const ADMIN_ID = 'b92b871a-1efa-4a05-ae27-cba6c6409c8d'

// variaciones/aprendizajes mock usan 'PR-XXXX' (sin espacios) mientras que
// presupuestos.id es 'PR - XXXX' — inconsistencia real del mock, se normaliza
// acá para no romper la FK id_pres → presupuestos(id).
function normalizeId(id: string | null | undefined): string | null | undefined {
  if (!id) return id
  return id.replace(/^PR-(\d+)$/, 'PR - $1')
}

function sqlStr(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return `'${String(v).replace(/'/g, "''")}'`
}

function insert(table: string, cols: string[], rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const values = rows.map(r => `(${cols.map(c => sqlStr(r[c])).join(', ')})`).join(',\n  ')
  return `insert into ${table} (${cols.join(', ')}) values\n  ${values}\non conflict do nothing;\n`
}

const out: string[] = []
out.push('-- ─── PORTE — Paso 7: migración de datos mock a tablas reales ──────────────')
out.push('-- Generado por scripts/gen-seed.ts desde src/modules/porte/data/*.ts\n')

out.push(insert('presupuestos',
  ['id', 'id_num', 'fecha', 'cliente', 'descripcion', 'categoria', 'responsable', 'costo_mat', 'costo_mo', 'ind_vendidos', 'impuestos', 'comercial', 'beneficio', 'estado_comercial', 'vencimiento', 'observaciones', 'enviado', 'activo', 'created_at', 'created_by', 'updated_at'],
  MOCK_PRESUPUESTOS.map(p => ({
    id: p.id, id_num: p.idNum, fecha: p.fecha, cliente: p.cliente, descripcion: p.descripcion,
    categoria: p.categoria, responsable: p.responsable, costo_mat: p.costoMat, costo_mo: p.costoMo,
    ind_vendidos: p.indVendidos, impuestos: p.impuestos, comercial: p.comercial, beneficio: p.beneficio,
    estado_comercial: p.estadoComercial, vencimiento: p.vencimiento, observaciones: p.observaciones,
    enviado: p.enviado, activo: p.activo, created_at: p.createdAt, created_by: ADMIN_ID, updated_at: p.updatedAt,
  }))))

out.push(insert('ventas',
  ['id', 'cliente', 'monto_total', 'mater', 'mo', 'ind_vend', 'imp', 'comerc', 'benef', 'fecha_cierre', 'cond_pago', 'dias', 'venc_cobro', 'caja_intenc', 'venta_final', 'motivo_dif', 'entrega_compr', 'entrega_real', 'estado_op', 'resp_op', 'created_at', 'created_by', 'updated_at'],
  MOCK_VENTAS.map(v => ({
    id: v.id, cliente: v.cliente, monto_total: v.montoTotal, mater: v.mater, mo: v.mo, ind_vend: v.indVend,
    imp: v.imp, comerc: v.comerc, benef: v.benef, fecha_cierre: v.fechaCierre, cond_pago: v.condPago,
    dias: v.dias, venc_cobro: v.vencCobro, caja_intenc: v.cajaIntenc, venta_final: v.ventaFinal,
    motivo_dif: v.motivoDif, entrega_compr: v.entregaCompr, entrega_real: v.entregaReal, estado_op: v.estadoOp,
    resp_op: v.respOp, created_at: v.createdAt, created_by: ADMIN_ID, updated_at: v.updatedAt,
  }))))

out.push(insert('proveedores',
  ['id_prov', 'nombre', 'rubro', 'contacto', 'telefono', 'condicion_habitual', 'plazo_dias', 'cuenta_banco', 'tipo_caja', 'saldo_inicial', 'fecha_saldo_inicial', 'activo', 'observaciones', 'created_at', 'created_by', 'updated_at'],
  MOCK_PROVEEDORES.map(p => ({
    id_prov: p.idProv, nombre: p.nombre, rubro: p.rubro, contacto: p.contacto, telefono: p.telefono,
    condicion_habitual: p.condicionHabitual, plazo_dias: p.plazoDias, cuenta_banco: p.cuentaBanco,
    tipo_caja: p.tipoCaja, saldo_inicial: p.saldoCc, fecha_saldo_inicial: p.fechaSaldoInicial,
    activo: p.activo, observaciones: p.observaciones, created_at: p.createdAt, created_by: ADMIN_ID, updated_at: p.updatedAt,
  }))))

out.push(insert('ingresos',
  ['ref', 'fecha', 'tipo_ingreso', 'id_obra', 'concepto', 'monto', 'cuenta', 'caja', 'estado', 'activo', 'created_at', 'created_by', 'updated_at'],
  MOCK_INGRESOS.map(i => ({
    ref: i.ref, fecha: i.fecha, tipo_ingreso: i.tipoIngreso, id_obra: i.id, concepto: i.concepto,
    monto: i.monto, cuenta: i.cuenta, caja: i.caja, estado: i.estado, activo: i.activo,
    created_at: i.createdAt, created_by: ADMIN_ID, updated_at: i.updatedAt,
  }))))

out.push(insert('egresos',
  ['ref', 'fecha', 'tipo_egreso', 'id_obra', 'proveedor_id', 'categoria', 'monto', 'cuenta', 'caja', 'estado', 'fecha_emision', 'fecha_acreditacion', 'activo', 'created_at', 'created_by', 'updated_at'],
  MOCK_EGRESOS.map(e => ({
    ref: e.ref, fecha: e.fecha, tipo_egreso: e.tipoEgreso, id_obra: e.id, proveedor_id: e.proveedor,
    categoria: e.categoria, monto: e.monto, cuenta: e.cuenta, caja: e.caja, estado: e.estado,
    fecha_emision: e.fechaEmision, fecha_acreditacion: e.fechaAcreditacion, activo: e.activo,
    created_at: e.createdAt, created_by: ADMIN_ID, updated_at: e.updatedAt,
  }))))

out.push(insert('gastos_fijos',
  ['fecha', 'concepto', 'categoria', 'monto_previsto', 'monto_real', 'periodicidad', 'cuenta', 'tipo_caja', 'proveedor_id', 'estado', 'observaciones', 'activo', 'created_at', 'created_by', 'updated_at'],
  MOCK_GASTOS_FIJOS.map(g => ({
    fecha: g.fecha, concepto: g.concepto, categoria: g.categoria, monto_previsto: g.montoPrevisto,
    monto_real: g.montoReal, periodicidad: g.periodicidad, cuenta: g.cuenta, tipo_caja: g.tipoCaja,
    proveedor_id: g.proveedorId, estado: g.estado, observaciones: g.observaciones, activo: g.activo,
    created_at: g.createdAt, created_by: ADMIN_ID, updated_at: g.updatedAt,
  }))))

out.push(insert('variaciones',
  ['id_var', 'fecha', 'id_pres', 'cliente', 'tipo_var', 'descripcion', 'valor_anterior', 'valor_nuevo', 'impacto', 'canal', 'presup_nuevo', 'registrado_por', 'observaciones', 'activo', 'created_at', 'created_by', 'updated_at'],
  MOCK_VARIACIONES.map(v => ({
    id_var: v.idVar, fecha: v.fecha, id_pres: normalizeId(v.idPres), cliente: v.cliente, tipo_var: v.tipoVar,
    descripcion: v.descripcion, valor_anterior: v.valorAnterior, valor_nuevo: v.valorNuevo, impacto: v.impacto,
    canal: v.canal, presup_nuevo: normalizeId(v.presupNuevo), registrado_por: v.registradoPor, observaciones: v.observaciones,
    activo: v.activo, created_at: v.createdAt, created_by: ADMIN_ID, updated_at: v.updatedAt,
  }))))

out.push(insert('aprendizajes',
  ['id_apr', 'fecha_cierre', 'id_pres', 'cliente', 'categoria', 'que_salio_bien', 'que_salio_mal', 'causa_desvio', 'haria_diferente', 'aplica_a_futuras', 'registrado_por', 'observaciones', 'activo', 'created_at', 'created_by', 'updated_at'],
  MOCK_APRENDIZAJES.map(a => ({
    id_apr: a.idApr, fecha_cierre: a.fechaCierre, id_pres: normalizeId(a.idPres), cliente: a.cliente, categoria: a.categoria,
    que_salio_bien: a.queSalioBien, que_salio_mal: a.queSalioMal, causa_desvio: a.causaDesvio,
    haria_diferente: a.hariaDiferente, aplica_a_futuras: a.aplicaAFuturas, registrado_por: a.registradoPor,
    observaciones: a.observaciones, activo: a.activo, created_at: a.createdAt, created_by: ADMIN_ID, updated_at: a.updatedAt,
  }))))

console.log(out.join('\n'))
