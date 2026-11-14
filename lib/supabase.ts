import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the two public Supabase values are set in the environment. */
export const configured = Boolean(url && key);

export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder");
