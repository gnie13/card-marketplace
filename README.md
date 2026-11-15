# Card Marketplace

A storefront for trading cards (Pokemon first) where signed-in buyers send offers and the owner runs everything from an admin view.

- **Stack:** Next.js (App Router) on Vercel, Supabase for the database, Google sign-in and photo storage.
- **Prices:** TCGplayer market prices, read once a day from the free TCGCSV mirror by `/api/cron/prices`.
- **Security:** every table uses Supabase row level security. The browser only ever holds the public key.

## Pages

| Path | What it does |
| --- | --- |
| `/` | Shop: search, set, game, type, condition, graded, rarity and price filters, sorting |
| `/card/[id]` | Front and back photos, graded cert link, market panel with 30D, 90D, 1Y ranges, offer form with trade-in, save, add to bundle |
| `/bundle` | One offer covering several cards |
| `/saved` | Saved cards. Buyers are emailed on restock or price drop |
| `/buylist` | Cards the shop wants to buy and what it pays. Signed-in visitors can say "I have this" |
| `/offers` | A buyer's offers: withdraw, answer a counter, book a meetup time |
| `/admin` | Owner only: overview, offers, inventory (with CSV import), meetups, buylist, price trends, sales tax, usage, store |
| `/login` | Google sign-in, or email and password with confirmation and reset |
| `/guide`, `/terms`, `/privacy` | Condition guide and offer rules, draft legal pages |

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor**, paste `supabase/schema.sql`, run it. Then run `supabase/seed.sql` for the sample listings (optional).
3. In **Project Settings > API**, copy the project URL, the public key and the secret key.

### 2. Google sign-in
1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add this authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
3. In Supabase, open **Authentication > Sign In / Providers > Google**, turn it on, and paste the client ID and secret.
4. In **Authentication > URL Configuration**, set the Site URL to your live address and add `http://localhost:3000/**` and `https://YOUR-SITE/**` as redirect URLs.

### Email and password sign-in
Supabase Auth stores passwords as salted bcrypt hashes. This app never writes a password to its own tables. Recommended settings in **Authentication > Sign In / Providers > Email**: keep **Confirm email** on, set the minimum password length to 10, require letters and digits, and keep **Secure password change** on. Turn on leaked password protection if your plan includes it. Supabase's built-in mailer allows only a few emails per hour, so connect custom SMTP (Resend works) before real traffic.

### 3. Run it locally
```bash
cp .env.example .env.local   # then fill in the four values
npm install
npm run dev
```

### 4. Make yourself the admin
Sign in once on the site, then run this in the Supabase SQL Editor with your address:
```sql
update profiles set is_admin = true where email = 'you@example.com';
```
Reload the site and the Admin link appears.

### 5. Deploy on Vercel
1. Import this repo at vercel.com.
2. Add the four environment variables from `.env.example`. `CRON_SECRET` can be any long random string.
3. Deploy. `vercel.json` schedules the price refresh for 21:30 UTC each day. Vercel sends `CRON_SECRET` with that request automatically.

### 6. Email alerts (optional)
Create a free account at resend.com, verify a sending domain, and add `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Until then the site runs normally and simply sends no email. Alerts cover: new offers and buyer replies (to you), accept, counter, decline and sold (to the buyer), restock and price drop (to buyers who saved the card), and buylist replies (to you).

## Importing inventory
**Admin > Inventory > Import many cards** takes CSV text or a file with these columns. Only `name` and `ask` are required.

```
name,number,set_name,set_code,game,kind,rarity,condition,grade,grader,cert_no,qty,ask,market,cost,tcg_group_id,tcg_product_id
```

## Loading past prices
The daily refresh only adds today's price. To fill in history, add two repository secrets under **Settings > Secrets and variables > Actions** (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`), then open **Actions > Backfill price history > Run workflow** and choose how many days to load. It reads the daily TCGCSV archives (available from 2024-02-08) and only adds days that are missing. Run it again after adding new cards.

## Pricing details
A card is refreshed only when it has both a TCGplayer set (group) ID and product ID. The product ID is the number in the card's TCGplayer URL. Set IDs are listed at `https://tcgcsv.com/tcgplayer/3/groups`. Cards without IDs keep whatever price you log by hand in **Admin > Price trends**. The same page has a **Refresh prices now** button.

## Sales tax and pickup
- Sales are local pickup only and every price includes sales tax.
- `locations` holds the meetup towns and the combined tax rate for each. Edit them in **Admin > Store**. The starting rates came from third-party rate sites, so confirm each one in the MyTax Illinois Tax Rate Finder.
- When a sale is recorded, the tax is split out as `price - price / (1 + rate)` and stored on the sale. **Admin > Sales tax** totals it by month and town for filing.

## Not built yet
- Online payment, shipping, seller ratings, multiple sellers, live auctions. Left out on purpose: sales are cash and in person.
- Scanning cards with a phone camera, and recent sold prices. The free price source provides neither.
- A printable receipt generated from a recorded sale.
- The terms and privacy pages are drafts and need review before launch.

## Tests
`supabase/schema.sql` was exercised in an in-memory Postgres (PGlite) with stubbed Supabase auth: access rules for visitors, buyers and the admin, the counter flow, meetup booking, single and bundle sales, and the tax split. It has not yet been run against a hosted Supabase project.
