update public.travelers
set name = 'Syahindah Batrishia'
where name = 'Syahindah Batrisia';

alter table public.itinerary_activities
  drop constraint if exists itinerary_activities_created_by_check;

update public.itinerary_activities
set created_by = 'Syahindah Batrishia'
where created_by = 'Syahindah Batrisia';

alter table public.itinerary_activities
  add constraint itinerary_activities_created_by_check
  check (
    created_by is null
    or created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  );

alter table public.budget_items
  drop constraint if exists budget_items_created_by_check;

update public.budget_items
set created_by = 'Syahindah Batrishia'
where created_by = 'Syahindah Batrisia';

alter table public.budget_items
  add constraint budget_items_created_by_check
  check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  );

update public.splitwise_people
set name = 'Syahindah Batrishia'
where name = 'Syahindah Batrisia'
  and not exists (
    select 1
    from public.splitwise_people as existing
    where lower(trim(existing.name)) = lower('Syahindah Batrishia')
  );

drop policy if exists "Allow shared trip members to update traveler selection"
  on public.travelers;
create policy "Allow shared trip members to update traveler selection"
  on public.travelers for update to anon, authenticated
  using (
    name in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  )
  with check (
    name in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  );

drop policy if exists "Allow shared trip members to add activities"
  on public.itinerary_activities;
create policy "Allow shared trip members to add activities"
  on public.itinerary_activities for insert to anon, authenticated
  with check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  );

drop policy if exists "Allow shared trip members to update activities"
  on public.itinerary_activities;
create policy "Allow shared trip members to update activities"
  on public.itinerary_activities for update to anon, authenticated
  using (true) with check (
    created_by is null
    or created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  );

drop policy if exists "Allow shared trip members to add budget items"
  on public.budget_items;
create policy "Allow shared trip members to add budget items"
  on public.budget_items for insert to anon, authenticated
  with check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
    and amount > 0
    and category in ('food', 'activities', 'transport')
  );

drop policy if exists "Allow shared trip members to update budget items"
  on public.budget_items;
create policy "Allow shared trip members to update budget items"
  on public.budget_items for update to anon, authenticated
  using (true)
  with check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
    and amount > 0
    and category in ('food', 'activities', 'transport')
  );

drop policy if exists "Allow shared trip members to add checklist completions"
  on public.checklist_item_completions;
create policy "Allow shared trip members to add checklist completions"
  on public.checklist_item_completions
  for insert to anon, authenticated
  with check (
    exists (
      select 1
      from public.travelers
      where travelers.id = checklist_item_completions.traveler_id
        and travelers.name in (
          'Iffah Afiqah',
          'Syahindah Batrishia',
          'Syauqina Qistina'
        )
    )
  );

drop policy if exists "Allow shared trip members to add checklist groups"
  on public.checklist_groups;
create policy "Allow shared trip members to add checklist groups"
  on public.checklist_groups for insert to anon, authenticated
  with check (
    char_length(trim(title)) between 1 and 100
    and char_length(trim(short_title)) between 1 and 100
    and (
      owner_traveler_id is null
      or exists (
        select 1
        from public.travelers
        where travelers.id = checklist_groups.owner_traveler_id
          and travelers.name in (
            'Iffah Afiqah',
            'Syahindah Batrishia',
            'Syauqina Qistina'
          )
      )
    )
  );

drop policy if exists "Allow shared trip members to update checklist groups"
  on public.checklist_groups;
create policy "Allow shared trip members to update checklist groups"
  on public.checklist_groups for update to anon, authenticated
  using (true)
  with check (
    char_length(trim(title)) between 1 and 100
    and char_length(trim(short_title)) between 1 and 100
    and (
      owner_traveler_id is null
      or exists (
        select 1
        from public.travelers
        where travelers.id = checklist_groups.owner_traveler_id
          and travelers.name in (
            'Iffah Afiqah',
            'Syahindah Batrishia',
            'Syauqina Qistina'
          )
      )
    )
  );
