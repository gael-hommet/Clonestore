// Phase E — Founder Access : émetteur d'événements de funnel côté client.
// Léger, non intrusif, sans fournisseur externe. Sûr en SSR. Les événements
// anonymes sont reliés à une réservation uniquement après soumission volontaire.

import type { ClientAnalyticsEvent } from "./types";

// E-R1 §3 — le client ne peut émettre que des événements CLIENT. Les événements de
// vérité serveur (réservation, confirmation, paiement…) ne sont jamais émis ici.
export interface FounderEventMeta {
  anonymousSessionId?: string;
  reservationId?: string;
  commercialPhase?: string;
  source?: string;
  ctaVariant?: string;
  landingPath?: string;
}

interface FounderWindow {
  __cloneFounderFunnel?: Array<{ name: ClientAnalyticsEvent; meta: FounderEventMeta; t: number }>;
  cloneFounderFunnel?: (record: { name: ClientAnalyticsEvent; meta: FounderEventMeta; t: number }) => void;
}

let start = 0;

export function emitFounderEvent(name: ClientAnalyticsEvent, meta: FounderEventMeta = {}): void {
  if (typeof window === "undefined") return;
  const w = window as Window & FounderWindow;
  const now = Date.now();
  if (start === 0) start = now;
  const record = { name, meta, t: now - start };
  if (!w.__cloneFounderFunnel) w.__cloneFounderFunnel = [];
  w.__cloneFounderFunnel.push(record);
  try {
    w.cloneFounderFunnel?.(record);
  } catch {
    /* un sink défaillant ne casse jamais le funnel */
  }
  try {
    w.dispatchEvent(new CustomEvent("clone-founder-funnel", { detail: record }));
  } catch {
    /* noop */
  }
  // best-effort : persistance serveur du funnel (append-only), sans bloquer l'UI
  try {
    const body = JSON.stringify({ name, ...meta });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/founder-access/funnel", new Blob([body], { type: "application/json" }));
    }
  } catch {
    /* noop */
  }
}
