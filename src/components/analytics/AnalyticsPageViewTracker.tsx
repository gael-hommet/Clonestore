"use client";
// Tracker de navigation central App Router — une seule vue par transition réelle. Ne double pas
// SSR+hydratation (ne s'exécute qu'après montage client). Gère le retour bfcache comme une
// navigation réelle. Monté une fois dans le layout racine, additif (aucun tracker existant retiré).

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, newPageViewId } from "@/lib/analytics/client/track";
import { CANONICAL_ROUTE_KEYS, type CanonicalRouteKey } from "@/lib/analytics/schema";

const PRIVATE_ROUTE_PREFIXES = ["/profile", "/agents/pierre/use", "/founder", "/cockpit", "/internal", "/admin"];

function normalizeRoute(pathname: string): CanonicalRouteKey {
  if ((CANONICAL_ROUTE_KEYS as readonly string[]).includes(pathname)) {
    return pathname as CanonicalRouteKey;
  }
  if (PRIVATE_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return "PRIVATE_ROUTE_REDACTED";
  }
  // Route dynamique non énumérée (ex: /partenaires/r/[slug]) — jamais l'URL brute avec ses
  // paramètres ; repliée sur la route protégée par défaut plutôt que de fuiter un chemin libre.
  return "PRIVATE_ROUTE_REDACTED";
}

export function AnalyticsPageViewTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const strictModeGuard = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // Garde anti-double-émission React Strict Mode : un même (path) monté deux fois de suite
    // dans le même tick ne produit qu'une vue.
    const guardKey = `${pathname}:${Date.now() >> 8}`; // fenêtre ~256ms, suffisant pour Strict Mode, pas pour une vraie re-navigation rapide
    if (strictModeGuard.current === pathname && lastTrackedPath.current === pathname) return;
    strictModeGuard.current = pathname;
    lastTrackedPath.current = pathname;

    const pageViewId = newPageViewId();
    track("page_viewed", { pageViewId, routeKey: normalizeRoute(pathname) });
    void guardKey;
  }, [pathname]);

  useEffect(() => {
    // Retour bfcache : le navigateur restaure une page depuis le cache sans re-exécuter les
    // effets React — une navigation réelle du point de vue utilisateur doit néanmoins compter.
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted && pathname) {
        const pageViewId = newPageViewId();
        track("page_viewed", { pageViewId, routeKey: normalizeRoute(pathname) });
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname]);

  return null;
}
