"use client";

import { useState } from "react";
import { useApp } from "@/lib/app";
import { supabase } from "@/lib/supabase";
import type { BuyItem, Card, Lead, Loc, Offer, Slot } from "@/lib/types";
import { GAMES, dstr, fmtDay, fmtSlot, gameName, num, parseCsv, slug, usd } from "@/lib/util";

type Run = (work: () => PromiseLike<{ error: { message: string } | null }>, done: string) => Promise<boolean>;

export function BuylistAdmin({ items, leads, run }: { items: BuyItem[]; leads: Lead[]; run: Run }) {
  const { toast } = useApp();
  const blank = { name: "", set_name: "", number: "", condition: "NM", pay: "", note: "", game: "pokemon" };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const pay = num(f.pay);
    if (!f.name.trim() || pay == null) return toast("Enter a card name and what you pay.");
    const ok = await run(() => supabase.from("buylist").insert({ ...f, name: f.name.trim(), pay }), "Added to the buylist.");
    if (ok) setF(blank);
  }
  return (
    <>
      <form className="panel" onSubmit={add}>
        <h2>Add a card you want to buy</h2>
        <div className="fgrid">
          <label className="w2">Card name<input type="text" id="bl-name" required maxLength={80} value={f.name} onChange={set("name")} /></label>
          <label>Game<select id="bl-game" value={f.game} onChange={set("game")}>{GAMES.map((g) => <option key={g[0]} value={g[0]}>{g[1]}</option>)}</select></label>
          <label>Set<input type="text" id="bl-set" maxLength={60} value={f.set_name} onChange={set("set_name")} /></label>
          <label>Number<input type="text" id="bl-num" maxLength={20} value={f.number} onChange={set("number")} /></label>
          <label>Condition wanted<select id="bl-cond" value={f.condition} onChange={set("condition")}>{["NM", "LP", "MP", "HP", "Any"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>You pay (USD)<input type="number" id="bl-pay" min="0" step="0.01" required value={f.pay} onChange={set("pay")} /></label>
          <label className="w2">Note shown to sellers<input type="text" id="bl-note" maxLength={120} placeholder="Up to 4 copies, 1st Edition only..." value={f.note} onChange={set("note")} /></label>
        </div>
        <div><button className="btn solid" type="submit">Add to buylist</button></div>
      </form>
      {items.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Card</th><th>Game</th><th>Condition</th><th className="num">You pay</th><th className="num">Sellers</th><th>Action</th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.name}</b><div className="sub">{[b.set_name, b.number, b.note].filter(Boolean).join(" · ")}</div></td>
                  <td>{gameName(b.game)}</td>
                  <td>{b.condition}</td>
                  <td className="num">{usd(b.pay)}</td>
                  <td className="num">{leads.filter((l) => l.buylist_id === b.id).length}</td>
                  <td>
                    <div className="acts">
                      <button className="btn sm" onClick={() => run(() => supabase.from("buylist").update({ active: !b.active }).eq("id", b.id), b.active ? "Hidden from the buylist." : "Shown on the buylist.")}>{b.active ? "Hide" : "Show"}</button>
                      <button className="btn sm danger" onClick={() => run(() => supabase.from("buylist").delete().eq("id", b.id), "Removed.")}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Your buylist is empty. Add the cards you want and what you pay, and they show on the public &quot;We buy&quot; page.</div>
      )}
      <h2>People who have your cards</h2>
      {leads.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Card</th><th>Seller</th><th>Their note</th><th>Sent</th><th></th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td><b>{items.find((b) => b.id === l.buylist_id)?.name ?? "Removed card"}</b></td>
                  <td><b>{l.profiles?.name || "Visitor"}</b>{l.profiles?.email && <div className="sub">{l.profiles.email}</div>}</td>
                  <td>{l.note || <span className="mute">none</span>}</td>
                  <td>{fmtDay(l.created_at)}</td>
                  <td><button className="btn sm" onClick={() => run(() => supabase.from("sell_leads").delete().eq("id", l.id), "Cleared.")}>Done</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">Nobody has responded yet. When a signed-in visitor taps &quot;I have this&quot;, they show up here with their email.</div>
      )}
    </>
  );
}

export function MeetupsAdmin({ slots, locs, offers, run }: { slots: Slot[]; locs: Loc[]; offers: Offer[]; run: Run }) {
  const { toast } = useApp();
  const active = locs.filter((l) => l.active);
  const [loc, setLoc] = useState("");
  const [when, setWhen] = useState("");
  const town = (id: string) => locs.find((l) => l.id === id)?.name ?? id;
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const at = new Date(when);
    if (!when || isNaN(at.getTime()) || at < new Date()) return toast("Pick a date and time in the future.");
    const ok = await run(() => supabase.from("slots").insert({ location_id: loc || active[0]?.id, starts_at: at.toISOString() }), "Time slot opened.");
    if (ok) setWhen("");
  }
  const now = new Date().toISOString();
  const upcoming = slots.filter((s) => s.starts_at >= now);
  return (
    <>
      <form className="panel" onSubmit={add} style={{ maxWidth: 640 }}>
        <h2>Open a meetup time</h2>
        <p className="note">Buyers with an accepted offer pick from the open times below. Each time holds one meetup.</p>
        <div className="fgrid">
          <label>Town<select id="sl-loc" value={loc || active[0]?.id || ""} onChange={(e) => setLoc(e.target.value)}>{active.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}</select></label>
          <label className="w2">Date and time<input type="datetime-local" id="sl-when" required value={when} onChange={(e) => setWhen(e.target.value)} style={{ border: "1px solid var(--ink)", padding: "8px 10px", background: "var(--paper)" }} /></label>
        </div>
        <div><button className="btn solid" type="submit" disabled={!active.length}>Open this time</button></div>
      </form>
      {upcoming.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>When</th><th>Town</th><th>Booked by</th><th>For</th><th></th></tr></thead>
            <tbody>
              {upcoming.map((s) => {
                const o = offers.find((x) => x.id === s.offer_id);
                return (
                  <tr key={s.id}>
                    <td><b>{fmtSlot(s.starts_at)}</b></td>
                    <td>{town(s.location_id)}</td>
                    <td>{o ? <><b>{o.profiles?.name || "Buyer"}</b>{o.profiles?.email && <div className="sub">{o.profiles.email}</div>}</> : <span className="pill off">Open</span>}</td>
                    <td>{o ? <>{o.card_name}<div className="sub">{o.card_label}</div></> : ""}</td>
                    <td><button className="btn sm danger" onClick={() => run(() => supabase.from("slots").delete().eq("id", s.id), "Time slot removed.")}>Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No upcoming times. Open a few so buyers can book as soon as you accept their offer.</div>
      )}
    </>
  );
}

const CSV_HEAD = "name,number,set_name,set_code,game,kind,rarity,condition,grade,grader,cert_no,qty,ask,market,cost,tcg_group_id,tcg_product_id";

export function BulkImport({ cards, run }: { cards: Card[]; run: Run }) {
  const { toast } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = text.trim() ? parseCsv(text) : [];
  const valid = rows.filter((r) => r.name && num(r.ask ?? "") != null);

  async function go() {
    if (!valid.length) return toast("No valid rows. Each row needs at least a name and an asking price.");
    setBusy(true);
    const today = dstr();
    const taken = new Set(cards.map((c) => c.id));
    const made = valid.map((r) => {
      let id = slug(`${r.set_code || r.set_name || ""}-${r.name}-${r.number || ""}`) || "card";
      while (taken.has(id)) id = `${id.slice(0, 34)}-${Math.random().toString(36).slice(2, 6)}`;
      taken.add(id);
      const market = num(r.market ?? "");
      return {
        cost: num(r.cost ?? ""),
        row: {
          id, name: r.name, number: r.number ?? "", set_name: r.set_name ?? "", set_code: (r.set_code ?? "").toUpperCase(),
          game: (r.game || "pokemon").toLowerCase(), kind: r.kind?.toLowerCase() === "sealed" ? "sealed" : "single",
          rarity: r.rarity ?? "", condition: (r.condition || "NM").toUpperCase(), grade: r.grade || "Raw", grader: r.grader ?? "", cert_no: r.cert_no ?? "",
          qty: Math.max(0, parseInt(r.qty || "1") || 0), ask: num(r.ask), market, price_updated: market != null ? today : null,
          tcg_group_id: num(r.tcg_group_id ?? ""), tcg_product_id: num(r.tcg_product_id ?? ""),
        },
      };
    });
    const ok = await run(async () => {
      const a = await supabase.from("cards").insert(made.map((m) => m.row));
      if (a.error) return a;
      const hist = made.filter((m) => m.row.market != null).map((m) => ({ card_id: m.row.id, day: today, price: m.row.market }));
      if (hist.length) {
        const h = await supabase.from("price_history").upsert(hist);
        if (h.error) return h;
      }
      const costs = made.filter((m) => m.cost != null).map((m) => ({ card_id: m.row.id, cost: m.cost }));
      return costs.length ? supabase.from("card_costs").upsert(costs) : { error: null };
    }, `${made.length} cards imported.`);
    setBusy(false);
    if (ok) setText("");
  }

  return (
    <details className="panel">
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Import many cards from a spreadsheet</summary>
      <p className="note">Export your sheet as CSV and paste it below, or choose the file. The first row must be the column names. Only name and ask are required.</p>
      <p className="mono small" style={{ margin: 0, overflowWrap: "anywhere" }}>{CSV_HEAD}</p>
      <input type="file" id="csv-file" accept=".csv,text/csv" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setText(await file.text()); }} />
      <textarea className="csv" id="csv-text" aria-label="CSV rows" placeholder={`${CSV_HEAD}\nCharizard ex,199/165,Scarlet & Violet 151,MEW,pokemon,single,Special Illustration Rare,NM,Raw,,,1,290,292.22,180,23237,517045`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="acts">
        <button className="btn solid" onClick={go} disabled={busy || !valid.length}>{busy ? "Importing..." : `Import ${valid.length} card${valid.length === 1 ? "" : "s"}`}</button>
        {rows.length > valid.length && <span className="note">{rows.length - valid.length} row{rows.length - valid.length === 1 ? "" : "s"} skipped for a missing name or asking price.</span>}
      </div>
    </details>
  );
}
