-- ─── PORTE — Paso 25: profiles legibles por todo el equipo autenticado ─────
-- Hasta ahora cada usuario solo podía leer su propio perfil
-- (lectura_propio_perfil, 0007), pensado únicamente para que el login
-- resuelva el rol propio. Pantallas como Registros (MisRegistrosPage)
-- necesitan mostrar el nombre de quien creó cada fila, no solo el propio —
-- sin esto la UI cae al UUID crudo de auth.uid(). `nombre`/`role`/`activo`
-- no son datos sensibles (no incluye email, que vive en auth.users) — se
-- habilita lectura completa de profiles para cualquier admin/data_entry,
-- igual que el resto de las tablas de negocio (ver auth_role() en 0005).
create policy "lectura_equipo" on profiles for select
  using (auth_role() in ('admin', 'data_entry'));
