import { supabase } from "./supabase";

type Body =
  | { type: "offer"; id: string }
  | { type: "card"; id: string; kind: "restock" | "price" }
  | { type: "lead"; id: string };

/** Asks the server to send an email about something that just changed. Never blocks or throws. */
export async function notify(body: Body) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {}
}
