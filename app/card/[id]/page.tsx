"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { supabase } from "@/lib/supabase";
import type { Card, Hist, Loc, Offer } from "@/lib/types";
import { deltaInfo, fmtDay, num, usd } from "@/lib/util";
import { Art, Pill } from "@/components/ui";
import { LineChart } from "@/components/charts";

export default function CardPage() {
  const { id } = useParams<{ id: string }>();
  const { user, ready, toast, track, site } = useApp();
  const [locs, setLocs] = useState<Loc[]>([]);
  const [meetup, setMeetup] = useState("");
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [hist, setHist] = useState<Hist[]>([]);
  const [mine, setMine] = useState<Offer[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = user?.id;

  const loadMine = useCallback(async () => {
    if (!uid) return setMine([]);
    const { data } = await supabase.from("offers").select("*").eq("card_id", id).eq("user_id", uid).order("created_at", { ascending: false });
    setMine((data as Offer[]) ?? []);
  }, [id, uid]);

  useEffect(() => {
    supabase.from("cards").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      const c = (data as Card) ?? null;
      setCard(c);
      if (c?.ask != null) setAmount(String(c.ask));
    });
    supabase.from("locations").select("*").eq("active", true).order("name").then(({ data }) => setLocs((data as Loc[]) ?? []));
    supabase.from("price_history").select("*").eq("card_id", id).order("day").then(({ data }) => setHist((data as Hist[]) ?? []));
  }, [id]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (ready) track("view", id);
  }, [ready, id, track]);

  if (card === undefined) return <p className="mute" style={{ padding: "40px 0" }}>Loading card...</p>;
  if (card === null)
    return (
      <>
        <Link className="back" href="/">Back to shop</Link>
        <div className="empty">This card is no longer listed.</div>
      </>
    );

  const d = deltaInfo(card);
  const sold = card.qty < 1;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const amt = num(amount);
    if (!card || !amt || amt <= 0) return toast("Enter an offer amount above zero.");
    setBusy(true);
    const { error } = await supabase.from("offers").insert({
      card_id: card.id,
      card_name: card.name,
      card_label: `${card.set_name} · ${card.number}`,
      amount: amt,
      note: note.trim().slice(0, 240),
      meetup: meetup || locs[0]?.id || "",
      ask_at_offer: card.ask,
      market_at_offer: card.market,
    });
    setBusy(false);
    if (error) return toast("Your offer did not send. Check your connection and try again.");
    setNote("");
    toast(`Offer of ${usd(amt)} sent. Track it under My offers.`);
    loadMine();
  }

  return (
    <>
      <Link className="back" href="/">Back to shop</Link>
      <div className="detail">
        <div className="artcol"><Art c={card} /></div>
        <div className="side">
          <div style={{ display: "grid", gap: 8 }}>
            <span className="eyebrow">{card.set_name} · {card.number}</span>
            <h1 style={{ fontSize: "clamp(26px,4.4vw,42px)" }}>{card.name}</h1>
          </div>
          <div className="row" style={{ justifyContent: "flex-start", gap: 14, alignItems: "center" }}>
            <span className="bigask">{sold ? "Sold" : usd(card.ask)}</span>
            {d && !sold && <span className={`delta ${d.cls}`}>{d.txt}</span>}
          </div>
          <div className="spec">
            <div><span className="eyebrow">Rarity</span><b>{card.rarity || "n/a"}</b></div>
            <div><span className="eyebrow">Condition</span><b>{card.condition || "n/a"}</b></div>
            <div><span className="eyebrow">Grade</span><b>{card.grade || "Raw"}</b></div>
            <div><span className="eyebrow">In stock</span><b>{card.qty}</b></div>
          </div>

          <div className="panel">
            <div className="head">
              <h2>Market price</h2>
              <span className="eyebrow">{card.price_updated ? `Updated ${fmtDay(card.price_updated)}` : ""}</span>
            </div>
            <div className="spec">
              <div><span className="eyebrow">Market avg</span><b>{usd(card.market)}</b></div>
              <div><span className="eyebrow">Low listing</span><b>{usd(card.low)}</b></div>
              <div><span className="eyebrow">Mid listing</span><b>{usd(card.mid)}</b></div>
            </div>
            {hist.length > 1 ? (
              <div className="chart"><LineChart pts={hist.map((h) => ({ d: h.day, v: Number(h.price) }))} fmt={usd} /></div>
            ) : (
              <p className="note">
                Price tracking for this card started {fmtDay(hist[0]?.day ?? card.price_updated) || "recently"}. A trend line appears after the next daily update.
              </p>
            )}
            <p className="note">
              Source: TCGplayer market price
              {card.tcg_product_id && (
                <>
                  , <a href={`https://www.tcgplayer.com/product/${card.tcg_product_id}`} target="_blank" rel="noopener noreferrer">view the listing on TCGplayer</a>
                </>
              )}
              .
            </p>
          </div>

          <div className="panel">
            <h2>Make an offer</h2>
            {sold ? (
              <p className="note">This card has sold.</p>
            ) : !user ? (
              <p className="note">
                {ready ? (
                  <>
                    <Link href={`/login?next=/card/${card.id}`}>Sign in</Link> to send an offer on this card.
                  </>
                ) : (
                  "Checking your sign-in..."
                )}
              </p>
            ) : (
              <form className="offerform" onSubmit={send}>
                <label>
                  Your offer (USD)
                  <input type="number" id="of-amt" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <label>
                  Note to seller (optional)
                  <input type="text" id="of-note" maxLength={240} placeholder="Best days or times, bundle with another card..." value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                {locs.length > 0 && (
                  <label className="full">
                    Where you would like to meet
                    <select id="of-meet" value={meetup || locs[0].id} onChange={(e) => setMeetup(e.target.value)}>
                      {locs.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}
                    </select>
                  </label>
                )}
                <div className="full acts">
                  <button className="btn solid" type="submit" disabled={busy}>Send offer</button>
                  <span className="note">
                    Prices include sales tax. Local pickup only, paid in person ({site.payments}). Nothing is charged here. See the <Link href="/guide">offer rules</Link>.
                  </span>
                </div>
              </form>
            )}
            {mine.length > 0 && (
              <>
                <div className="tablewrap">
                  <table>
                    <tbody>
                      {mine.map((o) => (
                        <tr key={o.id}>
                          <td className="mono">{usd(o.amount)}</td>
                          <td className="sub">{fmtDay(o.created_at)}</td>
                          <td><Pill status={o.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link href="/offers" style={{ fontSize: 13 }}>Manage my offers</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
