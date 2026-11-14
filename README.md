# Card Marketplace

A storefront for trading cards (Pokemon first) where signed-in buyers send offers and the owner runs everything from an admin view.

- **Stack:** Next.js (App Router) on Vercel, Supabase for the database, Google sign-in and photo storage.
- **Prices:** TCGplayer market prices, read once a day from the free TCGCSV mirror by `/api/cron/prices`.
- **Security:** every table uses Supabase row level security. The browser only ever holds the public key.

## Pages

| Path | What it does |
| --- | --- |
| `/` | Shop: search, set filter, sorting, asking price against market |
| `/card/[id]` | Card detail, market panel and trend, offer form |
| `/offers` | A buyer's offers: withdraw, accept or decline a counter |
| `/admin` | Owner only: overview, offers, inventory, price trends, usage, store details |
| `/login` | Google sign-in |
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

## Pricing details
A card is refreshed only when it has both a TCGplayer set (group) ID and product ID. The product ID is the number in the card's TCGplayer URL. Set IDs are listed at `https://tcgcsv.com/tcgplayer/3/groups`. Cards without IDs keep whatever price you log by hand in **Admin > Price trends**. The same page has a **Refresh prices now** button.

## Not built yet
- Payments. Offers end in an agreed price, and payment happens off the site.
- Email notifications when an offer changes status.
- The terms and privacy pages are drafts and need review before launch.
