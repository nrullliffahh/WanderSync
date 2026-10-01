alter table public.trip_roles
  alter column id set default gen_random_uuid()::text,
  add column if not exists icon text;

alter table public.trip_roles enable row level security;

revoke all on table public.trip_roles from anon, authenticated;
grant select, insert, update, delete
  on table public.trip_roles to anon, authenticated;

drop policy if exists "Allow shared trip members to read roles"
  on public.trip_roles;
drop policy if exists "Allow shared trip members to add roles"
  on public.trip_roles;
drop policy if exists "Allow shared trip members to update roles"
  on public.trip_roles;
drop policy if exists "Allow shared trip members to delete roles"
  on public.trip_roles;

create policy "Allow shared trip members to read roles"
  on public.trip_roles for select to anon, authenticated using (true);

create policy "Allow shared trip members to add roles"
  on public.trip_roles for insert to anon, authenticated
  with check (char_length(trim(name)) between 1 and 80);

create policy "Allow shared trip members to update roles"
  on public.trip_roles for update to anon, authenticated
  using (true)
  with check (char_length(trim(name)) between 1 and 80);

create policy "Allow shared trip members to delete roles"
  on public.trip_roles for delete to anon, authenticated using (true);

insert into public.trip_roles (name, description, assignee_id, icon)
select
  suggested.name,
  suggested.description,
  travelers.id,
  suggested.icon
from (
  values
    (
      'Trip Leader / PIC',
      'Master schedule coordination, final decision-making, pedestrian and public transit navigation.',
      'Iffah Afiqah',
      'compass'
    ),
    (
      'Booking & Reservations',
      'Early ticket purchases, Colony Suites liaison, check-in/out procedures, and QR code storage.',
      'Syahindah Batrishia',
      'ticket'
    ),
    (
      'Lead Driver',
      'Vehicle navigation, toll management, and RFID / Touch ''n Go card balance monitoring.',
      'Syauqina Qistina',
      'car'
    ),
    (
      'Treasurer / Money Master',
      'Shared pool fund management, collective payments, and transparent expense recording.',
      'Iffah Afiqah',
      'wallet'
    )
) as suggested(name, description, assignee_name, icon)
join public.travelers as travelers on travelers.name = suggested.assignee_name
where not exists (
  select 1
  from public.trip_roles as existing
  where existing.name = suggested.name
);
