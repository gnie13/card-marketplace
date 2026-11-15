-- Card Marketplace schema. Run once in Supabase > SQL Editor, then run seed.sql.

-- ---------- tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists cards (
  id text primary key,
  game text not null default 'pokemon',
  kind text not null default 'single' check (kind in ('single','sealed')),
  name text not null,
  number text default '',
  set_name text default '',
  set_code text default '',
  rarity text default '',
  condition text default 'NM',
  grade text default 'Raw',
  grader text default '',
  cert_no text default '',
  qty int not null default 1 check (qty >= 0),
  ask numeric(10,2),
  market numeric(10,2),
  low numeric(10,2),
  mid numeric(10,2),
  price_updated date,
  tcg_group_id int,
  tcg_product_id int,
  tcg_subtype text,
  image_url text,
  image_back_url text,
  photos text[] not null default '{}',
  listed boolean not null default true,
  sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists card_costs (
  card_id text primary key references cards on delete cascade,
  cost numeric(10,2) not null
);

create table if not exists price_history (
  card_id text not null references cards on delete cascade,
  day date not null,
  price numeric(10,2) not null,
  primary key (card_id, day)
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  card_id text references cards on delete set null,
  card_name text not null,
  card_label text default '',
  amount numeric(10,2) not null check (amount > 0),
  note text default '' check (char_length(note) <= 240),
  meetup text default '',
  items jsonb not null default '[]',
  trade_note text default '' check (char_length(trade_note) <= 400),
  trade_value numeric(10,2),
  ask_at_offer numeric(10,2),
  market_at_offer numeric(10,2),
  status text not null default 'pending' check (status in
    ('pending','countered','counter_accepted','counter_declined','accepted','declined','sold','withdrawn')),
  counter numeric(10,2),
  sale_price numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  card_id text,
  name text not null,
  set_name text default '',
  number text default '',
  price numeric(10,2) not null,
  cost numeric(10,2),
  qty int not null default 1,
  location text,
  tax_rate numeric(6,3) not null default 0,
  tax numeric(10,2) not null default 0,
  buyer uuid,
  offer_id uuid,
  sold_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('visit','view')),
  anon_id text not null check (char_length(anon_id) <= 40),
  user_id uuid,
  card_id text,
  day date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists events_day_idx on events (day);

create table if not exists site (
  id int primary key default 1 check (id = 1),
  name text not null default 'QCCards',
  tagline text not null default 'Every card we have in hand, priced against the live market. See something you want? Send an offer.',
  contact text not null default '',
  payments text not null default 'Cash'
);
insert into site (id) values (1) on conflict do nothing;

-- Meetup towns and the combined sales tax rate charged there. Prices on the site include tax.
create table if not exists locations (
  id text primary key,
  name text not null,
  state text not null default 'IL',
  rate numeric(6,3) not null default 0 check (rate >= 0 and rate < 30),
  active boolean not null default true
);
-- Starting rates come from third-party rate sites (November 2026). Confirm each one in the
-- MyTax Illinois Tax Rate Finder, then correct it in Admin > Store.
insert into locations (id, name, state, rate) values
  ('moline', 'Moline', 'IL', 8.5),
  ('geneseo', 'Geneseo', 'IL', 8.25),
  ('colona', 'Colona', 'IL', 8.75),
  ('coal-valley', 'Coal Valley', 'IL', 8.75)
on conflict (id) do nothing;

create table if not exists wishlist (
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  card_id text not null references cards on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- Cards the shop wants to buy, and what it pays.
create table if not exists buylist (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'pokemon',
  name text not null,
  set_name text default '',
  number text default '',
  condition text default 'NM',
  pay numeric(10,2) not null check (pay >= 0),
  note text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A signed-in visitor saying "I have this card".
create table if not exists sell_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  buylist_id uuid not null references buylist on delete cascade,
  note text default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now()
);

-- Meetup time slots the seller opens. A buyer with an accepted offer books one.
create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references locations on delete cascade,
  starts_at timestamptz not null,
  offer_id uuid unique references offers on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Buyers change their own offers only through these two functions.
create or replace function offer_withdraw(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update offers set status = 'withdrawn', updated_at = now()
  where id = p_id and user_id = auth.uid() and status in ('pending','countered');
  if not found then raise exception 'This offer can no longer be withdrawn'; end if;
end $$;

create or replace function offer_reply(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update offers
  set status = case when p_accept then 'counter_accepted' else 'counter_declined' end, updated_at = now()
  where id = p_id and user_id = auth.uid() and status = 'countered';
  if not found then raise exception 'There is no open counter on this offer'; end if;
end $$;

-- Internal: sells one copy of one card. The price is tax-included:
-- tax = price - price / (1 + rate), using the meetup town's rate. Not callable from the API.
create or replace function sell_one(p_card text, p_price numeric, p_offer uuid, p_location text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c cards%rowtype;
  l locations%rowtype;
  v_rate numeric := 0;
begin
  select * into c from cards where id = p_card for update;
  if not found then raise exception 'Card not found'; end if;
  if c.qty < 1 then raise exception '% is out of stock', c.name; end if;
  if p_location is not null then
    select * into l from locations where id = p_location;
    if not found then raise exception 'Unknown meetup location'; end if;
    v_rate := l.rate;
  end if;
  insert into sales (card_id, name, set_name, number, price, cost, location, tax_rate, tax, buyer, offer_id)
  values (c.id, c.name, c.set_name, c.number, p_price,
    (select cost from card_costs where card_id = c.id),
    case when p_location is null then null else l.name || ', ' || l.state end,
    v_rate, round(p_price - p_price / (1 + v_rate / 100), 2),
    (select user_id from offers where id = p_offer), p_offer);
  update cards set qty = qty - 1 where id = c.id;
end $$;

-- A sale made without an offer (walk-up, or agreed elsewhere).
create or replace function record_sale(p_card text, p_price numeric, p_location text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform sell_one(p_card, p_price, null, p_location);
end $$;

-- Completes an accepted offer. A bundle's agreed price is split across its cards
-- in proportion to their asking prices, so each card gets its own sale row.
create or replace function record_offer_sale(p_offer uuid, p_location text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  o offers%rowtype;
  v_agreed numeric;
  v_total numeric;
  v_n int;
  v_done numeric := 0;
  v_share numeric;
  r record;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into o from offers where id = p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  v_agreed := case o.status when 'accepted' then o.amount when 'counter_accepted' then o.counter end;
  if v_agreed is null then raise exception 'This offer has not been accepted'; end if;
  v_n := jsonb_array_length(o.items);
  if v_n = 0 then
    perform sell_one(o.card_id, v_agreed, o.id, p_location);
  else
    select coalesce(sum(coalesce((i->>'ask')::numeric, 0)), 0) into v_total from jsonb_array_elements(o.items) i;
    for r in select i, ord from jsonb_array_elements(o.items) with ordinality as t(i, ord) order by ord loop
      if r.ord = v_n then
        v_share := v_agreed - v_done;
      elsif v_total > 0 then
        v_share := round(v_agreed * coalesce((r.i->>'ask')::numeric, 0) / v_total, 2);
      else
        v_share := round(v_agreed / v_n, 2);
      end if;
      perform sell_one(r.i->>'id', v_share, o.id, p_location);
      v_done := v_done + v_share;
    end loop;
  end if;
  update offers set status = 'sold', sale_price = v_agreed, updated_at = now() where id = o.id;
end $$;

-- A buyer books an open meetup slot for their own accepted offer.
create or replace function book_slot(p_slot uuid, p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from offers where id = p_offer and user_id = auth.uid() and status in ('accepted','counter_accepted')) then
    raise exception 'Only an accepted offer of your own can book a meetup';
  end if;
  update slots set offer_id = null where offer_id = p_offer;
  update slots set offer_id = p_offer where id = p_slot and offer_id is null and starts_at > now();
  if not found then raise exception 'That time is no longer available'; end if;
end $$;

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table cards enable row level security;
alter table card_costs enable row level security;
alter table price_history enable row level security;
alter table offers enable row level security;
alter table sales enable row level security;
alter table events enable row level security;
alter table site enable row level security;
alter table locations enable row level security;
alter table wishlist enable row level security;
alter table buylist enable row level security;
alter table sell_leads enable row level security;
alter table slots enable row level security;

drop policy if exists "own profile or admin" on profiles;
create policy "own profile or admin" on profiles for select using (id = auth.uid() or is_admin());

drop policy if exists "public reads listed cards" on cards;
create policy "public reads listed cards" on cards for select using (listed or is_admin());
drop policy if exists "admin writes cards" on cards;
create policy "admin writes cards" on cards for all using (is_admin()) with check (is_admin());

drop policy if exists "admin costs" on card_costs;
create policy "admin costs" on card_costs for all using (is_admin()) with check (is_admin());

drop policy if exists "public reads prices" on price_history;
create policy "public reads prices" on price_history for select using (true);
drop policy if exists "admin writes prices" on price_history;
create policy "admin writes prices" on price_history for all using (is_admin()) with check (is_admin());

drop policy if exists "buyer or admin reads offers" on offers;
create policy "buyer or admin reads offers" on offers for select using (user_id = auth.uid() or is_admin());
drop policy if exists "buyer sends offer" on offers;
create policy "buyer sends offer" on offers for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and counter is null and sale_price is null);
drop policy if exists "admin updates offers" on offers;
create policy "admin updates offers" on offers for update using (is_admin()) with check (is_admin());

drop policy if exists "admin sales" on sales;
create policy "admin sales" on sales for all using (is_admin()) with check (is_admin());

drop policy if exists "anyone logs events" on events;
create policy "anyone logs events" on events for insert with check (user_id is null or user_id = auth.uid());
drop policy if exists "admin reads events" on events;
create policy "admin reads events" on events for select using (is_admin());

drop policy if exists "public reads site" on site;
create policy "public reads site" on site for select using (true);
drop policy if exists "admin updates site" on site;
create policy "admin updates site" on site for update using (is_admin()) with check (is_admin());

drop policy if exists "public reads locations" on locations;
create policy "public reads locations" on locations for select using (true);
drop policy if exists "admin writes locations" on locations;
create policy "admin writes locations" on locations for all using (is_admin()) with check (is_admin());

drop policy if exists "own wishlist" on wishlist;
create policy "own wishlist" on wishlist for all to authenticated using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid());

drop policy if exists "public reads buylist" on buylist;
create policy "public reads buylist" on buylist for select using (active or is_admin());
drop policy if exists "admin writes buylist" on buylist;
create policy "admin writes buylist" on buylist for all using (is_admin()) with check (is_admin());

drop policy if exists "own leads or admin" on sell_leads;
create policy "own leads or admin" on sell_leads for select using (user_id = auth.uid() or is_admin());
drop policy if exists "send a lead" on sell_leads;
create policy "send a lead" on sell_leads for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admin deletes leads" on sell_leads;
create policy "admin deletes leads" on sell_leads for delete using (is_admin());

drop policy if exists "see open or own slots" on slots;
create policy "see open or own slots" on slots for select to authenticated using (
  is_admin() or offer_id is null
  or exists (select 1 from offers o where o.id = slots.offer_id and o.user_id = auth.uid()));
drop policy if exists "admin writes slots" on slots;
create policy "admin writes slots" on slots for all using (is_admin()) with check (is_admin());

-- ---------- grants (row level security above still decides every row) ----------
grant usage on schema public to anon, authenticated;
grant select on cards, price_history, site, locations, buylist to anon;
grant insert on events to anon;
grant select, insert, update, delete on profiles, cards, card_costs, price_history, offers, sales, events, site, locations, wishlist, buylist, sell_leads, slots to authenticated;
revoke execute on function sell_one(text, numeric, uuid, text) from public, anon, authenticated;
revoke execute on function offer_withdraw(uuid), offer_reply(uuid, boolean), record_sale(text, numeric, text),
  record_offer_sale(uuid, text), book_slot(uuid, uuid) from public, anon;
grant execute on function offer_withdraw(uuid), offer_reply(uuid, boolean), record_sale(text, numeric, text),
  record_offer_sale(uuid, text), book_slot(uuid, uuid) to authenticated;
grant execute on function is_admin() to anon, authenticated;

-- ---------- card photo storage ----------
insert into storage.buckets (id, name, public) values ('cards', 'cards', true) on conflict (id) do nothing;
drop policy if exists "public reads card photos" on storage.objects;
create policy "public reads card photos" on storage.objects for select using (bucket_id = 'cards');
drop policy if exists "admin uploads card photos" on storage.objects;
create policy "admin uploads card photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'cards' and public.is_admin());
drop policy if exists "admin deletes card photos" on storage.objects;
create policy "admin deletes card photos" on storage.objects for delete to authenticated
  using (bucket_id = 'cards' and public.is_admin());

-- ---------- make yourself the admin ----------
-- Sign in to the site once with Google, then run this with your address:
-- update profiles set is_admin = true where email = 'you@example.com';
