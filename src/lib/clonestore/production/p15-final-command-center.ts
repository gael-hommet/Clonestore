// src/lib/clonestore/production/p15-final-command-center.ts
// P15 §9 — COMMAND CENTER final. Agrège les 7 portes P15 + la porte P10 (plancher dur) + le command
// center P11 + les contraintes de vérité commerciale P14, en un statut global + drapeaux + prochaines
// actions owner. FAIL-CLOSED : jamais LAUNCHED sans preuve de déploiement ; production jamais autorisée
// par des flags env seuls ; le produit démo-only reste possible sans rien de live.

import { evaluateP15ExternalGoLive, explainP15Blockers, type P15GoLiveInput, type P15GoLiveStatus } from "./p15-external-golive-contract";
import { evaluateP11CommandCenter } from "./p11-final-golive-command-center";
import { PRODUCTION_AUTHORIZED as P10_PRODUCTION_AUTHORIZED } from "./p10-production-gate";

/** Contraintes de vérité commerciale P14 qui doivent tenir au lancement (rappel non négociable). */
export const P15_COMMERCIAL_TRUTH_CONSTRAINTS: readonly string[] = [
  "Pierre = employé IA RH (jamais assistant/chatbot/copilote).",
  "Pierre absorbe la charge RH opérationnelle ; il ne remplace pas la responsabilité finale humaine/légale.",
  "Aucune revendication de moteur de paie / DSN.",
  "Aucune garantie de conformité légale/pays.",
  "Aucune revendication « production live / Stripe live / Yousign live » non vérifiée.",
];

export interface P15CommandCenterReport {
  readonly globalStatus: P15GoLiveStatus;
  readonly publicPaidLaunchAllowed: boolean;
  readonly privatePilotAllowed: boolean;
  readonly demoOnlyAllowed: boolean;
  readonly productionAuthorizationAllowed: boolean;
  readonly p10HardFloorRespected: boolean;
  readonly exactBlockers: { code: string; gate: string; blockers: string[] }[];
  readonly exactWarnings: string[];
  readonly requiredOwnerActions: string[];
  readonly nextStep: string;
  readonly gates: ReturnType<typeof evaluateP15ExternalGoLive>["gates"];
  readonly commercialTruthConstraints: readonly string[];
  readonly p11CrossCheck: { globalStatus: string; productionAuthorized: boolean };
  readonly safeMessage: string;
}

/** Rapport final agrégé. Pur (lit env + entrées). */
export function evaluateP15FinalCommandCenter(input: P15GoLiveInput = {}): P15CommandCenterReport {
  const p15 = evaluateP15ExternalGoLive(input);
  const p11 = evaluateP11CommandCenter(input.env as NodeJS.ProcessEnv | undefined);
  const exactBlockers = explainP15Blockers(p15);

  const requiredOwnerActions: string[] = [];
  const gate = (k: string) => p15.gates.find((g) => g.key === k);
  if (!gate("stripe_live")?.pass) requiredOwnerActions.push("Configurer les prix Stripe LIVE (EUR 44900 / CHF 49900, mensuels, actifs) + webhook, puis dry-run read-only owner (node scripts/p15-verify-stripe-live-readonly.mjs) + attester CLONESTORE_STRIPE_LIVE_VERIFIED.");
  if (!gate("reconciliation")?.pass) requiredOwnerActions.push("Activer STRIPE_COUNTRY_RECONCILIATION_ENABLED puis vérifier la réconciliation sur des paiements LIVE réels + attester CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED.");
  if (!gate("legal_tax")?.pass) requiredOwnerActions.push("Faire réviser les artefacts légaux/fiscaux FR/BE/LU/CH par avocat/comptable (hash+date+source) ou accepter explicitement le risque owner disclosed.");
  if (!gate("provider")?.pass) requiredOwnerActions.push("Passer Yousign LIVE (lever P8.7.4) OU approuver le repli officiel signature-préparée (CLONESTORE_SIGNATURE_FALLBACK_APPROVED) avec copie « préparé, non signé ».");
  if (!gate("monitoring")?.pass) requiredOwnerActions.push("Déployer la health route + alerting + répéter le rollback, puis attester CLONESTORE_MONITORING_ROLLBACK_VERIFIED.");
  if (!gate("owner_approval")?.pass) requiredOwnerActions.push("Compléter et signer P15_OWNER_GO_LIVE_APPROVAL_PACKET.md (décision approve_production + acknowledgements).");
  if (!p15.p10HardFloor) requiredOwnerActions.push("Lever le plancher dur P10 (PRODUCTION_AUTHORIZED) par un changement de code owner DÉLIBÉRÉ — jamais par env.");

  const nextStep = p15.status === "TECHNICAL_READY_EXTERNAL_BLOCKED"
    ? "Fournir les preuves externes manquantes (Stripe live, légal/fiscal, provider/fallback, monitoring) puis compléter l'approbation owner. La couche technique (réconciliation câblée + webhook + modules) est prête."
    : p15.status === "OWNER_REVIEW_REQUIRED"
      ? "Compléter l'approbation owner ; toutes les portes externes passent."
      : p15.status === "READY_FOR_PRODUCTION_AUTHORIZATION"
        ? "Lever le plancher dur P10 (changement de code owner) pour autoriser la production."
        : p15.status === "NOT_READY" ? "Corriger la couche technique (réconciliation/webhook)."
          : p15.status === "PRODUCTION_AUTHORIZED" ? "Déployer (action explicite séparée) puis fournir la preuve de déploiement."
            : "Lancé.";

  const safeMessage = p15.status === "TECHNICAL_READY_EXTERNAL_BLOCKED"
    ? "Clôture TECHNIQUE prête (réconciliation câblée + webhook + modules) ; les preuves EXTERNES (Stripe live, légal/fiscal, provider, monitoring) et le sign-off owner manquent. Production désactivée, aucun paiement live, aucun déploiement."
    : "Voir globalStatus + exactBlockers.";

  return {
    globalStatus: p15.status,
    publicPaidLaunchAllowed: p15.publicPaidLaunchAllowed,
    privatePilotAllowed: p15.privatePilotAllowed,
    demoOnlyAllowed: p15.demoOnlyAllowed,
    productionAuthorizationAllowed: p15.productionAuthorizationAllowed,
    p10HardFloorRespected: P10_PRODUCTION_AUTHORIZED === false,
    exactBlockers,
    exactWarnings: P10_PRODUCTION_AUTHORIZED ? [] : ["Plancher dur P10 actif : PRODUCTION_AUTHORIZED=false (production jamais autorisée par env)."],
    requiredOwnerActions,
    nextStep,
    gates: p15.gates,
    commercialTruthConstraints: P15_COMMERCIAL_TRUTH_CONSTRAINTS,
    p11CrossCheck: { globalStatus: p11.globalStatus, productionAuthorized: p11.productionAuthorized },
    safeMessage,
  };
}
