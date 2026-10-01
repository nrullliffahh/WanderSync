create table if not exists public.checklist_item_completions (
  checklist_item_id text not null
    references public.checklist_items(id) on delete cascade,
  traveler_id integer not null
    references public.travelers(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (checklist_item_id, traveler_id)
);

alter table public.checklist_item_completions enable row level security;

revoke all on table public.checklist_item_completions from anon, authenticated;
grant select, insert, delete
  on table public.checklist_item_completions to anon, authenticated;

drop policy if exists "Allow shared trip members to read checklist completions"
  on public.checklist_item_completions;
drop policy if exists "Allow shared trip members to add checklist completions"
  on public.checklist_item_completions;
drop policy if exists "Allow shared trip members to remove checklist completions"
  on public.checklist_item_completions;

create policy "Allow shared trip members to read checklist completions"
  on public.checklist_item_completions
  for select to anon, authenticated using (true);

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

create policy "Allow shared trip members to remove checklist completions"
  on public.checklist_item_completions
  for delete to anon, authenticated using (true);
