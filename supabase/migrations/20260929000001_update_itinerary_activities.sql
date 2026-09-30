alter table public.itinerary_activities
  add column if not exists tags text[] not null default '{}',
  add column if not exists created_by text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'itinerary_activities_created_by_check'
      and conrelid = 'public.itinerary_activities'::regclass
  ) then
    alter table public.itinerary_activities
      add constraint itinerary_activities_created_by_check
      check (
        created_by is null
        or created_by in (
          'Iffah Afiqah',
          'Syahindah Batrisia',
          'Syauqina Qistina'
        )
      );
  end if;
end;
$$;

alter table public.itinerary_activities enable row level security;

revoke all on table public.itinerary_activities from anon, authenticated;
grant select (
  id,
  day_number,
  start_time,
  title,
  location,
  transport,
  travel_duration,
  activity_duration,
  tags,
  notes,
  image_url,
  is_favorite,
  created_by
) on table public.itinerary_activities to anon, authenticated;
grant insert (
  day_number,
  start_time,
  title,
  location,
  transport,
  travel_duration,
  activity_duration,
  tags,
  notes,
  image_url,
  is_favorite,
  created_by
) on table public.itinerary_activities to anon, authenticated;
grant update (
  day_number,
  start_time,
  title,
  location,
  transport,
  travel_duration,
  activity_duration,
  tags,
  notes,
  image_url,
  is_favorite
) on table public.itinerary_activities to anon, authenticated;
grant delete on table public.itinerary_activities to anon, authenticated;

drop policy if exists "Allow shared trip members to read activities"
  on public.itinerary_activities;
drop policy if exists "Allow shared trip members to add activities"
  on public.itinerary_activities;
drop policy if exists "Allow shared trip members to update activities"
  on public.itinerary_activities;
drop policy if exists "Allow shared trip members to delete activities"
  on public.itinerary_activities;

create policy "Allow shared trip members to read activities"
  on public.itinerary_activities for select to anon, authenticated using (true);

create policy "Allow shared trip members to add activities"
  on public.itinerary_activities for insert to anon, authenticated
  with check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrisia',
      'Syauqina Qistina'
    )
  );

create policy "Allow shared trip members to update activities"
  on public.itinerary_activities for update to anon, authenticated
  using (true) with check (
    created_by is null
    or created_by in (
      'Iffah Afiqah',
      'Syahindah Batrisia',
      'Syauqina Qistina'
    )
  );

create policy "Allow shared trip members to delete activities"
  on public.itinerary_activities for delete to anon, authenticated using (true);
