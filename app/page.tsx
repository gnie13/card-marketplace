"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app";
import { configured, supabase } from "@/lib/supabase";
import type { Card } from "@/lib/types";
import { deltaInfo, fmtDay, usd } from "@/lib/util";
import { Art, SetupNotice } from "@/components/ui";

const SORTS: [string, string][] = [
  ["price-desc", "Price, high to low"],
  ["price-asc", "Price, low to high"],
  ["deal", "Best price vs market"],
  ["name", "Name"],
];

export default function Shop() {
  const { site } = useApp();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [set, setSet] = useState("");
  const [sort, setSort] = useState("price-desc");

  useEffect(() => {
    if (!configured) return;
    supabase.from("cards").select("*").eq("listed", true).then(({ data, error }) => {
      if (error) setError(true);
      setCards((data as Card[]) ?? []);
    });
  }, []);

  const sets = useMemo(() => [...new Set((cards ?? []).map((c) => c.set_name).filter(Boolean))].sort(), [cards]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dv = (c: Card) => deltaInfo(c)?.p ?? 9;
    const cmp: Record<string, (a: Card, b: Card) => number> = {
      "price-desc": (a, b) => (b.ask ?? 0) - (a.ask ?? 0),
      "price-asc": (a, b) => (a.ask ?? 0) - (b.ask ?? 0),
      deal: (a, b) => dv(a) - dv(b),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return (cards ?? [])
      .filter((c) => (!set || c.set_name === set) && (!needle || `${c.name} ${c.number} ${c.set_name}`.toLowerCase().includes(needle)))
      .sort((a, b) => Number(b.qty > 0) - Number(a.qty > 0) || cmp[sort](a, b));
  }, [cards, q, set, sort]);

  const inStock = (cards ?? []).filter((c) => c.qty > 0).length;
  const updated = (cards ?? []).map((c) => c.price_updated).filter(Boolean).sort().at(-1);

  return (
    <>
      <SetupNotice />
      <section className="intro">
        <span className="eyebrow">
          {cards ? `${inStock} cards in stock` : "Loading inventory"}
          {updated ? ` · market prices as of ${fmtDay(updated)}` : ""}
        </span>
        <h1>{site.name}</h1>
        <p>{site.tagline}</p>
      </section>
      <div className="filters">
        <label className="q">
          Search
          <input type="search" id="f-q" placeholder="Card name or number" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          Set
          <select id="f-set" value={set} onChange={(e) => setSet(e.target.value)}>
            <option value="">All sets</option>
            {sets.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Sort
          <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
          </select>
        </label>
      </div>
      {!cards ? (
        <div className="empty" style={{ marginBottom: 48 }}>{configured ? "Loading inventory..." : "Inventory appears here once the database is connected."}</div>
      ) : !list.length ? (
        <div className="empty" style={{ marginBottom: 48 }}>
          {error ? "The inventory could not be loaded. Refresh to try again." : cards.length ? "No cards match that search." : "No cards are listed yet."}
        </div>
      ) : (
        <div className="grid">
          {list.map((c) => {
            const d = deltaInfo(c);
            const sold = c.qty < 1;
            return (
              <Link key={c.id} className={`tile${sold ? " sold" : ""}`} href={`/card/${c.id}`}>
                <Art c={c} />
                <div>
                  <div className="name">{c.name}</div>
                  <div className="meta">{c.set_name} · {c.number}</div>
                </div>
                <div>
                  <div className="row">
                    <span className="ask">{sold ? "Sold" : usd(c.ask)}</span>
                    {c.qty > 1 && <span className="meta mono">x{c.qty}</span>}
                  </div>
                  <div className="row">
                    <span className="meta mono">Mkt {usd(c.market)}</span>
                    {d && !sold && <span className={`delta ${d.cls}`}>{d.txt}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
