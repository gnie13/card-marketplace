"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app";
import { supabase } from "@/lib/supabase";
import type { Card, Ev, Hist, Offer, Sale, Site } from "@/lib/types";
import { OPEN, agreed, deltaInfo, dstr, fmtDay, lastDays, num, slug, usd } from "@/lib/util";
import { Pill } from "@/components/ui";
import { BarChart, LineChart, Spark } from "@/components/charts";

type Data = { cards: Card[]; costs: Record<string, number>; hist: Hist[]; offers: Offer[]; sales: Sale[]; events: Ev[] };
type Run = (work: () => PromiseLike<{ error: { message: string } | null }>, done: string) => Promise<boolean>;
const TABS = [["overview", "Overview"], ["offers", "Offers"], ["inventory", "Inventory"], ["prices", "Price trends"], ["usage", "Usage"], ["store", "Store"]] as const;
type Tab = (typeof TABS)[number][0];

export default function Admin() {
  const { isAdmin, ready, toast } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const since = lastDays(30)[0];
    const [cards, costs, hist, offers, sales, events] = await Promise.all([
      supabase.from("cards").select("*"),
      supabase.from("card_costs").select("*"),
      supabase.from("price_history").select("*").order("day"),
      supabase.from("offers").select("*, profiles(name,email)").order("created_at", { ascending: false }),
      supabase.from("sales").select("*").order("sold_at"),
      supabase.from("events").select("type,anon_id,card_id,day").gte("day", since).limit(20000),
    ]);
    setData({
      cards: (cards.data as Card[]) ?? [],
      costs: Object.fromEntries(((costs.data as { card_id: string; cost: number }[]) ?? []).map((c) => [c.card_id, Number(c.cost)])),
      hist: (hist.data as Hist[]) ?? [],
      offers: (offers.data as Offer[]) ?? [],
      sales: (sales.data as Sale[]) ?? [],
      events: (events.data as Ev[]) ?? [],
    });
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const run: Run = useCallback(
    async (work, done) => {
      const { error } = await work();
      toast(error ? `That did not save: ${error.message}` : done);
      await load();
      return !error;
    },
    [toast, load],
  );

  if (!isAdmin)
    return (
      <section className="section">
        <h1>Admin</h1>
        <div className="empty">{ready ? "Only the shop owner can open the admin view." : "Checking your access..."}</div>
      </section>
    );

  return (
    <section className="section">
      <h1>Admin</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t[0]} role="tab" aria-selected={tab === t[0]} onClick={() => setTab(t[0])}>{t[1]}</button>
        ))}
      </div>
      {!data ? (
        <div className="empty">Loading shop data...</div>
      ) : tab === "overview" ? (
        <Overview d={data} go={setTab} />
      ) : tab === "offers" ? (
        <Offers d={data} run={run} />
      ) : tab === "inventory" ? (
        <Inventory d={data} run={run} />
      ) : tab === "prices" ? (
        <Prices d={data} run={run} reload={load} />
      ) : tab === "usage" ? (
        <Usage d={data} />
      ) : (
        <Store />
      )}
    </section>
  );
}

/** A number box with one button, for counters, sale prices and manual market prices. */
function AmountAction({ placeholder, label, onGo }: { placeholder: string; label: string; onGo: (n: number) => void }) {
  const [v, setV] = useState("");
  const { toast } = useApp();
  return (
    <>
      <input type="number" step="0.01" min="0" placeholder={placeholder} aria-label={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
      <button
        className="btn sm"
        onClick={() => {
          const n = num(v);
          if (n == null || n < 0) return toast("Enter an amount first.");
          setV("");
          onGo(n);
        }}
      >
        {label}
      </button>
    </>
  );
}

function Overview({ d, go }: { d: Data; go: (t: Tab) => void }) {
  const rev = d.sales.reduce((a, s) => a + Number(s.price), 0);
  const withCost = d.sales.filter((s) => s.cost != null);
  const profit = withCost.reduce((a, s) => a + Number(s.price) - Number(s.cost), 0);
  const units = d.sales.reduce((a, s) => a + (s.qty || 1), 0);
  const live = d.cards.filter((c) => c.qty > 0);
  const askVal = live.reduce((a, c) => a + Number(c.ask ?? 0) * c.qty, 0);
  const mktVal = live.reduce((a, c) => a + Number(c.market ?? 0) * c.qty, 0);
  const stock = live.reduce((a, c) => a + c.qty, 0);
  const open = d.offers.filter((o) => OPEN.includes(o.status));
  const days = lastDays(30);
  const byDay = Object.fromEntries(days.map((x) => [x, 0]));
  d.sales.forEach((s) => {
    const day = dstr(new Date(s.sold_at));
    if (day in byDay) byDay[day] += Number(s.price);
  });
  const week = new Set(lastDays(7));
  const visitors = new Set(d.events.filter((e) => week.has(e.day)).map((e) => e.anon_id)).size;
  const samples = d.cards.filter((c) => c.sample).length;
  return (
    <>
      {samples > 0 && (
        <div className="banner">
          <b>{samples} sample listings are loaded.</b> They carry real TCGplayer market prices but are placeholders for your stock. Edit or delete them under Inventory and add the cards you actually hold.
        </div>
      )}
      <div className="tiles">
        <div className="stat"><span className="eyebrow">Earnings</span><b>{usd(rev)}</b><small>{units} card{units === 1 ? "" : "s"} sold</small></div>
        <div className="stat"><span className="eyebrow">Profit</span><b>{withCost.length ? usd(profit) : "n/a"}</b><small>{withCost.length ? `on ${withCost.length} of ${d.sales.length} sales with a cost entered` : "Add what you paid per card to see profit"}</small></div>
        <div className="stat"><span className="eyebrow">Open offers</span><b>{open.length}</b><small>{d.offers.length} received in total</small></div>
        <div className="stat"><span className="eyebrow">Stock at asking</span><b>{usd(askVal)}</b><small>{stock} cards, {usd(mktVal)} at market</small></div>
        <div className="stat"><span className="eyebrow">Visitors, 7 days</span><b>{visitors}</b><small>unique browsers</small></div>
      </div>
      <div className="two">
        <div className="panel">
          <div className="head"><h2>Earnings by day</h2><span className="eyebrow">Last 30 days</span></div>
          <div className="chart"><BarChart rows={days.map((x) => ({ d: x, v: byDay[x] }))} fmt={usd} label="Earnings per day over the last 30 days" /></div>
        </div>
        <div className="panel">
          <div className="head"><h2>Latest offers</h2><button className="btn sm" onClick={() => go("offers")}>All offers</button></div>
          {d.offers.length ? (
            <div className="tablewrap">
              <table>
                <tbody>
                  {d.offers.slice(0, 6).map((o) => (
                    <tr key={o.id}>
                      <td><b>{o.card_name}</b><div className="sub">{fmtDay(o.created_at)}</div></td>
                      <td className="num">{usd(o.amount)}</td>
                      <td><Pill status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No offers yet. They appear here as soon as a signed-in buyer sends one.</div>
          )}
        </div>
      </div>
    </>
  );
}

function Offers({ d, run }: { d: Data; run: Run }) {
  if (!d.offers.length) return <div className="empty">No offers yet. When a buyer sends one, you can accept, counter, or decline it here.</div>;
  const set = (o: Offer, patch: Partial<Offer>, done: string) =>
    run(() => supabase.from("offers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", o.id), done);
  const pc = (a: number, b: number | null | undefined) => (b ? `${(((a - b) / b) * 100).toFixed(0)}%` : "n/a");
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr><th>Card</th><th>Buyer</th><th className="num">Offer</th><th className="num">vs asking</th><th className="num">vs market</th><th>Sent</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          {d.offers.map((o) => {
            const c = d.cards.find((x) => x.id === o.card_id);
            const price = agreed(o);
            return (
              <tr key={o.id}>
                <td><b>{o.card_name}</b><div className="sub">{o.card_label}{o.note ? ` · "${o.note}"` : ""}</div></td>
                <td><b>{o.profiles?.name || "Buyer"}</b>{o.profiles?.email && <div className="sub">{o.profiles.email}</div>}</td>
                <td className="num">{usd(o.amount)}</td>
                <td className="num">{pc(o.amount, c?.ask ?? o.ask_at_offer)}</td>
                <td className="num">{pc(o.amount, c?.market ?? o.market_at_offer)}</td>
                <td>{fmtDay(o.created_at)}</td>
                <td><Pill status={o.status} /></td>
                <td>
                  <div className="acts">
                    {(o.status === "pending" || o.status === "counter_declined") && (
                      <>
                        <button className="btn sm solid" onClick={() => set(o, { status: "accepted" }, "Offer accepted.")}>Accept</button>
                        <AmountAction placeholder="Counter $" label="Counter" onGo={(n) => set(o, { status: "countered", counter: n }, `Counter of ${usd(n)} sent.`)} />
                        <button className="btn sm" onClick={() => set(o, { status: "declined" }, "Offer declined.")}>Decline</button>
                      </>
                    )}
                    {o.status === "countered" && (
                      <>
                        <span className="sub">Countered at {usd(o.counter)}, waiting on buyer</span>
                        <button className="btn sm" onClick={() => set(o, { status: "declined" }, "Offer declined.")}>Decline</button>
                      </>
                    )}
                    {(o.status === "accepted" || o.status === "counter_accepted") && (
                      <>
                        <button className="btn sm solid" disabled={!c || c.qty < 1} onClick={() => run(() => supabase.rpc("record_sale", { p_card: o.card_id, p_price: price, p_offer: o.id }), `Sale recorded at ${usd(price)}.`)}>
                          Mark sold at {usd(price)}
                        </button>
                        <button className="btn sm" onClick={() => set(o, { status: "declined" }, "Offer cancelled.")}>Cancel</button>
                      </>
                    )}
                    {o.status === "sold" && <span className="sub">Sold at {usd(o.sale_price)}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Form = Record<"name" | "number" | "set_name" | "set_code" | "rarity" | "condition" | "grade" | "qty" | "ask" | "market" | "cost" | "group" | "product", string> & { listed: boolean };

function Editor({ card, cost, run, close }: { card: Card | null; cost: number | undefined; run: Run; close: () => void }) {
  const { toast } = useApp();
  const s = (v: unknown) => (v == null ? "" : String(v));
  const [f, setF] = useState<Form>({
    name: s(card?.name), number: s(card?.number), set_name: s(card?.set_name), set_code: s(card?.set_code), rarity: s(card?.rarity),
    condition: card?.condition || "NM", grade: card?.grade || "Raw", qty: s(card?.qty ?? 1), ask: s(card?.ask), market: s(card?.market),
    cost: s(cost), group: s(card?.tcg_group_id), product: s(card?.tcg_product_id), listed: card?.listed ?? true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof Omit<Form, "listed">, label: string, cls = "", props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={cls}>
      {label}
      <input type="text" id={`e-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const id = card?.id ?? `${slug(`${f.name}-${f.number}`)}-${Math.random().toString(36).slice(2, 6)}`;
    const market = num(f.market);
    const today = dstr();
    let image_url = card?.image_url ?? null;
    if (file) {
      const path = `${id}-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      const up = await supabase.storage.from("cards").upload(path, file);
      if (up.error) {
        setBusy(false);
        return toast(`The photo did not upload: ${up.error.message}`);
      }
      image_url = supabase.storage.from("cards").getPublicUrl(path).data.publicUrl;
    }
    const row = {
      id, name: f.name.trim(), number: f.number.trim(), set_name: f.set_name.trim(), set_code: f.set_code.trim().toUpperCase(), rarity: f.rarity.trim(),
      condition: f.condition, grade: f.grade.trim() || "Raw", qty: Math.max(0, parseInt(f.qty) || 0), ask: num(f.ask), market,
      tcg_group_id: num(f.group), tcg_product_id: num(f.product), listed: f.listed, image_url, sample: false,
      ...(market != null && market !== Number(card?.market) ? { price_updated: today } : {}),
    };
    const ok = await run(async () => {
      const a = await supabase.from("cards").upsert(row);
      if (a.error) return a;
      if (market != null && market !== Number(card?.market)) {
        const h = await supabase.from("price_history").upsert({ card_id: id, day: today, price: market });
        if (h.error) return h;
      }
      const c = num(f.cost);
      return c == null ? supabase.from("card_costs").delete().eq("card_id", id) : supabase.from("card_costs").upsert({ card_id: id, cost: c });
    }, card ? "Card updated." : "Card added to the shop.");
    setBusy(false);
    if (ok) close();
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={card ? "Edit card" : "Add a card"}>
      <form onSubmit={save}>
        <h2>{card ? "Edit card" : "Add a card"}</h2>
        <div className="fgrid">
          {field("name", "Card name", "w2", { required: true, maxLength: 80 })}
          {field("number", "Number", "", { placeholder: "199/165", maxLength: 20 })}
          {field("set_name", "Set", "w2", { maxLength: 60 })}
          {field("set_code", "Set code", "", { placeholder: "MEW", maxLength: 6 })}
          {field("rarity", "Rarity", "", { maxLength: 40 })}
          <label>
            Condition
            <select id="e-condition" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
              {["NM", "LP", "MP", "HP", "DMG"].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          {field("grade", "Grade", "", { placeholder: "Raw, PSA 10", maxLength: 16 })}
          {field("qty", "Quantity", "", { type: "number", min: 0, step: 1 })}
          {field("ask", "Asking price", "", { type: "number", min: 0, step: 0.01, required: true })}
          {field("market", "Market price", "", { type: "number", min: 0, step: 0.01 })}
          {field("cost", "Your cost (private)", "", { type: "number", min: 0, step: 0.01 })}
          {field("product", "TCGplayer product ID", "", { type: "number", placeholder: "517045" })}
          {field("group", "TCGplayer set (group) ID", "", { type: "number", placeholder: "23237" })}
          <label className="w3">
            Photo of your card{card?.image_url ? " (replaces the current photo)" : ""}
            <input type="file" id="e-img" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="check w3">
            <input type="checkbox" id="e-listed" checked={f.listed} onChange={(e) => setF({ ...f, listed: e.target.checked })} />
            Show this card in the shop
          </label>
        </div>
        <p className="note">The two TCGplayer IDs let the daily refresh price this card. The product ID is the number in the card&apos;s TCGplayer URL. Set IDs are listed at tcgcsv.com.</p>
        <div className="acts">
          <button className="btn solid" type="submit" disabled={busy}>{card ? "Save changes" : "Add card"}</button>
          <button className="btn" type="button" onClick={close}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function Inventory({ d, run }: { d: Data; run: Run }) {
  const [edit, setEdit] = useState<Card | "new" | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const rows = [...d.cards].sort((a, b) => Number(b.ask ?? 0) - Number(a.ask ?? 0));
  return (
    <>
      <div className="head">
        <span className="mute">{rows.length} cards · cost and profit are visible to you only</span>
        <button className="btn solid" onClick={() => setEdit("new")}>Add a card</button>
      </div>
      {rows.length ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Card</th><th>Cond.</th><th className="num">Qty</th><th className="num">Asking</th><th className="num">Market</th><th className="num">Cost</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b>{c.sample && <> <span className="pill off">Sample</span></>}<div className="sub">{c.set_name} · {c.number}</div></td>
                  <td>{c.condition} {c.grade}</td>
                  <td className="num">{c.qty}</td>
                  <td className="num">{usd(c.ask)}</td>
                  <td className="num">{usd(c.market)}</td>
                  <td className="num">{d.costs[c.id] != null ? usd(d.costs[c.id]) : <span className="mute">not set</span>}</td>
                  <td>{!c.listed ? <span className="pill off">Hidden</span> : c.qty > 0 ? <span className="pill good">Listed</span> : <span className="pill solid">Sold out</span>}</td>
                  <td>
                    <div className="acts">
                      <button className="btn sm" onClick={() => setEdit(c)}>Edit</button>
                      {c.qty > 0 && <AmountAction placeholder="Sale $" label="Record sale" onGo={(n) => run(() => supabase.rpc("record_sale", { p_card: c.id, p_price: n }), `Sale recorded at ${usd(n)}.`)} />}
                      <button
                        className="btn sm danger"
                        onClick={() => {
                          if (confirm !== c.id) return setConfirm(c.id);
                          setConfirm(null);
                          run(() => supabase.from("cards").delete().eq("id", c.id), "Card deleted.");
                        }}
                      >
                        {confirm === c.id ? "Confirm delete" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No cards yet. Add your first card to open the shop.</div>
      )}
      {edit && <Editor card={edit === "new" ? null : edit} cost={edit === "new" ? undefined : d.costs[edit.id]} run={run} close={() => setEdit(null)} />}
    </>
  );
}

function Prices({ d, run, reload }: { d: Data; run: Run; reload: () => Promise<void> }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const byCard = useMemo(() => {
    const m: Record<string, { d: string; v: number }[]> = {};
    d.hist.forEach((h) => (m[h.card_id] ??= []).push({ d: h.day, v: Number(h.price) }));
    return m;
  }, [d.hist]);
  const rows = [...d.cards].sort((a, b) => Number(b.market ?? 0) - Number(a.market ?? 0));
  const dates = [...new Set(d.hist.map((h) => h.day))].sort();
  const series = dates.map((day) => ({
    d: day,
    v: rows.reduce((a, c) => {
      const h = (byCard[c.id] ?? []).filter((x) => x.d <= day).at(-1);
      return a + (h ? h.v * (c.qty || 1) : 0);
    }, 0),
  }));

  async function refresh() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/cron/prices", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const out = await res.json();
      toast(res.ok ? `Updated ${out.updated} of ${out.checked} cards from TCGplayer.` : `Refresh failed: ${out.error}`);
      await reload();
    } catch {
      toast("Refresh failed. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <div className="panel">
        <div className="head">
          <h2>Inventory market value</h2>
          <button className="btn sm solid" onClick={refresh} disabled={busy}>{busy ? "Refreshing..." : "Refresh prices now"}</button>
        </div>
        {series.length > 1 ? (
          <div className="chart"><LineChart pts={series} fmt={usd} /></div>
        ) : (
          <p className="note">Tracking started {fmtDay(dates[0]) || "today"}. Each daily refresh adds a point per card, and the trend line draws from the second day on.</p>
        )}
        <p className="note">Market price is the TCGplayer market average (recent completed sales), read from the free TCGCSV mirror. It refreshes automatically once a day for every card with both TCGplayer IDs. You can also log a price by hand in any row.</p>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Card</th><th className="num">Market</th><th className="num">Low to mid</th><th className="num">Asking</th><th className="num">Ask vs market</th><th className="num">Since tracking</th><th>Trend</th><th>Updated</th><th>Log a price</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const h = byCard[c.id] ?? [];
              const first = h[0]?.v;
              const ch = first && h.length > 1 && c.market != null ? ((Number(c.market) - first) / first) * 100 : null;
              const dl = deltaInfo(c);
              return (
                <tr key={c.id}>
                  <td><b>{c.name}</b><div className="sub">{c.set_name} · {c.number}{!(c.tcg_group_id && c.tcg_product_id) ? " · no TCGplayer IDs, manual only" : ""}</div></td>
                  <td className="num">{usd(c.market)}</td>
                  <td className="num">{usd(c.low)} to {usd(c.mid)}</td>
                  <td className="num">{usd(c.ask)}</td>
                  <td className="num">{dl ? `${dl.p > 0 ? "+" : ""}${(dl.p * 100).toFixed(0)}%` : "n/a"}</td>
                  <td className="num">{ch == null ? <span className="mute">n/a</span> : <span style={{ color: `var(--${ch >= 0 ? "good" : "bad"})` }}>{ch >= 0 ? "▲ +" : "▼ "}{ch.toFixed(1)}%</span>}</td>
                  <td><Spark pts={h} /></td>
                  <td>{fmtDay(c.price_updated)}</td>
                  <td>
                    <div className="acts">
                      <AmountAction
                        placeholder="Market $"
                        label="Log"
                        onGo={(n) =>
                          run(async () => {
                            const a = await supabase.from("cards").update({ market: n, price_updated: dstr() }).eq("id", c.id);
                            return a.error ? a : supabase.from("price_history").upsert({ card_id: c.id, day: dstr(), price: n });
                          }, `Logged ${usd(n)} for ${c.name}.`)
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Usage({ d }: { d: Data }) {
  const days = lastDays(14);
  const by = Object.fromEntries(days.map((x) => [x, 0]));
  const views: Record<string, number> = {};
  let visits = 0, totalViews = 0;
  d.events.forEach((e) => {
    if (e.type === "visit") {
      visits++;
      if (e.day in by) by[e.day]++;
    } else if (e.card_id) {
      views[e.card_id] = (views[e.card_id] || 0) + 1;
      totalViews++;
    }
  });
  const visitors = new Set(d.events.map((e) => e.anon_id)).size;
  const offBy: Record<string, number> = {};
  d.offers.forEach((o) => o.card_id && (offBy[o.card_id] = (offBy[o.card_id] || 0) + 1));
  const buyers = new Set(d.offers.map((o) => o.user_id)).size;
  const top = Object.entries(views).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <>
      <div className="tiles">
        <div className="stat"><span className="eyebrow">Visitors</span><b>{visitors}</b><small>unique browsers, last 30 days</small></div>
        <div className="stat"><span className="eyebrow">Visits</span><b>{visits}</b><small>last 30 days</small></div>
        <div className="stat"><span className="eyebrow">Card views</span><b>{totalViews}</b><small>{Object.keys(views).length} different cards</small></div>
        <div className="stat"><span className="eyebrow">Offers per 100 visits</span><b>{visits ? ((d.offers.length / visits) * 100).toFixed(1) : "n/a"}</b><small>{buyers} buyer{buyers === 1 ? "" : "s"}, {d.offers.length} offers all time</small></div>
      </div>
      <div className="two">
        <div className="panel">
          <div className="head"><h2>Visits by day</h2><span className="eyebrow">Last 14 days</span></div>
          <div className="chart"><BarChart rows={days.map((x) => ({ d: x, v: by[x] }))} fmt={(v) => `${v} visit${v === 1 ? "" : "s"}`} label="Visits per day over the last 14 days" /></div>
          <p className="note">Counts every visitor, signed in or not. Your own admin visits are left out.</p>
        </div>
        <div className="panel">
          <h2>Most viewed cards</h2>
          {top.length ? (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Card</th><th className="num">Views</th><th className="num">Offers</th></tr></thead>
                <tbody>
                  {top.map(([id, n]) => (
                    <tr key={id}><td><b>{d.cards.find((c) => c.id === id)?.name ?? id}</b></td><td className="num">{n}</td><td className="num">{offBy[id] || 0}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No card views recorded yet.</div>
          )}
        </div>
      </div>
    </>
  );
}

function Store() {
  const { site, reloadSite, toast } = useApp();
  const [f, setF] = useState<Site>(site);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("site").update({ name: f.name.trim() || "Card Marketplace", tagline: f.tagline.trim(), contact: f.contact.trim() }).eq("id", 1);
    toast(error ? `That did not save: ${error.message}` : "Store details saved.");
    reloadSite();
  }
  return (
    <form className="panel" onSubmit={save} style={{ maxWidth: 560 }}>
      <h2>Store details</h2>
      <label>Store name<input type="text" id="st-name" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Tagline<input type="text" id="st-tag" maxLength={200} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></label>
      <label>Contact shown in the footer<input type="text" id="st-contact" maxLength={120} placeholder="Email or handle" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
      <div><button className="btn solid" type="submit">Save store details</button></div>
    </form>
  );
}
