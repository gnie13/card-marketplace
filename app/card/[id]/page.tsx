"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { notify } from "@/lib/notify";
import { supabase } from "@/lib/supabase";
import type { Card, Hist, Loc, Offer } from "@/lib/types";
import { certUrl, deltaInfo, dstr, fmtDay, gameName, num, photosOf, usd } from "@/lib/util";
import { Art, Pill } from "@/components/ui";
import { LineChart } from "@/components/charts";

const RANGES: [string, number][] = [["30D", 30], ["90D", 90], ["1Y", 365], ["All", 0]];

export default function CardPage() {
  const { id } = useParams<{ id: string }>();
  const { user, ready, toast, track, site, bundle, toggleBundle } = useApp();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [hist, setHist] = useState<Hist[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [mine, setMine] = useState<Offer[]>([]);
  const [saved, setSaved] = useState(false);
  const [range, setRange] = useState(0);
  const [shot, setShot] = useState(0);
  const [f, setF] = useState({ amount: "", note: "", meetup: "", trade: "", tradeValue: "" });
  const [busy, setBusy] = useState(false);
  const uid = user?.id;

  const loadMine = useCallback(async () => {
    if (!uid) return;
    const [o, w] = await Promise.all([
      supabase.from("offers").select("*").eq("card_id", id).eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("wishlist").select("card_id").eq("card_id", id).eq("user_id", uid),
    ]);
    setMine((o.data as Offer[]) ?? []);
    setSaved(Boolean(w.data?.length));
  }, [id, uid]);

  useEffect(() => {
    supabase.from("cards").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      const c = (data as Card) ?? null;
      setCard(c);
      if (c?.ask != null) setF((x) => ({ ...x, amount: String(c.ask) }));
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
  const graded = Boolean(card.grade) && card.grade.toLowerCase() !== "raw";
  const cert = certUrl(card.grader, card.cert_no);
  const inBundle = bundle.includes(card.id);
  const photos = photosOf(card);
  const current = photos[Math.min(shot, photos.length - 1)];
  const cut = new Date();
  cut.setDate(cut.getDate() - range);
  const shown = (range ? hist.filter((h) => h.day >= dstr(cut)) : hist).map((h) => ({ d: h.day, v: Number(h.price) }));

  async function toggleSave() {
    if (!card) return;
    const res = saved
      ? await supabase.from("wishlist").delete().eq("card_id", card.id).eq("user_id", uid!)
      : await supabase.from("wishlist").insert({ card_id: card.id });
    if (res.error) return toast("That did not save. Try again.");
    setSaved(!saved);
    toast(saved ? "Removed from your saved cards." : "Saved. We will email you if it restocks or drops in price.");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const amt = num(f.amount);
    if (!card || !amt || amt <= 0) return toast("Enter an offer amount above zero.");
    setBusy(true);
    const { data, error } = await supabase
      .from("offers")
      .insert({
        card_id: card.id,
        card_name: card.name,
        card_label: `${card.set_name} · ${card.number}`,
        amount: amt,
        note: f.note.trim().slice(0, 240),
        meetup: f.meetup || locs[0]?.id || "",
        trade_note: f.trade.trim().slice(0, 400),
        trade_value: f.trade.trim() ? num(f.tradeValue) : null,
        ask_at_offer: card.ask,
        market_at_offer: card.market,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast("Your offer did not send. Check your connection and try again.");
    notify({ type: "offer", id: data.id });
    setF({ ...f, note: "", trade: "", tradeValue: "" });
    toast(`Offer of ${usd(amt)} sent. Track it under My offers.`);
    loadMine();
  }

  return (
    <>
      <Link className="back" href="/">Back to shop</Link>
      <div className="detail">
        <div className="artcol">
          {photos.length ? (
            <div className="gallery">
              <a href={current} target="_blank" rel="noopener noreferrer" title="Open the full-size photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="shot" src={current} alt={`Photo ${Math.min(shot, photos.length - 1) + 1} of ${photos.length} of ${card.name}`} />
              </a>
              {photos.length > 1 && (
                <div className="thumbs">
                  {photos.map((src, i) => (
                    <button key={src} aria-pressed={i === shot} aria-label={`Show photo ${i + 1}`} onClick={() => setShot(i)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
              <p className="note">{photos.length} photo{photos.length === 1 ? "" : "s"} of the actual card for sale. Tap the photo to see it full size.</p>
            </div>
          ) : (
            <>
              <Art c={card} />
              <p className="note" style={{ marginTop: 8 }}>No photos yet. Ask the seller for photos of the actual card before you meet.</p>
            </>
          )}
        </div>
        <div className="side">
          <div style={{ display: "grid", gap: 8 }}>
            <span className="eyebrow">{gameName(card.game)} · {card.set_name}{card.number ? ` · ${card.number}` : ""}</span>
            <h1 style={{ fontSize: "clamp(26px,4.4vw,42px)" }}>{card.name}</h1>
          </div>
          <div className="row" style={{ justifyContent: "flex-start", gap: 14, alignItems: "center" }}>
            <span className="bigask">{sold ? "Sold" : usd(card.ask)}</span>
            {d && !sold && <span className={`delta ${d.cls}`}>{d.txt}</span>}
          </div>
          <div className="acts">
            {!sold && <button className="btn" aria-pressed={inBundle} onClick={() => toggleBundle(card.id)}>{inBundle ? "Remove from bundle" : "Add to bundle offer"}</button>}
            {inBundle && <Link className="btn solid" href="/bundle" style={{ textDecoration: "none" }}>Review bundle ({bundle.length})</Link>}
            {user && <button className="btn" aria-pressed={saved} onClick={toggleSave}>{saved ? "Saved" : sold ? "Notify me if it restocks" : "Save and watch price"}</button>}
          </div>
          <div className="spec">
            {card.kind === "sealed" ? (
              <div><span className="eyebrow">Type</span><b>Sealed product</b></div>
            ) : (
              <>
                <div><span className="eyebrow">Rarity</span><b>{card.rarity || "n/a"}</b></div>
                <div><span className="eyebrow">Condition</span><b>{card.condition || "n/a"}</b></div>
                <div><span className="eyebrow">Grade</span><b>{graded ? `${card.grader} ${card.grade}`.trim() : "Raw"}</b></div>
                {graded && card.cert_no && (
                  <div>
                    <span className="eyebrow">Cert no.</span>
                    <b>{cert ? <a href={cert} target="_blank" rel="noopener noreferrer">{card.cert_no}</a> : card.cert_no}</b>
                  </div>
                )}
              </>
            )}
            <div><span className="eyebrow">In stock</span><b>{card.qty}</b></div>
          </div>

          <div className="panel">
            <div className="head">
              <h2>Market price</h2>
              <div className="seg" role="group" aria-label="Price history range">
                {RANGES.map((r) => <button key={r[0]} aria-pressed={range === r[1]} onClick={() => setRange(r[1])}>{r[0]}</button>)}
              </div>
            </div>
            <div className="spec">
              <div><span className="eyebrow">Market avg</span><b>{usd(card.market)}</b></div>
              <div><span className="eyebrow">Low listing</span><b>{usd(card.low)}</b></div>
              <div><span className="eyebrow">Mid listing</span><b>{usd(card.mid)}</b></div>
            </div>
            {shown.length > 1 ? (
              <div className="chart"><LineChart pts={shown} fmt={usd} /></div>
            ) : (
              <p className="note">
                {hist.length > 1
                  ? "Not enough price points in this range yet. Try a longer one."
                  : `Price tracking for this card started ${fmtDay(hist[0]?.day ?? card.price_updated) || "recently"}. A trend line appears after the next daily update.`}
              </p>
            )}
            <p className="note">
              Source: TCGplayer market price{card.price_updated ? `, updated ${fmtDay(card.price_updated)}` : ""}
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
              <p className="note">This card has sold.{user ? " Save it to hear if another copy comes in." : ""}</p>
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
                  <input type="number" id="of-amt" min="1" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
                </label>
                <label>
                  Note to seller (optional)
                  <input type="text" id="of-note" maxLength={240} placeholder="Best days or times..." value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
                </label>
                {locs.length > 0 && (
                  <label className="full">
                    Where you would like to meet
                    <select id="of-meet" value={f.meetup || locs[0].id} onChange={(e) => setF({ ...f, meetup: e.target.value })}>
                      {locs.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}
                    </select>
                  </label>
                )}
                <details className="full more" style={{ borderTop: 0, padding: 0 }}>
                  <summary>Include cards in trade</summary>
                  <div className="mgrid" style={{ gridTemplateColumns: "1fr 160px" }}>
                    <label>
                      Cards you would trade
                      <input type="text" id="of-trade" maxLength={400} placeholder="Card, set, condition" value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} />
                    </label>
                    <label>
                      Their value (USD)
                      <input type="number" id="of-tradeval" min="0" step="0.01" value={f.tradeValue} onChange={(e) => setF({ ...f, tradeValue: e.target.value })} />
                    </label>
                  </div>
                  <p className="note">Your cash offer above is what you pay on top of the trade. The seller inspects trade cards at the meetup.</p>
                </details>
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
