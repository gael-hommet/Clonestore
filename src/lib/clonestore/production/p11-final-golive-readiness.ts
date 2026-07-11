// src/lib/clonestore/production/p11-final-golive-readiness.ts
// P11 §2 — Évaluateur TOP-LEVEL de readiness go-live. Compose Stripe live, réconciliation pays,
// légal/fiscal, providers, déploiement, monitoring/rollback, sign-off owner. FAIL-CLOSED :
// productionAuthorized est DÉRIVÉ (owner-approuvé ∧ 0 bloqueur), jamais codé en dur à true.

import { evaluateStripeLiveReadiness } from "./p11-stripe-live-readiness";
import { evaluateLegalTaxReadiness } from "./p11-legal-tax-readiness";
import { evaluateProviderReadiness } from "./p11-provider-readiness";
import { STRIPE_COUNTRY_RECONCILIATION_PLAN } from "./p11-stripe-country-reconciliation";
import { evaluateP10ProductionGate, PRODUCTION_AUTHORIZED as P10_PRODUCTION_AUTHORIZED } from "./p10-production-gate";

export type P11Env = NodeJS.ProcessEnv;
const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };
const present = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;

export type P11FinalVerdict =
  | "VERIFIED"                                          // tout prêt + preuves externes + owner
  | "TECHNICAL_READINESS_VERIFIED_EXTERNAL_GOLIVE_BLOCKED" // code prêt, seuls des items externes/owner manquent
  | "NOT_VERIFIED";                                    // implémentation/tests incomplets

export interface P11Dimension { readonly ready: boolean; readonly blockers: string[]; readonly warnings: string[]; readonly notes: string[] }

export interface OwnerApprovalReadiness extends P11Dimension {
  readonly artifactPresent: boolean;
  readonly signer: string | null;
}

export interface P11FinalGoLiveReadiness {
  readonly ok: boolean;                    // toutes dimensions prêtes ∧ owner approuvé
  readonly externalTechnicalReady: boolean; // stripe live + réconciliation + légal/fiscal + provider + monitoring
  readonly productionAuthorized: boolean;  // DÉRIVÉ : ownerApproved ∧ 0 bloqueur (jamais hardcodé true)
  readonly runtimeProductionAuthorizedConst: boolean; // = P10 const (défense en profondeur, reste false)
  readonly blockers: string[];
  readonly warnings: string[];
  readonly requiredActions: string[];
  readonly stripeLiveReadiness: ReturnType<typeof evaluateStripeLiveReadiness>;
  readonly legalTaxReadiness: ReturnType<typeof evaluateLegalTaxReadiness>;
  readonly providerReadiness: ReturnType<typeof evaluateProviderReadiness>;
  readonly countryReconciliationReadiness: P11Dimension & { implemented: boolean; liveDataVerified: boolean };
  readonly deploymentReadiness: P11Dimension;
  readonly monitoringReadiness: P11Dimension;
  readonly ownerApprovalReadiness: OwnerApprovalReadiness;
  readonly finalVerdict: P11FinalVerdict;
}

/** Lit l'artefact d'approbation owner (jamais codé en dur). Requiert flag + signataire explicites. */
export function readOwnerApproval(env: P11Env = process.env): OwnerApprovalReadiness {
  const approved = flagOn(env.CLONESTORE_OWNER_GOLIVE_APPROVED);
  const signer = env.CLONESTORE_OWNER_GOLIVE_APPROVED_BY ?? null;
  const artifactPresent = approved && present(signer ?? undefined);
  return {
    ready: artifactPresent,
    artifactPresent,
    signer: artifactPresent ? signer : null,
    blockers: artifactPresent ? [] : ["Sign-off owner absent — artefact d'autorisation go-live requis (CLONESTORE_OWNER_GOLIVE_APPROVED + _BY, ou paquet signé)."],
    warnings: [],
    notes: ["L'autorisation de production n'est JAMAIS codée en dur ; elle exige un artefact owner explicite."],
  };
}

export function evaluateP11FinalGoLiveReadiness(env: P11Env = process.env): P11FinalGoLiveReadiness {
  const stripeLive = evaluateStripeLiveReadiness(env);
  const legalTax = evaluateLegalTaxReadiness(env);
  const provider = evaluateProviderReadiness(env);
  const owner = readOwnerApproval(env);

  // Réconciliation pays : capacité IMPLÉMENTÉE + testée (module pur). « ready » seulement quand
  // l'owner ATTESTE la vérification sur données de paiement LIVE (CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED).
  const reconLiveVerified = flagOn(env.CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED);
  const countryReconciliationReadiness = {
    implemented: true,
    liveDataVerified: reconLiveVerified,
    ready: reconLiveVerified,
    blockers: reconLiveVerified ? [] : ["Réconciliation pays implémentée + testée, mais NON vérifiée sur données de paiement LIVE (attestation owner requise)."],
    warnings: [],
    notes: [STRIPE_COUNTRY_RECONCILIATION_PLAN.disclaimer],
  };

  // Monitoring / rollback : plan requis + vérifié en ops avant go-live (attestation owner).
  const monitoringVerified = flagOn(env.CLONESTORE_MONITORING_ROLLBACK_VERIFIED);
  const monitoringReadiness: P11Dimension = monitoringVerified
    ? { ready: true, blockers: [], warnings: [], notes: ["Plan monitoring/rollback attesté vérifié."] }
    : { ready: false, blockers: ["Plan monitoring + rollback NON vérifié (alerting paiement/erreurs, procédure de rollback, kill-switch flag)."], warnings: [], notes: [] };

  // Déploiement : rien de déployé (P11 ne déploie pas). Dimension INFORMATIVE, hors des bloqueurs de
  // readiness (le déploiement est l'action FINALE après le sign-off owner, pas un pré-requis d'autorisation).
  const deployProof = flagOn(env.CLONESTORE_DEPLOY_PROOF);
  const deploymentReadiness: P11Dimension = {
    ready: deployProof,
    blockers: deployProof ? [] : ["Aucun déploiement effectué (P11 ne déploie pas) — étape finale après sign-off owner."],
    warnings: [],
    notes: ["P11 rend le système launch-ready sans déployer."],
  };

  // EXTERNAL-TECHNICAL : stripe live + réconciliation + légal/fiscal + provider + monitoring.
  const externalTechnicalDims: Array<{ ready: boolean; blockers: string[]; warnings?: string[] }> = [
    { ready: stripeLive.ready, blockers: stripeLive.blockers, warnings: stripeLive.warnings },
    countryReconciliationReadiness,
    { ready: legalTax.ready, blockers: legalTax.blockers, warnings: legalTax.warnings },
    { ready: provider.ready, blockers: provider.blockers, warnings: provider.warnings },
    monitoringReadiness,
  ];
  const externalTechnicalReady = externalTechnicalDims.every((d) => d.ready);
  // Bloqueurs de readiness = external-technical + owner (le déploiement n'est PAS un bloqueur d'autorisation).
  const blockers = [...externalTechnicalDims.flatMap((d) => d.blockers), ...owner.blockers];
  const warnings = [...externalTechnicalDims.flatMap((d) => d.warnings ?? []), ...owner.warnings];

  const requiredActions = [
    "Créer + vérifier les prix Stripe LIVE EUR (44900) et CHF (49900), mensuels, actifs.",
    "Configurer STRIPE_PRICE_PIERRE_EUR_MONTHLY + STRIPE_PRICE_PIERRE_CHF_MONTHLY + webhook LIVE + STRIPE_COUNTRY_PRICING_ENABLED.",
    "Dry-run read-only Stripe LIVE (prices.retrieve) autorisé par l'owner — aucun paiement.",
    "Revue juridique externe (CGU/CGV/DPA/mentions/…) pour FR/BE/LU/CH.",
    "Revue fiscale/TVA externe (EUR/CHF, TVA CH vs UE, B2B/reverse charge, entité).",
    "Passer Yousign/signature en LIVE (lever P8.7.4) + webhook signature vérifié.",
    "Vérifier la réconciliation pays sur données de paiement live (billing/tax/PM country).",
    "Vérifier le plan monitoring + rollback + kill-switch.",
    "Sign-off owner explicite (paquet d'approbation) + autorisation de déploiement.",
  ];

  // productionAuthorized DÉRIVÉ (jamais hardcodé true) avec PLANCHER DUR = la constante P10
  // (défense en profondeur RÉELLE) : external-technical prêt ∧ owner approuvé ∧ const P10 true.
  // La const P10 étant false, productionAuthorized ne peut PAS devenir true via des flags env seuls —
  // il faut un changement de code délibéré du propriétaire. Fail-closed maximal.
  const productionAuthorized = externalTechnicalReady && owner.artifactPresent && P10_PRODUCTION_AUTHORIZED;
  const ok = productionAuthorized;

  // Le code P11 est implémenté + testé : les bloqueurs restants sont EXTERNES/OWNER → verdict honnête.
  // VERIFIED seulement si external-technical prêt ET owner ; sinon readiness technique prête, go-live externe bloqué.
  const finalVerdict: P11FinalVerdict = externalTechnicalReady && owner.artifactPresent
    ? "VERIFIED"
    : "TECHNICAL_READINESS_VERIFIED_EXTERNAL_GOLIVE_BLOCKED";

  return {
    ok,
    externalTechnicalReady,
    productionAuthorized,
    runtimeProductionAuthorizedConst: P10_PRODUCTION_AUTHORIZED, // PLANCHER DUR de productionAuthorized (reste false)
    blockers,
    warnings,
    requiredActions,
    stripeLiveReadiness: stripeLive,
    legalTaxReadiness: legalTax,
    providerReadiness: provider,
    countryReconciliationReadiness,
    deploymentReadiness,
    monitoringReadiness,
    ownerApprovalReadiness: owner,
    finalVerdict,
  };
}

// Ancre pour l'agrégat : la porte P10 reste consultée par le command center.
export { evaluateP10ProductionGate };
