"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app";
import { configured, supabase } from "@/lib/supabase";
import type { Card, OfferStatus } from "@/lib/types";
import { STATE } from "@/lib/util";

export function Header() {
  const { user, isAdmin, ready, site } = useApp();
  const path = usePathname();
  const cur = (p: string) => (p === "/" ? path === "/" || path.startsWith("/card") : path.startsWith(p)) ? "page" : undefined;
  const name = (user?.user_metadata?.full_name as string | undefined) || user?.email || "";
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/">{site.name}</Link>
        <nav>
          <Link href="/" aria-current={cur("/")}>Shop</Link>
          {user && <Link href="/offers" aria-current={cur("/offers")}>My offers</Link>}
          {isAdmin && <Link href="/admin" aria-current={cur("/admin")}>Admin</Link>}
          {ready && !user && <Link href="/login" aria-current={cur("/login")}>Sign in</Link>}
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

export function Art({ c }: { c: Pick<Card, "name" | "set_code" | "number" | "grade" | "condition" | "image_url"> }) {
  if (c.image_url)
    return (
      <div className="art photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image_url} alt={`Photo of ${c.name}`} />
      </div>
    );
  return (
    <div className="art" aria-hidden="true">
      <div className="hd"><span>{c.set_code}</span><span>{c.number}</span></div>
      <div className="win"><span>{c.name}</span></div>
      <div className="ft"><span>{c.grade || "Raw"}</span><span>{c.condition}</span></div>
    </div>
  );
}

export function Pill({ status }: { status: OfferStatus }) {
  const s = STATE[status] ?? STATE.pending;
  return <span className={`pill ${s[1]}`}>{s[0]}</span>;
}
