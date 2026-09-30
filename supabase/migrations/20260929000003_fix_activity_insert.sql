alter table public.itinerary_activities
  alter column id set default gen_random_uuid();

grant insert on table public.itinerary_activities to anon, authenticated;

drop policy if exists "Allow shared trip members to add activities"
  on public.itinerary_activities;

create policy "Allow shared trip members to add activities"
  on public.itinerary_activities for insert to anon, authenticated
  with check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrisia',
      'Syauqina Qistina'
    )
  );
