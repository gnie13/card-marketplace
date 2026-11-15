-- Run once in Supabase > SQL Editor. Returns one row per card with its price points,
-- so trend lines load in a single request however long the history gets.
create or replace function price_series(p_days int default 90) returns table (card_id text, pts jsonb)
language sql stable set search_path = public as $$
  select h.card_id, jsonb_agg(jsonb_build_array(h.day, h.price) order by h.day)
  from price_history h
  where h.day >= current_date - p_days
  group by h.card_id
$$;
grant execute on function price_series(int) to anon, authenticated;
