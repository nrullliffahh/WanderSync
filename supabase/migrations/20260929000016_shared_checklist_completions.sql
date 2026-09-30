create table if not exists public.checklist_shared_item_completions (
  checklist_item_id text primary key
    references public.checklist_items(id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.checklist_shared_item_completions enable row level security;

revoke all on table public.checklist_shared_item_completions from anon, authenticated;
grant select, insert, delete
  on table public.checklist_shared_item_completions to anon, authenticated;

drop policy if exists "Allow shared trip members to read shared checklist completions"
  on public.checklist_shared_item_completions;
drop policy if exists "Allow shared trip members to add shared checklist completions"
  on public.checklist_shared_item_completions;
drop policy if exists "Allow shared trip members to remove shared checklist completions"
  on public.checklist_shared_item_completions;

create policy "Allow shared trip members to read shared checklist completions"
  on public.checklist_shared_item_completions
  for select to anon, authenticated using (true);

create policy "Allow shared trip members to add shared checklist completions"
  on public.checklist_shared_item_completions
  for insert to anon, authenticated
  with check (
    exists (
      select 1
      from public.checklist_items
      join public.checklist_groups on checklist_groups.id = checklist_items.group_id
      where checklist_items.id = checklist_shared_item_completions.checklist_item_id
        and checklist_groups.owner_traveler_id is null
    )
  );

create policy "Allow shared trip members to remove shared checklist completions"
  on public.checklist_shared_item_completions
  for delete to anon, authenticated
  using (
    exists (
      select 1
      from public.checklist_items
      join public.checklist_groups on checklist_groups.id = checklist_items.group_id
      where checklist_items.id = checklist_shared_item_completions.checklist_item_id
        and checklist_groups.owner_traveler_id is null
    )
  );

insert into public.checklist_shared_item_completions (checklist_item_id)
select distinct completions.checklist_item_id
from public.checklist_item_completions as completions
join public.checklist_items on checklist_items.id = completions.checklist_item_id
join public.checklist_groups on checklist_groups.id = checklist_items.group_id
where checklist_groups.owner_traveler_id is null
on conflict (checklist_item_id) do nothing;

delete from public.checklist_item_completions as completions
using public.checklist_items, public.checklist_groups
where checklist_items.id = completions.checklist_item_id
  and checklist_groups.id = checklist_items.group_id
  and checklist_groups.owner_traveler_id is null;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'checklist_shared_item_completions'
    )
  then
    execute 'alter publication supabase_realtime add table public.checklist_shared_item_completions';
  end if;
end;
$$;
