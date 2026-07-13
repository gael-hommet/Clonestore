// src/lib/clonechat/intelligence/c1-1/parrain-types.ts
// C1.1 — PARRAIN : types fondamentaux du runtime de connaissance totale CloneStore.
// Vocabulaires FERMÉS : types de sources, niveaux d'autorité, visibilités (dont
// RESTRICTED_SECRET qui ne part JAMAIS vers le modèle ni le client), modes viewer.
// Le chunk Parrain est STRUCTURELLEMENT compatible avec le KnowledgeChunk P9.4.1
// (validateCitations existant fonctionne sans modification).

import type { KnowledgeChunk } from "../../knowledge/types";

// ── Types de sources (vocabulaire fermé) ─────────────────────────────────────
export const PARRAIN_SOURCE_TYPES = [
  "public_page",
  "authenticated_page",
  "internal_page",
  "product_registry",
  "capability_registry",
  "technology_registry",
  "pricing_registry",
  "roadmap_report",
  "readiness_report",
  "legal_page",
  "support_memory",
  "bug_memory",
  "company_context",
  "mission",
  "task",
  "validation",
  "employee",
  "generated_document",
  "uploaded_document",
  "trace_event",
  "conversation",
  "code_symbol",
  "test_evidence",
  "unknown",
] as const;
export type ParrainSourceType = (typeof PARRAIN_SOURCE_TYPES)[number];

// ── Niveaux d'autorité ────────────────────────────────────────────────────────
export const PARRAIN_AUTHORITY_LEVELS = [
  "canonical_runtime",
  "canonical_registry",
  "verified_report",
  "product_page",
  "validated_support",
  "tenant_data",
  "uploaded_user_content",
  "candidate_learning",
  "unverified",
  "deprecated",
] as const;
export type ParrainAuthorityLevel = (typeof PARRAIN_AUTHORITY_LEVELS)[number];

/** Rang d'autorité (plus haut = plus autoritaire) — le candidat ne surclasse JAMAIS le canonique. */
export function authorityRank(level: ParrainAuthorityLevel): number {
  switch (level) {
    case "canonical_runtime": return 100;
    case "canonical_registry": return 95;
    case "verified_report": return 80;
    case "product_page": return 70;
    case "validated_support": return 65;
    case "tenant_data": return 60;
    case "uploaded_user_content": return 40;
    case "candidate_learning": return 10;
    case "unverified": return 5;
    case "deprecated": return 0;
  }
}

// ── Visibilités ───────────────────────────────────────────────────────────────
export const PARRAIN_VISIBILITIES = [
  "PUBLIC",
  // C1.7 — Pièce jointe ÉPHÉMÈRE fournie par l'utilisateur LUI-MÊME dans CE tour.
  // Ce n'est PAS de la connaissance publique, et ce n'est PAS une donnée tenant :
  // c'est le fichier de l'utilisateur, lié à AUCUNE entreprise (tenantCompanyId = null),
  // jamais persisté, jamais visible d'une autre session. Il n'accorde AUCUN accès tenant.
  "SESSION_EPHEMERAL",
  "AUTHENTICATED_CLIENT",
  "COMPANY_SCOPED",
  "FOUNDER_INTERNAL",
  "RESTRICTED_SECRET",
] as const;
export type ParrainVisibility = (typeof PARRAIN_VISIBILITIES)[number];

// ── Modes viewer (résolus CÔTÉ SERVEUR, jamais déclarés par le client) ────────
export const PARRAIN_VIEWER_MODES = ["public", "client", "founder"] as const;
export type ParrainViewerMode = (typeof PARRAIN_VIEWER_MODES)[number];

// ── Fraîcheur ─────────────────────────────────────────────────────────────────
export const PARRAIN_FRESHNESS_STRATEGIES = [
  "live_derived",      // dérivé à la demande du module canonique (toujours frais)
  "generated_index",   // index généré par script — périmé si le hash source change
  "session_snapshot",  // instantané borné construit pour ce tour (compte, pièce jointe)
  "static_verified",   // contenu vérifié par une phase (rapport) — version figée
] as const;
export type ParrainFreshnessStrategy = (typeof PARRAIN_FRESHNESS_STRATEGIES)[number];

export type ParrainFreshness = "CURRENT" | "STALE" | "UNKNOWN";

// ── Portée tenant ─────────────────────────────────────────────────────────────
export type ParrainTenantScope = "global" | "company";

// ── Entrée du registre de sources ─────────────────────────────────────────────
export const PARRAIN_SOURCE_STATUSES = ["active", "stale", "deprecated", "blocked"] as const;
export type ParrainSourceStatus = (typeof PARRAIN_SOURCE_STATUSES)[number];

export interface ParrainSourceEntry {
  readonly sourceId: string;
  readonly sourceType: ParrainSourceType;
  readonly title: string;
  /** Chemin source OU identifiant logique (jamais exposé au client normal). */
  readonly sourcePath: string;
  readonly authority: ParrainAuthorityLevel;
  readonly visibility: ParrainVisibility;
  readonly tenantScope: ParrainTenantScope;
  readonly freshnessStrategy: ParrainFreshnessStrategy;
  readonly version: string;
  readonly contentHash: string;
  readonly lastIndexedAt: string;
  readonly allowedAnswerModes: readonly ParrainViewerMode[];
  readonly citationLabel: string;
  readonly canExposeRawContent: boolean;
  readonly containsSensitiveData: boolean;
  readonly parser: string | null;
  readonly fallback: string;
  readonly status: ParrainSourceStatus;
}

// ── Chunk Parrain (superset compatible KnowledgeChunk P9.4.1) ─────────────────
export interface ParrainKnowledgeChunk extends KnowledgeChunk {
  readonly parrainSourceType: ParrainSourceType;
  readonly parrainAuthority: ParrainAuthorityLevel;
  readonly parrainVisibility: ParrainVisibility;
  /** companyId propriétaire pour un chunk tenant — null pour la connaissance globale. */
  readonly tenantCompanyId: string | null;
  readonly stale: boolean;
}

// ── Résultat de récupération ──────────────────────────────────────────────────
export interface ParrainRetrievedChunk {
  readonly chunk: ParrainKnowledgeChunk;
  readonly relevance: number;
  readonly authorityScore: number;
  readonly fresh: boolean;
}

export interface ParrainRetrievalResult {
  readonly selected: readonly ParrainRetrievedChunk[];
  readonly totalChars: number;
  readonly excluded: readonly { readonly chunkId: string; readonly reason: string }[];
  readonly staleSourceIds: readonly string[];
  readonly conflicts: readonly { readonly topic: string; readonly chunkIds: readonly string[] }[];
}

// ── Contexte viewer résolu serveur ───────────────────────────────────────────
export interface ParrainViewerContext {
  readonly mode: ParrainViewerMode;
  /** Résolu serveur (membership V1) — JAMAIS depuis le body client. */
  readonly companyId: string | null;
  readonly userId: string | null;
  readonly role: string | null;
}

// ── Lien / CTA ────────────────────────────────────────────────────────────────
export interface ParrainLink {
  readonly route: string;
  readonly label: string;
}

// ── Honnêteté de réponse ──────────────────────────────────────────────────────
export const PARRAIN_HONESTY_VALUES = [
  "answered",
  "partially_answered",
  "clarification_required",
  "source_missing",
  "permission_denied",
  "unsupported",
  "escalated",
] as const;
export type ParrainHonesty = (typeof PARRAIN_HONESTY_VALUES)[number];

// ── Utilitaires purs ──────────────────────────────────────────────────────────
export function parrainHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "pfnv_" + h.toString(16).padStart(8, "0");
}

export function parrainNormalize(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
