-- ─── PORTE — Paso 5: usuarios demo en Supabase Auth + profiles ────────────
-- Inserción directa en auth.users (técnica estándar cuando no se usa la
-- Admin API) — equivalente a "Add user" desde el dashboard con Auto Confirm.

do $$
declare
  admin_id uuid := gen_random_uuid();
  dataentry_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values
  (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
    'admin@porte.com', crypt('Enfermo@1985', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', false
  ),
  (
    '00000000-0000-0000-0000-000000000000', dataentry_id, 'authenticated', 'authenticated',
    'carga@porte.com', crypt('Enfermo@1985', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', false
  );

  insert into profiles (id, nombre, role) values
    (admin_id, 'Gonza', 'admin'),
    (dataentry_id, 'Carga de datos', 'data_entry');
end $$;
