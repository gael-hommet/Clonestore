// src/lib/clonestore/technologies/t1/technology-result.ts
// T1 — Résultat d'une technologie. INVARIANT DUR : `live: false` au niveau du TYPE —
// aucun résultat T1 ne peut prétendre à un effet live. Les messages sont assainis
// (jamais de secret dans un résultat ni dans un audit). Module PUR.

import type { TechnologyContext, TechnologyId } from "./technology-types";

export type TechnologyResultKind = "ok" | "needs_validation" | "fallback" | "blocked" | "error";

export const ALL_TECHNOLOGY_RESULT_KINDS: readonly TechnologyResultKind[] = [
  "ok", "needs_validation", "fallback", "blocked", "error",
];

export interface TechnologyResult<T = unknown> {
  readonly kind: TechnologyResultKind;
  readonly technologyId: TechnologyId;
  readonly employeeId: string;
  readonly companyId: string;
  /** Artefact préparé localement (jamais un effet exécuté). `null` si bloqué/erreur. */
  readonly artifact: T | null;
  /** L'humain doit-il valider avant tout usage/effet ? Jamais contournable par la machine. */
  readonly requiresHumanValidation: boolean;
  /** INVARIANT T1 : aucun résultat n'est live. Jamais. */
  readonly live: false;
  readonly fallbackNote?: string;
  readonly blockedReason?: string;
  readonly errorMessage?: string;
}

// ── Assainissement — jamais de secret dans un message ─────────────────────────

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|rk|whsec)[-_][A-Za-z0-9_-]{6,}\b/g,                  // clés type Stripe/OpenAI (sk_live_, sk-proj-…)
  /\b(?:api[-_]?key|secret|token|password|passwd|pwd|bearer|authorization)\s*[:=]\s*\S+/gi, // affectations clé=valeur
  /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi,                          // en-têtes Authorization: Bearer xxx
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,                                 // clés d'accès AWS
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,                                // tokens GitHub
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,                                    // clés API Google
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi,                  // URI avec credentials (postgres://u:p@…)
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_.-]+\b/g,                    // JWT
];

/** Assainit un message : les motifs ressemblant à des secrets sont expurgés. Pur. */
export function sanitizeTechnologyMessage(message: string): string {
  let out = message;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, "[REDACTED]");
  return out;
}

// ── Constructeurs ──────────────────────────────────────────────────────────────

function scope(ctx: Partial<TechnologyContext> | null | undefined): { employeeId: string; companyId: string } {
  return {
    employeeId: (ctx?.employeeId ?? "").trim(),
    companyId: (ctx?.companyId ?? "").trim(),
  };
}

/** Résultat OK (non effectful — ex. lecture, décision de permission, résumé). Pur. */
export function okResult<T>(technologyId: TechnologyId, ctx: TechnologyContext, artifact: T): TechnologyResult<T> {
  return { kind: "ok", technologyId, ...scope(ctx), artifact, requiresHumanValidation: false, live: false };
}

/** Résultat préparé — l'HUMAIN valide avant tout usage/effet. Pur. */
export function needsValidationResult<T>(technologyId: TechnologyId, ctx: TechnologyContext, artifact: T): TechnologyResult<T> {
  return { kind: "needs_validation", technologyId, ...scope(ctx), artifact, requiresHumanValidation: true, live: false };
}

/** Résultat en dégradation sûre (techno non live) — l'humain complète. Pur. */
export function fallbackResult<T>(
  technologyId: TechnologyId,
  ctx: TechnologyContext,
  artifact: T | null,
  fallbackNote: string,
): TechnologyResult<T> {
  return {
    kind: "fallback", technologyId, ...scope(ctx), artifact,
    requiresHumanValidation: true, live: false,
    fallbackNote: sanitizeTechnologyMessage(fallbackNote),
  };
}

/** Résultat bloqué (fail-closed) — rien n'a été préparé ni exécuté. Pur. */
export function blockedResult<T = never>(
  technologyId: TechnologyId,
  ctx: Partial<TechnologyContext> | null | undefined,
  blockedReason: string,
  fallbackNote?: string,
): TechnologyResult<T> {
  const base = {
    kind: "blocked" as const, technologyId, ...scope(ctx), artifact: null,
    requiresHumanValidation: true, live: false as const,
    blockedReason: sanitizeTechnologyMessage(blockedReason),
  };
  return fallbackNote === undefined ? base : { ...base, fallbackNote: sanitizeTechnologyMessage(fallbackNote) };
}

/** Résultat en erreur — message assaini, jamais de secret, jamais d'effet. Pur. */
export function errorResult<T = never>(
  technologyId: TechnologyId,
  ctx: Partial<TechnologyContext> | null | undefined,
  message: string,
): TechnologyResult<T> {
  return {
    kind: "error", technologyId, ...scope(ctx), artifact: null,
    requiresHumanValidation: true, live: false,
    errorMessage: sanitizeTechnologyMessage(message),
  };
}
