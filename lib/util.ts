import type { Card, Offer, OfferStatus } from "./types";

export const usd = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "n/a"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 0 : 2,
      }).format(Number(n));

export const dstr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fmtDay = (s: string | null | undefined) =>
  s ? new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export const num = (v: string) => {
  const n = parseFloat(v.replace(/[$,\s]/g, ""));
  return isFinite(n) ? n : null;
};

export function lastDays(n: number) {
  const a: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    a.push(dstr(d));
  }
  return a;
}

export function deltaInfo(c: Pick<Card, "ask" | "market">) {
  if (!c.market || !c.ask) return null;
  const p = (c.ask - c.market) / c.market;
  const a = Math.round(Math.abs(p) * 100);
  if (a < 1) return { cls: "over", txt: "at market", p };
  return p < 0 ? { cls: "under", txt: `${a}% under market`, p } : { cls: "over", txt: `${a}% over market`, p };
}

export const STATE: Record<OfferStatus, [string, string]> = {
  pending: ["Pending", "warn"],
  countered: ["Countered", "warn"],
  counter_accepted: ["Counter accepted", "good"],
  counter_declined: ["Counter declined", "off"],
  accepted: ["Accepted", "good"],
  declined: ["Declined", "bad"],
  sold: ["Sold", "solid"],
  withdrawn: ["Withdrawn", "off"],
};

export const OPEN: OfferStatus[] = ["pending", "countered", "counter_accepted", "accepted"];

/** The price both sides have agreed on, if the offer has reached that point. */
export const agreed = (o: Offer) =>
  o.status === "accepted" ? o.amount : o.status === "counter_accepted" ? o.counter : o.status === "sold" ? o.sale_price : null;

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Link to the grading company's certificate lookup, where one exists. */
export function certUrl(grader: string, cert: string) {
  const g = grader.trim().toUpperCase();
  const n = encodeURIComponent(cert.trim());
  if (!n) return null;
  if (g === "PSA") return `https://www.psacard.com/cert/${n}`;
  if (g === "CGC") return `https://www.cgccards.com/certlookup/${n}/`;
  return null;
}

export const GAMES: [string, string][] = [
  ["pokemon", "Pokemon"],
  ["magic", "Magic: The Gathering"],
  ["onepiece", "One Piece"],
  ["yugioh", "Yu-Gi-Oh!"],
  ["lorcana", "Lorcana"],
  ["sports", "Sports cards"],
  ["other", "Other"],
];
export const gameName = (g: string) => GAMES.find((x) => x[0] === g)?.[1] ?? g;

/** Small CSV reader: handles quoted fields, doubled quotes, and commas inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** Every photo of a card, cover first. Falls back to the older front and back fields. */
export const photosOf = (c: { photos?: string[] | null; image_url: string | null; image_back_url?: string | null }) =>
  c.photos?.length ? c.photos : [c.image_url, c.image_back_url ?? null].filter((x): x is string => Boolean(x));

/** Shrinks a phone photo to at most 1600px on its long side and re-encodes it as JPEG, so uploads stay small. */
export async function shrinkPhoto(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // transparent corners would otherwise turn black in a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}
