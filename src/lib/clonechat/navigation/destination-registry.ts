// src/lib/clonechat/navigation/destination-registry.ts
// C1.8 REOUVERT §5 — REGISTRE CANONIQUE DES DESTINATIONS CLONESTORE.
//
// Source de vérité UNIQUE des destinations que CloneChat peut proposer. Chaque route est une VRAIE
// page du dépôt (validée par `assertDestinationsAreReal` en test). Aucune route inventée ne peut
// être présentée : un CTA est toujours dérivé d'une entrée de ce registre, et sa route revalidée.
//
// Ce n'est pas un second registre de ROUTES (le canonique reste `src/lib/nav/route-registry.ts`) :
// c'est la couche PRODUIT qui associe une route à ses intentions, son CTA, son mode et ses pays.

import { getRouteEntry } from "@/lib/nav/route-registry";

export type DestinationContext = "public" | "authenticated" | "both";

export interface CloneStoreDestination {
  readonly id: string;
  readonly route: string;
  readonly label: string;
  readonly description: string;
  readonly context: DestinationContext;
  /** CTA canonique (libellé affiché + route). Toujours cliquable, toujours réel. */
  readonly cta: { readonly label: string; readonly route: string };
  /** Priorité de désambiguïsation (plus haut = préféré à intention égale). */
  readonly priority: number;
  readonly available: boolean;
  /** Prérequis réel à annoncer UNIQUEMENT si l'action l'exige (jamais sur une question publique). */
  readonly companyRequired: boolean;
  /** Pays de disponibilité (null = toutes zones de lancement). */
  readonly countries: readonly string[] | null;
  readonly source: string;
}

const D = (d: CloneStoreDestination): CloneStoreDestination => Object.freeze(d);

/**
 * REGISTRE. Ordre = ordre de lecture ; la désambiguïsation utilise `priority`.
 * Chaque `route`/`cta.route` correspond à une page RÉELLE (voir le test d'intégrité).
 */
export const DESTINATIONS: readonly CloneStoreDestination[] = Object.freeze([
  // ── Accueil ─────────────────────────────────────────────────────────────────
  D({ id: "home", route: "/", label: "Accueil",
      description: "La page d'accueil de CloneStore.",
      context: "both", cta: { label: "Accueil", route: "/" },
      priority: 30, available: true, companyRequired: false, countries: null, source: "route-registry" }),

  // ── Commercial / acquisition ────────────────────────────────────────────────
  D({ id: "reserver_pierre", route: "/reserver/pierre", label: "Réserver Pierre",
      description: "Obtenir Pierre : réserver le prix fondateur et lancer l'activation.",
      context: "both", cta: { label: "Réserver Pierre", route: "/reserver/pierre" },
      priority: 100, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "pierre_pricing", route: "/reserver/pierre", label: "Tarifs de Pierre",
      description: "Le prix de Pierre par pays (449 € FR/BE/LU, 499 CHF Suisse).",
      context: "both", cta: { label: "Voir le prix et réserver", route: "/reserver/pierre" },
      priority: 90, available: true, companyRequired: false, countries: null, source: "route-registry+p10" }),
  D({ id: "demo_pierre", route: "/demo/pierre", label: "Démo Pierre",
      description: "Voir Pierre en action (démonstration).",
      context: "both", cta: { label: "Voir la démo Pierre", route: "/demo/pierre" },
      priority: 80, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "demo_general", route: "/demo", label: "Démo CloneStore",
      description: "Découvrir CloneStore et Pierre en démonstration.",
      context: "both", cta: { label: "Voir la démo", route: "/demo" },
      priority: 70, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "discover_pierre", route: "/agents/pierre", label: "Pierre — employé IA RH",
      description: "Présentation de Pierre : ce qu'il fait, ses missions RH, ses limites.",
      context: "both", cta: { label: "Découvrir Pierre", route: "/agents/pierre" },
      priority: 60, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "discover_clonestore", route: "/comprendre-clonestore", label: "Comprendre CloneStore",
      description: "Ce qu'est CloneStore, sa méthode, ses employés IA.",
      context: "both", cta: { label: "Comprendre CloneStore", route: "/comprendre-clonestore" },
      priority: 55, available: true, companyRequired: false, countries: null, source: "app-route" }),
  D({ id: "employees_catalog", route: "/agents", label: "Les employés IA",
      description: "Le catalogue des employés IA de CloneStore.",
      context: "both", cta: { label: "Voir les employés IA", route: "/agents" },
      priority: 50, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "partners", route: "/founding-partners", label: "Partenaires Fondateurs",
      description: "Le cercle des partenaires fondateurs de CloneStore.",
      context: "both", cta: { label: "Partenaires Fondateurs", route: "/founding-partners" },
      priority: 45, available: true, companyRequired: false, countries: null, source: "route-registry" }),

  // ── Compte / accès ──────────────────────────────────────────────────────────
  D({ id: "login", route: "/login", label: "Connexion",
      description: "Se connecter à son espace CloneStore.",
      context: "public", cta: { label: "Se connecter", route: "/login" },
      priority: 40, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "signup", route: "/signup", label: "Créer un compte",
      description: "Créer un compte CloneStore.",
      context: "public", cta: { label: "Créer un compte", route: "/signup" },
      priority: 40, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "my_clonestore", route: "/profile", label: "Mon CloneStore",
      description: "Votre espace personnel CloneStore.",
      context: "authenticated", cta: { label: "Mon CloneStore", route: "/profile" },
      priority: 40, available: true, companyRequired: false, countries: null, source: "route-registry" }),

  // ── Espace client / entreprise (prérequis entreprise) ───────────────────────
  D({ id: "pierre_cockpit", route: "/agents/pierre/use", label: "Cockpit Pierre",
      description: "Piloter Pierre : missions, validations, suivi.",
      context: "authenticated", cta: { label: "Ouvrir le cockpit Pierre", route: "/agents/pierre/use" },
      priority: 50, available: true, companyRequired: true, countries: null, source: "route-registry" }),
  D({ id: "employees_360", route: "/agents/pierre/employees", label: "Employé 360",
      description: "Vos salariés dans Pierre.",
      context: "authenticated", cta: { label: "Voir mes salariés", route: "/agents/pierre/employees" },
      priority: 45, available: true, companyRequired: true, countries: null, source: "route-registry" }),
  D({ id: "company_footprint", route: "/profile/onboarding", label: "Empreinte Entreprise",
      description: "Configurer votre entreprise.",
      context: "authenticated", cta: { label: "Configurer l'entreprise", route: "/profile/onboarding" },
      priority: 40, available: true, companyRequired: true, countries: null, source: "route-registry" }),
  D({ id: "technologies", route: "/profile/technologies", label: "Technologies",
      description: "Les technologies CloneStore activées pour votre entreprise.",
      context: "authenticated", cta: { label: "Voir les technologies", route: "/profile/technologies" },
      priority: 35, available: true, companyRequired: true, countries: null, source: "route-registry" }),
  D({ id: "clonechat", route: "/assistant", label: "CloneChat",
      description: "L'assistant CloneChat.",
      context: "both", cta: { label: "Ouvrir CloneChat", route: "/assistant" },
      priority: 30, available: true, companyRequired: false, countries: null, source: "route-registry" }),

  // ── Support / légal ─────────────────────────────────────────────────────────
  D({ id: "support", route: "/questions", label: "Support / FAQ",
      description: "Aide et questions fréquentes.",
      context: "both", cta: { label: "Contacter le support", route: "/questions" },
      priority: 20, available: true, companyRequired: false, countries: null, source: "route-registry" }),
  D({ id: "legal_cgu", route: "/legal/cgu", label: "Conditions d'utilisation",
      description: "Les CGU de CloneStore.",
      context: "both", cta: { label: "Lire les CGU", route: "/legal/cgu" },
      priority: 15, available: true, companyRequired: false, countries: null, source: "app-route" }),
  D({ id: "legal_cgv", route: "/legal/cgv", label: "Conditions de vente",
      description: "Les CGV de CloneStore.",
      context: "both", cta: { label: "Lire les CGV", route: "/legal/cgv" },
      priority: 15, available: true, companyRequired: false, countries: null, source: "app-route" }),
  D({ id: "legal_privacy", route: "/legal/confidentialite", label: "Confidentialité",
      description: "La politique de confidentialité (RGPD).",
      context: "both", cta: { label: "Politique de confidentialité", route: "/legal/confidentialite" },
      priority: 15, available: true, companyRequired: false, countries: null, source: "app-route" }),
  D({ id: "legal_dpa", route: "/legal/dpa", label: "DPA",
      description: "L'accord de traitement des données (DPA).",
      context: "both", cta: { label: "Voir le DPA", route: "/legal/dpa" },
      priority: 15, available: true, companyRequired: false, countries: null, source: "app-route" }),
  D({ id: "legal_mentions", route: "/legal/mentions", label: "Mentions légales",
      description: "Les mentions légales.",
      context: "both", cta: { label: "Mentions légales", route: "/legal/mentions" },
      priority: 15, available: true, companyRequired: false, countries: null, source: "app-route" }),
]);

const BY_ID: ReadonlyMap<string, CloneStoreDestination> = new Map(DESTINATIONS.map((d) => [d.id, d]));

export function destinationById(id: string): CloneStoreDestination | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Ces routes existent RÉELLEMENT comme pages Next mais ne sont pas (encore) déclarées dans le
 * route-registry canonique. On les considère réelles car leurs fichiers `page.tsx` existent
 * (vérifié). Toute AUTRE route doit être dans le registre canonique.
 */
const REAL_UNREGISTERED_ROUTES: ReadonlySet<string> = new Set([
  "/comprendre-clonestore", "/legal/cgu", "/legal/cgv", "/legal/confidentialite", "/legal/dpa", "/legal/mentions",
]);

/** Une route de destination est-elle RÉELLE ? (registre canonique OU page réelle connue) */
export function isRealDestinationRoute(route: string): boolean {
  const clean = route.split("?")[0].split("#")[0];
  return getRouteEntry(clean) !== null || REAL_UNREGISTERED_ROUTES.has(clean);
}
