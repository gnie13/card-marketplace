"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { configured, supabase } from "@/lib/supabase";
import { SetupNotice } from "@/components/ui";

/** Only same-site paths are allowed as a return target. */
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") || "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function Login() {
  const { user, site } = useApp();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (user) router.replace(nextPath());
  }, [user, router]);

  async function google() {
    setFailed(false);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(nextPath())}` },
    });
    if (error) setFailed(true);
  }

  return (
    <section className="login">
      <SetupNotice />
      <h1 style={{ fontSize: 32 }}>Sign in</h1>
      <p className="mute" style={{ margin: 0 }}>
        Sign in to send offers on {site.name} and track their status. Browsing the shop needs no account.
      </p>
      <button className="btn solid" onClick={google} disabled={!configured}>Continue with Google</button>
      {failed && <p className="note" style={{ color: "var(--bad)" }}>Google sign-in could not start. Try again in a moment.</p>}
      <p className="note">We store your name and email so the seller can reply to your offers. See the privacy page for details.</p>
    </section>
  );
}
