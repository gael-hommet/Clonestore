// src/lib/clonestore/product-technologies/t2/product-technology-contract.ts
// T2 — Le CONTRAT de technologie produit + validation + audit.
// Mêmes verrous que T1 (round adversarial T1 inclus) : garde anti-effet-live (réutilise
// wantsLiveEffect T1), anti-blanchiment par artifactKind, drapeaux d'effets interdits,
// machineCanAutoApprove:false au niveau du type, audit disponible pour tous les kinds.

import { wantsLiveEffect, sanitizeTechnologyMessage } from "@/lib/clonestore/technologies/t1";
import type {
  ProductTechnologyContext, ProductTechnologyId, ProductTechnologyMode, ProductTechnologyStatus,
} from "./product-technology-types";
import {
  ALL_PRODUCT_RESULT_KINDS, productBlocked, productError, productFallback, productNeedsValidation, productOk,
  type ProductTechnologyResult, type ProductTechnologyResultKind,
} from "./product-technology-result";

// ── Contrat ────────────────────────────────────────────────────────────────────

export interface ProductTechnologyContract<In = unknown, Out = unknown> {
  readonly id: ProductTechnologyId;
  readonly name: string;
  readonly definition: string;
  readonly role: string;
  readonly answersQuestion: string;
  readonly contains: readonly string[];
  readonly doesNotContain: readonly string[];
  /** Dépendances vers d'autres technologies produit (composition via l'orchestrateur/contrats). */
  readonly dependencies: readonly ProductTechnologyId[];
  readonly status: ProductTechnologyStatus;
  readonly mode: ProductTechnologyMode;
  readonly safeFallback: string;
  readonly liveBlockedReason: string | null;
  readonly requiresValidation: boolean;
  /** Ce qui PEUT être revendiqué commercialement (préparation locale gouvernée…). */
  readonly commercialClaimAllowed: string;
  /** Ce qui ne doit JAMAIS être revendiqué (voix live, téléphonie live, …). */
  readonly commercialClaimForbidden: readonly string[];
  prepare(input: In, ctx: ProductTechnologyContext): Promise<ProductTechnologyResult<Out>>;
  validate(result: ProductTechnologyResult<Out>, ctx: ProductTechnologyContext): ProductTechnologyValidationReport;
  audit(result: ProductTechnologyResult<Out>, ctx: ProductTechnologyContext): ProductTechnologyAuditEntry;
}

// ── Validation (jamais de contournement humain ; anti-blanchiment) ─────────────

export interface ProductTechnologyValidationReport {
  readonly productTechnologyId: ProductTechnologyId;
  readonly resultKind: ProductTechnologyResultKind;
  readonly structurallyValid: boolean;
  readonly humanValidationRequired: boolean;
  readonly machineCanAutoApprove: false;
  readonly notes: readonly string[];
}

/** artifactKind attendu par techno — un artefact re-étiqueté est démasqué (fail-closed). */
export const EXPECTED_PRODUCT_ARTIFACT_KIND: Readonly<Record<ProductTechnologyId, string>> = Object.freeze({
  cloneos: "cloneos_mission_plan",
  cloneadn: "cloneadn_profile",
  cloneguard: "cloneguard_decision",
  clonetrace: "clonetrace_event",
  clonevoice: "clonevoice_intent",
  clonepolicy: "clonepolicy_decision",
  clonecontinuum: "clonecontinuum_state",
  clonetrust: "clonetrust_decision",
  clonereview: "clonereview_report",
  clonesignals: "clonesignals_candidates",
  clonelearn: "clonelearn_candidates",
  clonebrief: "clonebrief_artifact",
  clonecall: "clonecall_session",
  cloneroom: "cloneroom_coordination",
});

/** Drapeaux qu'aucun artefact T2 ne peut porter à true (aucun effet/live n'a jamais eu lieu). */
const FORBIDDEN_PRODUCT_EFFECT_CLAIMS: readonly string[] = [
  "executed", "liveCallMade", "outboundCallMade", "audioRecorded", "audioProcessed", "liveVoice", "liveVoiceUsed",
  "cronCreated", "liveSchedulerUsed", "adnMutated", "sentLive", "notificationSentLive",
  "peerToPeerAllowed", "decidesHrOutcomes", "legalGuarantee", "productionEnabled", "paymentEnabled",
];

/** Drapeaux qui DOIVENT être true sur l'artefact de leur techno (invariants anti-forge inversés). */
const REQUIRED_TRUE_ARTIFACT_FLAGS: Readonly<Partial<Record<ProductTechnologyId, readonly string[]>>> = {
  cloneroom: ["peerToPeerBlocked"],
  clonecall: ["outboundLivePathBlocked"],
  clonevoice: ["textAuthoritative"],
  clonebrief: ["onlyProvidedFacts", "preparedNeverClaimedAsDone"],
  cloneos: ["governanceRequired"],
  clonetrust: ["criticalAlwaysHumanOnly"],
};

export function buildProductTechnologyValidationReport<T>(
  meta: { id: ProductTechnologyId; requiresValidation: boolean },
  result: ProductTechnologyResult<T>,
  _ctx: ProductTechnologyContext,
): ProductTechnologyValidationReport {
  const notes: string[] = [];
  let structurallyValid = true;

  if (result.productTechnologyId !== meta.id) {
    structurallyValid = false;
    notes.push(`Incohérence d'identifiant : résultat « ${result.productTechnologyId} » vs contrat « ${meta.id} ».`);
  }
  if ((result as { live: boolean }).live !== false) {
    structurallyValid = false;
    notes.push("Résultat forgé : `live` doit être false en T2.");
  }
  if (!ALL_PRODUCT_RESULT_KINDS.includes(result.kind)) {
    structurallyValid = false;
    notes.push(`Kind de résultat inconnu : « ${String(result.kind)} ».`);
  }

  const artifact = result.artifact;
  if (artifact !== null && typeof artifact === "object") {
    const record = artifact as Record<string, unknown>;
    const expected = EXPECTED_PRODUCT_ARTIFACT_KIND[meta.id];
    if (record.artifactKind !== expected) {
      structurallyValid = false;
      notes.push(`Artefact étranger : artifactKind « ${String(record.artifactKind)} » ≠ « ${expected} » attendu pour « ${meta.id} ».`);
    }
    for (const flag of FORBIDDEN_PRODUCT_EFFECT_CLAIMS) {
      if (record[flag] === true) {
        structurallyValid = false;
        notes.push(`Artefact forgé : « ${flag}: true » — aucun artefact T2 ne peut prétendre à un effet/live.`);
      }
    }
    for (const flag of REQUIRED_TRUE_ARTIFACT_FLAGS[meta.id] ?? []) {
      if (record[flag] !== true) {
        structurallyValid = false;
        notes.push(`Artefact forgé : « ${flag} » doit être true pour « ${meta.id} » (invariant inversé absent/faux).`);
      }
    }
    // CloneRoom : chaque route DOIT passer par CloneOS (jamais de pair-à-pair direct).
    if (meta.id === "cloneroom") {
      const plan = record.contextRoutingPlan as { allViaCloneOS?: unknown; routes?: readonly { via?: unknown }[] } | undefined;
      if (plan?.allViaCloneOS !== true || (plan.routes ?? []).some((r) => r.via !== "cloneos")) {
        structurallyValid = false;
        notes.push("Artefact cloneroom forgé : le plan de routage doit être intégralement via CloneOS.");
      }
    }
  } else if (result.kind === "ok" || result.kind === "needs_validation") {
    structurallyValid = false;
    notes.push("Artefact absent pour un résultat ok/needs_validation — fail-closed.");
  }

  const humanValidationRequired =
    meta.requiresValidation || result.requiresHumanValidation ||
    result.kind === "needs_validation" || !structurallyValid;

  if (humanValidationRequired) notes.push("Validation humaine requise avant tout usage/effet — non contournable par la machine.");

  return {
    productTechnologyId: meta.id, resultKind: result.kind, structurallyValid,
    humanValidationRequired, machineCanAutoApprove: false, notes,
  };
}

// ── Audit (disponible pour TOUS les kinds, y compris fallback/bloqué/erreur) ──

export interface ProductTechnologyAuditEntry {
  readonly id: string;
  readonly at: string;
  readonly productTechnologyId: ProductTechnologyId;
  readonly employeeId: string;
  readonly companyId: string;
  readonly resultKind: ProductTechnologyResultKind;
  readonly requiresHumanValidation: boolean;
  readonly live: false;
  readonly fallbackUsed: boolean;
  readonly note: string;
}

let productAuditSequence = 0;

export function createProductTechnologyAuditEntry<T>(
  result: ProductTechnologyResult<T>,
  ctx?: Partial<ProductTechnologyContext> | null,
  note?: string,
): ProductTechnologyAuditEntry {
  productAuditSequence += 1;
  const parts = [
    note,
    result.fallbackNote ? `fallback: ${result.fallbackNote}` : undefined,
    result.blockedReason ? `bloqué: ${result.blockedReason}` : undefined,
    result.errorMessage ? `erreur: ${result.errorMessage}` : undefined,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return {
    id: `t2-audit-${productAuditSequence}`,
    at: new Date().toISOString(),
    productTechnologyId: result.productTechnologyId,
    employeeId: result.employeeId || (ctx?.employeeId ?? "").trim(),
    companyId: result.companyId || (ctx?.companyId ?? "").trim(),
    resultKind: result.kind,
    requiresHumanValidation: result.requiresHumanValidation,
    live: false,
    fallbackUsed: result.kind === "fallback" || result.fallbackNote !== undefined,
    note: sanitizeTechnologyMessage(parts.join(" | ") || `usage ${result.productTechnologyId} (${result.kind})`),
  };
}

export interface ProductTechnologyAuditLog {
  record(entry: ProductTechnologyAuditEntry): void;
  list(): readonly ProductTechnologyAuditEntry[];
  count(): number;
}

export function createProductTechnologyAuditLog(): ProductTechnologyAuditLog {
  const entries: ProductTechnologyAuditEntry[] = [];
  return {
    record(e) { entries.push(e); },
    list() { return [...entries]; },
    count() { return entries.length; },
  };
}

// ── Fabrique de contrat ────────────────────────────────────────────────────────

export interface ProductPrepareOutcome<Out> {
  readonly kind: Exclude<ProductTechnologyResultKind, "error">;
  readonly artifact: Out | null;
  readonly fallbackNote?: string;
  readonly blockedReason?: string;
}

export interface DefineProductTechnologyConfig<In, Out> {
  readonly id: ProductTechnologyId;
  readonly name: string;
  readonly definition: string;
  readonly role: string;
  readonly answersQuestion: string;
  readonly contains: readonly string[];
  readonly doesNotContain: readonly string[];
  readonly dependencies: readonly ProductTechnologyId[];
  readonly status: ProductTechnologyStatus;
  readonly mode: ProductTechnologyMode;
  readonly safeFallback: string;
  readonly liveBlockedReason: string | null;
  readonly requiresValidation: boolean;
  readonly commercialClaimAllowed: string;
  readonly commercialClaimForbidden: readonly string[];
  /** Construit l'artefact local sûr. Peut être async (composition d'autres contrats T2/T1). Jamais d'I/O. */
  readonly prepareArtifact: (input: In, ctx: ProductTechnologyContext) => ProductPrepareOutcome<Out> | Promise<ProductPrepareOutcome<Out>>;
}

function hasScope(ctx: ProductTechnologyContext | null | undefined): ctx is ProductTechnologyContext {
  return !!ctx && (ctx.employeeId ?? "").trim().length > 0 && (ctx.companyId ?? "").trim().length > 0;
}

export const PRODUCT_LIVE_BLOCKED_REASON =
  "Effet live demandé — bloqué par défaut en T2 (production OFF, aucun provider live vérifié). L'artefact peut être préparé sans effet.";

// ── Garde téléphonie T2 (backstop couche entière — T1 wantsLiveEffect ne couvre pas la téléphonie) ──

const TELEPHONY_KEY_PATTERN = /phone|dial|numero|msisdn|outbound|callnow|calltarget|telephone|^tel$/i;

const meaningful = (v: unknown): boolean =>
  v !== undefined && v !== null && v !== false && !(typeof v === "string" && v.trim().length === 0);

/**
 * L'input porte-t-il une intention de téléphonie live (clé type phone/dial/outbound avec une
 * valeur significative, jusqu'à un niveau d'imbrication) ? FAIL-CLOSED : un faux positif
 * bloque — jamais l'inverse. Pur.
 */
export function wantsTelephonyIntent(input: unknown, depth = 0): boolean {
  if (typeof input !== "object" || input === null || Array.isArray(input) || depth > 1) return false;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (TELEPHONY_KEY_PATTERN.test(key) && meaningful(value)) return true;
    if (typeof value === "object" && value !== null && !Array.isArray(value) && wantsTelephonyIntent(value, depth + 1)) return true;
  }
  return false;
}

export const PRODUCT_TELEPHONY_BLOCKED_REASON =
  "Intention de téléphonie/appel sortant détectée — live_blocked en T2 (aucun provider télécom vérifié, cadre légal non validé).";

/** Définit un contrat de technologie produit T2 (GELÉ). Aucune logique spécifique à un employé. */
export function defineProductTechnologyContract<In, Out>(
  cfg: DefineProductTechnologyConfig<In, Out>,
): ProductTechnologyContract<In, Out> {
  const contract: ProductTechnologyContract<In, Out> = {
    id: cfg.id,
    name: cfg.name,
    definition: cfg.definition,
    role: cfg.role,
    answersQuestion: cfg.answersQuestion,
    contains: cfg.contains,
    doesNotContain: cfg.doesNotContain,
    dependencies: cfg.dependencies,
    status: cfg.status,
    mode: cfg.mode,
    safeFallback: cfg.safeFallback,
    liveBlockedReason: cfg.liveBlockedReason,
    requiresValidation: cfg.requiresValidation,
    commercialClaimAllowed: cfg.commercialClaimAllowed,
    commercialClaimForbidden: cfg.commercialClaimForbidden,

    async prepare(input: In, ctx: ProductTechnologyContext): Promise<ProductTechnologyResult<Out>> {
      // TOUT est dans le try : un input piégé (getter qui jette) dégrade en productError
      // (toujours audité par l'appelant) au lieu de sortir de prepare sans audit.
      try {
        if (!hasScope(ctx)) {
          return productBlocked<Out>(cfg.id, ctx, "Contexte incomplet (employeeId et companyId requis) — refus fail-closed.", cfg.safeFallback);
        }
        // Garde anti-effet-live T1 réutilisée (synonymes + coercition + imbrication).
        if (wantsLiveEffect(input)) {
          return productBlocked<Out>(cfg.id, ctx, PRODUCT_LIVE_BLOCKED_REASON, cfg.safeFallback);
        }
        // Backstop téléphonie T2 (toutes technologies) : clé phone/dial/outbound significative → refus.
        if (wantsTelephonyIntent(input)) {
          return productBlocked<Out>(cfg.id, ctx, PRODUCT_TELEPHONY_BLOCKED_REASON, cfg.safeFallback);
        }
        const outcome = await cfg.prepareArtifact(input, ctx);
        switch (outcome.kind) {
          case "ok":
            return outcome.artifact === null
              ? productFallback<Out>(cfg.id, ctx, null, outcome.fallbackNote ?? cfg.safeFallback)
              : productOk(cfg.id, ctx, outcome.artifact);
          case "needs_validation":
            return outcome.artifact === null
              ? productFallback<Out>(cfg.id, ctx, null, outcome.fallbackNote ?? cfg.safeFallback)
              : productNeedsValidation(cfg.id, ctx, outcome.artifact);
          case "fallback":
            return productFallback<Out>(cfg.id, ctx, outcome.artifact, outcome.fallbackNote ?? cfg.safeFallback);
          case "blocked":
            return productBlocked<Out>(cfg.id, ctx, outcome.blockedReason ?? "Bloqué — refus fail-closed.", cfg.safeFallback);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return productError<Out>(cfg.id, ctx, `Préparation impossible : ${message}`);
      }
    },

    validate(result, ctx) {
      return buildProductTechnologyValidationReport({ id: cfg.id, requiresValidation: cfg.requiresValidation }, result, ctx);
    },

    audit(result, ctx) {
      return createProductTechnologyAuditEntry(result, ctx);
    },
  };
  return Object.freeze(contract);
}
