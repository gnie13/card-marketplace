"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { notify } from "@/lib/notify";
import { supabase } from "@/lib/supabase";
import type { Loc, Offer, Slot } from "@/lib/types";
import { agreed, fmtDay, fmtSlot, usd } from "@/lib/util";
import { Pill } from "@/components/ui";

export default function MyOffers() {
  const { user, ready, toast, site } = useApp();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const uid = user?.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const [o, s, l] = await Promise.all([
      supabase.from("offers").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("slots").select("*").gte("starts_at", new Date().toISOString()).order("starts_at"),
      supabase.from("locations").select("*"),
    ]);
    setOffers((o.data as Offer[]) ?? []);
    setSlots((s.data as Slot[]) ?? []);
    setLocs((l.data as Loc[]) ?? []);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const town = (id: string) => locs.find((l) => l.id === id)?.name ?? "";

  async function act(o: Offer, fn: "offer_withdraw" | "offer_reply" | "book_slot", args: Record<string, unknown>, done: string) {
    const { error } = await supabase.rpc(fn, args);
    toast(error ? `That did not go through: ${error.message}` : done);
    if (!error) notify({ type: "offer", id: o.id });
    load();
  }

  if (!user)
    return (
      <section className="section">
        <h1>My offers</h1>
        <div className="empty">{ready ? <><Link href="/login?next=/offers">Sign in</Link> to send and track offers.</> : "Checking your sign-in..."}</div>
      </section>
    );

  return (
    <section className="section">
      <h1>My offers</h1>
      {!offers ? (
        <div className="empty">Loading your offers...</div>
      ) : !offers.length ? (
        <div className="empty">You have not sent any offers yet. <Link href="/">Browse the shop</Link> and open a card to make one.</div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Card</th><th className="num">Your offer</th><th className="num">Asking</th><th>Sent</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {offers.map((o) => {
                const booked = slots.find((s) => s.offer_id === o.id);
                const open = slots.filter((s) => !s.offer_id).sort((a, b) => Number(b.location_id === o.meetup) - Number(a.location_id === o.meetup));
                const chosen = pick[o.id] ?? open[0]?.id ?? "";
                const isBundle = o.items?.length > 0;
                return (
                  <tr key={o.id}>
                    <td>
                      {o.card_id && !isBundle ? <Link href={`/card/${o.card_id}`}><b>{o.card_name}</b></Link> : <b>{o.card_name}</b>}
                      <div className="sub">{o.card_label}</div>
                      {o.trade_note && <div className="sub">Trade: {o.trade_note}{o.trade_value != null ? ` (${usd(o.trade_value)})` : ""}</div>}
                    </td>
                    <td className="num">{usd(o.amount)}</td>
                    <td className="num">{usd(o.ask_at_offer)}</td>
                    <td>{fmtDay(o.created_at)}</td>
                    <td><Pill status={o.status} /></td>
                    <td>
                      <div className="acts">
                        {o.status === "countered" && (
                          <>
                            <span className="mono">Counter: {usd(o.counter)}</span>
                            <button className="btn sm solid" onClick={() => act(o, "offer_reply", { p_id: o.id, p_accept: true }, "Counter accepted. Pick a meetup time next.")}>Accept {usd(o.counter)}</button>
                            <button className="btn sm" onClick={() => act(o, "offer_reply", { p_id: o.id, p_accept: false }, "Counter declined.")}>Decline</button>
                          </>
                        )}
                        {o.status === "pending" && <button className="btn sm" onClick={() => act(o, "offer_withdraw", { p_id: o.id }, "Offer withdrawn.")}>Withdraw</button>}
                        {(o.status === "accepted" || o.status === "counter_accepted") && (
                          <>
                            <span className="sub">Agreed at {usd(agreed(o))}, tax included. Pay in person ({site.payments}).</span>
                            {booked && <span className="pill good">Meetup {fmtSlot(booked.starts_at)}, {town(booked.location_id)}</span>}
                            {open.length > 0 ? (
                              <>
                                <select aria-label="Meetup time" style={{ width: 230 }} value={chosen} onChange={(e) => setPick({ ...pick, [o.id]: e.target.value })}>
                                  {open.map((s) => <option key={s.id} value={s.id}>{fmtSlot(s.starts_at)}, {town(s.location_id)}</option>)}
                                </select>
                                <button className="btn sm solid" onClick={() => act(o, "book_slot", { p_slot: chosen, p_offer: o.id }, "Meetup booked.")}>{booked ? "Change time" : "Book meetup"}</button>
                              </>
                            ) : (
                              !booked && <span className="sub">No open times right now. The seller will email you to set one.</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
