alter table public.checklist_items
  add column if not exists assigned_traveler_id integer
    references public.travelers(id) on delete set null;

create index if not exists checklist_items_assigned_traveler_id_idx
  on public.checklist_items(assigned_traveler_id);
