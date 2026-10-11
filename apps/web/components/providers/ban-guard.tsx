// Mounted once in the root layout. Learns whether the signed-in account is
// banned (status endpoint + any 403 ACCOUNT_BANNED from the API client) and,
// while it is, covers the whole app with a screen that cannot be dismissed.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BanScreen } from "@/components/moderation/BanScreen";
import { moderationApi } from "@/lib/api/moderation";
import { authApi } from "@/lib/api/auth";
import { setBan, useBanState } from "@/lib/ban-store";
import { useAuthStore } from "@/store/auth-store";

const POLL_MS = 30_000;
const HOST_ID = "ban-guard-root";

export function BanGuard() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const clearAuth = useAuthStore((s) => s.clear);
  const { ban, skewMs } = useBanState();
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const wasBanned = useRef(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await moderationApi.myBan();
      setBan(r.banned ? r.ban : null, r.serverNow);
    } catch {
      /* offline / signed out: keep whatever we knew */
    } finally {
      setChecking(false);
    }
  }, []);

  // Check on sign-in, then keep checking (a temp ban can end; a new one can start).
  useEffect(() => {
    if (!userId) {
      setBan(null);
      return;
    }
    void check();
    const t = window.setInterval(() => void check(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, check]);

  // Dedicated mount point outside React's app tree.
  useEffect(() => {
    let el = document.getElementById(HOST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = HOST_ID;
      document.body.appendChild(el);
    }
    setHost(el);
  }, []);

  // While banned: freeze scrolling and make everything else inert, so nothing
  // underneath can be focused, tabbed to or clicked.
  useEffect(() => {
    if (!ban) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const touched: HTMLElement[] = [];
    for (const child of Array.from(document.body.children) as HTMLElement[]) {
      if (child.id === HOST_ID || child.tagName === "SCRIPT") continue;
      child.setAttribute("inert", "");
      child.setAttribute("aria-hidden", "true");
      touched.push(child);
    }
    return () => {
      root.style.overflow = prevOverflow;
      for (const c of touched) {
        c.removeAttribute("inert");
        c.removeAttribute("aria-hidden");
      }
    };
  }, [ban]);

  useEffect(() => {
    if (ban) wasBanned.current = true;
    else if (wasBanned.current) {
      wasBanned.current = false;
      toast.success("Your ban has ended. Welcome back!");
    }
  }, [ban]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await authApi.signOut();
    } catch {
      /* sign out locally regardless */
    }
    setBan(null);
    clearAuth();
    window.location.replace("/auth");
  }, [clearAuth]);

  if (!ban || !host) return null;
  return createPortal(
    <BanScreen ban={ban} skewMs={skewMs} checking={checking} signingOut={signingOut} onSignOut={signOut} onExpired={check} />,
    host,
  );
}
