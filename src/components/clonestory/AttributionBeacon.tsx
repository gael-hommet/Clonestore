"use client";

// CloneStory — beacon d'attribution du lien partenaire. Déclenche, côté client, la
// capture first-touch (cookie signé + attribution anonyme) via la route serveur. Rend
// du vide. Le gating par JS filtre naturellement les scanners/crawlers sans JS : ils
// ne produisent pas d'attribution forte (la visite reste journalisée par la page /r).

import { useEffect } from "react";

export default function AttributionBeacon({ code }: { code: string }) {
  useEffect(() => {
    if (!code) return;
    fetch("/api/founding-partners/attribution/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {});
  }, [code]);
  return null;
}
