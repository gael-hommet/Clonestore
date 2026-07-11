// src/lib/clonestore/founder-acceptance/pierre-ultimate-coverage-evaluator.ts
// P14 §3 — Évaluateur de COUVERTURE. Applique des règles DÉTERMINISTES aux drapeaux de preuve de
// chaque exigence du catalogue pour produire un statut honnête. Module PUR. Ne marque JAMAIS
// legal/tax/pays VERIFIED sans preuve externe ; ne marque JAMAIS paie complète / décisions
// disciplinaires/légales/managériales finales comme couvertes ; ne prétend JAMAIS remplacer toute la RH.

import {
  PIERRE_ULTIMATE_VISION_REQUIREMENTS, PIERRE_ULTIMATE_GROUPS,
  type UltimateRequirement, type CoverageStatus, type EvidencePresent, type UltimateGroup,
} from "./pierre-ultimate-vision-catalog";

/** Overrides de preuve externe (par défaut : rien de prouvé → fail-closed honnête). */
export interface CoverageEvidenceOverride {
  readonly legalProof?: boolean;      // revue juridique externe FR/BE/LU/CH présente
  readonly providerLive?: boolean;    // signature/provider live vérifié
  readonly externalProof?: boolean;   // preuve externe (intégrations/email/etc.)
  readonly productionAuthorized?: boolean; // production autorisée (P10 const — reste false)
  /** Overrides ciblés par id d'exigence (rare). */
  readonly perRequirement?: Record<string, Partial<EvidencePresent>>;
}

export interface CoverageResult {
  readonly id: string;
  readonly group: UltimateGroup;
  readonly title: string;
  readonly status: CoverageStatus;
  readonly launch_importance: UltimateRequirement["launch_importance"];
  readonly claim_level: UltimateRequirement["claim_level"];
  readonly evidence_required: UltimateRequirement["evidence_required"];
  readonly sensitive: boolean;
  readonly reason: string;
  readonly provenBy: readonly string[];
}

const INTERNAL_KINDS = ["code", "test", "browser", "report"] as const;
/** VERIFIED = toutes les preuves INTERNES déclarées par l'exigence (code/test/browser/report) sont
 *  présentes. Ainsi une capacité d'infra (code+test+rapport) est VERIFIED sans navigateur, tandis
 *  qu'une feature RH gouvernée qui DÉCLARE avoir besoin d'une preuve navigateur reste PARTIAL. */
function internalRequiredMet(req: UltimateRequirement, ev: EvidencePresent): boolean {
  const required = req.evidence_required.filter((k) => (INTERNAL_KINDS as readonly string[]).includes(k));
  if (required.length === 0) return false; // aucune preuve interne déclarée → pas VERIFIED (au mieux ARCHITECTURE)
  return required.every((k) => !!(ev as Record<string, boolean | undefined>)[k]);
}

function mergedEvidence(req: UltimateRequirement, ov: CoverageEvidenceOverride): EvidencePresent {
  const per = ov.perRequirement?.[req.id] ?? {};
  return {
    ...req.evidence,
    ...(ov.legalProof !== undefined ? { legal: ov.legalProof } : {}),
    ...(ov.providerLive !== undefined ? { provider: ov.providerLive } : {}),
    ...(ov.externalProof !== undefined ? { external: ov.externalProof } : {}),
    ...per,
  };
}

/** Dérive le statut d'UNE exigence. Règles honnêtes, fail-closed sur externe/légal/provider. */
export function statusForRequirement(req: UltimateRequirement, ov: CoverageEvidenceOverride = {}): CoverageResult {
  const ev = mergedEvidence(req, ov);
  const needs = (k: string) => req.evidence_required.includes(k as never);

  let status: CoverageStatus;
  let reason: string;

  if (req.claim_level === "must_not_claim") {
    status = "MUST_NOT_CLAIM";
    reason = "Ne doit jamais être revendiqué commercialement (paie complète / décision finale sensible / conformité garantie / remplacement total RH / DRH autonome).";
  } else if (needs("legal") && !ev.legal) {
    status = "LEGAL_BLOCKED";
    reason = "Nécessite une validation juridique externe (absente) — jamais marqué conforme sans preuve externe.";
  } else if (needs("provider") && !ev.provider) {
    status = "PROVIDER_BLOCKED";
    reason = "Nécessite un provider live vérifié (ex. Yousign) — non live (P8.7.4).";
  } else if (needs("external") && !ev.external) {
    status = "EXTERNAL_BLOCKED";
    reason = "Nécessite une preuve/activation externe (absente).";
  } else if (ev.code && internalRequiredMet(req, ev) && (ev.test || ev.report || ev.browser)) {
    // VERIFIED exige code + TOUTES les preuves internes déclarées + AU MOINS une preuve réelle
    // (test/rapport/navigateur). Le code SEUL ne suffit jamais (ce serait ARCHITECTURE_READY) — même
    // avec un flag légal/externe : on ne fabrique pas un VERIFIED sur une simple existence de code.
    status = "VERIFIED";
    reason = "Toutes les preuves REQUISES par l'exigence sont présentes (code + les preuves déclarées : test/rapport et/ou navigateur).";
  } else if (ev.code && (ev.test || ev.report || ev.browser)) {
    status = "PARTIAL";
    reason = "Implémenté et prouvé partiellement (une preuve requise manque — souvent la preuve navigateur E2E dédiée).";
  } else if (ev.code) {
    status = "ARCHITECTURE_READY";
    reason = "Architecture/implémentation présente mais fonctionnalité non complète/non prouvée.";
  } else {
    status = "FUTURE_ROADMAP";
    reason = "Pas d'implémentation significative actuelle — roadmap.";
  }

  return {
    id: req.id, group: req.group, title: req.title, status,
    launch_importance: req.launch_importance, claim_level: req.claim_level,
    evidence_required: req.evidence_required,
    sensitive: req.sensitive, reason, provenBy: req.provenBy,
  };
}

/** Évalue TOUTES les exigences. Pur. */
export function evaluatePierreUltimateCoverage(evidence: CoverageEvidenceOverride = {}): CoverageResult[] {
  return PIERRE_ULTIMATE_VISION_REQUIREMENTS.map((r) => statusForRequirement(r, evidence));
}

export interface CoverageSummary {
  readonly total: number;
  readonly byStatus: Record<CoverageStatus, number>;
  readonly byGroup: Record<string, { total: number; statuses: Record<string, number> }>;
  readonly launchCritical: { total: number; verified: number; partial: number; blocked: number; mustNot: number; roadmap: number };
  readonly topVerified: string[];
  readonly topGaps: string[];   // launch-critical/important non-verified (hors must_not)
}

/** Résume les résultats de couverture. Pur. */
export function summarizePierreCoverage(results: CoverageResult[]): CoverageSummary {
  const byStatus = Object.create(null) as Record<CoverageStatus, number>;
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  const byGroup: CoverageSummary["byGroup"] = {};
  for (const r of results) {
    const g = (byGroup[r.group] ??= { total: 0, statuses: {} });
    g.total++; g.statuses[r.status] = (g.statuses[r.status] ?? 0) + 1;
  }

  const lc = results.filter((r) => r.launch_importance === "launch_critical");
  const isBlocked = (s: CoverageStatus) => s === "LEGAL_BLOCKED" || s === "PROVIDER_BLOCKED" || s === "EXTERNAL_BLOCKED";
  const launchCritical = {
    total: lc.length,
    verified: lc.filter((r) => r.status === "VERIFIED").length,
    partial: lc.filter((r) => r.status === "PARTIAL").length,
    blocked: lc.filter((r) => isBlocked(r.status)).length,
    mustNot: lc.filter((r) => r.status === "MUST_NOT_CLAIM").length,
    roadmap: lc.filter((r) => r.status === "FUTURE_ROADMAP" || r.status === "ARCHITECTURE_READY").length,
  };

  const topVerified = results.filter((r) => r.status === "VERIFIED").map((r) => r.title);
  const topGaps = results
    .filter((r) => (r.launch_importance === "launch_critical" || r.launch_importance === "important")
      && r.status !== "VERIFIED" && r.status !== "MUST_NOT_CLAIM")
    .map((r) => `${r.title} [${r.status}]`);

  return { total: results.length, byStatus, byGroup, launchCritical, topVerified, topGaps };
}

/** Matrice de vérité commerciale : ce qui est revendicable maintenant / avec prudence / interdit. Pur. */
export interface CommercialTruthMatrix {
  readonly claimNow: string[];              // VERIFIED + can_claim_now
  readonly claimWithCaution: string[];      // (VERIFIED|PARTIAL|ARCHITECTURE_READY) + can_claim_with_caution
  readonly cannotClaimYet: string[];        // blocked / roadmap / cannot_claim_yet
  readonly mustNotClaim: string[];          // MUST_NOT_CLAIM
}
export function computeCommercialTruthMatrix(results: CoverageResult[]): CommercialTruthMatrix {
  const claimNow: string[] = [], claimWithCaution: string[] = [], cannotClaimYet: string[] = [], mustNotClaim: string[] = [];
  for (const r of results) {
    if (r.status === "MUST_NOT_CLAIM" || r.claim_level === "must_not_claim") { mustNotClaim.push(r.title); continue; }
    if (r.claim_level === "can_claim_now" && r.status === "VERIFIED") { claimNow.push(r.title); continue; }
    if (r.claim_level === "can_claim_with_caution" && (r.status === "VERIFIED" || r.status === "PARTIAL" || r.status === "ARCHITECTURE_READY")) { claimWithCaution.push(r.title); continue; }
    cannotClaimYet.push(`${r.title} [${r.status}]`);
  }
  return { claimNow, claimWithCaution, cannotClaimYet, mustNotClaim };
}

/** Matrice de claims de LANCEMENT : les items launch_critical/important prêts vs bloquants. Pur.
 *  Règle dure : un item FUTURE_ROADMAP/ARCHITECTURE_READY n'est JAMAIS « launch verified ». */
export interface LaunchClaimMatrix {
  readonly launchVerified: string[];        // launch_critical/important + VERIFIED
  readonly launchCautious: string[];        // launch_critical/important + PARTIAL (claim with caution)
  readonly launchBlockers: string[];        // launch_critical + (blocked/roadmap) → à divulguer
  readonly forbiddenAtLaunch: string[];     // MUST_NOT_CLAIM
  readonly launchReady: boolean;            // aucun launch_critical VERIFIED manquant de façon bloquante
}
export function computeLaunchClaimMatrix(results: CoverageResult[]): LaunchClaimMatrix {
  const relevant = results.filter((r) => r.launch_importance === "launch_critical" || r.launch_importance === "important");
  const isRoadmap = (s: CoverageStatus) => s === "FUTURE_ROADMAP" || s === "ARCHITECTURE_READY";
  const isBlocked = (s: CoverageStatus) => s === "LEGAL_BLOCKED" || s === "PROVIDER_BLOCKED" || s === "EXTERNAL_BLOCKED";

  const launchVerified = relevant.filter((r) => r.status === "VERIFIED").map((r) => r.title);
  const launchCautious = relevant.filter((r) => r.status === "PARTIAL").map((r) => r.title);
  const launchBlockers = results
    .filter((r) => r.launch_importance === "launch_critical" && (isBlocked(r.status) || isRoadmap(r.status)))
    .map((r) => `${r.title} [${r.status}]`);
  const forbiddenAtLaunch = results.filter((r) => r.status === "MUST_NOT_CLAIM").map((r) => r.title);

  // launchReady = les piliers launch_critical NON sensibles-externes sont VERIFIED ; les bloquants
  // launch_critical restants sont uniquement des dépendances externes/légales/provider HONNÊTEMENT divulguées.
  const criticalCore = results.filter((r) => r.launch_importance === "launch_critical" && r.claim_level !== "must_not_claim"
    && !r.evidence_required.includes("legal") && !r.evidence_required.includes("provider") && !r.evidence_required.includes("external"));
  const launchReady = criticalCore.length > 0 && criticalCore.every((r) => r.status === "VERIFIED");

  return { launchVerified, launchCautious, launchBlockers, forbiddenAtLaunch, launchReady };
}
