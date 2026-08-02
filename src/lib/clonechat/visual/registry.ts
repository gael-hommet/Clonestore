// src/lib/clonechat/visual/registry.ts
//
// Registre CANONIQUE, typé, versionné et déterministe des cibles visuelles. Chaque cible « verified »
// pointe une ancre `data-tour-id` RÉELLEMENT rendue sur une route RÉELLE publique (prouvée par un
// rendu serveur + e2e/clonechat-visual-targets.spec.ts). Les parcours sans ancre fiable sont au
// niveau route (status "unavailable" → fallback textuel), jamais une cible inventée. Cross-check
// d'obsolescence contre le contrat d'ancres déclaré (route-registry + guided-tour registries).

import { getRouteEntry, allDeclaredTourTargets } from "@/lib/nav/route-registry";
import { listTours } from "@/lib/guided-tour/tour-registry";
import type { VisualTarget } from "./types";

export const CLONECHAT_VISUAL_REGISTRY_VERSION = "visual-registry-1" as const;

/** Contrat d'ancres DÉCLARÉ (route-registry + toutes les étapes de tours). Sert à l'obsolescence. */
export function declaredAnchorContract(): ReadonlySet<string> {
  const set = new Set<string>(allDeclaredTourTargets());
  for (const tour of listTours()) {
    for (const step of tour.steps) if (step.targetId) set.add(step.targetId);
  }
  return set;
}

function sel(tourId: string): string {
  return `[data-tour-id="${tourId}"]`;
}

/** Cible « verified » publique (ancre réelle prouvée par un rendu). */
function verifiedPublic(p: {
  id: string; route: string; surface: string; goal: string; tourId: string; label: string;
  instruction: string; success: string; fallback: string; recommendedRoute?: string;
}): VisualTarget {
  return {
    id: p.id, version: "1", route: p.route, surface: p.surface, goal: p.goal,
    viewports: ["desktop", "mobile_iphone", "mobile_android"],
    requiredPageState: "public_rendered",
    audience: "public", prerequisites: [],
    element: { tourId: p.tourId, role: null, label: p.label, stableSelector: sel(p.tourId) },
    locationStrategy: "stable_attribute",
    accessibleRole: null, accessibleLabel: p.label, stableSelector: sel(p.tourId), rect: null,
    instruction: p.instruction, appearCondition: `L'élément ${sel(p.tourId)} est visible sur ${p.route}.`,
    successCondition: p.success, fallbackText: p.fallback,
    provenance: `route-registry + guided-tour + rendu serveur réel + e2e/clonechat-visual-targets.spec.ts (${sel(p.tourId)} sur ${p.route}).`,
    pageFingerprint: null, status: "verified", recommendedRoute: p.recommendedRoute ?? null,
  };
}

/** Cible au niveau ROUTE, sans ancre en page fiable → guidage textuel honnête. */
function routeLevel(p: {
  id: string; route: string | null; surface: string; goal: string; audience?: VisualTarget["audience"];
  instruction: string; success: string; fallback: string; prerequisites?: VisualTarget["prerequisites"];
}): VisualTarget {
  return {
    id: p.id, version: "1", route: p.route ?? "", surface: p.surface, goal: p.goal,
    viewports: ["desktop", "mobile_iphone", "mobile_android"],
    requiredPageState: "any", audience: p.audience ?? "public", prerequisites: p.prerequisites ?? [],
    element: { tourId: null, role: null, label: null, stableSelector: null },
    locationStrategy: "structural_selector",
    accessibleRole: null, accessibleLabel: null, stableSelector: null, rect: null,
    instruction: p.instruction, appearCondition: p.route ? `La route ${p.route} est ouverte.` : "Surcouche de guidage affichée.",
    successCondition: p.success, fallbackText: p.fallback,
    provenance: p.route ? `nav/route-registry (${p.route}) — aucune ancre en page prouvée : guidage au niveau route.` : "Guidage textuel (aucune surface de page dédiée).",
    pageFingerprint: null, status: "unavailable", recommendedRoute: p.route,
  };
}

/** Cible authentifiée DÉCLARÉE (ancre réelle sur page gated — non vérifiée navigateur ici). */
function declaredAuth(p: {
  id: string; route: string; surface: string; goal: string; tourId: string; label: string;
  instruction: string; success: string; fallback: string; prerequisites: VisualTarget["prerequisites"];
}): VisualTarget {
  return {
    id: p.id, version: "1", route: p.route, surface: p.surface, goal: p.goal,
    viewports: ["desktop", "mobile_iphone", "mobile_android"],
    requiredPageState: "authenticated_rendered",
    audience: "authenticated", prerequisites: p.prerequisites,
    element: { tourId: p.tourId, role: null, label: p.label, stableSelector: sel(p.tourId) },
    locationStrategy: "stable_attribute",
    accessibleRole: null, accessibleLabel: p.label, stableSelector: sel(p.tourId), rect: null,
    instruction: p.instruction, appearCondition: `L'élément ${sel(p.tourId)} est visible sur ${p.route} (connecté).`,
    successCondition: p.success, fallbackText: p.fallback,
    provenance: `guided-tour registry (${sel(p.tourId)} sur ${p.route}) — page authentifiée, non vérifiée navigateur dans ce gate.`,
    pageFingerprint: null, status: "declared", recommendedRoute: p.route,
  };
}

export const VISUAL_TARGETS: readonly VisualTarget[] = [
  // ── Cibles publiques VERIFIED (ancres réelles rendues) ─────────────────────
  verifiedPublic({ id: "vt_home", route: "/", surface: "Accueil", goal: "Revenir à l'accueil.", tourId: "homepage-primary", label: "Accueil CloneStore", instruction: "Sur l'accueil, l'élément principal (mis en évidence) présente CloneStore.", success: "L'accueil est affiché.", fallback: "Ouvrez l'accueil : /" }),
  verifiedPublic({ id: "vt_boutique", route: "/agents", surface: "Boutique", goal: "Voir les employés IA.", tourId: "boutique-entry", label: "Boutique des employés IA", instruction: "La boutique liste les employés IA ; l'entrée est mise en évidence.", success: "La boutique est affichée.", fallback: "Ouvrez la boutique : /agents" }),
  verifiedPublic({ id: "vt_pierre_page", route: "/agents/pierre", surface: "Page Pierre", goal: "Découvrir Pierre puis réserver.", tourId: "pierre-page-entry", label: "Page de Pierre", instruction: "Sur la page de Pierre (élément mis en évidence), lancez la réservation.", success: "La page de Pierre est affichée.", fallback: "Ouvrez la page de Pierre : /agents/pierre, puis la réservation : /reserver/pierre", recommendedRoute: "/reserver/pierre" }),
  verifiedPublic({ id: "vt_clonechat_entry", route: "/assistant", surface: "CloneChat", goal: "Ouvrir CloneChat.", tourId: "clonechat-entry", label: "CloneChat", instruction: "CloneChat s'ouvre ici (élément mis en évidence).", success: "CloneChat est affiché.", fallback: "Ouvrez CloneChat : /assistant" }),
  verifiedPublic({ id: "vt_clonechat_input", route: "/assistant", surface: "CloneChat", goal: "Écrire à CloneChat.", tourId: "clonechat-input", label: "Champ de message CloneChat", instruction: "Saisissez votre message dans le champ de CloneChat (mis en évidence).", success: "Le champ de message est prêt.", fallback: "Écrivez votre message dans CloneChat : /assistant" }),
  verifiedPublic({ id: "vt_demo", route: "/demo/pierre", surface: "Démo Pierre", goal: "Ouvrir la démonstration de Pierre.", tourId: "demo-entry", label: "Démonstration de Pierre", instruction: "La démonstration de Pierre démarre ici (élément mis en évidence).", success: "La démonstration est affichée.", fallback: "Ouvrez la démo : /demo/pierre" }),
  verifiedPublic({ id: "vt_login", route: "/login", surface: "Connexion", goal: "Se connecter.", tourId: "client-space-entry", label: "Accès à Mon CloneStore", instruction: "Connectez-vous depuis l'entrée Mon CloneStore (mise en évidence).", success: "Vous êtes connecté.", fallback: "Connectez-vous : /login" }),

  // ── Parcours au niveau route (aucune ancre en page fiable → fallback texte) ──
  routeLevel({ id: "vt_reserve", route: "/reserver/pierre", surface: "Réservation Pierre", goal: "Réserver Pierre.", instruction: "Ouvrez la page de réservation de Pierre et suivez les indications de la page.", success: "Une confirmation de réservation s'affiche.", fallback: "Réservez Pierre : /reserver/pierre" }),
  routeLevel({ id: "vt_checkout", route: "/checkout", surface: "Paiement", goal: "Finaliser le paiement.", instruction: "Ouvrez la page de paiement et suivez les indications de la page.", success: "Une confirmation de commande s'affiche.", fallback: "Finalisez le paiement : /checkout" }),
  routeLevel({ id: "vt_signup", route: "/signup", surface: "Création de compte", goal: "Créer un compte.", instruction: "Ouvrez la page de création de compte et créez votre compte.", success: "Votre compte est créé.", fallback: "Créez un compte : /signup" }),
  routeLevel({ id: "vt_support", route: "/questions", surface: "Support", goal: "Contacter le support.", instruction: "Ouvrez la page support et décrivez votre problème.", success: "Votre demande est transmise au support.", fallback: "Contactez le support : /questions" }),
  routeLevel({ id: "vt_recover", route: null, surface: "Reprise", goal: "Reprendre après une panne.", instruction: "Réessayez la même action dans un instant.", success: "L'action reprend normalement.", fallback: "Réessayez dans un instant ; si le problème persiste, contactez le support (/questions)." }),
  routeLevel({ id: "vt_confirm_overlay", route: null, surface: "Confirmation CloneActions", goal: "Visualiser la demande de confirmation.", instruction: "Une demande de confirmation est présentée ; validez-la explicitement pour continuer.", success: "L'action confirmée est exécutée sous contrôle.", fallback: "Confirmez l'action demandée pour continuer." }),
  routeLevel({ id: "vt_blocked_overlay", route: null, surface: "Action bloquée", goal: "Comprendre une action bloquée.", instruction: "Cette action est bloquée ; la raison et l'étape à corriger sont indiquées.", success: "Le blocage est levé une fois la condition satisfaite.", fallback: "Cette action est bloquée : consultez la raison indiquée." }),

  // ── Parcours authentifiés DÉCLARÉS (ancre réelle sur page gated, non vérifiée ici) ──
  declaredAuth({ id: "vt_resolve_company", route: "/profile", surface: "Mon CloneStore", goal: "Rattacher une entreprise.", tourId: "mycs-company", label: "Section entreprise", instruction: "Dans Mon CloneStore, la section entreprise permet d'ajouter ou de sélectionner votre entreprise.", success: "Une entreprise active est disponible.", fallback: "Ajoutez ou sélectionnez votre entreprise dans Mon CloneStore : /profile", prerequisites: ["authentication", "active_company"] }),
  declaredAuth({ id: "vt_select_company", route: "/profile", surface: "Mon CloneStore", goal: "Sélectionner l'entreprise.", tourId: "mycs-company", label: "Section entreprise", instruction: "Dans Mon CloneStore, la section entreprise permet de choisir l'entreprise sur laquelle travailler.", success: "Une entreprise est sélectionnée.", fallback: "Sélectionnez votre entreprise dans Mon CloneStore : /profile", prerequisites: ["authentication", "active_company"] }),
] as const;

export function getVisualTarget(id: string): VisualTarget | null {
  return VISUAL_TARGETS.find((t) => t.id === id) ?? null;
}

/** Une route de cible est-elle réelle (registre) ? (les cibles route=null sont des surcouches) */
export function targetRouteIsReal(t: VisualTarget): boolean {
  return t.route === "" || !!getRouteEntry(t.route);
}
