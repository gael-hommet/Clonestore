"use client";

// Phase E.5 — Heartbeat de présence first-party (léger, non bloquant). Envoie un
// ping toutes les ~45 s et au montage. Continue de fonctionner sans Realtime.
// Aucune donnée sensible : session anonyme + chemin courant + UTM de la page.

import * as React from "react";

function anonSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const k = "cs_anon_sid";
    let id = sessionStorage.getItem(k);
    if (!id) { id = crypto.randomUUID?.() ?? String(Date.now() + Math.random()); sessionStorage.setItem(k, id); }
    return id;
  } catch { return undefined; }
}

function deviceCategory(): string {
  if (typeof navigator === "undefined") return "unknown";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

// `event` : événement de page-vue émis UNE seule fois au montage (funnel). Les
// heartbeats suivants ne renvoient pas l'événement (pas de double comptage).
export function PresencePing({ phase, event }: { phase?: string; event?: string }) {
  React.useEffect(() => {
    const sid = anonSessionId();
    if (!sid) return;
    let active = true;
    let firstSent = false;

    const ping = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        if (!sessionStorage.getItem("cs_landing")) sessionStorage.setItem("cs_landing", window.location.pathname);
        const includeEvent = event && !firstSent;
        const body = JSON.stringify({
          anonymous_session_id: sid,
          current_path: window.location.pathname,
          landing_path: sessionStorage.getItem("cs_landing") ?? window.location.pathname,
          referrer: document.referrer || undefined,
          utm_source: p.get("utm_source") ?? undefined,
          utm_medium: p.get("utm_medium") ?? undefined,
          utm_campaign: p.get("utm_campaign") ?? undefined,
          device_category: deviceCategory(),
          commercial_phase: phase,
          ...(includeEvent ? { events: [{ name: event, path: window.location.pathname }] } : {}),
        });
        firstSent = true;
        if (navigator.sendBeacon) navigator.sendBeacon("/api/founder-access/presence", new Blob([body], { type: "application/json" }));
        else void fetch("/api/founder-access/presence", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
      } catch { /* noop */ }
    };

    ping();
    const t = setInterval(() => { if (active && document.visibilityState === "visible") ping(); }, 45_000);
    return () => { active = false; clearInterval(t); };
  }, [phase, event]);

  return null;
}
