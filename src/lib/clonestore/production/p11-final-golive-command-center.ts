// src/lib/clonestore/production/p11-final-golive-command-center.ts
// P11 §7 — COMMAND CENTER go-live. Agrège la porte P10 + la readiness finale P11 en un statut
// global + drapeaux d'autorisation + message sûr. FAIL-CLOSED : ne renvoie JAMAIS LAUNCHED sans
// preuve de déploiement, ni OWNER_APPROVED sans artefact owner ET 0 bloqueur. Production off.

import { evaluateP11FinalGoLiveReadiness, type P11Env } from "./p11-final-golive-readiness";
import { evaluateP10ProductionGate } from "./p10-production-gate";

export type GoLiveGlobalStatus =
  | "NOT_READY"
  | "READY_FOR_OWNER_REVIEW"
  | "OWNER_APPROVED_READY_TO_LAUNCH"
  | "LAUNCHED";

export interface P11CommandCenterReport {
  readonly globalStatus: GoLiveGlobalStatus;
  readonly publicLaunchAllowed: boolean;
  readonly privatePilotAllowed: boolean;
  readonly paidCustomerAllowed: boolean;
  readonly blockersCount: number;
  readonly warningsCount: number;
  readonly nextActions: string[];
  readonly missingProofs: string[];
  readonly ownerApprovalRequired: boolean;
  readonly productionAuthorized: boolean;
  readonly safeMessage: string;
  readonly dimensions: {
    readonly stripeLive: boolean;
    readonly countryReconciliation: boolean;
    readonly legalTax: boolean;
    readonly provider: boolean;
    readonly deployment: boolean;
    readonly monitoring: boolean;
    readonly ownerApproval: boolean;
  };
  readonly p10GateOk: boolean;
  readonly finalVerdict: ReturnType<typeof evaluateP11FinalGoLiveReadiness>["finalVerdict"];
}

export function evaluateP11CommandCenter(env: P11Env = process.env): P11CommandCenterReport {
  const p11 = evaluateP11FinalGoLiveReadiness(env);
  const p10 = evaluateP10ProductionGate(env);

  const blockers = p11.blockers;
  const blockersCount = blockers.length;
  const warningsCount = p11.warnings.length;

  // Un déploiement effectif exige une PREUVE de déploiement (attestation owner). Jamais LAUNCHED sinon.
  const deployProof = p11.deploymentReadiness.ready;
  const ownerApproved = p11.ownerApprovalReadiness.artifactPresent;

  let globalStatus: GoLiveGlobalStatus;
  if (!p11.externalTechnicalReady) {
    globalStatus = "NOT_READY";                       // des items externes/techniques manquent
  } else if (!ownerApproved) {
    globalStatus = "READY_FOR_OWNER_REVIEW";          // tout l'externe est prêt ; manque le sign-off owner
  } else if (!(deployProof && p11.productionAuthorized)) {
    // Approuvé ; LAUNCHED exige EN PLUS une preuve de déploiement ET le plancher dur P10
    // (productionAuthorized) → non atteignable par des flags env tant que la const P10 est false.
    globalStatus = "OWNER_APPROVED_READY_TO_LAUNCH";
  } else {
    globalStatus = "LAUNCHED";                         // déploiement + production réellement autorisée
  }

  const missingProofs: string[] = [];
  if (!p11.stripeLiveReadiness.liveApiVerified) missingProofs.push("Vérification Stripe LIVE (prices EUR/CHF actifs, mensuels, montants exacts) — dry-run owner.");
  if (!p11.legalTaxReadiness.legalTaxReady) missingProofs.push("Revue juridique + fiscale/TVA externe FR/BE/LU/CH.");
  if (!p11.providerReadiness.ready) missingProofs.push("Signature/Yousign LIVE (P8.7.4 à lever) + webhook signature vérifié.");
  if (!p11.countryReconciliationReadiness.liveDataVerified) missingProofs.push("Réconciliation pays vérifiée sur données de paiement LIVE.");
  if (!p11.monitoringReadiness.ready) missingProofs.push("Plan monitoring + rollback vérifié.");
  if (!p11.deploymentReadiness.ready) missingProofs.push("Autorisation + preuve de déploiement.");
  if (!p11.ownerApprovalReadiness.artifactPresent) missingProofs.push("Artefact d'approbation owner (sign-off go-live).");

  const productionAuthorized = p11.productionAuthorized; // dérivé, false
  const launchAllowed = globalStatus === "LAUNCHED";

  const safeMessage = globalStatus === "NOT_READY"
    ? "Go-live NON prêt : des éléments externes (Stripe live, légal/fiscal, provider signature, monitoring) et le sign-off owner manquent. La readiness TECHNIQUE P11 est en place ; la production reste désactivée."
    : globalStatus === "READY_FOR_OWNER_REVIEW"
      ? "Techniquement prêt ; en attente du sign-off owner. Production toujours désactivée."
      : globalStatus === "OWNER_APPROVED_READY_TO_LAUNCH"
        ? "Owner a approuvé et 0 bloqueur : prêt à déployer (le déploiement reste une action explicite séparée)."
        : "Lancé.";

  return {
    globalStatus,
    publicLaunchAllowed: launchAllowed,
    privatePilotAllowed: launchAllowed, // rien de live tant que non lancé
    paidCustomerAllowed: launchAllowed,
    blockersCount,
    warningsCount,
    nextActions: p11.requiredActions,
    missingProofs,
    ownerApprovalRequired: !p11.ownerApprovalReadiness.artifactPresent,
    productionAuthorized,
    safeMessage,
    dimensions: {
      stripeLive: p11.stripeLiveReadiness.ready,
      countryReconciliation: p11.countryReconciliationReadiness.ready,
      legalTax: p11.legalTaxReadiness.ready,
      provider: p11.providerReadiness.ready,
      deployment: p11.deploymentReadiness.ready,
      monitoring: p11.monitoringReadiness.ready,
      ownerApproval: p11.ownerApprovalReadiness.artifactPresent,
    },
    p10GateOk: p10.ok,
    finalVerdict: p11.finalVerdict,
  };
}
