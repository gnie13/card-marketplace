// Loads past market prices into price_history from the daily TCGCSV archives.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-prices.mjs 90
// Needs the 7z command (p7zip). Run it from the "Backfill price history" GitHub workflow.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const days = Math.min(Math.max(parseInt(process.argv[2] ?? "90", 10) || 90, 1), 700);
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const UA = { "User-Agent": "QCCards price backfill (github.com/gnie13/card-marketplace)" };
const db = (path, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await db("cards?select=id,tcg_group_id,tcg_product_id,tcg_subtype&tcg_group_id=not.is.null&tcg_product_id=not.is.null");
if (!res.ok) throw new Error(`Could not read cards: ${res.status} ${await res.text()}`);
const cards = await res.json();
const groups = [...new Set(cards.map((c) => c.tcg_group_id))];
console.log(`${cards.length} cards with TCGplayer IDs across ${groups.length} sets, going back ${days} days`);
if (!cards.length) process.exit(0);

const tmp = "backfill-tmp";
mkdirSync(tmp, { recursive: true });
let saved = 0, missingDays = 0;

for (let i = 1; i <= days; i++) {
  const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  if (d < "2024-02-08") break; // the archive starts here
  const file = `${tmp}/${d}.7z`;
  try {
    const dl = await fetch(`https://tcgcsv.com/archive/tcgplayer/prices-${d}.ppmd.7z`, { headers: UA });
    if (!dl.ok) throw new Error(`HTTP ${dl.status}`);
    writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
    // Extract only the sets we stock, not the whole archive.
    execFileSync("7z", ["x", "-y", `-o${tmp}`, file, ...groups.map((g) => `${d}/3/${g}/prices`)], { stdio: "ignore" });
  } catch (err) {
    missingDays++;
    console.log(`${d}: skipped (${err.message})`);
    rmSync(file, { force: true });
    continue;
  }
  const rows = [];
  for (const g of groups) {
    const path = `${tmp}/${d}/3/${g}/prices`;
    if (!existsSync(path)) continue;
    let prices = [];
    try {
      prices = JSON.parse(readFileSync(path, "utf8")).results ?? [];
    } catch {
      continue;
    }
    for (const c of cards.filter((x) => x.tcg_group_id === g)) {
      const hits = prices.filter((p) => Number(p.productId) === Number(c.tcg_product_id) && p.marketPrice != null);
      const hit = hits.find((p) => p.subTypeName === c.tcg_subtype) ?? hits.find((p) => p.subTypeName === "Holofoil") ?? hits[0];
      if (hit) rows.push({ card_id: c.id, day: d, price: hit.marketPrice });
    }
  }
  if (rows.length) {
    // Days already recorded by the live refresh are kept as they are.
    const up = await db("price_history?on_conflict=card_id,day", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!up.ok) throw new Error(`Database rejected ${d}: ${up.status} ${await up.text()}`);
    saved += rows.length;
  }
  console.log(`${d}: ${rows.length} prices`);
  rmSync(file, { force: true });
  rmSync(`${tmp}/${d}`, { recursive: true, force: true });
  await sleep(300);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`Done. Saved ${saved} price points. ${missingDays} day(s) had no archive.`);
