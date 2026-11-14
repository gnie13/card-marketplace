"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { notify } from "@/lib/notify";
import { supabase } from "@/lib/supabase";
import type { Card, Loc } from "@/lib/types";
import { num, usd } from "@/lib/util";

export default function Bundle() {
  const { user, ready, bundle, toggleBundle, clearBundle, toast, site } = useApp();
  const router = useRouter();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [f, setF] = useState({ amount: "", note: "", meetup: "" });
  const [busy, setBusy] = useState(false);
  const key = bundle.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!ids.length) {
      Promise.resolve().then(() => setCards([]));
      return;
    }
    supabase.from("cards").select("*").in("id", ids).then(({ data }) => setCards((data as Card[]) ?? []));
    supabase.from("locations").select("*").eq("active", true).order("name").then(({ data }) => setLocs((data as Loc[]) ?? []));
  }, [key]);

  const live = (cards ?? []).filter((c) => c.qty > 0 && bundle.includes(c.id));
  const gone = bundle.length - live.length;
  const total = live.reduce((a, c) => a + Number(c.ask ?? 0), 0);
  const market = live.reduce((a, c) => a + Number(c.market ?? 0), 0);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const amt = num(f.amount);
    if (!amt || amt <= 0) return toast("Enter one total offer for the whole bundle.");
    if (live.length < 2) return toast("A bundle needs at least two cards in stock.");
    setBusy(true);
    const { data, error } = await supabase
      .from("offers")
      .insert({
        card_id: live[0].id,
        card_name: `Bundle of ${live.length} cards`,
        card_label: live.map((c) => c.name).join(", ").slice(0, 300),
        items: live.map((c) => ({ id: c.id, name: c.name, label: `${c.set_name} · ${c.number}`, ask: c.ask, market: c.market })),
        amount: amt,
        note: f.note.trim().slice(0, 240),
        meetup: f.meetup || locs[0]?.id || "",
        ask_at_offer: total,
        market_at_offer: market,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast("Your bundle offer did not send. Try again.");
    notify({ type: "offer", id: data.id });
    clearBundle();
    toast(`Bundle offer of ${usd(amt)} sent.`);
    router.push("/offers");
  }

  return (
    <section className="section">
      <h1>Bundle offer</h1>
      <p className="mute" style={{ margin: 0, maxWidth: "62ch" }}>Make one offer for several cards. The seller accepts, declines, or counters the bundle as a whole.</p>
      {!cards ? (
        <div className="empty">Loading your bundle...</div>
      ) : !live.length ? (
        <div className="empty">Your bundle is empty. Open a card in the <Link href="/">shop</Link> and choose &quot;Add to bundle offer&quot;.</div>
      ) : (
        <>
          <div className="list">
            {live.map((c) => (
              <div className="li" key={c.id}>
                <div><Link href={`/card/${c.id}`}><b>{c.name}</b></Link><div className="sub mute">{c.set_name} · {c.number} · {c.condition} {c.grade}</div></div>
                <div className="acts"><span className="mono">{usd(c.ask)}</span><button className="btn sm" onClick={() => toggleBundle(c.id)}>Remove</button></div>
              </div>
            ))}
            <div className="li"><b>{live.length} cards at asking price</b><span className="mono"><b>{usd(total)}</b></span></div>
          </div>
          {gone > 0 && <p className="note">{gone} card{gone === 1 ? "" : "s"} in your bundle sold and {gone === 1 ? "was" : "were"} left out.</p>}
          {!user ? (
            <div className="empty">{ready ? <><Link href="/login?next=/bundle">Sign in</Link> to send this bundle offer.</> : "Checking your sign-in..."}</div>
          ) : (
            <form className="panel offerform" onSubmit={send} style={{ maxWidth: 640 }}>
              <label>
                Your total offer (USD)
                <input type="number" id="bn-amt" min="1" step="0.01" required placeholder={String(total)} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
              </label>
              <label>
                Note to seller (optional)
                <input type="text" id="bn-note" maxLength={240} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
              </label>
              {locs.length > 0 && (
                <label className="full">
                  Where you would like to meet
                  <select id="bn-meet" value={f.meetup || locs[0].id} onChange={(e) => setF({ ...f, meetup: e.target.value })}>
                    {locs.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}
                  </select>
                </label>
              )}
              <div className="full acts">
                <button className="btn solid" type="submit" disabled={busy || live.length < 2}>Send bundle offer</button>
                <span className="note">{live.length < 2 ? "Add at least one more card. " : ""}Prices include sales tax. Local pickup, paid in person ({site.payments}).</span>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
