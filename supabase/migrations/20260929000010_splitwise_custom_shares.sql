alter table public.splitwise_expenses
  add column if not exists split_mode text not null default 'equally';

alter table public.splitwise_expenses
  drop constraint if exists splitwise_expenses_split_mode_check;

alter table public.splitwise_expenses
  add constraint splitwise_expenses_split_mode_check
  check (split_mode in ('equally', 'custom'));

drop function if exists public.save_splitwise_expense(
  uuid, text, numeric, uuid, date, text
);

create or replace function public.save_splitwise_expense(
  p_expense_id uuid,
  p_name text,
  p_amount numeric,
  p_paid_by uuid,
  p_expense_date date,
  p_note text,
  p_split_mode text,
  p_custom_shares jsonb
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
  v_share_count bigint;
  v_unique_share_count bigint;
  v_share_total_cents bigint;
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

  if p_split_mode is null or p_split_mode not in ('equally', 'custom') then
    raise exception 'Choose either an equal or custom split.';
  end if;

  if not exists (
    select 1 from public.splitwise_people where id = p_paid_by
  ) then
    raise exception 'The selected payer is not a trip participant.';
  end if;

  select count(*) into v_people_count from public.splitwise_people;
  if v_people_count = 0 then
    raise exception 'Add at least one trip participant before saving an expense.';
  end if;

  v_total_cents := round(p_amount * 100)::bigint;

  if p_split_mode = 'custom' then
    if jsonb_typeof(p_custom_shares) <> 'array' then
      raise exception 'Custom shares must be supplied as a list of participant amounts.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_custom_shares) as share(value)
      where share.value ->> 'person_id' is null
         or share.value ->> 'share_amount' is null
         or (share.value ->> 'share_amount')::numeric < 0
         or ((share.value ->> 'share_amount')::numeric * 100)
              <> round((share.value ->> 'share_amount')::numeric * 100)
         or not exists (
           select 1
           from public.splitwise_people people
           where people.id = (share.value ->> 'person_id')::uuid
         )
    ) then
      raise exception 'Each custom share must contain a valid participant and a non-negative amount with at most two decimal places.';
    end if;

    select
      count(*),
      count(distinct share.value ->> 'person_id'),
      coalesce(sum(round((share.value ->> 'share_amount')::numeric * 100)), 0)
    into v_share_count, v_unique_share_count, v_share_total_cents
    from jsonb_array_elements(p_custom_shares) as share(value);

    if v_share_count <> v_people_count
       or v_unique_share_count <> v_people_count then
      raise exception 'Provide exactly one custom share for every trip participant.';
    end if;

    if v_share_total_cents <> v_total_cents then
      raise exception 'Custom shares must add up exactly to the expense total.';
    end if;
  end if;

  if p_expense_id is null then
    insert into public.splitwise_expenses (
      name, amount, paid_by, expense_date, note, split_mode
    )
    values (
      trim(p_name),
      round(p_amount, 2),
      p_paid_by,
      coalesce(p_expense_date, current_date),
      coalesce(p_note, ''),
      p_split_mode
    )
    returning id into v_expense_id;
  else
    update public.splitwise_expenses
    set name = trim(p_name),
        amount = round(p_amount, 2),
        paid_by = p_paid_by,
        expense_date = coalesce(p_expense_date, current_date),
        note = coalesce(p_note, ''),
        split_mode = p_split_mode
    where id = p_expense_id
    returning id into v_expense_id;

    if v_expense_id is null then
      raise exception 'Expense not found.';
    end if;

    delete from public.splitwise_shares where expense_id = v_expense_id;
  end if;

  if p_split_mode = 'custom' then
    insert into public.splitwise_shares (expense_id, person_id, share_amount)
    select
      v_expense_id,
      (share.value ->> 'person_id')::uuid,
      round((share.value ->> 'share_amount')::numeric, 2)
    from jsonb_array_elements(p_custom_shares) as share(value);
  else
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
  end if;

  return v_expense_id;
end;
$$;

revoke all on function public.save_splitwise_expense(
  uuid, text, numeric, uuid, date, text, text, jsonb
) from public;
grant execute on function public.save_splitwise_expense(
  uuid, text, numeric, uuid, date, text, text, jsonb
) to anon, authenticated;
