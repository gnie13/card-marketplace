"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app";
import { configured, supabase } from "@/lib/supabase";
import type { Card } from "@/lib/types";
import { deltaInfo, fmtDay, gameName, num, usd } from "@/lib/util";
import { Art, SetupNotice } from "@/components/ui";

const SORTS: [string, string][] = [
  ["price-desc", "Price, high to low"],
  ["price-asc", "Price, low to high"],
  ["new", "Newest arrivals"],
  ["deal", "Best price vs market"],
  ["name", "Name"],
];
const BLANK = { q: "", set: "", sort: "price-desc", game: "", kind: "", cond: "", rarity: "", graded: "", min: "", max: "" };

export default function Shop() {
  const { site } = useApp();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState(false);
  const [f, setF] = useState(BLANK);
  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!configured) return;
    supabase.from("cards").select("*").eq("listed", true).then(({ data, error }) => {
      if (error) setError(true);
      setCards((data as Card[]) ?? []);
    });
  }, []);

  const all = useMemo(() => cards ?? [], [cards]);
  const uniq = (pick: (c: Card) => string) => [...new Set(all.map(pick).filter(Boolean))].sort();
  const sets = uniq((c) => c.set_name), games = uniq((c) => c.game), rarities = uniq((c) => c.rarity), conds = uniq((c) => c.condition);

  const list = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    const min = num(f.min), max = num(f.max);
    const dv = (c: Card) => deltaInfo(c)?.p ?? 9;
    const graded = (c: Card) => Boolean(c.grade) && c.grade.toLowerCase() !== "raw";
    const cmp: Record<string, (a: Card, b: Card) => number> = {
      "price-desc": (a, b) => (b.ask ?? 0) - (a.ask ?? 0),
      "price-asc": (a, b) => (a.ask ?? 0) - (b.ask ?? 0),
      new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      deal: (a, b) => dv(a) - dv(b),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return all
      .filter(
        (c) =>
          (!f.set || c.set_name === f.set) &&
          (!f.game || c.game === f.game) &&
          (!f.kind || c.kind === f.kind) &&
          (!f.cond || c.condition === f.cond) &&
          (!f.rarity || c.rarity === f.rarity) &&
          (!f.graded || (f.graded === "graded") === graded(c)) &&
          (min == null || (c.ask ?? 0) >= min) &&
          (max == null || (c.ask ?? 0) <= max) &&
          (!needle || `${c.name} ${c.number} ${c.set_name}`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => Number(b.qty > 0) - Number(a.qty > 0) || cmp[f.sort](a, b));
  }, [all, f]);

  const inStock = all.filter((c) => c.qty > 0).length;
  const updated = all.map((c) => c.price_updated).filter(Boolean).sort().at(-1);
  const extra = [f.game, f.kind, f.cond, f.rarity, f.graded, f.min, f.max].filter(Boolean).length;
  const opts = (xs: string[], label = (x: string) => x) => xs.map((x) => <option key={x} value={x}>{label(x)}</option>);

  return (
    <>
      <SetupNotice />
      <section className="intro">
        <span className="eyebrow">
          {cards ? `${inStock} items in stock` : "Loading inventory"}
          {updated ? ` · market prices as of ${fmtDay(updated)}` : ""} · prices include sales tax
        </span>
        <h1>{site.name}</h1>
        <p>{site.tagline}</p>
      </section>
      <div className="filters">
        <label className="q">Search<input type="search" id="f-q" placeholder="Card name or number" value={f.q} onChange={set("q")} /></label>
        <label>Set<select id="f-set" value={f.set} onChange={set("set")}><option value="">All sets</option>{opts(sets)}</select></label>
        <label>Sort<select id="f-sort" value={f.sort} onChange={set("sort")}>{SORTS.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></label>
      </div>
      <details className="more">
        <summary>More filters{extra ? ` (${extra} on)` : ""}</summary>
        <div className="mgrid">
          <label>Game<select id="f-game" value={f.game} onChange={set("game")}><option value="">All games</option>{opts(games, gameName)}</select></label>
          <label>Type<select id="f-kind" value={f.kind} onChange={set("kind")}><option value="">Singles and sealed</option><option value="single">Singles</option><option value="sealed">Sealed product</option></select></label>
          <label>Condition<select id="f-cond" value={f.cond} onChange={set("cond")}><option value="">Any condition</option>{opts(conds)}</select></label>
          <label>Graded<select id="f-graded" value={f.graded} onChange={set("graded")}><option value="">Graded and raw</option><option value="graded">Graded only</option><option value="raw">Raw only</option></select></label>
          <label>Rarity<select id="f-rarity" value={f.rarity} onChange={set("rarity")}><option value="">Any rarity</option>{opts(rarities)}</select></label>
          <label>Min price<input type="number" id="f-min" min="0" placeholder="$" value={f.min} onChange={set("min")} /></label>
          <label>Max price<input type="number" id="f-max" min="0" placeholder="$" value={f.max} onChange={set("max")} /></label>
          <div style={{ alignSelf: "end" }}><button className="btn" onClick={() => setF(BLANK)}>Clear filters</button></div>
        </div>
      </details>
      {!cards ? (
        <div className="empty" style={{ marginBottom: 48 }}>{configured ? "Loading inventory..." : "Inventory appears here once the database is connected."}</div>
      ) : !list.length ? (
        <div className="empty" style={{ marginBottom: 48 }}>
          {error ? "The inventory could not be loaded. Refresh to try again." : cards.length ? "Nothing matches those filters." : "No cards are listed yet."}
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
                  <div className="meta">{c.set_name}{c.number ? ` · ${c.number}` : ""}</div>
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
