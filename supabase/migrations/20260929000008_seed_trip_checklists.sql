alter table public.checklist_items
  alter column id set default gen_random_uuid()::text,
  alter column is_done set default false;

update public.checklist_groups as existing
set short_title = suggested.short_title
from (
  values
    ('Pre-Departure', 'Pre-departure'),
    ('Personal packing', 'Personal'),
    ('Shared gear', 'Shared gear'),
    ('Cooking & grocery', 'Cooking')
) as suggested(title, short_title)
where lower(existing.title) = lower(suggested.title);

insert into public.checklist_groups (title, short_title)
select suggested.title, suggested.short_title
from (
  values
    ('Pre-Departure', 'Pre-departure'),
    ('Personal packing', 'Personal'),
    ('Shared gear', 'Shared gear'),
    ('Cooking & grocery', 'Cooking')
) as suggested(title, short_title)
where not exists (
  select 1
  from public.checklist_groups existing
  where lower(existing.title) = lower(suggested.title)
);

insert into public.checklist_items (group_id, item_name, is_done)
select groups.id, suggested.item_name, false
from (
  values
    ('Pre-Departure', 'Online ticket confirmations'),
    ('Pre-Departure', 'Physical Touch ''n Go cards'),
    ('Pre-Departure', 'eWallet / RFID top-up'),
    ('Pre-Departure', 'Vehicle safety inspection'),
    ('Personal packing', 'Clothes for each trip day'),
    ('Personal packing', 'Comfortable walking shoes'),
    ('Personal packing', 'Personal toiletries'),
    ('Personal packing', 'Phone charger and power bank'),
    ('Shared gear', 'First-aid kit'),
    ('Shared gear', 'Umbrellas and raincoats'),
    ('Shared gear', 'Tissues and hand sanitizer'),
    ('Shared gear', 'Reusable water bottles'),
    ('Cooking & grocery', 'Drinking water'),
    ('Cooking & grocery', 'Breakfast and snack supplies'),
    ('Cooking & grocery', 'Food storage bags'),
    ('Cooking & grocery', 'Basic cooking supplies')
) as suggested(group_title, item_name)
join public.checklist_groups as groups
  on lower(groups.title) = lower(suggested.group_title)
where not exists (
  select 1
  from public.checklist_items existing
  where existing.group_id = groups.id
    and lower(existing.item_name) = lower(suggested.item_name)
);

alter table public.checklist_groups enable row level security;
alter table public.checklist_items enable row level security;

revoke all on table public.checklist_groups from anon, authenticated;
revoke all on table public.checklist_items from anon, authenticated;
grant select, insert, update, delete
  on table public.checklist_groups to anon, authenticated;
grant select, insert, update, delete
  on table public.checklist_items to anon, authenticated;

drop policy if exists "Allow shared trip members to read checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to add checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to update checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to delete checklist groups"
  on public.checklist_groups;
drop policy if exists "Allow shared trip members to read checklist items"
  on public.checklist_items;
drop policy if exists "Allow shared trip members to add checklist items"
  on public.checklist_items;
drop policy if exists "Allow shared trip members to update checklist items"
  on public.checklist_items;
drop policy if exists "Allow shared trip members to delete checklist items"
  on public.checklist_items;

create policy "Allow shared trip members to read checklist groups"
  on public.checklist_groups for select to anon, authenticated using (true);
create policy "Allow shared trip members to add checklist groups"
  on public.checklist_groups for insert to anon, authenticated
  with check (char_length(trim(title)) between 1 and 100);
create policy "Allow shared trip members to update checklist groups"
  on public.checklist_groups for update to anon, authenticated
  using (true) with check (char_length(trim(title)) between 1 and 100);
create policy "Allow shared trip members to delete checklist groups"
  on public.checklist_groups for delete to anon, authenticated using (true);

create policy "Allow shared trip members to read checklist items"
  on public.checklist_items for select to anon, authenticated using (true);
create policy "Allow shared trip members to add checklist items"
  on public.checklist_items for insert to anon, authenticated
  with check (char_length(trim(item_name)) between 1 and 160);
create policy "Allow shared trip members to update checklist items"
  on public.checklist_items for update to anon, authenticated
  using (true) with check (char_length(trim(item_name)) between 1 and 160);
create policy "Allow shared trip members to delete checklist items"
  on public.checklist_items for delete to anon, authenticated using (true);
