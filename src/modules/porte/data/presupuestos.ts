import type { Categoria, EstadoComercial } from './config'

// ─── Presupuestos (01_PRESUPUESTOS) ───────────────────────────────────────────
// PR-XXXX es la llave universal: nace acá y acompaña la obra hasta el cierre.

export interface Presupuesto {
  id: string              // 'PR - XXXX'
  idNum?: number          // correlativo legacy, opcional
  fecha: string           // YYYY-MM-DD
  cliente: string
  descripcion: string
  categoria: Categoria
  responsable: string
  costoMat?: number
  costoMo?: number
  indVendidos?: number
  impuestos?: number
  comercial?: number
  beneficio?: number
  montoTotal?: number     // calculado = suma de los 6 anteriores
  estadoComercial: EstadoComercial
  vencimiento?: string    // YYYY-MM-DD
  observaciones?: string
  enviado: boolean
  activo: boolean
  createdAt: string        // ISO datetime
  createdBy: string         // id de usuario
  updatedAt: string
}

function calcMontoTotal(p: Pick<Presupuesto, 'costoMat' | 'costoMo' | 'indVendidos' | 'impuestos' | 'comercial' | 'beneficio'>): number | undefined {
  const { costoMat, costoMo, indVendidos, impuestos, comercial, beneficio } = p
  if ([costoMat, costoMo, indVendidos, impuestos, comercial, beneficio].some(v => v === undefined)) return undefined
  return (costoMat! + costoMo! + indVendidos! + impuestos! + comercial! + beneficio!)
}

export const MOCK_PRESUPUESTOS: Presupuesto[] = [
  { id: 'PR - 0596', fecha: '2026-07-28', cliente: 'FRIAS PABLO',              descripcion: 'CIEGA',                                                categoria: 'CORTINA',        responsable: 'Gonza', costoMat: 480000,  costoMo: 350000, indVendidos: 175000, impuestos: 47000,  comercial: 130000, beneficio: 78817.94, montoTotal: 1260817.94, estadoComercial: 'En presupuestación', enviado: false },
  { id: 'PR - 0593', fecha: '2026-07-25', cliente: 'COLEGIO SANTA TERESITA',    descripcion: 'MICROPERFORADA AUTOMATIZADA CON PUERTA DE ESCAPE',    categoria: 'CORTINA',        responsable: 'Gonza', costoMat: 1800000, costoMo: 1100000, indVendidos: 550000, impuestos: 155000, comercial: 430000, beneficio: 141391.15, montoTotal: 4176391.15, estadoComercial: 'En presupuestación', enviado: false },
  { id: 'PR - 0547', fecha: '2026-06-02', cliente: 'PROCON',                    descripcion: 'ESCALERA METALICA',                                    categoria: 'ESTRUCTURA',     responsable: 'Gonza', costoMat: 3200000, costoMo: 2100000, indVendidos: 1000000, impuestos: 280000, comercial: 780000, beneficio: 231545.10, montoTotal: 7591545.10, estadoComercial: 'Enviado', vencimiento: '2026-07-02', enviado: true },
  { id: 'PR - 0551', fecha: '2026-06-05', cliente: 'CASTRO ARIEL',              descripcion: 'CORTINA METALICA CIEGA AUTOMATIZADA CON MOTOR TUBULAR', categoria: 'CORTINA',        responsable: 'Gonza', costoMat: 900000,  costoMo: 620000, indVendidos: 310000, impuestos: 77000,  comercial: 190000, beneficio: -11214.02, montoTotal: 2085785.98, estadoComercial: 'Enviado', vencimiento: '2026-07-05', enviado: true },
  { id: 'PR - 0550', fecha: '2026-06-04', cliente: 'VILCA JULIA',               descripcion: 'LEVADIZO Y PUERTA DE ACCESO',                          categoria: 'PORTON',         responsable: 'Gonza', costoMat: 1450000, costoMo: 980000, indVendidos: 490000, impuestos: 126000, comercial: 310000, beneficio: 40775.70, montoTotal: 3396775.70, estadoComercial: 'Rechazado', vencimiento: '2026-06-25', enviado: true },
  { id: 'PR - 0542', fecha: '2026-05-28', cliente: 'LUQUE MARTIN',              descripcion: 'HOJA DE PUERTA BATIENTE',                              categoria: 'OTRO',           responsable: 'Gonza', costoMat: 250000,  costoMo: 180000, indVendidos: 90000,  impuestos: 22000,  comercial: 45000,  beneficio: 5693.32, montoTotal: 592693.32, estadoComercial: 'Cancelado', enviado: true },
  { id: 'PR - 0565', fecha: '2026-06-18', cliente: 'MAIZARES FERNANDA',         descripcion: 'LEVADIZO Y PUERTA DE ACCESO',                          categoria: 'PORTON',         responsable: 'Gonza', estadoComercial: 'Pedido', enviado: false },
  { id: 'PR - 0484', fecha: '2026-04-10', cliente: 'TSCHOPP SEBASTIAN',         descripcion: 'PORTON LEVADIZO GALVANIZADO',                          categoria: 'PORTON',         responsable: 'Gonza', costoMat: 1350000, costoMo: 950000, indVendidos: 475000, impuestos: 122000, comercial: 300000, beneficio: 161611.15, montoTotal: 3358611.15, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0552', fecha: '2026-06-06', cliente: 'CASTRO ARIEL',              descripcion: 'PORTON CORREDIZO AUTOMATIZADO',                        categoria: 'PORTON',         responsable: 'Gonza', costoMat: 692297.99, costoMo: 567288.40, indVendidos: 255863.82, impuestos: 68975.92, comercial: 288639.84, beneficio: 165697.21, montoTotal: 2038763.18, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0530', fecha: '2026-05-20', cliente: 'MARTEARENA BENITO',          descripcion: 'ESTRUCTURA METALICA GALPON',                           categoria: 'ESTRUCTURA',     responsable: 'Gonza', costoMat: 1400000, costoMo: 980000, indVendidos: 480000, impuestos: 125000, comercial: 195000, beneficio: 20912.95, montoTotal: 3200912.95, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0532', fecha: '2026-05-22', cliente: 'CHECA ESTELA',               descripcion: 'FRENTE DE ASADOR',                                     categoria: 'FRENTE ASADOR',  responsable: 'Gonza', costoMat: 220000,  costoMo: 150000, indVendidos: 75000,  impuestos: 19000,  comercial: 42000,  beneficio: 1732.08, montoTotal: 507732.08, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0536', fecha: '2026-05-25', cliente: 'MEDRANO EDUARDO',            descripcion: 'CORTINA METALICA CIEGA',                               categoria: 'CORTINA',        responsable: 'Gonza', costoMat: 1650000, costoMo: 1150000, indVendidos: 570000, impuestos: 145000, comercial: 260000, beneficio: 25366.26, montoTotal: 3800366.26, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0546', fecha: '2026-06-01', cliente: 'VILCA JULIA',                descripcion: 'PORTON LEVADIZO Y REJA',                               categoria: 'PORTON',         responsable: 'Gonza', costoMat: 1100000, costoMo: 780000, indVendidos: 390000, impuestos: 98000,  comercial: 165000, beneficio: 2266.37, montoTotal: 2535266.37, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0560', fecha: '2026-06-12', cliente: 'GERALA ANTONIO',             descripcion: 'ESTRUCTURA MENOR PARA GALERIA',                        categoria: 'ESTRUCTURA',     responsable: 'Gonza', costoMat: 160000,  costoMo: 110000, indVendidos: 55000,  impuestos: 14000,  comercial: 34000,  beneficio: 3667.18, montoTotal: 376667.18, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0581', fecha: '2026-07-10', cliente: 'ROMERO FACUNDO',             descripcion: 'PORTON DE CHAPA SIMPLE',                               categoria: 'PORTON',         responsable: 'Gonza', costoMat: undefined, costoMo: undefined, indVendidos: undefined, impuestos: undefined, comercial: undefined, beneficio: 410193.05, montoTotal: 410193.05, estadoComercial: 'Represupuestado', observaciones: 'Error de carga en el Excel original: montoTotal quedó igual al beneficio.', enviado: true },
  { id: 'PR - 0575', fecha: '2026-07-02', cliente: 'AGUIRRE SILVANA',            descripcion: 'CORTINA MICROPERFORADA MANUAL',                        categoria: 'CORTINA',        responsable: 'Gonza', costoMat: 520000,  costoMo: 360000, indVendidos: 180000, impuestos: 45000,  comercial: 95000,  beneficio: 12400,   montoTotal: 1212400, estadoComercial: 'En negociación', vencimiento: '2026-08-02', enviado: true },
  { id: 'PR - 0578', fecha: '2026-07-08', cliente: 'DOMINGUEZ RAUL',             descripcion: 'FRENTE DE ASADOR CON HERRAJES',                        categoria: 'FRENTE ASADOR',  responsable: 'Gonza', costoMat: 190000,  costoMo: 130000, indVendidos: 65000,  impuestos: 16500,  comercial: 36000,  beneficio: 4200,    montoTotal: 441700, estadoComercial: 'Enviado', vencimiento: '2026-08-08', enviado: true },
  { id: 'PR - 0584', fecha: '2026-07-15', cliente: 'FERNANDEZ LORENA',           descripcion: 'MANTENIMIENTO PORTON EXISTENTE',                       categoria: 'SERVICIO',       responsable: 'Gonza', costoMat: 40000,   costoMo: 60000,  indVendidos: 15000,  impuestos: 5000,   comercial: 8000,   beneficio: 2000,    montoTotal: 130000, estadoComercial: 'Aceptado', enviado: true },
  { id: 'PR - 0588', fecha: '2026-07-20', cliente: 'SOSA MARIANO',               descripcion: 'ESTRUCTURA PARA TINGLADO',                             categoria: 'ESTRUCTURA',     responsable: 'Gonza', estadoComercial: 'Pedido', enviado: false },
  { id: 'PR - 0590', fecha: '2026-07-22', cliente: 'PAZ CAROLINA',                descripcion: 'PORTON LEVADIZO CHICO',                                categoria: 'PORTON',         responsable: 'Gonza', costoMat: 780000,  costoMo: 540000, indVendidos: 270000, impuestos: 68000,  comercial: 150000, beneficio: 18500,   montoTotal: 1826500, estadoComercial: 'En presupuestación', enviado: false },
  { id: 'PR - 0592', fecha: '2026-07-24', cliente: 'NUÑEZ EZEQUIEL',              descripcion: 'CORTINA CIEGA MOTORIZADA',                             categoria: 'CORTINA',        responsable: 'Gonza', costoMat: 650000,  costoMo: 450000, indVendidos: 225000, impuestos: 57000,  comercial: 120000, beneficio: 9200,    montoTotal: 1511200, estadoComercial: 'Enviado', vencimiento: '2026-08-24', enviado: true },
].map(p => ({
  ...p,
  montoTotal: p.montoTotal ?? calcMontoTotal(p),
  activo: true,
  createdAt: `${p.fecha}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${p.fecha}T09:00:00.000Z`,
})) as Presupuesto[]
