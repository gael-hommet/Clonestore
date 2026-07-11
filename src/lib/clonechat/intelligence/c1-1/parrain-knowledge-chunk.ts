// src/lib/clonechat/intelligence/c1-1/parrain-knowledge-chunk.ts
// C1.1 — Fabrique de chunks : produit des ParrainKnowledgeChunk compatibles avec le
// pipeline P9.4.1 (mêmes champs de base → validateCitations existant inchangé).
// Chaque chunk passe la quarantaine secrète à la construction (fail-closed).

import type { KnowledgeCategory, KnowledgeKind } from "../../knowledge/types";
import { contentHash } from "../../knowledge/types";
import { quarantineIfSecret, toLegacyVisibility } from "./parrain-visibility";
import {
  parrainHash,
  type ParrainAuthorityLevel,
  type ParrainFreshness,
  type ParrainKnowledgeChunk,
  type ParrainSourceType,
  type ParrainVisibility,
} from "./parrain-types";

export interface MakeChunkInput {
  readonly id: string;
  readonly sourceId: string;
  readonly title: string;
  readonly text: string;
  readonly sourceType: ParrainSourceType;
  readonly authority: ParrainAuthorityLevel;
  readonly visibility: ParrainVisibility;
  readonly citationLabel: string;
  readonly kind?: KnowledgeKind;
  readonly category?: KnowledgeCategory;
  readonly routes?: readonly string[];
  readonly tenantCompanyId?: string | null;
  readonly version?: string;
  readonly reviewedAt?: string;
  readonly freshness?: ParrainFreshness;
  readonly authorityPath?: string;
}

const KIND_BY_SOURCE: Partial<Record<ParrainSourceType, KnowledgeKind>> = {
  public_page: "public_page",
  authenticated_page: "client_surface",
  internal_page: "internal_document",
  product_registry: "product_config",
  capability_registry: "runtime_capability",
  technology_registry: "technology_catalogue",
  pricing_registry: "pricing_config",
  roadmap_report: "release_state",
  readiness_report: "release_state",
  legal_page: "legal_limit",
  support_memory: "support_procedure",
  bug_memory: "known_issue",
  code_symbol: "internal_document",
  test_evidence: "internal_document",
};

const CATEGORY_BY_SOURCE: Partial<Record<ParrainSourceType, KnowledgeCategory>> = {
  public_page: "pages",
  authenticated_page: "cockpit",
  internal_page: "release_state",
  product_registry: "vision",
  capability_registry: "employees",
  technology_registry: "technologies",
  pricing_registry: "prices",
  roadmap_report: "release_state",
  readiness_report: "release_state",
  legal_page: "limits",
  support_memory: "support",
  bug_memory: "bugs",
  company_context: "account",
  mission: "missions",
  task: "missions",
  validation: "validations",
  employee: "salaries",
  generated_document: "documents",
  uploaded_document: "documents",
  trace_event: "account",
  conversation: "account",
  code_symbol: "release_state",
  test_evidence: "release_state",
};

export const PARRAIN_DEFAULT_REVIEWED_AT = "2026-07-10";

export function makeParrainChunk(input: MakeChunkInput): ParrainKnowledgeChunk {
  const freshness: ParrainFreshness = input.freshness ?? "CURRENT";
  const chunk: ParrainKnowledgeChunk = Object.freeze({
    // ── Champs KnowledgeChunk (compatibilité P9.4.1 / validateCitations) ──
    id: input.id,
    sourceId: input.sourceId,
    title: input.title,
    kind: input.kind ?? KIND_BY_SOURCE[input.sourceType] ?? "internal_document",
    category: input.category ?? CATEGORY_BY_SOURCE[input.sourceType] ?? "release_state",
    visibility: toLegacyVisibility(input.visibility),
    authority: input.authorityPath ?? input.sourceId,
    version: input.version ?? "c1.1",
    reviewedAt: input.reviewedAt ?? PARRAIN_DEFAULT_REVIEWED_AT,
    freshnessStatus: freshness,
    text: input.text,
    routes: input.routes,
    citationLabel: input.citationLabel,
    contentHash: contentHash(input.text),
    // ── Extensions Parrain ──
    parrainSourceType: input.sourceType,
    parrainAuthority: input.authority,
    parrainVisibility: input.visibility,
    tenantCompanyId: input.tenantCompanyId ?? null,
    stale: freshness === "STALE",
  });
  return quarantineIfSecret(chunk);
}

/** Id stable dérivé du contenu (chunks de session : pièces jointes, contexte compte). */
export function derivedChunkId(prefix: string, seed: string): string {
  return `${prefix}.${parrainHash(seed)}`;
}
