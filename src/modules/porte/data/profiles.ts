// ─── Perfiles de usuario (equipo) ───────────────────────────────────────────
// Solo lectura desde el store — el alta de usuarios se hace fuera de la app
// (Supabase Auth + trigger que inserta la fila en profiles).

export interface Profile {
  id: string
  nombre: string
  role: 'admin' | 'data_entry'
  activo: boolean
}
