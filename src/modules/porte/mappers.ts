// ─── Mapeo snake_case (DB) ↔ camelCase (frontend) — una función por entidad ──
import type { Ingreso } from './data/ingresos'
import type { Egreso } from './data/egresos'
import type { Presupuesto } from './data/presupuestos'
import type { Venta } from './data/ventas'
import type { Proveedor } from './data/proveedores'
import type { GastoFijo } from './data/gastosFijos'
import type { Variacion } from './data/variaciones'
import type { Aprendizaje } from './data/aprendizajes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export function rowToIngreso(r: Row): Ingreso {
  return {
    fecha: r.fecha, tipoIngreso: r.tipo_ingreso, id: r.id_obra, concepto: r.concepto ?? '',
    monto: Number(r.monto), cuenta: r.cuenta, caja: r.caja, estado: r.estado, ref: r.ref,
    activo: r.activo, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function ingresoToRow(i: Partial<Ingreso>): Row {
  const row: Row = {}
  if (i.fecha !== undefined) row.fecha = i.fecha
  if (i.tipoIngreso !== undefined) row.tipo_ingreso = i.tipoIngreso
  if (i.id !== undefined) row.id_obra = i.id
  if (i.concepto !== undefined) row.concepto = i.concepto
  if (i.monto !== undefined) row.monto = i.monto
  if (i.cuenta !== undefined) row.cuenta = i.cuenta
  if (i.caja !== undefined) row.caja = i.caja
  if (i.estado !== undefined) row.estado = i.estado
  if (i.activo !== undefined) row.activo = i.activo
  return row
}

export function rowToEgreso(r: Row): Egreso {
  return {
    fecha: r.fecha, tipoEgreso: r.tipo_egreso, id: r.id_obra ?? undefined, proveedor: r.proveedor_id ?? undefined,
    categoria: r.categoria, monto: Number(r.monto), cuenta: r.cuenta, caja: r.caja, estado: r.estado, ref: r.ref,
    fechaEmision: r.fecha_emision ?? undefined, fechaAcreditacion: r.fecha_acreditacion ?? undefined,
    activo: r.activo, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function egresoToRow(e: Partial<Egreso>): Row {
  const row: Row = {}
  if (e.fecha !== undefined) row.fecha = e.fecha
  if (e.tipoEgreso !== undefined) row.tipo_egreso = e.tipoEgreso
  if (e.id !== undefined) row.id_obra = e.id ?? null
  if (e.proveedor !== undefined) row.proveedor_id = e.proveedor ?? null
  if (e.categoria !== undefined) row.categoria = e.categoria
  if (e.monto !== undefined) row.monto = e.monto
  if (e.cuenta !== undefined) row.cuenta = e.cuenta
  if (e.caja !== undefined) row.caja = e.caja
  if (e.estado !== undefined) row.estado = e.estado
  if (e.fechaEmision !== undefined) row.fecha_emision = e.fechaEmision ?? null
  if (e.fechaAcreditacion !== undefined) row.fecha_acreditacion = e.fechaAcreditacion ?? null
  if (e.activo !== undefined) row.activo = e.activo
  return row
}

export function rowToPresupuesto(r: Row): Presupuesto {
  return {
    id: r.id, idNum: r.id_num ?? undefined, fecha: r.fecha, cliente: r.cliente, descripcion: r.descripcion ?? '',
    categoria: r.categoria, responsable: r.responsable ?? '', costoMat: r.costo_mat ?? undefined,
    costoMo: r.costo_mo ?? undefined, indVendidos: r.ind_vendidos ?? undefined, impuestos: r.impuestos ?? undefined,
    comercial: r.comercial ?? undefined, beneficio: r.beneficio ?? undefined, montoTotal: r.monto_total ?? undefined,
    estadoComercial: r.estado_comercial, vencimiento: r.vencimiento ?? undefined, observaciones: r.observaciones ?? undefined,
    enviado: r.enviado, activo: r.activo, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function presupuestoToRow(p: Partial<Presupuesto>): Row {
  const row: Row = {}
  if (p.id !== undefined) row.id = p.id
  if (p.idNum !== undefined) row.id_num = p.idNum ?? null
  if (p.fecha !== undefined) row.fecha = p.fecha
  if (p.cliente !== undefined) row.cliente = p.cliente
  if (p.descripcion !== undefined) row.descripcion = p.descripcion
  if (p.categoria !== undefined) row.categoria = p.categoria
  if (p.responsable !== undefined) row.responsable = p.responsable
  if (p.costoMat !== undefined) row.costo_mat = p.costoMat ?? null
  if (p.costoMo !== undefined) row.costo_mo = p.costoMo ?? null
  if (p.indVendidos !== undefined) row.ind_vendidos = p.indVendidos ?? null
  if (p.impuestos !== undefined) row.impuestos = p.impuestos ?? null
  if (p.comercial !== undefined) row.comercial = p.comercial ?? null
  if (p.beneficio !== undefined) row.beneficio = p.beneficio ?? null
  // monto_total es columna generada — nunca se envía
  if (p.estadoComercial !== undefined) row.estado_comercial = p.estadoComercial
  if (p.vencimiento !== undefined) row.vencimiento = p.vencimiento ?? null
  if (p.observaciones !== undefined) row.observaciones = p.observaciones ?? null
  if (p.enviado !== undefined) row.enviado = p.enviado
  if (p.activo !== undefined) row.activo = p.activo
  return row
}

export function rowToVenta(r: Row): Venta {
  return {
    id: r.id, cliente: r.cliente, montoTotal: Number(r.monto_total), mater: Number(r.mater ?? 0),
    mo: Number(r.mo ?? 0), indVend: Number(r.ind_vend ?? 0), imp: Number(r.imp ?? 0), comerc: Number(r.comerc ?? 0),
    benef: Number(r.benef ?? 0), fechaCierre: r.fecha_cierre, condPago: r.cond_pago ?? undefined,
    dias: r.dias ?? undefined, vencCobro: r.venc_cobro ?? undefined, cajaIntenc: r.caja_intenc ?? undefined,
    ventaFinal: Number(r.venta_final), motivoDif: r.motivo_dif ?? undefined, entregaCompr: r.entrega_compr ?? undefined,
    entregaReal: r.entrega_real ?? undefined, estadoOp: r.estado_op, respOp: r.resp_op ?? '',
    createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function ventaToRow(v: Partial<Venta>): Row {
  const row: Row = {}
  if (v.id !== undefined) row.id = v.id
  if (v.cliente !== undefined) row.cliente = v.cliente
  if (v.montoTotal !== undefined) row.monto_total = v.montoTotal
  if (v.mater !== undefined) row.mater = v.mater
  if (v.mo !== undefined) row.mo = v.mo
  if (v.indVend !== undefined) row.ind_vend = v.indVend
  if (v.imp !== undefined) row.imp = v.imp
  if (v.comerc !== undefined) row.comerc = v.comerc
  if (v.benef !== undefined) row.benef = v.benef
  if (v.fechaCierre !== undefined) row.fecha_cierre = v.fechaCierre
  if (v.condPago !== undefined) row.cond_pago = v.condPago ?? null
  if (v.dias !== undefined) row.dias = v.dias ?? null
  if (v.vencCobro !== undefined) row.venc_cobro = v.vencCobro ?? null
  if (v.cajaIntenc !== undefined) row.caja_intenc = v.cajaIntenc ?? null
  if (v.ventaFinal !== undefined) row.venta_final = v.ventaFinal
  if (v.motivoDif !== undefined) row.motivo_dif = v.motivoDif ?? null
  if (v.entregaCompr !== undefined) row.entrega_compr = v.entregaCompr ?? null
  if (v.entregaReal !== undefined) row.entrega_real = v.entregaReal ?? null
  if (v.estadoOp !== undefined) row.estado_op = v.estadoOp
  if (v.respOp !== undefined) row.resp_op = v.respOp
  return row
}

export function rowToProveedor(r: Row): Proveedor {
  return {
    idProv: r.id_prov, nombre: r.nombre, rubro: r.rubro ?? '', contacto: r.contacto ?? '', telefono: r.telefono ?? '',
    condicionHabitual: r.condicion_habitual ?? undefined, plazoDias: r.plazo_dias ?? undefined,
    cuentaBanco: r.cuenta_banco ?? undefined, tipoCaja: r.tipo_caja,
    saldoCc: Number(r.saldo_cc_actual ?? r.saldo_inicial ?? 0),
    fechaSaldoInicial: r.fecha_saldo_inicial, activo: r.activo, observaciones: r.observaciones ?? undefined,
    createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function proveedorToRow(p: Partial<Proveedor>): Row {
  const row: Row = {}
  if (p.idProv !== undefined) row.id_prov = p.idProv
  if (p.nombre !== undefined) row.nombre = p.nombre
  if (p.rubro !== undefined) row.rubro = p.rubro
  if (p.contacto !== undefined) row.contacto = p.contacto
  if (p.telefono !== undefined) row.telefono = p.telefono
  if (p.condicionHabitual !== undefined) row.condicion_habitual = p.condicionHabitual ?? null
  if (p.plazoDias !== undefined) row.plazo_dias = p.plazoDias ?? null
  if (p.cuentaBanco !== undefined) row.cuenta_banco = p.cuentaBanco ?? null
  if (p.tipoCaja !== undefined) row.tipo_caja = p.tipoCaja
  if (p.saldoCc !== undefined) row.saldo_inicial = p.saldoCc
  if (p.fechaSaldoInicial !== undefined) row.fecha_saldo_inicial = p.fechaSaldoInicial
  if (p.activo !== undefined) row.activo = p.activo
  if (p.observaciones !== undefined) row.observaciones = p.observaciones ?? null
  return row
}

export function rowToGastoFijo(r: Row): GastoFijo {
  return {
    fecha: r.fecha, concepto: r.concepto, categoria: r.categoria, montoPrevisto: Number(r.monto_previsto ?? 0),
    montoReal: r.monto_real === null ? null : Number(r.monto_real), periodicidad: r.periodicidad, cuenta: r.cuenta,
    tipoCaja: r.tipo_caja, proveedorId: r.proveedor_id, estado: r.estado, observaciones: r.observaciones ?? undefined,
    activo: r.activo, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function gastoFijoToRow(g: Partial<GastoFijo>): Row {
  const row: Row = {}
  if (g.fecha !== undefined) row.fecha = g.fecha
  if (g.concepto !== undefined) row.concepto = g.concepto
  if (g.categoria !== undefined) row.categoria = g.categoria
  if (g.montoPrevisto !== undefined) row.monto_previsto = g.montoPrevisto
  if (g.montoReal !== undefined) row.monto_real = g.montoReal
  if (g.periodicidad !== undefined) row.periodicidad = g.periodicidad
  if (g.cuenta !== undefined) row.cuenta = g.cuenta
  if (g.tipoCaja !== undefined) row.tipo_caja = g.tipoCaja
  if (g.proveedorId !== undefined) row.proveedor_id = g.proveedorId
  if (g.estado !== undefined) row.estado = g.estado
  if (g.observaciones !== undefined) row.observaciones = g.observaciones ?? null
  if (g.activo !== undefined) row.activo = g.activo
  return row
}

export function rowToVariacion(r: Row): Variacion {
  return {
    idVar: r.id_var, fecha: r.fecha, idPres: r.id_pres, cliente: r.cliente ?? '', tipoVar: r.tipo_var,
    descripcion: r.descripcion ?? '', valorAnterior: r.valor_anterior ?? '', valorNuevo: r.valor_nuevo ?? '',
    impacto: Number(r.impacto ?? 0), canal: r.canal ?? '', presupNuevo: r.presup_nuevo ?? undefined,
    registradoPor: r.registrado_por ?? '', observaciones: r.observaciones ?? undefined, activo: r.activo,
    createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function variacionToRow(v: Partial<Variacion>): Row {
  const row: Row = {}
  if (v.idVar !== undefined) row.id_var = v.idVar
  if (v.fecha !== undefined) row.fecha = v.fecha
  if (v.idPres !== undefined) row.id_pres = v.idPres
  if (v.cliente !== undefined) row.cliente = v.cliente
  if (v.tipoVar !== undefined) row.tipo_var = v.tipoVar
  if (v.descripcion !== undefined) row.descripcion = v.descripcion
  if (v.valorAnterior !== undefined) row.valor_anterior = v.valorAnterior
  if (v.valorNuevo !== undefined) row.valor_nuevo = v.valorNuevo
  if (v.impacto !== undefined) row.impacto = v.impacto
  if (v.canal !== undefined) row.canal = v.canal
  if (v.presupNuevo !== undefined) row.presup_nuevo = v.presupNuevo ?? null
  if (v.registradoPor !== undefined) row.registrado_por = v.registradoPor
  if (v.observaciones !== undefined) row.observaciones = v.observaciones ?? null
  if (v.activo !== undefined) row.activo = v.activo
  return row
}

export function rowToAprendizaje(r: Row): Aprendizaje {
  return {
    idApr: r.id_apr, fechaCierre: r.fecha_cierre, idPres: r.id_pres, cliente: r.cliente ?? '', categoria: r.categoria,
    queSalioBien: r.que_salio_bien ?? '', queSalioMal: r.que_salio_mal ?? '', causaDesvio: r.causa_desvio,
    hariaDiferente: r.haria_diferente ?? '', aplicaAFuturas: r.aplica_a_futuras ?? false, registradoPor: r.registrado_por ?? '',
    observaciones: r.observaciones ?? undefined, activo: r.activo, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at,
  }
}
export function aprendizajeToRow(a: Partial<Aprendizaje>): Row {
  const row: Row = {}
  if (a.idApr !== undefined) row.id_apr = a.idApr
  if (a.fechaCierre !== undefined) row.fecha_cierre = a.fechaCierre
  if (a.idPres !== undefined) row.id_pres = a.idPres
  if (a.cliente !== undefined) row.cliente = a.cliente
  if (a.categoria !== undefined) row.categoria = a.categoria
  if (a.queSalioBien !== undefined) row.que_salio_bien = a.queSalioBien
  if (a.queSalioMal !== undefined) row.que_salio_mal = a.queSalioMal
  if (a.causaDesvio !== undefined) row.causa_desvio = a.causaDesvio
  if (a.hariaDiferente !== undefined) row.haria_diferente = a.hariaDiferente
  if (a.aplicaAFuturas !== undefined) row.aplica_a_futuras = a.aplicaAFuturas
  if (a.registradoPor !== undefined) row.registrado_por = a.registradoPor
  if (a.observaciones !== undefined) row.observaciones = a.observaciones ?? null
  if (a.activo !== undefined) row.activo = a.activo
  return row
}
