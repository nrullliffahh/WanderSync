create table if not exists public.booking_vault_records (
  id uuid primary key default gen_random_uuid(),
  record_key text not null unique
    check (record_key in ('accommodation', 'sunway_lagoon')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  booking_reference text not null default '' check (char_length(booking_reference) <= 200),
  keybox_pin text not null default '' check (char_length(keybox_pin) <= 100),
  parking_lot text not null default '' check (char_length(parking_lot) <= 100),
  security_deposit numeric(10, 2) check (security_deposit is null or security_deposit >= 0),
  ticket_quantity integer check (ticket_quantity is null or ticket_quantity >= 0),
  locker_voucher text not null default '' check (char_length(locker_voucher) <= 200),
  locker_price numeric(10, 2) check (locker_price is null or locker_price >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_vault_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.booking_vault_records(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  file_path text not null unique,
  content_type text not null check (char_length(content_type) <= 120),
  file_size bigint not null check (file_size between 1 and 20971520),
  uploaded_at timestamptz not null default now()
);

insert into public.booking_vault_records (record_key, title)
values
  ('accommodation', 'The Colony Suites by SAS Global'),
  ('sunway_lagoon', 'Sunway Lagoon')
on conflict (record_key) do nothing;

alter table public.booking_vault_records enable row level security;
alter table public.booking_vault_files enable row level security;

revoke all on table public.booking_vault_records from anon, authenticated;
revoke all on table public.booking_vault_files from anon, authenticated;

grant select, update on table public.booking_vault_records to anon, authenticated;
grant select, insert, delete on table public.booking_vault_files to anon, authenticated;

drop policy if exists "Allow shared trip members to read booking vault records"
  on public.booking_vault_records;
create policy "Allow shared trip members to read booking vault records"
  on public.booking_vault_records for select to anon, authenticated
  using (true);

drop policy if exists "Allow shared trip members to update booking vault records"
  on public.booking_vault_records;
create policy "Allow shared trip members to update booking vault records"
  on public.booking_vault_records for update to anon, authenticated
  using (true)
  with check (
    char_length(trim(title)) between 1 and 160
    and char_length(booking_reference) <= 200
    and char_length(keybox_pin) <= 100
    and char_length(parking_lot) <= 100
    and (security_deposit is null or security_deposit >= 0)
    and (ticket_quantity is null or ticket_quantity >= 0)
    and char_length(locker_voucher) <= 200
    and (locker_price is null or locker_price >= 0)
  );

drop policy if exists "Allow shared trip members to read booking vault files"
  on public.booking_vault_files;
create policy "Allow shared trip members to read booking vault files"
  on public.booking_vault_files for select to anon, authenticated
  using (true);

drop policy if exists "Allow shared trip members to add booking vault files"
  on public.booking_vault_files;
create policy "Allow shared trip members to add booking vault files"
  on public.booking_vault_files for insert to anon, authenticated
  with check (
    char_length(trim(file_name)) between 1 and 255
    and file_size between 1 and 20971520
  );

drop policy if exists "Allow shared trip members to delete booking vault files"
  on public.booking_vault_files;
create policy "Allow shared trip members to delete booking vault files"
  on public.booking_vault_files for delete to anon, authenticated
  using (true);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'booking-vault-files',
  'booking-vault-files',
  false,
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
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow shared trip members to read booking vault storage"
  on storage.objects;
create policy "Allow shared trip members to read booking vault storage"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'booking-vault-files');

drop policy if exists "Allow shared trip members to upload booking vault files"
  on storage.objects;
create policy "Allow shared trip members to upload booking vault files"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'booking-vault-files');

drop policy if exists "Allow shared trip members to delete booking vault files"
  on storage.objects;
create policy "Allow shared trip members to delete booking vault files"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'booking-vault-files');
