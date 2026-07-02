// Contrat de navigation — registre central des routes (P9.1).
//
// Source de vérité UNIQUE pour : espaces produit, audience (public / authentifié
// / interne), labels centralisés, statut, appartenance à la navigation, et phase
// future concernée. Additif et non destructif : les navigations existantes
// (site-header, AppShell, connected-routes) restent en place ; ce registre les
// documente et prépare breadcrumbs, permissions, tour cross-page, analytics et
// prévention des doublons pour P9.2+.
//
// Ne PAS supprimer de route ici. Les routes obsolètes sont marquées `deprecated`
// ou `stub` avec une note, jamais retirées.

import { CONNECTED_ROUTE_PREFIXES, isConnectedRoute } from "./connected-routes";

export type ProductSpace =
  | "public" // Site public commercial
  | "guided-discovery" // Onboarding public facultatif (moteur de tour)
  | "my-clonestore" // Espace client (profil, employés, facturation…)
  | "client-cockpit" // Cockpit opérationnel client (Pierre use, employé 360…)
  | "production-cockpit" // Exploitation interne CloneStore (founder / internal)
  | "clonechat" // Interface conversationnelle
  | "clonevoice" // Couche vocale future de CloneChat
  | "clonestory"; // Univers institutionnel séparé (Founding Partners)

export type RouteAudience = "public" | "authenticated" | "internal";

export type RouteStatus =
  | "active" // En service, à conserver
  | "gated" // Accessible mais verrouillée par un droit/état
  | "stub" // Redirection / placeholder volontaire
  | "deprecated" // À retirer dans une phase future (jamais dans P9.1)
  | "internal"; // Réservée exploitation interne

export interface RouteEntry {
  /** Chemin canonique ou motif dynamique (ex. /agents/[slug]). */
  readonly path: string;
  /** Label centralisé (breadcrumbs, nav, analytics). */
  readonly label: string;
  readonly space: ProductSpace;
  readonly audience: RouteAudience;
  readonly status: RouteStatus;
  /** Apparaît dans la navigation principale publique/app. */
  readonly primaryNav?: boolean;
  /** Chaîne de fil d'Ariane (labels des parents). */
  readonly breadcrumb?: readonly string[];
  /** Phase future qui en portera la refonte (documentation seulement). */
  readonly futurePhase?: string;
  /** data-tour-id porté par un élément de cette route (si ciblé par un tour). */
  readonly tourTargets?: readonly string[];
  readonly note?: string;
}

// — Registre —
// Volontairement centré sur les routes principales + celles ciblées par le tour.
// La cartographie exhaustive (60+ routes) vit dans P9_1_ROUTE_NAVIGATION_MATRIX.md.

export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  // Site public
  {
    path: "/",
    label: "Accueil",
    space: "public",
    audience: "public",
    status: "active",
    primaryNav: true,
    tourTargets: ["homepage-primary"],
  },
  {
    path: "/agents",
    label: "Employés IA",
    space: "public",
    audience: "public",
    status: "active",
    primaryNav: true,
    breadcrumb: ["Accueil"],
    tourTargets: ["boutique-entry"],
  },
  {
    path: "/agents/pierre",
    label: "Pierre",
    space: "public",
    audience: "public",
    status: "active",
    breadcrumb: ["Accueil", "Employés IA"],
    tourTargets: ["pierre-page-entry"],
  },
  {
    path: "/agents/[slug]",
    label: "Fiche employé",
    space: "public",
    audience: "public",
    status: "stub",
    breadcrumb: ["Accueil", "Employés IA"],
    note: "Redirige vers /agents (fiches futures). Conserver comme placeholder.",
  },
  {
    path: "/demo",
    label: "Démo",
    space: "public",
    audience: "public",
    status: "active",
    primaryNav: true,
    breadcrumb: ["Accueil"],
  },
  {
    path: "/demo/pierre",
    label: "Démo Pierre",
    space: "public",
    audience: "public",
    status: "active",
    breadcrumb: ["Accueil", "Démo"],
    tourTargets: ["demo-entry"],
  },
  {
    path: "/reserver/pierre",
    label: "Réserver Pierre",
    space: "public",
    audience: "public",
    status: "gated",
    breadcrumb: ["Accueil", "Pierre"],
    note: "Gating par phase founder (before_launch / window / closed).",
  },
  {
    path: "/checkout",
    label: "Paiement",
    space: "public",
    audience: "public",
    status: "gated",
    note: "Gating par agent + session + statut de commande.",
  },
  {
    path: "/login",
    label: "Connexion",
    space: "public",
    audience: "public",
    status: "active",
    note: "Entrée publique canonique vers My CloneStore (cible du tour public).",
    tourTargets: ["client-space-entry"],
  },
  {
    path: "/signup",
    label: "Créer un compte",
    space: "public",
    audience: "public",
    status: "active",
  },
  {
    path: "/questions",
    label: "Support",
    space: "public",
    audience: "public",
    status: "active",
    primaryNav: true,
  },

  // Guided discovery (moteur de tour public)
  {
    path: "/#guided-discovery",
    label: "Découverte guidée",
    space: "guided-discovery",
    audience: "public",
    status: "active",
    note: "Overlay non-route : moteur de tour monté globalement (portal). Parcours MULTI-PAGE : / → /agents → /agents/pierre → /assistant → /demo/pierre → /login → /.",
    tourTargets: [
      "homepage-primary",
      "boutique-entry",
      "pierre-page-entry",
      "clonechat-entry",
      "demo-entry",
      "client-space-entry",
    ],
  },

  // CloneChat
  {
    path: "/assistant",
    label: "CloneChat",
    space: "clonechat",
    audience: "public",
    status: "gated",
    note: "Verrouillé serveur par feature flag (isCloneChatEnabled) — page intacte. L'écran public de verrouillage porte la cible du tour.",
    futurePhase: "P9.2",
    tourTargets: ["clonechat-entry"],
  },

  // My CloneStore (espace client)
  {
    path: "/profile",
    label: "Mon CloneStore",
    space: "my-clonestore",
    audience: "authenticated",
    status: "gated",
    primaryNav: true,
    futurePhase: "P9.2",
  },
  {
    path: "/profile/agents",
    label: "Mes employés",
    space: "my-clonestore",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
  },
  {
    path: "/profile/messages",
    label: "Messagerie",
    space: "my-clonestore",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
  },
  {
    path: "/profile/onboarding",
    label: "Empreinte Entreprise",
    space: "my-clonestore",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
    note: "Onboarding client (Quick Start / empreinte guidée). Voir fondations P9.1.",
  },
  {
    path: "/profile/technologies",
    label: "Technologies",
    space: "my-clonestore",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
  },

  // Cockpit opérationnel client
  {
    path: "/agents/pierre/use",
    label: "Cockpit Pierre",
    space: "client-cockpit",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
  },
  {
    path: "/agents/pierre/setup",
    label: "Configuration Pierre",
    space: "client-cockpit",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
  },
  {
    path: "/agents/pierre/employees",
    label: "Employé 360",
    space: "client-cockpit",
    audience: "authenticated",
    status: "gated",
    breadcrumb: ["Mon CloneStore"],
    futurePhase: "P9.2",
  },

  // Production cockpit (exploitation interne)
  {
    path: "/founder",
    label: "Command Center",
    space: "production-cockpit",
    audience: "internal",
    status: "internal",
    note: "Owner-gate + allowlist. Aucun périmètre P8/backend touché en P9.1.",
  },
  {
    path: "/internal/[slug]/command-center",
    label: "Command Center (interne)",
    space: "production-cockpit",
    audience: "internal",
    status: "internal",
  },

  // CloneStory (univers institutionnel séparé)
  {
    path: "/founding-partners",
    label: "Cercle des Partenaires Fondateurs",
    space: "clonestory",
    audience: "public",
    status: "gated",
    note: "Univers isolé (voir mémoire projet CloneStory). Hors périmètre refonte P9.",
  },
] as const;

// — Helpers —

export function getRouteEntry(path: string): RouteEntry | null {
  return ROUTE_REGISTRY.find((entry) => entry.path === path) ?? null;
}

export function routesForSpace(space: ProductSpace): RouteEntry[] {
  return ROUTE_REGISTRY.filter((entry) => entry.space === space);
}

export function primaryNavRoutes(): RouteEntry[] {
  return ROUTE_REGISTRY.filter((entry) => entry.primaryNav === true);
}

export function routeLabel(path: string, fallback?: string): string {
  return getRouteEntry(path)?.label ?? fallback ?? path;
}

/** Toutes les cibles de tour déclarées, dédupliquées. */
export function allDeclaredTourTargets(): string[] {
  const set = new Set<string>();
  for (const entry of ROUTE_REGISTRY) {
    for (const target of entry.tourTargets ?? []) set.add(target);
  }
  return [...set];
}

/** Pont vers le contrat existant : cette route est-elle sous l'app shell connecté ? */
export function isConnectedSpacePath(path: string): boolean {
  return isConnectedRoute(path);
}

export { CONNECTED_ROUTE_PREFIXES };
