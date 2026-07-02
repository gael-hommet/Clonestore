// src/lib/clonechat/knowledge/types.ts
// P9.4.1 — Types du cerveau de connaissance CloneStore. Le registre n'est plus un
// tableau de prose hardcodée : chaque chunk est DÉRIVÉ d'une SOURCE canonique réelle
// (public-catalog, commercial-state, route-registry, technologies, capability canon…),
// avec visibilité sur 4 niveaux, hash d'intégrité, version et fraîcheur. Le modèle est
// grounded UNIQUEMENT sur les chunks visibles pour le viewer courant.

export type KnowledgeKind =
  | "product_vision" | "public_page" | "route_registry" | "product_config"
  | "pricing_config" | "employee_catalogue" | "technology_catalogue"
  | "client_surface" | "runtime_capability" | "support_procedure"
  | "known_issue" | "release_state" | "legal_limit" | "internal_document";

export type KnowledgeVisibility = "PUBLIC" | "AUTHENTICATED_CLIENT" | "INTERNAL_CLONESTORE" | "RESTRICTED";

export type FreshnessStatus = "CURRENT" | "STALE" | "UNKNOWN";

/** Catégories OBLIGATOIRES pour la couverture (§2). */
export type KnowledgeCategory =
  | "vision" | "employees" | "technologies" | "offers" | "prices" | "routes"
  | "pages" | "onboarding" | "account" | "cockpit" | "missions" | "validations"
  | "salaries" | "documents" | "communications" | "permissions" | "security"
  | "limits" | "bugs" | "support" | "release_state";

export const REQUIRED_CATEGORIES: readonly KnowledgeCategory[] = [
  "vision", "employees", "technologies", "offers", "prices", "routes", "pages",
  "onboarding", "account", "cockpit", "missions", "validations", "salaries",
  "documents", "communications", "permissions", "security", "limits", "bugs",
  "support", "release_state",
];

/** Viewer d'un tour (les deux modes CloneChat + un flag interne explicite). */
export type KnowledgeViewer = "public" | "authenticated";

/** Source canonique déclarée (traçabilité / autorité éditoriale). */
export interface KnowledgeSourceRef {
  readonly authority: string;      // module de vérité, ex. "src/lib/catalog/public-catalog.ts"
  readonly version: string;
  readonly reviewedAt: string;     // ISO date
}

/** Unité récupérable, dérivée d'une source réelle. */
export interface KnowledgeChunk {
  readonly id: string;
  readonly sourceId: string;
  readonly title: string;
  readonly kind: KnowledgeKind;
  readonly category: KnowledgeCategory;
  readonly visibility: KnowledgeVisibility;
  readonly authority: string;
  readonly version: string;
  readonly reviewedAt: string;
  readonly freshnessStatus: FreshnessStatus;
  /** Fait client-safe (jamais de secret, jamais d'ID interne, jamais de PII). */
  readonly text: string;
  readonly routes?: readonly string[];
  /** Étiquette DISCRÈTE pour l'UI (« la page Pierre », « votre cockpit »). */
  readonly citationLabel: string;
  readonly contentHash: string;
}

// ── Empreinte d'intégrité déterministe (FNV-1a 32 bits) ─────────────────────
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return "fnv1a_" + h.toString(16).padStart(8, "0");
}

/** Visibilités autorisées pour un viewer (jamais internal/restricted au client). */
export function allowedVisibilities(viewer: KnowledgeViewer): readonly KnowledgeVisibility[] {
  return viewer === "authenticated" ? ["PUBLIC", "AUTHENTICATED_CLIENT"] : ["PUBLIC"];
}

/** Normalisation accent-insensible pour le scoring de récupération. */
export function normalizeText(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
