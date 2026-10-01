create table if not exists public.splitwise_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create unique index if not exists splitwise_people_name_unique
  on public.splitwise_people (lower(trim(name)));

create table if not exists public.splitwise_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  paid_by uuid not null references public.splitwise_people(id) on delete restrict,
  expense_date date not null default current_date,
  note text not null default '' check (char_length(note) <= 250),
  created_at timestamptz not null default now()
);

create table if not exists public.splitwise_shares (
  expense_id uuid not null references public.splitwise_expenses(id) on delete cascade,
  person_id uuid not null references public.splitwise_people(id) on delete restrict,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  primary key (expense_id, person_id)
);

create table if not exists public.splitwise_settlements (
  id uuid primary key default gen_random_uuid(),
  from_person_id uuid not null references public.splitwise_people(id) on delete restrict,
  to_person_id uuid not null references public.splitwise_people(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  settlement_date date not null default current_date,
  note text not null default '' check (char_length(note) <= 250),
  created_at timestamptz not null default now(),
  constraint splitwise_settlements_different_people
    check (from_person_id <> to_person_id)
);

insert into public.splitwise_people (name)
select seed.name
from (values
  ('Iffah Afiqah'),
  ('Syahindah Batrishia'),
  ('Syauqina Qistina')
) as seed(name)
where not exists (
  select 1 from public.splitwise_people people
  where lower(trim(people.name)) = lower(trim(seed.name))
);

alter table public.splitwise_people enable row level security;
alter table public.splitwise_expenses enable row level security;
alter table public.splitwise_shares enable row level security;
alter table public.splitwise_settlements enable row level security;

revoke all on table public.splitwise_people from anon, authenticated;
revoke all on table public.splitwise_expenses from anon, authenticated;
revoke all on table public.splitwise_shares from anon, authenticated;
revoke all on table public.splitwise_settlements from anon, authenticated;

grant select, insert, update, delete
  on table public.splitwise_people to anon, authenticated;
grant select, insert, update, delete
  on table public.splitwise_expenses to anon, authenticated;
grant select, insert, update, delete
  on table public.splitwise_shares to anon, authenticated;
grant select, insert, update, delete
  on table public.splitwise_settlements to anon, authenticated;

drop policy if exists "Allow shared trip members to manage Splitwise people"
  on public.splitwise_people;
create policy "Allow shared trip members to manage Splitwise people"
  on public.splitwise_people for all to anon, authenticated
  using (true)
  with check (char_length(trim(name)) between 1 and 100);

drop policy if exists "Allow shared trip members to manage Splitwise expenses"
  on public.splitwise_expenses;
create policy "Allow shared trip members to manage Splitwise expenses"
  on public.splitwise_expenses for all to anon, authenticated
  using (true)
  with check (
    char_length(trim(name)) between 1 and 120
    and amount > 0
    and char_length(note) <= 250
  );

drop policy if exists "Allow shared trip members to manage Splitwise shares"
  on public.splitwise_shares;
create policy "Allow shared trip members to manage Splitwise shares"
  on public.splitwise_shares for all to anon, authenticated
  using (true)
  with check (share_amount >= 0);

drop policy if exists "Allow shared trip members to manage Splitwise settlements"
  on public.splitwise_settlements;
create policy "Allow shared trip members to manage Splitwise settlements"
  on public.splitwise_settlements for all to anon, authenticated
  using (true)
  with check (
    from_person_id <> to_person_id
    and amount > 0
    and char_length(note) <= 250
  );

create or replace function public.save_splitwise_expense(
  p_expense_id uuid,
  p_name text,
  p_amount numeric,
  p_paid_by uuid,
  p_expense_date date,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expense_id uuid;
  v_total_cents bigint;
  v_people_count bigint;
  v_base_cents bigint;
  v_remainder_cents bigint;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Expense name must be between 1 and 120 characters.';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99 then
    raise exception 'Expense amount must be greater than zero.';
  end if;

  if p_note is not null and char_length(p_note) > 250 then
    raise exception 'Expense note must be 250 characters or fewer.';
  end if;

  if not exists (
    select 1 from public.splitwise_people where id = p_paid_by
  ) then
    raise exception 'The selected payer is not a trip participant.';
  end if;

  if p_expense_id is null then
    insert into public.splitwise_expenses (name, amount, paid_by, expense_date, note)
    values (
      trim(p_name),
      round(p_amount, 2),
      p_paid_by,
      coalesce(p_expense_date, current_date),
      coalesce(p_note, '')
    )
    returning id into v_expense_id;
  else
    update public.splitwise_expenses
    set name = trim(p_name),
        amount = round(p_amount, 2),
        paid_by = p_paid_by,
        expense_date = coalesce(p_expense_date, current_date),
        note = coalesce(p_note, '')
    where id = p_expense_id
    returning id into v_expense_id;

    if v_expense_id is null then
      raise exception 'Expense not found.';
    end if;

    delete from public.splitwise_shares where expense_id = v_expense_id;
  end if;

  select count(*) into v_people_count from public.splitwise_people;
  if v_people_count = 0 then
    raise exception 'Add at least one trip participant before saving an expense.';
  end if;

  v_total_cents := round(p_amount * 100)::bigint;
  v_base_cents := v_total_cents / v_people_count;
  v_remainder_cents := mod(v_total_cents, v_people_count);

  insert into public.splitwise_shares (expense_id, person_id, share_amount)
  select
    v_expense_id,
    ranked.id,
    (
      v_base_cents
      + case when ranked.position <= v_remainder_cents then 1 else 0 end
    )::numeric / 100
  from (
    select people.id, row_number() over (order by people.created_at, people.id) as position
    from public.splitwise_people people
  ) ranked;

  return v_expense_id;
end;
$$;

revoke all on function public.save_splitwise_expense(uuid, text, numeric, uuid, date, text)
  from public;
grant execute on function public.save_splitwise_expense(uuid, text, numeric, uuid, date, text)
  to anon, authenticated;
