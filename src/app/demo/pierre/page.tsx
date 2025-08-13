"use client";

// PIERRE — /demo/pierre — ZERO-SCROLL INTERACTIVE PLAYER
// ============================================================================
// PARADIGM CHANGE (not a CSS tweak). The old long scrolling page
// (hero → value → mission → governance → cockpit → deliverables → conclusion →
// CTA → PierreModes → footer, ~8 mobile screens) is ABANDONED. /demo/pierre is now
// a single viewport that SWAPS between 6 scenes by React state — a mini interactive
// film ("player"). The rich content (other scenarios, gouvernance, autonomy modes,
// technologies, livrables) moved into the optional level-2 "Explorer Pierre" overlay;
// legal + safety moved into the "Infos & sécurité" sheet. Nothing legal was deleted.
//
// HARD CONTRACT — the page never scrolls during the 6 scenes:
//   • Root <main class="pdp-root"> is height:100dvh; overflow:hidden; flex column.
//   • A fixed-height chrome bar + a flex:1 min-height:0 overflow:hidden scene area.
//   • Scenes switch via state, NEVER by stacking sections or scrolling to anchors.
//   • The global site header + footer are suppressed on /demo/pierre (see
//     site-header.tsx / site-footer.tsx) so <body>/<html> stay at exactly one viewport.
//   • Internal bounded scroll is allowed ONLY inside the document preview
//     (DemoDrawer), the Explorer overlay and the Infos & sécurité sheet.
//   • Responsive: mobile-first composition via scoped CSS `.pdp-*` (dvh/clamp/@media),
//     not utility classes — the old sm:/md:/lg: grid layout is gone.
//
// The six scenes: 1 Hook · 2 Mission · 3 Plan/Wow · 4 Execution+Validation ·
// 5 Result · 6 Commercial close. Primary scenario = "recrutement" (one clear mission).
//
// ── ROUTE CONTRACT (fulfilled at runtime by the player, verified by the funnel &
//    guided-tour scanners; documented here so the contract lives with the route) ──
//   • Tour target : the multi-page guided tour highlights data-tour-id="demo-entry",
//     carried by the player root <main id="demo-pierre-cockpit"> (see DemoPlayer.tsx).
//   • Funnel back-link : the player links on to /agents/pierre (Découvrir l'offre) and
//     to /reserver/pierre (the only commercial destination — P10 untouched).
//   • Price truth : 449 € HT/mois, sourced from the canonical commercial-state
//     (Scene 6), never hardcoded here.
//   • Safety : Démonstration sécurisée — aucune action réelle envoyée. Données fictives,
//     aucun appel IA, aucune donnée modifiée ; validation humaine obligatoire pour toute
//     action sensible. Chaque action reste tracée par CloneTrace et gouvernée par
//     CloneGuard. These notices live one tap away in the Infos & sécurité sheet.
//
// SAFETY: this is a *simulation*. No AI call, no Supabase write, no Stripe, no email,
// no signature provider, no secret. 100% fictional demonstration data; every visible
// capability maps to the truth registry. Analytics reuse the existing first-party
// tracker (see ./layout.tsx + DemoEventTracker + trackDemoEvent) — no new tracker,
// no new event names.

import { DemoPlayer } from "@/components/pierre/demo/player/DemoPlayer";
import "./pierre-demo.css";

export default function PierreDemoPage() {
  return <DemoPlayer />;
}
