alter table public.travelers
  add column if not exists last_selected_at timestamptz;

insert into public.travelers (name)
select profiles.name
from (
  values
    ('Iffah Afiqah'),
    ('Syahindah Batrisia'),
    ('Syauqina Qistina')
) as profiles(name)
where not exists (
  select 1
  from public.travelers existing
  where existing.name = profiles.name
);

alter table public.travelers enable row level security;

revoke all on table public.travelers from anon, authenticated;
grant select (id, name) on table public.travelers to anon, authenticated;
grant update (last_selected_at) on table public.travelers to anon, authenticated;

drop policy if exists "Allow shared trip members to read travelers"
  on public.travelers;
drop policy if exists "Allow shared trip members to update traveler selection"
  on public.travelers;

create policy "Allow shared trip members to read travelers"
  on public.travelers for select to anon, authenticated using (true);

create policy "Allow shared trip members to update traveler selection"
  on public.travelers for update to anon, authenticated
  using (
    name in (
      'Iffah Afiqah',
      'Syahindah Batrisia',
      'Syauqina Qistina'
    )
  )
  with check (
    name in (
      'Iffah Afiqah',
      'Syahindah Batrisia',
      'Syauqina Qistina'
    )
  );
