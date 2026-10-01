alter table public.budget_items
  alter column id set default gen_random_uuid(),
  add column if not exists item_name text not null default '',
  add column if not exists route_or_day text not null default 'Trip expense',
  add column if not exists is_shared boolean not null default true,
  add column if not exists created_by text not null default 'Iffah Afiqah';

alter table public.budget_items
  drop constraint if exists budget_items_created_by_check;

alter table public.budget_items
  add constraint budget_items_created_by_check
  check (
    created_by in (
      'Iffah Afiqah',
      'Syahindah Batrishia',
      'Syauqina Qistina'
    )
  );

alter table public.budget_items enable row level security;

revoke all on table public.budget_items from anon, authenticated;
grant select on table public.budget_items to anon, authenticated;
grant insert on table public.budget_items to anon, authenticated;
grant update on table public.budget_items to anon, authenticated;
grant delete on table public.budget_items to anon, authenticated;

drop policy if exists "Allow shared trip members to read budget items"
  on public.budget_items;
drop policy if exists "Allow shared trip members to add budget items"
  on public.budget_items;
drop policy if exists "Allow shared trip members to update budget items"
  on public.budget_items;
drop policy if exists "Allow shared trip members to delete budget items"
  on public.budget_items;

create policy "Allow shared trip members to read budget items"
  on public.budget_items for select to anon, authenticated using (true);

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

create policy "Allow shared trip members to delete budget items"
  on public.budget_items for delete to anon, authenticated using (true);
