"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app";
import { configured, supabase } from "@/lib/supabase";
import type { Card, OfferStatus } from "@/lib/types";
import { STATE } from "@/lib/util";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setDark(document.documentElement.dataset.theme === "dark"));
  }, []);
  function flip() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("cm-theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button className="btn sm" onClick={flip} aria-pressed={dark} title="Switch between light and dark mode">
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}

export function Header() {
  const { user, isAdmin, ready, site, bundle } = useApp();
  const path = usePathname();
  const cur = (p: string) => (p === "/" ? path === "/" || path.startsWith("/card") : path.startsWith(p)) ? "page" : undefined;
  const name = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/">{site.name}</Link>
        <nav>
          <Link href="/" aria-current={cur("/")}>Shop</Link>
          <Link href="/buylist" aria-current={cur("/buylist")}>We buy</Link>
          {bundle.length > 0 && <Link href="/bundle" aria-current={cur("/bundle")}>Bundle ({bundle.length})</Link>}
          {user && <Link href="/saved" aria-current={cur("/saved")}>Saved</Link>}
          {user && <Link href="/offers" aria-current={cur("/offers")}>My offers</Link>}
          {isAdmin && <Link href="/admin" aria-current={cur("/admin")}>Admin</Link>}
          {ready && !user && <Link href="/login" aria-current={cur("/login")}>Sign in</Link>}
          <ThemeToggle />
          {user && (
            <>
              <span className="who">{name}</span>
              <button className="btn sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const { site } = useApp();
  return (
    <footer>
      <div className="wrap foot">
        <span>
          {site.name}
          {site.contact ? ` · ${site.contact}` : ""}
        </span>
        <span className="links">
          <Link href="/guide">Condition guide and offer rules</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </span>
        <span>Market prices are TCGplayer market averages and change daily. Not affiliated with any card publisher.</span>
      </div>
    </footer>
  );
}

export function SetupNotice() {
  if (configured) return null;
  return (
    <div className="banner" style={{ margin: "24px 0" }}>
      <b>The database is not connected yet.</b> Add the Supabase values from <span className="mono">.env.example</span> to
      your environment, then reload. The README lists each step.
    </div>
  );
}

export function Art({ c, back }: { c: Pick<Card, "name" | "set_code" | "number" | "grade" | "condition" | "image_url"> & { kind?: string; image_back_url?: string | null }; back?: boolean }) {
  const src = back ? c.image_back_url : c.image_url;
  if (src)
    return (
      <div className="art photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${back ? "Back" : "Front"} photo of ${c.name}`} />
      </div>
    );
  return (
    <div className="art" aria-hidden="true">
      <div className="hd"><span>{c.set_code}</span><span>{c.number}</span></div>
      <div className="win"><span>{c.name}</span></div>
      <div className="ft"><span>{c.kind === "sealed" ? "Sealed" : c.grade || "Raw"}</span><span>{c.kind === "sealed" ? "" : c.condition}</span></div>
    </div>
  );
}

export function Pill({ status }: { status: OfferStatus }) {
  const s = STATE[status] ?? STATE.pending;
  return <span className={`pill ${s[1]}`}>{s[0]}</span>;
}
