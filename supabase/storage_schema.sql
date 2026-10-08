-- ============================================================
-- SCRIPT PARA CREAR BUCKET DE COMPROBANTES Y POLÍTICAS
-- Ejecuta este script en Supabase: SQL Editor > New query > Run
-- ============================================================

-- Crear bucket si no existe
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Eliminar políticas previas para poder re-ejecutar el script sin errores
drop policy if exists "Usuarios autenticados pueden subir comprobantes" on storage.objects;
drop policy if exists "Cualquiera puede ver comprobantes" on storage.objects;
drop policy if exists "Cualquiera puede subir comprobantes al bucket receipts" on storage.objects;

-- Permitir subir comprobantes a usuarios autenticados E invitados (compra sin cuenta)
create policy "Cualquiera puede subir comprobantes al bucket receipts"
  on storage.objects for insert
  with check ( bucket_id = 'receipts' );

-- Permitir a cualquier usuario ver las imágenes (los admin necesitan verlas)
create policy "Cualquiera puede ver comprobantes"
  on storage.objects for select
  using ( bucket_id = 'receipts' );
