-- ─── PORTE — Paso 4b: RLS sobre profiles (faltaba en el spec original) ────
-- Supabase habilita RLS automáticamente en toda tabla nueva de public sin
-- policies — profiles se quedó bloqueada por completo. Cada usuario puede
-- leer su propio perfil (lo necesita el login para resolver el rol).

create policy "lectura_propio_perfil" on profiles for select
  using (auth.uid() = id);
