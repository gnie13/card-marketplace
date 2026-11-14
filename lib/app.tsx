"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { configured, supabase } from "./supabase";
import type { Site } from "./types";

type Ctx = {
  user: User | null;
  isAdmin: boolean;
  ready: boolean;
  site: Site;
  toast: (m: string) => void;
  reloadSite: () => void;
  track: (type: "visit" | "view", cardId?: string) => void;
};

const DEFAULT_SITE: Site = {
  name: "Card Marketplace",
  tagline: "Every card we have in hand, priced against the live market. See something you want? Send an offer.",
  contact: "",
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

function anonId() {
  try {
    let id = localStorage.getItem("cm-anon");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("cm-anon", id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authKnown, setAuthKnown] = useState(false);
  const [admin, setAdmin] = useState<{ uid: string | null; value: boolean } | null>(null);
  const [site, setSite] = useState<Site>(DEFAULT_SITE);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 3800);
  }, []);

  const reloadSite = useCallback(() => {
    if (!configured) return;
    supabase.from("site").select("name,tagline,contact").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setSite(data as Site);
    });
  }, []);

  useEffect(() => {
    reloadSite();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthKnown(true);
    });
    return () => data.subscription.unsubscribe();
  }, [reloadSite]);

  const uid = user?.id ?? null;
  useEffect(() => {
    if (!authKnown) return;
    let live = true;
    const done = (value: boolean) => live && setAdmin({ uid, value });
    if (!uid) {
      Promise.resolve().then(() => done(false));
    } else {
      supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle().then(({ data }) => done(Boolean(data?.is_admin)));
    }
    return () => {
      live = false;
    };
  }, [uid, authKnown]);

  const ready = authKnown && admin !== null && admin.uid === uid;
  const isAdmin = ready && Boolean(admin?.value);

  const track = useCallback(
    (type: "visit" | "view", cardId?: string) => {
      if (!configured || !ready || isAdmin) return;
      supabase.from("events").insert({ type, anon_id: anonId(), user_id: uid, card_id: cardId ?? null }).then(() => {});
    },
    [ready, isAdmin, uid],
  );

  useEffect(() => {
    if (!ready) return;
    try {
      if (sessionStorage.getItem("cm-visit")) return;
      sessionStorage.setItem("cm-visit", "1");
    } catch {}
    track("visit");
  }, [ready, track]);

  return (
    <AppCtx.Provider value={{ user, isAdmin, ready, site, toast, reloadSite, track }}>
      {children}
      {msg && (
        <div id="toast" role="status">
          {msg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
