-- ─── PORTE — Paso 17: adjuntar el comprobante original a egresos por factura ──
-- Hasta ahora el asistente descartaba el PDF/imagen de la factura después de
-- extraer los datos — solo quedaba la extracción estructurada, no el archivo
-- original. Se agrega un bucket privado para guardarlo y un link desde el
-- egreso creado, para poder verlo/descargarlo después.

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- Mismo criterio que las tablas (auth_role() definida en 0005_rls.sql): solo
-- admin/data_entry autenticados pueden generar signed URLs para leer objetos
-- de este bucket. Las escrituras las hace únicamente el backend con el
-- service role (createAdminClient), que ya bypasea RLS — no hace falta
-- policy de insert/update acá.
create policy "lectura_autenticados_comprobantes" on storage.objects for select
  using (bucket_id = 'comprobantes' and auth_role() in ('admin', 'data_entry'));

alter table egresos
  add column comprobante_path text;
