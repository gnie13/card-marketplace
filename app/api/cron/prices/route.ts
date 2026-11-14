import { createClient } from "@supabase/supabase-js";

// Daily market price refresh. Vercel Cron calls this with CRON_SECRET (see vercel.json).
// An admin can also trigger it from Admin > Price trends with their own session token.

type TcgPrice = { productId: number; lowPrice: number | null; midPrice: number | null; marketPrice: number | null; subTypeName: string };
type CardRow = { id: string; market: number | null; tcg_group_id: number; tcg_product_id: number; tcg_subtype: string | null };

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return Response.json({ error: "Supabase environment values are missing" }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = Boolean(process.env.CRON_SECRET) && token === process.env.CRON_SECRET;
  if (!allowed && token) {
    const { data } = await db.auth.getUser(token);
    if (data.user) {
      const { data: profile } = await db.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
      allowed = Boolean(profile?.is_admin);
    }
  }
  if (!allowed) return Response.json({ error: "Not authorized" }, { status: 401 });

  const { data: cards, error } = await db
    .from("cards")
    .select("id, market, tcg_group_id, tcg_product_id, tcg_subtype")
    .not("tcg_group_id", "is", null)
    .not("tcg_product_id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const groups = new Map<number, CardRow[]>();
  for (const c of (cards ?? []) as CardRow[]) groups.set(c.tcg_group_id, [...(groups.get(c.tcg_group_id) ?? []), c]);

  let updated = 0;
  const skipped: string[] = [];
  for (const [group, list] of groups) {
    let prices: TcgPrice[] = [];
    try {
      const res = await fetch(`https://tcgcsv.com/tcgplayer/3/${group}/prices`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      prices = (await res.json()).results ?? [];
    } catch {
      skipped.push(...list.map((c) => c.id));
      continue;
    }
    for (const c of list) {
      const rows = prices.filter((p) => p.productId === c.tcg_product_id && p.marketPrice != null);
      const row = rows.find((p) => p.subTypeName === c.tcg_subtype) ?? rows.find((p) => p.subTypeName === "Holofoil") ?? rows[0];
      if (!row || row.marketPrice == null) {
        skipped.push(c.id);
        continue;
      }
      const a = await db.from("cards").update({ market: row.marketPrice, low: row.lowPrice, mid: row.midPrice, price_updated: today }).eq("id", c.id);
      const b = await db.from("price_history").upsert({ card_id: c.id, day: today, price: row.marketPrice });
      if (a.error || b.error) skipped.push(c.id);
      else updated++;
    }
  }
  return Response.json({ day: today, checked: cards?.length ?? 0, updated, skipped });
}
