"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { supabase } from "@/lib/supabase";
import type { Card } from "@/lib/types";
import { deltaInfo, usd } from "@/lib/util";

export default function Saved() {
  const { user, ready, toast } = useApp();
  const [cards, setCards] = useState<Card[] | null>(null);
  const uid = user?.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from("wishlist").select("cards(*)").eq("user_id", uid).order("created_at", { ascending: false });
    setCards(((data ?? []) as unknown as { cards: Card | null }[]).map((r) => r.cards).filter((c): c is Card => Boolean(c)));
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    const { error } = await supabase.from("wishlist").delete().eq("card_id", id).eq("user_id", uid!);
    toast(error ? "That did not save. Try again." : "Removed from your saved cards.");
    load();
  }

  return (
    <section className="section">
      <h1>Saved cards</h1>
      <p className="mute" style={{ margin: 0, maxWidth: "62ch" }}>You get an email when a saved card comes back in stock or its price drops.</p>
      {!user ? (
        <div className="empty">{ready ? <><Link href="/login?next=/saved">Sign in</Link> to save cards.</> : "Checking your sign-in..."}</div>
      ) : !cards ? (
        <div className="empty">Loading your saved cards...</div>
      ) : !cards.length ? (
        <div className="empty">Nothing saved yet. Open a card in the <Link href="/">shop</Link> and choose &quot;Save and watch price&quot;.</div>
      ) : (
        <div className="list">
          {cards.map((c) => {
            const d = deltaInfo(c);
            return (
              <div className="li" key={c.id}>
                <div><Link href={`/card/${c.id}`}><b>{c.name}</b></Link><div className="sub mute">{c.set_name} · {c.number}</div></div>
                <div className="acts">
                  {c.qty > 0 ? <span className="mono">{usd(c.ask)}</span> : <span className="pill solid">Sold out</span>}
                  {d && c.qty > 0 && <span className={`delta ${d.cls}`}>{d.txt}</span>}
                  <button className="btn sm" onClick={() => remove(c.id)}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
