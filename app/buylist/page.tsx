"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { notify } from "@/lib/notify";
import { configured, supabase } from "@/lib/supabase";
import type { BuyItem } from "@/lib/types";
import { gameName, usd } from "@/lib/util";

export default function Buylist() {
  const { user, ready, toast, site } = useApp();
  const [items, setItems] = useState<BuyItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    if (!configured) return;
    supabase.from("buylist").select("*").eq("active", true).order("pay", { ascending: false }).then(({ data }) => setItems((data as BuyItem[]) ?? []));
  }, []);

  async function send(b: BuyItem) {
    const { data, error } = await supabase.from("sell_leads").insert({ buylist_id: b.id, note: note.trim().slice(0, 400) }).select("id").single();
    if (error) return toast("That did not send. Try again.");
    notify({ type: "lead", id: data.id });
    setSent([...sent, b.id]);
    setOpen(null);
    setNote("");
    toast("Sent. The seller will email you to set up a meetup.");
  }

  return (
    <section className="section">
      <h1>We buy cards</h1>
      <p className="mute" style={{ margin: 0, maxWidth: "62ch" }}>
        These are cards {site.name} is looking for and what we pay in cash for a copy in the listed condition. Final price depends on inspection at the meetup.
      </p>
      {!items ? (
        <div className="empty">{configured ? "Loading the buylist..." : "The buylist appears once the database is connected."}</div>
      ) : !items.length ? (
        <div className="empty">Nothing on the buylist right now. Check back soon.</div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Card</th><th>Game</th><th>Condition</th><th className="num">We pay</th><th></th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.name}</b><div className="sub">{[b.set_name, b.number].filter(Boolean).join(" · ")}{b.note ? ` · ${b.note}` : ""}</div></td>
                  <td>{gameName(b.game)}</td>
                  <td>{b.condition}</td>
                  <td className="num">{usd(b.pay)}</td>
                  <td>
                    <div className="acts">
                      {sent.includes(b.id) ? (
                        <span className="pill good">Sent</span>
                      ) : !user ? (
                        ready && <Link href="/login?next=/buylist">Sign in to sell</Link>
                      ) : open === b.id ? (
                        <>
                          <input type="text" aria-label="Details about your copy" placeholder="Condition, how many" style={{ width: 180 }} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
                          <button className="btn sm solid" onClick={() => send(b)}>Send</button>
                        </>
                      ) : (
                        <button className="btn sm" onClick={() => { setOpen(b.id); setNote(""); }}>I have this</button>
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
