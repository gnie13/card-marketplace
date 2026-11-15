"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { configured, supabase } from "@/lib/supabase";
import { SetupNotice } from "@/components/ui";

// Passwords are never stored or handled by this site's own database tables.
// Supabase Auth receives them over HTTPS and keeps only a salted bcrypt hash.

const MIN_PASSWORD = 10;
type Mode = "signin" | "signup" | "forgot" | "reset";

/** Only same-site paths are allowed as a return target. */
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") || "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function Login() {
  const { user, site, toast } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // A password reset link signs the person in and lands here; show the new-password form instead of redirecting.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "reset") Promise.resolve().then(() => setMode("reset"));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && mode !== "reset") router.replace(nextPath());
  }, [user, mode, router]);

  const go = (m: Mode) => {
    setMode(m);
    setMsg(null);
    setF((x) => ({ ...x, password: "", confirm: "" }));
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const origin = () => window.location.origin;

  async function google() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin()}/login?next=${encodeURIComponent(nextPath())}` },
    });
    if (error) setMsg({ ok: false, text: "Google sign-in could not start. Try again in a moment." });
  }

  function passwordProblem() {
    if (f.password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
    if (!/[a-zA-Z]/.test(f.password) || !/[0-9]/.test(f.password)) return "Include at least one letter and one number.";
    if (f.password !== f.confirm) return "The two passwords do not match.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const email = f.email.trim().toLowerCase();

    if (mode === "signin") {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: f.password });
      setBusy(false);
      // One message for every failure, so the form never reveals which emails have accounts.
      if (error) setMsg({ ok: false, text: /confirm/i.test(error.message) ? "Confirm your email first. Check your inbox for the link we sent." : "That email and password do not match an account." });
      return;
    }

    if (mode === "forgot") {
      setBusy(true);
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/login?mode=reset` });
      setBusy(false);
      setMsg({ ok: true, text: "If that email has an account, a reset link is on its way. It can take a minute to arrive." });
      return;
    }

    const problem = passwordProblem();
    if (problem) return setMsg({ ok: false, text: problem });

    if (mode === "signup") {
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: f.password,
        options: { data: { full_name: f.name.trim().slice(0, 80) }, emailRedirectTo: `${origin()}/login?next=${encodeURIComponent(nextPath())}` },
      });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: /rate|limit/i.test(error.message) ? "Too many sign-ups right now. Try again in an hour, or use Google." : `Could not create the account: ${error.message}` });
      if (!data.session) setMsg({ ok: true, text: "Check your email and click the link to confirm your account. Then come back and sign in." });
      return;
    }

    // reset
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: f.password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: `Could not change the password: ${error.message}` });
    toast("Password changed. You are signed in.");
    router.replace("/");
  }

  const title = { signin: "Sign in", signup: "Create an account", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const showEmail = mode !== "reset";
  const showPassword = mode !== "forgot";
  const newPassword = mode === "signup" || mode === "reset";

  return (
    <section className="login">
      <SetupNotice />
      <h1 style={{ fontSize: 32 }}>{title}</h1>
      {mode === "signin" && <p className="mute" style={{ margin: 0 }}>Sign in to send offers on {site.name} and track their status. Browsing the shop needs no account.</p>}
      {mode === "reset" && !user && <p className="note">Open this page from the reset link in your email. If the link expired, request a new one.</p>}

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {mode === "signup" && (
          <label>Your name<input type="text" id="li-name" autoComplete="name" required maxLength={80} value={f.name} onChange={set("name")} /></label>
        )}
        {showEmail && (
          <label>Email<input type="email" id="li-email" autoComplete="email" required maxLength={200} value={f.email} onChange={set("email")} /></label>
        )}
        {showPassword && (
          <label>
            {newPassword ? "New password" : "Password"}
            <input type="password" id="li-pass" autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? MIN_PASSWORD : 1} maxLength={72} value={f.password} onChange={set("password")} />
          </label>
        )}
        {newPassword && (
          <>
            <label>Repeat password<input type="password" id="li-pass2" autoComplete="new-password" required maxLength={72} value={f.confirm} onChange={set("confirm")} /></label>
            <p className="note">At least {MIN_PASSWORD} characters with a letter and a number. A password manager or a long phrase works best.</p>
          </>
        )}
        {msg && <p className="note" role="status" style={{ color: msg.ok ? "var(--good)" : "var(--bad)" }}>{msg.text}</p>}
        <button className="btn solid" type="submit" disabled={busy || !configured || (mode === "reset" && !user)}>
          {busy ? "Working..." : { signin: "Sign in", signup: "Create account", forgot: "Email me a reset link", reset: "Save new password" }[mode]}
        </button>
      </form>

      {mode !== "reset" && (
        <div className="acts" style={{ justifyContent: "space-between" }}>
          {mode === "signin" ? (
            <>
              <button className="btn sm" onClick={() => go("signup")}>Create an account</button>
              <button className="btn sm" onClick={() => go("forgot")}>Forgot password?</button>
            </>
          ) : (
            <button className="btn sm" onClick={() => go("signin")}>Back to sign in</button>
          )}
        </div>
      )}

      {(mode === "signin" || mode === "signup") && (
        <>
          <div className="eyebrow" style={{ textAlign: "center" }}>or</div>
          <button className="btn" onClick={google} disabled={!configured}>Continue with Google</button>
        </>
      )}
      <p className="note">We store your name and email so the seller can reply to your offers. Passwords are kept only as a one-way hash by our sign-in provider, never in readable form. See the privacy page for details.</p>
    </section>
  );
}
