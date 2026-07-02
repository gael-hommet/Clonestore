// Navigation de l'espace connecté — modèle DÉRIVÉ du registre de routes (P9.2).
//
// Source de vérité UNIQUE :
//   - existence + label de chaque entrée → `ROUTE_REGISTRY` (route-registry.ts) ;
//   - regroupement + ordre → ci-dessous (contexte de nav, pas une route) ;
//   - icônes → couche React (AppShell), gardées hors de ce module framework-agnostic.
//
// Garde-fou : une route ABSENTE du registre ne peut PAS apparaître dans la nav
// (elle est filtrée). Ainsi la nav ne diverge jamais du registre. Un `label`
// optionnel n'existe que pour les cas où le libellé de nav diffère volontairement
// du libellé canonique de la route (ex. « Vue générale » pour l'espace /profile,
// dont le libellé canonique « Mon CloneStore » est déjà porté par l'en-tête).

import { getRouteEntry } from "./route-registry";

export interface AppNavItemDef {
  readonly path: string;
  /** Override contextuel ; sinon le label vient du registre. */
  readonly label?: string;
}

export interface AppNavGroupDef {
  readonly title: string;
  readonly items: readonly AppNavItemDef[];
}

/** Regroupement + ordre de la nav connectée (les paths DOIVENT exister au registre). */
export const APP_NAV_GROUPS: readonly AppNavGroupDef[] = [
  {
    title: "Organisation",
    items: [
      { path: "/profile", label: "Vue générale" },
      { path: "/profile/agents" },
      { path: "/profile/onboarding" },
    ],
  },
  {
    title: "Opérations",
    items: [
      { path: "/agents/pierre/use" },
      { path: "/profile/messages" },
      { path: "/agents/pierre/employees" },
      { path: "/assistant" },
    ],
  },
  {
    title: "Configuration",
    items: [{ path: "/agents/pierre/setup" }, { path: "/profile/technologies" }],
  },
  {
    title: "Compte",
    items: [{ path: "/agents", label: "Boutique" }, { path: "/questions" }],
  },
];

export interface ResolvedNavItem {
  readonly path: string;
  readonly label: string;
}

export interface ResolvedNavGroup {
  readonly title: string;
  readonly items: readonly ResolvedNavItem[];
}

/**
 * Résout les groupes de nav depuis le registre. Chaque item hérite du label
 * canonique du registre (sauf override explicite) ; les paths inconnus du
 * registre sont ÉCARTÉS (la nav ne peut pas inventer de route).
 */
export function resolveAppNavGroups(): ResolvedNavGroup[] {
  return APP_NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items
      .map((item) => {
        const entry = getRouteEntry(item.path);
        if (!entry) return null;
        return { path: item.path, label: item.label ?? entry.label };
      })
      .filter((v): v is ResolvedNavItem => v !== null),
  })).filter((group) => group.items.length > 0);
}

/** Route active (exacte pour /profile, préfixe sinon). */
export function isNavItemActive(pathname: string, path: string): boolean {
  if (path === "/profile") return pathname === "/profile";
  return pathname === path || pathname.startsWith(`${path}/`);
}
