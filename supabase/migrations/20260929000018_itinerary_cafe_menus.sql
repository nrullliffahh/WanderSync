alter table public.itinerary_activities
  add column if not exists menu_file_path text;

grant select (menu_file_path)
  on table public.itinerary_activities to anon, authenticated;
grant insert (menu_file_path)
  on table public.itinerary_activities to anon, authenticated;
grant update (menu_file_path)
  on table public.itinerary_activities to anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'itinerary-cafe-menus',
  'itinerary-cafe-menus',
  true,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow shared trip members to upload itinerary cafe menus"
  on storage.objects;
create policy "Allow shared trip members to upload itinerary cafe menus"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'itinerary-cafe-menus');

drop policy if exists "Allow shared trip members to delete itinerary cafe menus"
  on storage.objects;
create policy "Allow shared trip members to delete itinerary cafe menus"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'itinerary-cafe-menus');
