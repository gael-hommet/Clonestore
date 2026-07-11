// src/lib/clonestore/integration/p16c/p16c-governance-pipeline.ts
// P16C — LE PIPELINE DE GOUVERNANCE. Calcule l'état effectif comme le PLUS STRICT de TOUS les gates
// (fail-closed) : disposition Pierre · permission · human-only Pierre · legal · provider · CloneGuard ·
// ClonePolicy · CloneTrust · clarification · must-not-claim payroll · statut T1/T2 · production.
// PRÉCÉDENCE (le plus strict gagne) :
//   PERMISSION_BLOCKED > HUMAN_ONLY > UNSUPPORTED > LEGAL_BLOCKED > PROVIDER_BLOCKED >
//   VALIDATION_REQUIRED > PREPARE_LOCAL > PROPOSE > READ_ONLY > LOCAL_EXECUTION_ALLOWED.
// AUCUN gate ne peut ABAISSER une décision plus stricte (on prend toujours le max). L'exécution locale
// n'existe QUE si TOUS les gates l'autorisent. Aucun effet externe n'est jamais autorisé (externallyExecutable=false).
// Module PUR : entièrement testable sans I/O.

import type { P16ADisposition } from "@/lib/pierre/v1/ultimate/p16a";
import type {
  P16CGovernanceState, P16CGovernanceDecision, P16CGovernanceContribution,
} from "./p16c-types";
import type { CloneGuardActionDecision } from "@/lib/clonestore/product-technologies/t2";
import type { AutonomyLevel } from "@/lib/clonestore/product-technologies/t2";

// Rang de STRICTESSE (plus haut = plus strict = moins permis). LOCAL_EXECUTION_ALLOWED est le moins strict.
const STRICTNESS: Readonly<Record<P16CGovernanceState, number>> = {
  PERMISSION_BLOCKED: 90,
  HUMAN_ONLY: 80,
  UNSUPPORTED: 75,
  LEGAL_BLOCKED: 70,
  PROVIDER_BLOCKED: 60,
  VALIDATION_REQUIRED: 50,
  PREPARE_LOCAL: 40,
  PROPOSE: 30,
  READ_ONLY: 20,
  LOCAL_EXECUTION_ALLOWED: 10,
};

export function strictnessOf(state: P16CGovernanceState): number {
  return STRICTNESS[state];
}

/** Le plus strict des deux états (jamais l'inverse — fail-closed). Pur. */
export function strictest(a: P16CGovernanceState, b: P16CGovernanceState): P16CGovernanceState {
  return STRICTNESS[a] >= STRICTNESS[b] ? a : b;
}

const DISPOSITION_TO_STATE: Readonly<Record<P16ADisposition, P16CGovernanceState>> = {
  read_explain: "READ_ONLY",
  execute_local: "LOCAL_EXECUTION_ALLOWED",
  propose: "PROPOSE",
  prepare: "PREPARE_LOCAL",
  validation_required: "VALIDATION_REQUIRED",
  provider_blocked: "PROVIDER_BLOCKED",
  human_only: "HUMAN_ONLY",
  refused_unsupported: "UNSUPPORTED",
};

const TRUST_TO_STATE: Readonly<Record<AutonomyLevel, P16CGovernanceState | null>> = {
  human_only: "HUMAN_ONLY",
  prepare_only: "PREPARE_LOCAL",
  suggest: "PROPOSE",
  execute_with_validation: "VALIDATION_REQUIRED",
  autonomous_safe: null, // aucun floor — l'exécution locale reste permise
};

export interface P16CGovernanceInput {
  readonly disposition: P16ADisposition;
  readonly permissionDenied: boolean;
  readonly permissionReason?: string;
  readonly humanOnly: boolean;
  readonly humanOnlyReasons: readonly string[];
  readonly legalDependencies: readonly string[];
  readonly providerDependencies: readonly string[];
  readonly clarificationBlocks: boolean;
  readonly mustNotClaimPayroll: boolean;
  // Décisions T2 réelles (issues de l'orchestrateur) — optionnelles (peuvent être injectées en test).
  readonly guardDecision?: CloneGuardActionDecision | null;
  readonly guardRisk?: "normal" | "sensitive" | "critical" | null;
  readonly guardFinalLegal?: boolean;
  readonly policyDecision?: "allow_prepare" | "require_validation" | "escalate" | "block" | null;
  readonly trustAutonomyLevel?: AutonomyLevel | null;
  // Statut T1 : une permission T1 refusée est un blocage de permission dur.
  readonly t1PermissionDenied?: boolean;
  readonly t1PermissionReason?: string;
  readonly t1UnknownOrBlocked?: boolean;
  // FAIL-CLOSED : CloneOS a bloqué le run par gouvernance (guard/policy null ou refus) — même si
  // aucune décision n'est exploitable (artefact null), on impose AU MOINS une validation humaine.
  readonly cloneOsBlockedByGovernance?: boolean;
}

/**
 * Calcule l'état de gouvernance effectif = le plus strict de tous les gates (fail-closed). Pur.
 * Chaque gate contribue au plus un floor ; on prend le max. Aucun gate n'abaisse un gate plus strict.
 */
export function computeGovernanceState(input: P16CGovernanceInput): P16CGovernanceDecision {
  const contributions: P16CGovernanceContribution[] = [];
  const add = (gate: P16CGovernanceContribution["gate"], state: P16CGovernanceState, reason: string) =>
    contributions.push({ gate, state, reason });

  // 0) Base : disposition de Pierre (autorité RH).
  const base = DISPOSITION_TO_STATE[input.disposition];
  add("pierre_disposition", base, `Disposition Pierre: ${input.disposition}.`);

  // 1) Permission (le plus strict). Une entité interdite / permission T1 refusée → blocage dur.
  if (input.permissionDenied) add("permission", "PERMISSION_BLOCKED", input.permissionReason ?? "Permission refusée (fail-closed).");
  if (input.t1PermissionDenied) add("t1_status", "PERMISSION_BLOCKED", input.t1PermissionReason ?? "Permission T1 refusée (fail-closed).");
  if (input.t1UnknownOrBlocked) add("t1_status", "PERMISSION_BLOCKED", "Technologie T1 inconnue/bloquée — refus fail-closed.");

  // 2) Human-only Pierre (jamais abaissé).
  if (input.humanOnly) add("pierre_human_only", "HUMAN_ONLY", `Décision finale humaine requise: ${input.humanOnlyReasons.join(", ") || "sensible"}.`);

  // 3) Legal / provider (Pierre a déclaré la dépendance — préservée telle quelle).
  if (input.legalDependencies.length > 0) add("legal", "LEGAL_BLOCKED", `Dépendance légale/pays: ${input.legalDependencies.slice(0, 3).join("; ")}.`);
  if (input.providerDependencies.length > 0) add("provider", "PROVIDER_BLOCKED", `Provider live requis (indisponible): ${input.providerDependencies.slice(0, 3).join("; ")}.`);

  // 4) CloneGuard (peut ÉLEVER la restriction, jamais l'abaisser).
  const guard = input.guardDecision ?? null;
  if (guard === "refuse") add("cloneguard", "HUMAN_ONLY", "CloneGuard refuse : décision réservée à l'humain.");
  else if (guard === "block") add("cloneguard", "VALIDATION_REQUIRED", "CloneGuard bloque : validation humaine requise.");
  else if (guard === "require_validation") add("cloneguard", "VALIDATION_REQUIRED", `CloneGuard exige une validation (risque ${input.guardRisk ?? "sensitive"}).`);

  // 5) ClonePolicy (règles d'entreprise — jamais au-dessus de la loi/human-only, mais peut exiger validation/bloquer).
  const policy = input.policyDecision ?? null;
  if (policy === "block") add("clonepolicy", "VALIDATION_REQUIRED", "ClonePolicy bloque (canal/fenêtre) — résolution humaine requise.");
  else if (policy === "require_validation") add("clonepolicy", "VALIDATION_REQUIRED", "ClonePolicy exige une validation humaine.");
  else if (policy === "escalate") add("clonepolicy", "VALIDATION_REQUIRED", "ClonePolicy escalade — validation humaine requise.");

  // 6) CloneTrust (peut RÉDUIRE l'autonomie = élever la strictesse ; jamais l'augmenter au-delà des floors).
  if (input.trustAutonomyLevel) {
    const st = TRUST_TO_STATE[input.trustAutonomyLevel];
    if (st) add("clonetrust", st, `CloneTrust plafonne l'autonomie à « ${input.trustAutonomyLevel} ».`);
  }

  // 6bis) CloneOS a bloqué le run par gouvernance (fail-closed, même sans décision exploitable).
  if (input.cloneOsBlockedByGovernance) add("cloneos", "VALIDATION_REQUIRED", "CloneOS a bloqué le run par gouvernance — validation humaine requise (fail-closed).");

  // 7) Clarification manquante bloquante → validation requise.
  if (input.clarificationBlocks) add("clarification", "VALIDATION_REQUIRED", "Information obligatoire manquante — clarification requise.");

  // 8) must-not-claim payroll → préparation locale uniquement (jamais un moteur de paie).
  if (input.mustNotClaimPayroll) add("must_not_claim_payroll", "PREPARE_LOCAL", "Pré-paie préparée uniquement — jamais un moteur de paie/DSN.");

  // 9) Production : ne bloque pas l'exécution LOCALE mais interdit tout effet externe (externallyExecutable=false).
  add("production", base, "Production OFF — aucun effet externe/live autorisé (externallyExecutable=false).");

  // ── L'état effectif = le plus strict de toutes les contributions (max). ──
  let effectiveState: P16CGovernanceState = base;
  let decidedBy: P16CGovernanceContribution["gate"] = "pierre_disposition";
  for (const c of contributions) {
    if (c.gate === "production") continue; // informatif — ne modifie pas l'état local
    if (STRICTNESS[c.state] > STRICTNESS[effectiveState]) {
      effectiveState = c.state;
      decidedBy = c.gate;
    }
  }

  const executableLocally = effectiveState === "LOCAL_EXECUTION_ALLOWED";

  const BLOCKING: readonly P16CGovernanceState[] = [
    "PERMISSION_BLOCKED", "HUMAN_ONLY", "UNSUPPORTED", "LEGAL_BLOCKED", "PROVIDER_BLOCKED", "VALIDATION_REQUIRED",
  ];
  const exactBlockers = contributions
    .filter((c) => c.gate !== "production" && BLOCKING.includes(c.state))
    .map((c) => `[${c.state}] ${c.reason}`);

  return {
    effectiveState,
    decidedBy,
    contributions,
    executableLocally,
    externallyExecutable: false,
    exactBlockers,
  };
}
