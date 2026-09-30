insert into public.trip_days (day_number, dress_code)
values
  (1, 'White & Brown'),
  (2, 'Free & Easy / Casual'),
  (3, 'Banana & Cherry'),
  (4, 'Green & Black')
on conflict (day_number) do update
set dress_code = excluded.dress_code;
