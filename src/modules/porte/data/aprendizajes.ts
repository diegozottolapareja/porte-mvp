import type { Categoria, CausaDesvio } from './config'

// ─── Aprendizajes (08_APRENDIZAJES) ───────────────────────────────────────────
// Retrospectiva al cerrar la obra.

export interface Aprendizaje {
  idApr: string          // 'APR-XXXX'
  fechaCierre: string
  idPres: string
  cliente: string
  categoria: Categoria
  queSalioBien: string
  queSalioMal: string
  causaDesvio: CausaDesvio
  hariaDiferente: string
  aplicaAFuturas: boolean
  registradoPor: string
  observaciones?: string
  activo: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
}

const RAW_APRENDIZAJES: Omit<Aprendizaje, 'activo' | 'createdAt' | 'createdBy' | 'updatedAt'>[] = [
  { idApr: 'APR-0001', fechaCierre: '2026-06-01', idPres: 'PR-0484', cliente: 'TSCHOPP SEBASTIAN', categoria: 'PORTON', queSalioBien: 'El módulo de anclaje estándar funcionó perfecto, sin ajustes en obra', queSalioMal: 'El plazo de pintura se extendió 2 días por lluvia', causaDesvio: 'Estimación', hariaDiferente: 'Agregar día buffer en presupuesto para trabajos con pintura exterior', aplicaAFuturas: true, registradoPor: 'Gonza' },
]

export const MOCK_APRENDIZAJES: Aprendizaje[] = RAW_APRENDIZAJES.map(a => ({
  ...a,
  activo: true,
  createdAt: `${a.fechaCierre}T09:00:00.000Z`,
  createdBy: 'demo-admin',
  updatedAt: `${a.fechaCierre}T09:00:00.000Z`,
}))
