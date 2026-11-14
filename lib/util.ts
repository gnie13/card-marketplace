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
