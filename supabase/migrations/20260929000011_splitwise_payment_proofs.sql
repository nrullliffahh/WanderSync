alter table public.splitwise_settlements
  add column if not exists proof_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'splitwise-payment-proofs',
  'splitwise-payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow shared trip members to read Splitwise payment proofs"
  on storage.objects;
create policy "Allow shared trip members to read Splitwise payment proofs"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'splitwise-payment-proofs');

drop policy if exists "Allow shared trip members to add Splitwise payment proofs"
  on storage.objects;
create policy "Allow shared trip members to add Splitwise payment proofs"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'splitwise-payment-proofs');

drop policy if exists "Allow shared trip members to delete Splitwise payment proofs"
  on storage.objects;
create policy "Allow shared trip members to delete Splitwise payment proofs"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'splitwise-payment-proofs');
