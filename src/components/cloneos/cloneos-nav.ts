// src/components/cloneos/cloneos-nav.ts
// P12 — Navigation de la console CloneOS (rail desktop + bottom nav mobile). Aligné sur le
// contrat (CLONEOS_ROUTES). Pas de logique — juste la config, réutilisable + testable.
import { CLONEOS_ROUTES } from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

export type CloneOsNavKey =
  | "cockpit" | "room" | "pierre" | "missions" | "validations" | "documents" | "employees" | "mon_clonestore";

export interface CloneOsNavItem {
  readonly key: CloneOsNavKey;
  readonly label: string;
  readonly href: string;
  readonly icon: string;      // nom d'icône lucide (résolu dans le composant)
  readonly tourId?: string;
}

/** Rail de gauche (desktop/tablette) — pilotage de la main-d'œuvre IA. */
export const COCKPIT_RAIL_NAV: readonly CloneOsNavItem[] = [
  { key: "cockpit", label: "Global Cockpit", href: CLONEOS_ROUTES.cockpit, icon: "LayoutGrid", tourId: "cos-cockpit" },
  { key: "room", label: "CloneRoom", href: CLONEOS_ROUTES.cloneRoom, icon: "MessagesSquare", tourId: "cos-room" },
  { key: "pierre", label: "Pierre — RH", href: CLONEOS_ROUTES.pierre, icon: "Bot", tourId: "cos-pierre" },
  { key: "missions", label: "Missions", href: CLONEOS_ROUTES.pierreMissions, icon: "ClipboardList", tourId: "cos-missions" },
  { key: "validations", label: "Validations", href: CLONEOS_ROUTES.pierreValidations, icon: "ShieldCheck", tourId: "cos-validations" },
  { key: "documents", label: "Documents", href: CLONEOS_ROUTES.pierreDocuments, icon: "FileText", tourId: "cos-documents" },
];

/** Bottom nav (mobile) — accès aux surfaces clés en 1–2 taps (contrat §4). */
export const COCKPIT_BOTTOM_NAV: readonly CloneOsNavItem[] = [
  { key: "cockpit", label: "CloneOS", href: CLONEOS_ROUTES.cockpit, icon: "LayoutGrid" },
  { key: "missions", label: "Missions", href: CLONEOS_ROUTES.pierreMissions, icon: "ClipboardList" },
  { key: "validations", label: "Validations", href: CLONEOS_ROUTES.pierreValidations, icon: "ShieldCheck" },
  { key: "employees", label: "Employés", href: CLONEOS_ROUTES.pierre, icon: "Users" },
  { key: "mon_clonestore", label: "CloneStore", href: CLONEOS_ROUTES.monClonestore, icon: "Building2" },
];
