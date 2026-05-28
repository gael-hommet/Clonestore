// B48 — UI Pages Readiness
// Documents which UI pages exist and their launch status.
// Pure: no Supabase, no Next, no async. No throw.

export type UiPageEntry = {
  path: string;
  label: string;
  surface: string;
  public_facing: boolean;
  auth_required: boolean;
  status: "active" | "placeholder" | "missing" | "internal_only";
  blocking_public_launch: boolean;
  notes: string | null;
};

const UI_PAGE_REGISTRY: UiPageEntry[] = [
  // Public / marketing
  { path: "/", label: "Page d'accueil", surface: "public_site", public_facing: true, auth_required: false, status: "active", blocking_public_launch: false, notes: null },
  { path: "/pricing", label: "Page tarifs", surface: "checkout", public_facing: true, auth_required: false, status: "active", blocking_public_launch: false, notes: "449€/month" },
  // Legal — CGU/CGV missing
  { path: "/legal/cgu", label: "Conditions Générales d'Utilisation", surface: "legal", public_facing: true, auth_required: false, status: "missing", blocking_public_launch: true, notes: "BLOCKER: CGU must be published before public launch" },
  { path: "/legal/cgv", label: "Conditions Générales de Vente", surface: "legal", public_facing: true, auth_required: false, status: "missing", blocking_public_launch: true, notes: "BLOCKER: CGV must be published before public launch" },
  { path: "/legal/confidentialite", label: "Politique de confidentialité", surface: "rgpd", public_facing: true, auth_required: false, status: "active", blocking_public_launch: false, notes: "Exists but may need RGPD completion" },
  // Auth
  { path: "/auth/signin", label: "Connexion", surface: "auth", public_facing: true, auth_required: false, status: "active", blocking_public_launch: true, notes: null },
  { path: "/auth/signup", label: "Inscription", surface: "auth", public_facing: true, auth_required: false, status: "active", blocking_public_launch: false, notes: null },
  // Checkout
  { path: "/checkout", label: "Page de paiement", surface: "checkout", public_facing: false, auth_required: true, status: "active", blocking_public_launch: true, notes: "Stripe integration" },
  // Profile / cockpit
  { path: "/profile", label: "Profil utilisateur", surface: "cockpit", public_facing: false, auth_required: true, status: "active", blocking_public_launch: false, notes: null },
  { path: "/profile/technologies", label: "Configuration technologies (B46)", surface: "technologies", public_facing: false, auth_required: true, status: "active", blocking_public_launch: false, notes: null },
  { path: "/profile/launch-readiness", label: "Tableau de bord launch readiness (B48)", surface: "operations", public_facing: false, auth_required: false, status: "active", blocking_public_launch: false, notes: "Internal dashboard" },
  // Pierre cockpit
  { path: "/cockpit", label: "Pierre Cockpit", surface: "cockpit", public_facing: false, auth_required: true, status: "active", blocking_public_launch: false, notes: null },
  // Demo
  { path: "/demo", label: "Page démo", surface: "demo", public_facing: true, auth_required: false, status: "active", blocking_public_launch: false, notes: "Illustrative only — no real data" },
];

export function getAllUiPages(): UiPageEntry[] {
  return [...UI_PAGE_REGISTRY];
}

export function getMissingBlockingPages(): UiPageEntry[] {
  return UI_PAGE_REGISTRY.filter((p) => p.status === "missing" && p.blocking_public_launch);
}

export function getUiPagesBySurface(surface: string): UiPageEntry[] {
  return UI_PAGE_REGISTRY.filter((p) => p.surface === surface);
}

export function getUiReadinessSummary(): {
  total: number;
  active: number;
  placeholder: number;
  missing: number;
  blocking_missing: number;
} {
  const active = UI_PAGE_REGISTRY.filter((p) => p.status === "active").length;
  const placeholder = UI_PAGE_REGISTRY.filter((p) => p.status === "placeholder").length;
  const missing = UI_PAGE_REGISTRY.filter((p) => p.status === "missing").length;
  const blocking_missing = UI_PAGE_REGISTRY.filter((p) => p.status === "missing" && p.blocking_public_launch).length;
  return { total: UI_PAGE_REGISTRY.length, active, placeholder, missing, blocking_missing };
}

export function isUiLaunchBlocked(): boolean {
  return getMissingBlockingPages().length > 0;
}
