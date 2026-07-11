// src/lib/clonestore/technologies/t1/technology-contract.ts
// T1 — Le CONTRAT de technologie : la forme que Pierre (P16C) et tout futur employé IA
// consomment. `prepare` produit un ARTEFACT sûr (jamais un effet) ; `validate` ne contourne
// JAMAIS la validation humaine ; `audit` fonctionne pour tous les kinds (fallback compris).
// Toute demande d'effet LIVE est bloquée par défaut, pour toutes les technologies.

import type { LiveDependency, TechnologyContext, TechnologyId, TechnologyStatus } from "./technology-types";
import {
  blockedResult, errorResult, fallbackResult, needsValidationResult, okResult,
  type TechnologyResult, type TechnologyResultKind,
} from "./technology-result";
import { buildTechnologyValidationReport, type TechnologyValidationReport } from "./technology-validation";
import { createTechnologyAuditEntry, type TechnologyAuditEntry } from "./technology-audit";
import { technologyProductionAllowed } from "./technology-status";

export interface TechnologyContract<In = unknown, Out = unknown> {
  readonly id: TechnologyId;
  readonly name: string;
  readonly purpose: string;
  readonly status: TechnologyStatus;
  readonly liveDependency: LiveDependency;
  /** Les préparations effectful passent par l'humain — jamais d'effet auto. */
  readonly requiresValidation: boolean;
  /** Dégradation sûre quand la techno n'est pas live. */
  readonly safeFallback: string;
  readonly allowedInDemo: boolean;
  /** Dérivé du gate P10 réel — false tant que PRODUCTION_AUTHORIZED = false. */
  readonly allowedInProduction: boolean;
  /** Prépare un artefact sûr (jamais d'effet, jamais de live, jamais de secret). */
  prepare(input: In, ctx: TechnologyContext): Promise<TechnologyResult<Out>>;
  /** Valide la STRUCTURE d'un résultat — ne remplace jamais la validation humaine. */
  validate(result: TechnologyResult<Out>, ctx: TechnologyContext): TechnologyValidationReport;
  /** Trace l'usage — disponible même en fallback/bloqué/erreur. */
  audit(result: TechnologyResult<Out>, ctx: TechnologyContext): TechnologyAuditEntry;
}

// ── Garde anti-effet-live : tout drapeau d'intention live est bloqué par défaut ─

const LIVE_INTENT_FLAGS = [
  "live", "send", "sendNow", "push", "createLive", "connect", "requestLive", "signLive", "transferNow", "execute",
  // synonymes plausibles côté adaptateurs (même classe de correctif que les synonymes du claim-linter P14)
  "dispatch", "publish", "commit", "apply", "submit", "schedule", "trigger", "deliver", "upload", "sync",
  "post", "broadcast", "notify", "activate",
] as const;

// Les adaptateurs marshallent du JSON (tool-calls LLM, formulaires) : "true"/"1"/1 comptent comme une intention live.
const isLiveIntentValue = (v: unknown): boolean =>
  v === true ||
  (typeof v === "number" && v !== 0) ||
  (typeof v === "string" && ["true", "1", "on", "yes"].includes(v.trim().toLowerCase()));

/**
 * L'input demande-t-il un effet live/immédiat ? (bloqué par défaut en T1). Pur.
 * FAIL-CLOSED : détecte aussi un niveau d'imbrication (ex. { options: { send: true } }) —
 * un faux positif bloque (sûr), jamais l'inverse.
 */
export function wantsLiveEffect(input: unknown, depth = 0): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input) || depth > 1) return false;
  const record = input as Record<string, unknown>;
  if (LIVE_INTENT_FLAGS.some((flag) => isLiveIntentValue(record[flag]))) return true;
  return Object.values(record).some((v) => typeof v === "object" && v !== null && !Array.isArray(v) && wantsLiveEffect(v, depth + 1));
}

export const LIVE_EFFECT_BLOCKED_REASON =
  "Effet live demandé — bloqué par défaut en T1 (production OFF, aucun provider live vérifié). L'artefact peut être préparé sans effet.";

// ── Fabrique de contrat (mutualise gardes fail-closed + validation + audit) ────

export interface TechnologyPrepareOutcome<Out> {
  readonly kind: Exclude<TechnologyResultKind, "error">;
  readonly artifact: Out | null;
  readonly fallbackNote?: string;
  readonly blockedReason?: string;
}

export interface DefineTechnologyConfig<In, Out> {
  readonly id: TechnologyId;
  readonly name: string;
  readonly purpose: string;
  readonly status: TechnologyStatus;
  readonly liveDependency: LiveDependency;
  readonly requiresValidation: boolean;
  readonly safeFallback: string;
  readonly allowedInDemo?: boolean;
  /** Construit l'artefact local sûr. Peut rétrograder en fallback/blocked. Jamais d'I/O. */
  readonly prepareArtifact: (input: In, ctx: TechnologyContext) => TechnologyPrepareOutcome<Out>;
}

function hasScope(ctx: TechnologyContext | null | undefined): ctx is TechnologyContext {
  return !!ctx && (ctx.employeeId ?? "").trim().length > 0 && (ctx.companyId ?? "").trim().length > 0;
}

/** Définit un contrat de technologie T1 (GELÉ — non mutable au runtime). Aucune logique spécifique à un employé. */
export function defineTechnologyContract<In, Out>(cfg: DefineTechnologyConfig<In, Out>): TechnologyContract<In, Out> {
  const contract: TechnologyContract<In, Out> = {
    id: cfg.id,
    name: cfg.name,
    purpose: cfg.purpose,
    status: cfg.status,
    liveDependency: cfg.liveDependency,
    requiresValidation: cfg.requiresValidation,
    safeFallback: cfg.safeFallback,
    allowedInDemo: cfg.allowedInDemo ?? true,
    allowedInProduction: technologyProductionAllowed(), // = false tant que le plancher P10 est false

    async prepare(input: In, ctx: TechnologyContext): Promise<TechnologyResult<Out>> {
      if (!hasScope(ctx)) {
        return blockedResult<Out>(cfg.id, ctx, "Contexte incomplet (employeeId et companyId requis) — refus fail-closed.", cfg.safeFallback);
      }
      if (wantsLiveEffect(input)) {
        return blockedResult<Out>(cfg.id, ctx, LIVE_EFFECT_BLOCKED_REASON, cfg.safeFallback);
      }
      try {
        const outcome = cfg.prepareArtifact(input, ctx);
        switch (outcome.kind) {
          case "ok":
            return outcome.artifact === null
              ? fallbackResult<Out>(cfg.id, ctx, null, outcome.fallbackNote ?? cfg.safeFallback)
              : okResult(cfg.id, ctx, outcome.artifact);
          case "needs_validation":
            return outcome.artifact === null
              ? fallbackResult<Out>(cfg.id, ctx, null, outcome.fallbackNote ?? cfg.safeFallback)
              : needsValidationResult(cfg.id, ctx, outcome.artifact);
          case "fallback":
            return fallbackResult<Out>(cfg.id, ctx, outcome.artifact, outcome.fallbackNote ?? cfg.safeFallback);
          case "blocked":
            return blockedResult<Out>(cfg.id, ctx, outcome.blockedReason ?? "Bloqué — refus fail-closed.", cfg.safeFallback);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult<Out>(cfg.id, ctx, `Préparation impossible : ${message}`);
      }
    },

    validate(result, ctx) {
      return buildTechnologyValidationReport({ id: cfg.id, requiresValidation: cfg.requiresValidation }, result, ctx);
    },

    audit(result, ctx) {
      return createTechnologyAuditEntry(result, ctx);
    },
  };
  return Object.freeze(contract);
}
