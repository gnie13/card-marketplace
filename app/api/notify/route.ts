import { createClient } from "@supabase/supabase-js";

// Sends plain-text email alerts through Resend. Does nothing until RESEND_API_KEY and
// EMAIL_FROM are set, so the site works without email configured.

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;

async function send(to: string[], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const list = [...new Set(to.filter(Boolean))];
  if (!key || !from || !list.length) return 0;
  let sent = 0;
  for (const address of list.slice(0, 50)) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [address], subject, text }),
    });
    if (res.ok) sent++;
  }
  return sent;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return Response.json({ error: "Supabase environment values are missing" }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  const user = auth.user;
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  const isAdmin = Boolean(me?.is_admin);

  const body = (await request.json().catch(() => null)) as { type?: string; id?: string; kind?: string } | null;
  if (!body?.type || !body.id) return Response.json({ error: "Bad request" }, { status: 400 });

  const origin = new URL(request.url).origin;
  const { data: site } = await db.from("site").select("name").eq("id", 1).maybeSingle();
  const shop = site?.name || "QCCards";
  const admins = async () => ((await db.from("profiles").select("email").eq("is_admin", true)).data ?? []).map((p) => p.email as string);

  if (body.type === "offer") {
    const { data: o } = await db.from("offers").select("*, profiles(name,email)").eq("id", body.id).maybeSingle();
    if (!o) return Response.json({ error: "Offer not found" }, { status: 404 });
    const buyer = o.profiles as { name: string | null; email: string | null } | null;
    if (o.user_id === user.id && !isAdmin) {
      const what: Record<string, string> = {
        pending: `New offer of ${money(o.amount)}`,
        counter_accepted: `Counter of ${money(o.counter)} accepted`,
        counter_declined: `Counter of ${money(o.counter)} declined`,
        withdrawn: "Offer withdrawn",
        accepted: "Meetup time booked",
      };
      const line = what[o.status] ?? `Offer is now ${o.status}`;
      const sent = await send(
        await admins(),
        `${line}: ${o.card_name}`,
        `${line} on ${o.card_name}.\nBuyer: ${buyer?.name || "Buyer"} (${buyer?.email || "no email"})\n${o.note ? `Note: ${o.note}\n` : ""}${o.trade_note ? `Trade offered: ${o.trade_note}\n` : ""}\nReview it: ${origin}/admin`,
      );
      return Response.json({ sent });
    }
    if (!isAdmin) return Response.json({ error: "Not allowed" }, { status: 403 });
    const what: Record<string, string> = {
      accepted: `Your offer of ${money(o.amount)} was accepted. Pick a meetup time on the site.`,
      countered: `The seller countered at ${money(o.counter)}. You can accept or decline on the site.`,
      declined: "Your offer was declined.",
      sold: `Sale complete at ${money(o.sale_price)}. Thanks for buying from ${shop}.`,
    };
    const line = what[o.status];
    if (!line || !buyer?.email) return Response.json({ sent: 0 });
    const sent = await send([buyer.email], `${shop}: update on ${o.card_name}`, `${line}\n\nCard: ${o.card_name}\nPrices include sales tax. Pickup is local and paid in person.\n\nYour offers: ${origin}/offers`);
    return Response.json({ sent });
  }

  if (body.type === "card") {
    if (!isAdmin) return Response.json({ error: "Not allowed" }, { status: 403 });
    const { data: c } = await db.from("cards").select("id,name,set_name,ask").eq("id", body.id).maybeSingle();
    if (!c) return Response.json({ error: "Card not found" }, { status: 404 });
    const { data: wl } = await db.from("wishlist").select("profiles(email)").eq("card_id", c.id);
    const to = (wl ?? []).map((w) => (w.profiles as unknown as { email: string | null } | null)?.email ?? "");
    const line = body.kind === "price" ? `The price of ${c.name} dropped to ${money(c.ask)}.` : `${c.name} is back in stock at ${money(c.ask)}.`;
    const sent = await send(to, `${shop}: ${c.name}`, `${line}\n\nYou saved this card on ${shop}.\n${origin}/card/${c.id}`);
    return Response.json({ sent });
  }

  if (body.type === "lead") {
    const { data: l } = await db.from("sell_leads").select("*, buylist(name,pay), profiles(name,email)").eq("id", body.id).maybeSingle();
    if (!l || l.user_id !== user.id) return Response.json({ error: "Not allowed" }, { status: 403 });
    const b = l.buylist as { name: string; pay: number } | null;
    const p = l.profiles as { name: string | null; email: string | null } | null;
    const sent = await send(await admins(), `Someone has a card on your buylist: ${b?.name}`, `${p?.name || "A visitor"} (${p?.email || "no email"}) has ${b?.name}. You pay ${money(b?.pay)}.\n${l.note ? `Note: ${l.note}\n` : ""}\n${origin}/admin`);
    return Response.json({ sent });
  }

  return Response.json({ error: "Unknown type" }, { status: 400 });
}
