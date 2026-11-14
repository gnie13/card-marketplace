"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { supabase } from "@/lib/supabase";
import type { Offer } from "@/lib/types";
import { agreed, fmtDay, usd } from "@/lib/util";
import { Pill } from "@/components/ui";

export default function MyOffers() {
  const { user, ready, toast } = useApp();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const uid = user?.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("offers").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    setOffers((data as Offer[]) ?? []);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: "offer_withdraw" | "offer_reply", args: Record<string, unknown>, done: string) {
    const { error } = await supabase.rpc(fn, args);
    toast(error ? "That did not go through. Refresh and try again." : done);
    load();
  }

  if (!user)
    return (
      <section className="section">
        <h1>My offers</h1>
        <div className="empty">
          {ready ? (
            <>
              <Link href="/login?next=/offers">Sign in</Link> to send and track offers.
            </>
          ) : (
            "Checking your sign-in..."
          )}
        </div>
      </section>
    );

  return (
    <section className="section">
      <h1>My offers</h1>
      {!offers ? (
        <div className="empty">Loading your offers...</div>
      ) : !offers.length ? (
        <div className="empty">
          You have not sent any offers yet. <Link href="/">Browse the shop</Link> and open a card to make one.
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Card</th>
                <th className="num">Your offer</th>
                <th className="num">Asking</th>
                <th>Sent</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.card_id ? <Link href={`/card/${o.card_id}`}><b>{o.card_name}</b></Link> : <b>{o.card_name}</b>}
                    <div className="sub">{o.card_label}</div>
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
                          <button className="btn sm solid" onClick={() => act("offer_reply", { p_id: o.id, p_accept: true }, "Counter accepted. The seller will be in touch.")}>
                            Accept {usd(o.counter)}
                          </button>
                          <button className="btn sm" onClick={() => act("offer_reply", { p_id: o.id, p_accept: false }, "Counter declined.")}>Decline</button>
                        </>
                      )}
                      {o.status === "pending" && (
                        <button className="btn sm" onClick={() => act("offer_withdraw", { p_id: o.id }, "Offer withdrawn.")}>Withdraw</button>
                      )}
                      {(o.status === "accepted" || o.status === "counter_accepted") && (
                        <span className="sub">Agreed at {usd(agreed(o))}. The seller will contact you to complete the sale.</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
