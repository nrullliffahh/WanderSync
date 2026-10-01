drop policy if exists "Allow shared trip members to add budget items"
  on public.budget_items;
drop policy if exists "Allow shared trip members to update budget items"
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
