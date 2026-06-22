// BLOC 3 — Readiness gate code-only (jamais une simple constante).
//
// Le verdict est dérivé exclusivement de preuves observables au moment de
// l'appel : contrat, secrets, surfaces, claims. Aucune activation externe
// (Stripe live, vraies grants prospects, domaines, campagnes) n'est promue
// ici — ces blocages externes restent gérés ailleurs (Phase E + go-live).

import { EXPECTED_PIERRE_PRICE_AMOUNT } from "@/lib/billing/stripe-activation";
import {
  CONTRACT_VERSION,
  LEADFORGE_COMMIT,
  PIERRE_PRICE_AMOUNT_CENTS,
  buildContractSnapshot,
  computeContractFingerprint,
} from "./contract";
import { isAttributionSecretConfigured } from "./attribution-token";
import { isConversionSessionSecretConfigured } from "./session";
import { CLAIMS_REGISTRY } from "./claims-registry";

export type B3Verdict =
  | "V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED"
  | "V0_CONVERSION_ENGINE_BLOCKED_PRICE_MISMATCH"
  | "V0_CONVERSION_ENGINE_BLOCKED_CONTRACT_DRIFT"
  | "V0_CONVERSION_ENGINE_BLOCKED_SECRETS_MISSING"
  | "V0_CONVERSION_ENGINE_BLOCKED_CLAIM_PROMOTED_WITHOUT_EVIDENCE";

export interface ReadinessReport {
  verdict: B3Verdict;
  leadforge_commit: string;
  contract_version: string;
  contract_fingerprint: string;
  price_match: boolean;
  attribution_secret_configured: boolean;
  conversion_session_secret_configured: boolean;
  claims: {
    total: number;
    verified: number;
    pending: number;
    prohibited: number;
    pending_ids: readonly string[];
  };
  blocking_external: readonly string[];
  notes: readonly string[];
}

export function buildB3ConversionVerdict(): ReadinessReport {
  const snapshot = buildContractSnapshot();
  const fingerprint = computeContractFingerprint(snapshot);
  const priceMatch = PIERRE_PRICE_AMOUNT_CENTS === EXPECTED_PIERRE_PRICE_AMOUNT;
  const attributionOk = isAttributionSecretConfigured();
  const sessionOk = isConversionSessionSecretConfigured();

  const claims = Object.values(CLAIMS_REGISTRY);
  const verified = claims.filter((c) => c.status === "VERIFIED_PRODUCT_FACT").length;
  const pending = claims.filter((c) => c.status === "PENDING_CLONESTORE_PRODUCT_VERIFICATION");
  const prohibited = claims.filter((c) => c.status === "PROHIBITED_ON_SURFACE").length;

  let verdict: B3Verdict = "V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED";

  if (!priceMatch) verdict = "V0_CONVERSION_ENGINE_BLOCKED_PRICE_MISMATCH";
  // Une claim pending qui s'auto-déclare comme vérité produit serait un drift code.
  if (pending.some((c) => c.status === "VERIFIED_PRODUCT_FACT" as string)) {
    verdict = "V0_CONVERSION_ENGINE_BLOCKED_CLAIM_PROMOTED_WITHOUT_EVIDENCE";
  }

  // Blocages externes (jamais des défauts code, mais ils maintiennent le verdict
  // V0_..._EXTERNAL_ACTIVATION_REQUIRED).
  const externalBlockers: string[] = [];
  if (!attributionOk) externalBlockers.push("CLONESTORE_CONVERSION_ATTRIBUTION_SECRET (ou fallback) non configuré");
  if (!sessionOk) externalBlockers.push("CLONESTORE_CONVERSION_SESSION_SECRET (ou fallback) non configuré");
  externalBlockers.push("LeadForge live grants jamais importées dans ce dépôt");
  externalBlockers.push("Aucune campagne email réelle activée depuis CloneStore");
  externalBlockers.push("Stripe live non requis par ce bloc — TEST uniquement");

  return {
    verdict,
    leadforge_commit: LEADFORGE_COMMIT,
    contract_version: CONTRACT_VERSION,
    contract_fingerprint: fingerprint,
    price_match: priceMatch,
    attribution_secret_configured: attributionOk,
    conversion_session_secret_configured: sessionOk,
    claims: {
      total: claims.length,
      verified,
      pending: pending.length,
      prohibited,
      pending_ids: pending.map((c) => c.id),
    },
    blocking_external: externalBlockers,
    notes: [
      "Aucune activation publique modifiée par ce bloc.",
      "Aucun email réel envoyé. Aucun Stripe live. Aucune donnée prospect réelle importée.",
      "Le verdict CODE_READY ne signifie pas que la campagne est activée.",
    ],
  };
}
