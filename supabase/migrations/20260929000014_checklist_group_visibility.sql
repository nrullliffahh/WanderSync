alter table public.checklist_groups
  add column if not exists owner_traveler_id integer
    references public.travelers(id) on delete cascade;

create index if not exists checklist_groups_owner_traveler_id_idx
  on public.checklist_groups(owner_traveler_id);

drop policy if exists "Allow shared trip members to read checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to add checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to update checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to delete checklist groups"
  on public.checklist_groups;

create policy "Allow shared trip members to read checklist groups"
  on public.checklist_groups for select to anon, authenticated
  using (true);

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
            'Syahindah Batrisia',
            'Syauqina Qistina'
          )
      )
    )
  );

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
            'Syahindah Batrisia',
            'Syauqina Qistina'
          )
      )
    )
  );

create policy "Allow shared trip members to delete checklist groups"
  on public.checklist_groups for delete to anon, authenticated
  using (true);

create or replace function public.delete_checklist_group(p_group_id integer)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.checklist_items
  where group_id = p_group_id;

  delete from public.checklist_groups
  where id = p_group_id;
end;
$$;

revoke all on function public.delete_checklist_group(integer) from public;
grant execute on function public.delete_checklist_group(integer) to anon, authenticated;
