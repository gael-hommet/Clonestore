// src/lib/pierre/v1/governance/canonical-decision.ts
// P19 — CANONICAL GOVERNANCE DECISION (CloneGuard + ClonePolicy + CloneTrust, strictest-wins).
//
// Before P19 governance was fragmented: V1 `evaluateGuard` (green/orange/red/black), the autonomy engine
// `decideValidation`, the country execution gate, and legacy `hr/cloneguard` (allow/…/refuse) each answered
// a slice, with no single canonical decision and no cross-layer strictest-wins. This module is the SINGLE
// canonical decision. It does NOT re-implement any engine — it COMPOSES the real V1 engines and applies
// STRICTEST-WINS: no layer can grant more autonomy than the most restrictive layer allows.
//
//   Guard  (evaluateGuard)        → sensitivity / absolute HR blocks / lexical net
//   Trust  (decideValidation)     → effective autonomy for the mode + action class
//   Policy/Country (geo)          → jurisdictional actions fail-closed without a VERIFIED rule/template
//   Access (permissions)          → entitlement / suspension / revocation
//
// The result is server-authoritative and must be called before creating an executable task, before enqueue,
// before any provider/document/communication effect, and again just before the effect when context changed.

import { evaluateGuard, type GuardLevel } from "../cloneguard";
import { decideValidation, type AutonomyMode, type ActionKind, type RiskLevel, type Sensitivity, type ValidationDecision } from "../autonomy";

export type CanonicalRisk = "normal" | "sensitive" | "critical";

/** The single canonical decision vocabulary. Ordered least → most restrictive (see SEVERITY). */
export type CanonicalDecision =
  | "allow_execute"        // may act (possibly notify)
  | "allow_prepare"        // may prepare a clearly-marked draft only, no external effect
  | "require_validation"   // may prepare, but a human must approve before any effect
  | "human_only"           // only a human may decide/act — escalate, never autonomous
  | "block"                // blocked for now (missing country/permission/suspended) — recoverable
  | "refuse";              // hard refuse (not entitled / absolute prohibition)

const SEVERITY: Record<CanonicalDecision, number> = {
  allow_execute: 0, allow_prepare: 1, require_validation: 2, human_only: 3, block: 4, refuse: 5,
};
const AUTONOMY_ORDINAL: Record<AutonomyMode, number> = {
  draft: 0, normal: 1, high_autonomy: 2, enterprise_autonomous: 3,
};

/** strictest wins: return the more restrictive of two decisions. */
export function strictest(a: CanonicalDecision, b: CanonicalDecision): CanonicalDecision {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

export type CanonicalGovernanceInput = {
  readonly action: ActionKind;
  readonly risk: RiskLevel;
  readonly sensitivity: Sensitivity;
  readonly mode: AutonomyMode;                 // autonomy REQUESTED
  readonly external_side_effect: boolean;
  readonly text?: string;
  /** Country dimension — resolved SERVER-SIDE (never the client). */
  readonly country?: {
    readonly legalCountry: string | null;
    readonly jurisdictional: boolean;          // action depends on a country-specific VERIFIED rule/template
    readonly verified: boolean;                // a VERIFIED country rule/template exists (P8.12: currently false)
  };
  readonly access?: {
    readonly permissionGranted: boolean;       // base entitlement for the action
    readonly suspended?: boolean;              // user/company suspended
    readonly revoked?: boolean;                // permission revoked mid-flight
    readonly missing?: readonly string[];
  };
  readonly policyVersion?: string | null;
  readonly cloneadnVersion?: string | null;
};

export type CanonicalGovernanceDecision = {
  readonly version: "cg-1";
  readonly risk: CanonicalRisk;
  readonly decision: CanonicalDecision;
  readonly reasons: readonly string[];
  readonly appliedRules: readonly string[];
  readonly permissionsOk: boolean;
  readonly country: { legalCountry: string | null; jurisdictional: boolean; verified: boolean } | null;
  readonly autonomyRequested: AutonomyMode;
  readonly autonomyGranted: AutonomyMode;      // NEVER exceeds requested; clamped by the strictest layer
  readonly validationsRequired: boolean;
  readonly guardLevel: GuardLevel;
  readonly validationDecision: ValidationDecision;
  readonly policyVersion: string | null;
  readonly cloneadnVersion: string | null;
};

function guardContribution(level: GuardLevel): CanonicalDecision {
  switch (level) {
    case "black": return "human_only";
    case "red": return "require_validation";
    case "orange": return "allow_execute";
    case "green": return "allow_execute";
  }
}
function trustContribution(v: ValidationDecision): CanonicalDecision {
  switch (v) {
    case "BLOCK_AND_ESCALATE": return "human_only";
    case "HUMAN_APPROVAL_REQUIRED": return "require_validation";
    case "PREPARE_AND_OPTIONALLY_REVIEW": return "allow_prepare";
    case "EXECUTE_AND_NOTIFY": return "allow_execute";
    case "AUTO_EXECUTE": return "allow_execute";
  }
}

/**
 * Compose the canonical governance decision. Pure, deterministic, strictest-wins. The returned
 * `autonomyGranted` is clamped so it can never exceed `autonomyRequested`, and drops to `draft` whenever the
 * decision requires validation, escalation, blocking or refusal.
 */
export function decideCanonicalGovernance(input: CanonicalGovernanceInput): CanonicalGovernanceDecision {
  const guard = evaluateGuard({ action: input.action, risk: input.risk, sensitivity: input.sensitivity, text: input.text });
  const validation = decideValidation({
    mode: input.mode, action: input.action, risk: input.risk,
    sensitivity: input.sensitivity, external_side_effect: input.external_side_effect,
  });

  const reasons: string[] = [];
  const appliedRules: string[] = [`CloneGuard:${guard.level}`, `CloneTrust:${validation}`];

  let decision: CanonicalDecision = strictest(guardContribution(guard.level), trustContribution(validation));
  reasons.push(guard.explanation);

  // ── Access (permissions / suspension / revocation) — strictest ──
  let permissionsOk = true;
  if (input.access) {
    if (input.access.permissionGranted === false) {
      permissionsOk = false;
      decision = strictest(decision, "refuse");
      appliedRules.push("Access:permission_denied");
      reasons.push(`Permission manquante${input.access.missing?.length ? ` (${input.access.missing.join(", ")})` : ""} — action refusée.`);
    }
    if (input.access.suspended) {
      decision = strictest(decision, "block");
      appliedRules.push("Access:suspended");
      reasons.push("Utilisateur/entreprise suspendu — action bloquée.");
    }
    if (input.access.revoked) {
      decision = strictest(decision, "block");
      appliedRules.push("Access:revoked");
      reasons.push("Permission révoquée en cours — action bloquée.");
    }
  }

  // ── Country / policy (jurisdictional actions fail-closed) — strictest ──
  let country: CanonicalGovernanceDecision["country"] = null;
  if (input.country) {
    country = { legalCountry: input.country.legalCountry, jurisdictional: input.country.jurisdictional, verified: input.country.verified };
    if (input.country.jurisdictional) {
      if (input.country.legalCountry == null) {
        decision = strictest(decision, "block");
        appliedRules.push("ClonePolicy:country_required");
        reasons.push("Action juridictionnelle sans pays légal résolu — bloquée (aucun repli France).");
      } else if (!input.country.verified) {
        // A jurisdictional action cannot be autonomously finalized without a VERIFIED rule/template.
        decision = strictest(decision, "require_validation");
        appliedRules.push("ClonePolicy:country_not_verified");
        reasons.push(`Aucune règle vérifiée pour ${input.country.legalCountry} — validation humaine requise (jamais d'automatisation légale non vérifiée).`);
      }
    }
  }

  const risk: CanonicalRisk = input.risk === "critical" ? "critical" : (guard.level === "red" || guard.level === "black" || input.sensitivity !== "normal") ? "sensitive" : "normal";
  const validationsRequired = decision === "require_validation" || decision === "human_only";

  // autonomyGranted: never exceeds requested; drops to draft when not freely executable.
  const requestedOrd = AUTONOMY_ORDINAL[input.mode];
  const grantedOrd = decision === "allow_execute" ? requestedOrd : 0; // anything stricter than allow_execute ⇒ draft
  const autonomyGranted = (Object.keys(AUTONOMY_ORDINAL) as AutonomyMode[]).find((m) => AUTONOMY_ORDINAL[m] === Math.min(requestedOrd, grantedOrd)) ?? "draft";

  return {
    version: "cg-1",
    risk,
    decision,
    reasons,
    appliedRules,
    permissionsOk,
    country,
    autonomyRequested: input.mode,
    autonomyGranted,
    validationsRequired,
    guardLevel: guard.level,
    validationDecision: validation,
    policyVersion: input.policyVersion ?? null,
    cloneadnVersion: input.cloneadnVersion ?? null,
  };
}
