import { supabase } from "./supabase";

export type Series = Record<string, { d: string; v: number }[]>;

/** Price points per card for the last `days` days. Null when the database function is not installed yet. */
export async function loadSeries(days: number): Promise<Series | null> {
  const { data, error } = await supabase.rpc("price_series", { p_days: days });
  if (error || !data) return null;
  const out: Series = {};
  for (const row of data as { card_id: string; pts: [string, number][] }[]) {
    out[row.card_id] = (row.pts ?? []).map(([d, v]) => ({ d, v: Number(v) }));
  }
  return out;
}
