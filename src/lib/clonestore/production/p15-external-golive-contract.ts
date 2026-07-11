// src/lib/clonestore/production/p15-external-golive-contract.ts
// P15 §2 — CONTRAT officiel de clôture go-live. Agrège les 7 portes (A Stripe live · B webhook ·
// C réconciliation pays câblée · D légal/fiscal · E provider/Yousign · F monitoring/rollback · G
// approbation owner) en un statut + drapeaux d'autorisation. FAIL-CLOSED. Respecte le PLANCHER DUR
// P10 (PRODUCTION_AUTHORIZED) : la production ne peut JAMAIS être autorisée par des flags env seuls.
// Ne fait AUCUN appel Stripe, ne crée AUCun paiement, n'active AUCune production par défaut.

import { evaluateStripeLiveReadiness, evaluateWebhookReadiness } from "./p15-stripe-live-verification";
import { evaluateLegalTaxArtifactRegistry, legalTaxLaunchDecision, type LegalTaxArtifact } from "./p15-legal-tax-artifact-registry";
import { evaluateProviderClosure } from "./p15-provider-closure";
import { evaluateMonitoringRollback } from "./p15-monitoring-rollback";
import { PRODUCTION_AUTHORIZED as P10_PRODUCTION_AUTHORIZED } from "./p10-production-gate";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };
const present = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;
export type GoLiveEnv = Record<string, string | undefined>;

export type P15GoLiveStatus =
  | "NOT_READY"
  | "TECHNICAL_READY_EXTERNAL_BLOCKED"
  | "OWNER_REVIEW_REQUIRED"
  | "READY_FOR_PRODUCTION_AUTHORIZATION"
  | "PRODUCTION_AUTHORIZED"
  | "LAUNCHED";

export const P15_GO_LIVE_GATES = [
  { id: "A", key: "stripe_live", title: "Stripe live (prix EUR 44900 / CHF 49900, mensuels, actifs, vérifiés)", required: true },
  { id: "B", key: "webhook", title: "Webhook Stripe live (signature vérifiée, idempotent)", required: true },
  { id: "C", key: "reconciliation", title: "Réconciliation pays câblée dans l'activation + vérifiée live", required: true },
  { id: "D", key: "legal_tax", title: "Artefacts légaux/fiscaux FR/BE/LU/CH revus/attestés", required: true },
  { id: "E", key: "provider", title: "Provider signature live OU repli officiel approuvé", required: true },
  { id: "F", key: "monitoring", title: "Monitoring / rollback prêt et attesté", required: true },
  { id: "G", key: "owner_approval", title: "Artefact d'approbation owner explicite", required: true },
] as const;
export type P15GateKey = (typeof P15_GO_LIVE_GATES)[number]["key"];

export const P15_BLOCKER_CODES = {
  STRIPE_LIVE_NOT_VERIFIED: "STRIPE_LIVE_NOT_VERIFIED",
  WEBHOOK_NOT_VERIFIED: "WEBHOOK_NOT_VERIFIED",
  RECONCILIATION_NOT_WIRED: "RECONCILIATION_NOT_WIRED",
  RECONCILIATION_NOT_LIVE_VERIFIED: "RECONCILIATION_NOT_LIVE_VERIFIED",
  LEGAL_TAX_ARTIFACTS_MISSING: "LEGAL_TAX_ARTIFACTS_MISSING",
  PROVIDER_OR_FALLBACK_MISSING: "PROVIDER_OR_FALLBACK_MISSING",
  MONITORING_ROLLBACK_NOT_READY: "MONITORING_ROLLBACK_NOT_READY",
  OWNER_APPROVAL_MISSING: "OWNER_APPROVAL_MISSING",
  P10_HARD_FLOOR: "P10_PRODUCTION_HARD_FLOOR_FALSE",
} as const;
export type P15BlockerCode = (typeof P15_BLOCKER_CODES)[keyof typeof P15_BLOCKER_CODES];

export interface OwnerApprovalArtifact {
  readonly present: boolean;
  readonly signer: string | null;
  readonly decision: "approve_production" | "reject" | "private_pilot_only" | "demo_only" | null;
  readonly acknowledged: {
    readonly countries: boolean; readonly pricing: boolean; readonly legalTax: boolean;
    readonly provider: boolean; readonly stripeLive: boolean; readonly rollback: boolean;
  } | null;
  readonly explicitRiskStatement: boolean;
}

export interface P15GoLiveInput {
  readonly env?: GoLiveEnv;
  readonly legalArtifacts?: readonly LegalTaxArtifact[];
  readonly legalOwnerAcceptedWithDisclosedRisk?: boolean;
  readonly ownerApproval?: OwnerApprovalArtifact;
  readonly nowMs?: number;
  /** Le gate de réconciliation est-il câblé dans le webhook ? (invariant de code : true). */
  readonly reconciliationWired?: boolean;
}

export interface P15GateResult { readonly key: P15GateKey; readonly title: string; readonly pass: boolean; readonly blockers: string[]; readonly detail: Record<string, unknown> }

export interface P15ExternalGoLiveResult {
  readonly status: P15GoLiveStatus;
  readonly gates: P15GateResult[];
  readonly allExternalGatesPass: boolean;
  readonly technicalReady: boolean;
  readonly ownerApproved: boolean;
  readonly productionAuthorizationAllowed: boolean;   // exige TOUT + plancher P10
  readonly publicPaidLaunchAllowed: boolean;
  readonly privatePilotAllowed: boolean;
  readonly demoOnlyAllowed: boolean;
  readonly p10HardFloor: boolean;                      // = P10 const (false)
  readonly blockerCodes: P15BlockerCode[];
  readonly note: string;
}

function readOwnerApproval(input: P15GoLiveInput): OwnerApprovalArtifact {
  if (input.ownerApproval) return input.ownerApproval;
  const env = input.env ?? process.env;
  // Depuis l'env owner (fail-closed) : approuvé UNIQUEMENT si flag + signataire + décision explicites.
  const approved = flagOn(env.CLONESTORE_OWNER_GOLIVE_APPROVED);
  const signer = env.CLONESTORE_OWNER_GOLIVE_APPROVED_BY ?? null;
  const decisionRaw = (env.CLONESTORE_OWNER_GOLIVE_DECISION ?? "").trim();
  const decision = (["approve_production", "reject", "private_pilot_only", "demo_only"].includes(decisionRaw) ? decisionRaw : null) as OwnerApprovalArtifact["decision"];
  const artifactPresent = approved && present(signer ?? undefined) && decision !== null;
  return {
    present: artifactPresent, signer: artifactPresent ? signer : null, decision: artifactPresent ? decision : null,
    acknowledged: artifactPresent ? { countries: true, pricing: true, legalTax: true, provider: true, stripeLive: true, rollback: true } : null,
    explicitRiskStatement: flagOn(env.CLONESTORE_OWNER_GOLIVE_RISK_ACK),
  };
}

/** Évalue les 7 portes A–G. FAIL-CLOSED. Pur (lit env + entrées). */
export function evaluateP15ExternalGoLive(input: P15GoLiveInput = {}): P15ExternalGoLiveResult {
  const env = input.env ?? process.env;
  const gates: P15GateResult[] = [];
  const blockerCodes: P15BlockerCode[] = [];

  // A — Stripe live
  const stripe = evaluateStripeLiveReadiness(env);
  gates.push({ key: "stripe_live", title: "Stripe live", pass: stripe.ready, blockers: stripe.blockers, detail: { mode: stripe.mode, liveApiVerified: stripe.liveApiVerified, eur: stripe.eurPriceConfigured, chf: stripe.chfPriceConfigured } });
  if (!stripe.ready) blockerCodes.push(P15_BLOCKER_CODES.STRIPE_LIVE_NOT_VERIFIED);

  // B — Webhook
  const webhook = evaluateWebhookReadiness(env);
  gates.push({ key: "webhook", title: "Webhook", pass: webhook.ready, blockers: webhook.blockers, detail: { secretPresent: webhook.secretPresent, signatureEnforced: webhook.signatureEnforced, idempotent: webhook.idempotent } });
  if (!webhook.ready) blockerCodes.push(P15_BLOCKER_CODES.WEBHOOK_NOT_VERIFIED);

  // C — Réconciliation câblée + vérifiée live
  const reconciliationWired = input.reconciliationWired !== false; // invariant de code : câblé dans le webhook
  const reconciliationEnabled = flagOn(env.STRIPE_COUNTRY_RECONCILIATION_ENABLED);
  const reconciliationLiveVerified = flagOn(env.CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED);
  const reconPass = reconciliationWired && reconciliationEnabled && reconciliationLiveVerified;
  const reconBlockers: string[] = [];
  if (!reconciliationWired) reconBlockers.push("Gate de réconciliation NON câblé dans le webhook.");
  if (!reconciliationEnabled) reconBlockers.push("STRIPE_COUNTRY_RECONCILIATION_ENABLED désactivé — le gate n'applique pas encore le blocage en prod.");
  if (!reconciliationLiveVerified) reconBlockers.push("Réconciliation NON vérifiée sur données de paiement LIVE (CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED absent).");
  gates.push({ key: "reconciliation", title: "Réconciliation pays", pass: reconPass, blockers: reconBlockers, detail: { wired: reconciliationWired, enabled: reconciliationEnabled, liveVerified: reconciliationLiveVerified } });
  if (!reconciliationWired) blockerCodes.push(P15_BLOCKER_CODES.RECONCILIATION_NOT_WIRED);
  else if (!reconPass) blockerCodes.push(P15_BLOCKER_CODES.RECONCILIATION_NOT_LIVE_VERIFIED);

  // D — Légal/fiscal
  const registry = evaluateLegalTaxArtifactRegistry(input.legalArtifacts ?? [], { nowMs: input.nowMs });
  const legalDecision = legalTaxLaunchDecision(registry, input.legalOwnerAcceptedWithDisclosedRisk ?? false);
  gates.push({ key: "legal_tax", title: "Légal/fiscal", pass: legalDecision.allowed, blockers: legalDecision.allowed ? [] : [legalDecision.reason], detail: { mode: legalDecision.mode, externallyReviewed: registry.externallyReviewedCount, missing: registry.missing.length, ownerAttestedOnly: registry.ownerAttestedOnly.length } });
  if (!legalDecision.allowed) blockerCodes.push(P15_BLOCKER_CODES.LEGAL_TAX_ARTIFACTS_MISSING);

  // E — Provider / Yousign
  const provider = evaluateProviderClosure(env as NodeJS.ProcessEnv);
  gates.push({ key: "provider", title: "Provider signature", pass: provider.publicPaidLaunchAllowed, blockers: provider.publicPaidLaunchAllowed ? [] : provider.blockers, detail: { status: provider.status, liveSignatureClaimAllowed: provider.liveSignatureClaimAllowed } });
  if (!provider.publicPaidLaunchAllowed) blockerCodes.push(P15_BLOCKER_CODES.PROVIDER_OR_FALLBACK_MISSING);

  // F — Monitoring / rollback
  const monitoring = evaluateMonitoringRollback(env);
  gates.push({ key: "monitoring", title: "Monitoring/rollback", pass: monitoring.ready, blockers: monitoring.blockers, detail: { structural: monitoring.structuralAllPresent, ownerVerified: monitoring.ownerVerified } });
  if (!monitoring.ready) blockerCodes.push(P15_BLOCKER_CODES.MONITORING_ROLLBACK_NOT_READY);

  // G — Approbation owner
  const owner = readOwnerApproval(input);
  const ownerApproved = owner.present && owner.decision === "approve_production";
  gates.push({ key: "owner_approval", title: "Approbation owner", pass: ownerApproved, blockers: ownerApproved ? [] : ["Artefact d'approbation owner (approve_production) absent."], detail: { present: owner.present, decision: owner.decision } });
  if (!ownerApproved) blockerCodes.push(P15_BLOCKER_CODES.OWNER_APPROVAL_MISSING);

  // Le gate de réconciliation est câblé (invariant de code) → la couche TECHNIQUE est prête.
  const technicalReady = reconciliationWired && webhook.routeExists;
  const externalGateKeys: P15GateKey[] = ["stripe_live", "webhook", "reconciliation", "legal_tax", "provider", "monitoring"];
  const allExternalGatesPass = gates.filter((g) => externalGateKeys.includes(g.key)).every((g) => g.pass);

  const p10HardFloor = P10_PRODUCTION_AUTHORIZED; // false
  // Autorisation de production : TOUTES les portes + owner + plancher dur P10 (jamais par flags env seuls).
  const productionAuthorizationAllowed = allExternalGatesPass && ownerApproved && p10HardFloor;
  const deployProof = flagOn(env.CLONESTORE_DEPLOY_PROOF);

  let status: P15GoLiveStatus;
  if (!technicalReady) status = "NOT_READY";
  else if (!allExternalGatesPass) status = "TECHNICAL_READY_EXTERNAL_BLOCKED";
  else if (!ownerApproved) status = "OWNER_REVIEW_REQUIRED";
  else if (!p10HardFloor) status = "READY_FOR_PRODUCTION_AUTHORIZATION"; // owner OK + external OK, mais plancher P10 bloque
  else if (!deployProof) status = "PRODUCTION_AUTHORIZED";
  else status = "LAUNCHED";

  const publicPaidLaunchAllowed = status === "LAUNCHED";
  const demoOnlyAllowed = true; // le produit non-live reste démontrable
  // Pilote privé : seulement si owner l'a choisi ET aucun paiement live (production non autorisée).
  const privatePilotAllowed = owner.decision === "private_pilot_only" && !publicPaidLaunchAllowed;

  return {
    status, gates, allExternalGatesPass, technicalReady, ownerApproved,
    productionAuthorizationAllowed, publicPaidLaunchAllowed, privatePilotAllowed, demoOnlyAllowed,
    p10HardFloor, blockerCodes,
    note: "FAIL-CLOSED. La production ne peut JAMAIS être autorisée par des flags env seuls : le plancher dur P10 (PRODUCTION_AUTHORIZED const) exige un changement de code délibéré de l'owner. Aucun appel Stripe live, aucun paiement, aucun déploiement.",
  };
}

/** Statut de lancement (alias direct). Pur. */
export function computeP15LaunchStatus(input: P15GoLiveInput = {}): P15GoLiveStatus {
  return evaluateP15ExternalGoLive(input).status;
}

/** La production peut-elle être autorisée ? Exige toutes les portes + owner + plancher dur P10. Pur. */
export function canAuthorizeProduction(input: P15GoLiveInput = {}): boolean {
  return evaluateP15ExternalGoLive(input).productionAuthorizationAllowed;
}

/** Explique les bloqueurs restants (codes + libellés). Pur. */
export function explainP15Blockers(result: P15ExternalGoLiveResult): { code: P15BlockerCode | string; gate: string; blockers: string[] }[] {
  const out: { code: P15BlockerCode | string; gate: string; blockers: string[] }[] = [];
  for (const g of result.gates) if (!g.pass) out.push({ code: `GATE_${g.key.toUpperCase()}`, gate: g.title, blockers: g.blockers });
  if (!result.p10HardFloor) out.push({ code: P15_BLOCKER_CODES.P10_HARD_FLOOR, gate: "Plancher dur P10", blockers: ["PRODUCTION_AUTHORIZED = false as const — changement de code owner requis (jamais par env)."] });
  return out;
}
