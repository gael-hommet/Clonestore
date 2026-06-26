// BLOC 3 — Readiness gate strictement evidence-based.
//
// Le verdict CODE_READY n'est rendu QUE si chaque preuve listée est passée.
// Par défaut → `V0_CONVERSION_ENGINE_BLOCKED_MISSING_EVIDENCE`.
// Les blocages externes restent listés à part (Stripe live, vraies grants,
// domaines, go-live) — ils ne changent jamais le verdict CODE_READY.
//
// Les preuves sont fournies par l'appelant (`buildB3ConversionVerdict(evidence)`)
// — par exemple le script `scripts/check-b3-conversion-integration.mjs`, ou
// les tests qui collectent leurs propres preuves d'exécution.

import {
  CONTRACT_VERSION_REF as _CONTRACT_VERSION_REF, // backward compatibility (ne plus utiliser)
} from "./contract-version-compat";
import {
  LEADFORGE_COMMIT,
  LEADFORGE_FIXTURE_FINGERPRINT,
} from "./contract";
import { auditClaims } from "./claims-registry";

export type B3Verdict =
  | "V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED"
  | "V0_CONVERSION_ENGINE_BLOCKED_MISSING_EVIDENCE"
  | "V0_CONVERSION_ENGINE_BLOCKED_CONTRACT_DRIFT"
  | "V0_CONVERSION_ENGINE_BLOCKED_PARITY_FAILURE"
  | "V0_CONVERSION_ENGINE_BLOCKED_TOKEN_VECTOR_FAILURE"
  | "V0_CONVERSION_ENGINE_BLOCKED_STORAGE_NOT_FAIL_CLOSED"
  | "V0_CONVERSION_ENGINE_BLOCKED_CHECKOUT_ROUTE_NOT_WIRED"
  | "V0_CONVERSION_ENGINE_BLOCKED_WEBHOOK_ROUTE_NOT_WIRED"
  | "V0_CONVERSION_ENGINE_BLOCKED_TENANCY_NOT_WIRED"
  | "V0_CONVERSION_ENGINE_BLOCKED_SURFACE_EVENTS_NOT_WIRED"
  | "V0_CONVERSION_ENGINE_BLOCKED_DEMO_CONTRACT_FAILURE"
  | "V0_CONVERSION_ENGINE_BLOCKED_DIAGNOSTIC_CONTRACT_FAILURE"
  | "V0_CONVERSION_ENGINE_BLOCKED_BUILD_FAILURE"
  | "V0_CONVERSION_ENGINE_BLOCKED_FULL_SUITE_FAILURE"
  | "V0_CONVERSION_ENGINE_BLOCKED_ADVERSARIAL_FINDING"
  | "V0_CONVERSION_ENGINE_BLOCKED_DIRTY_SHARED_ROUTE_INTEGRATION";

export interface ReadinessEvidence {
  /** Le fingerprint LeadForge fixe (cf. fixtures/leadforge-contract-db9b166.json) a été vérifié. */
  fixtureFingerprintMatches?: boolean;
  /** Le snapshot CloneStore est PARITY-équivalent à la fixture LeadForge (champ par champ). */
  parityWithFixture?: boolean;
  /** Les test vectors de tokens Python→TS sont tous PASS. */
  tokenVectorsPass?: boolean;
  /** Le storage refuse la persistance en production sans backend (testé). */
  storageFailsClosedInProd?: boolean;
  /** La route /api/checkout invoque réellement le bridge BLOC 3 (testé via route-level test). */
  checkoutRouteBridged?: boolean;
  /** La route /api/webhooks/stripe invoque réellement le bridge BLOC 3. */
  webhookRouteBridged?: boolean;
  /** attachUserToSession refuse cross-tenant et cross-user. */
  tenancyAttachWired?: boolean;
  /** /demo/pierre et /diagnostic-rh émettent réellement les events. */
  surfaceEventsWired?: boolean;
  /** La démo respecte les behaviors LeadForge (CloneOS/CloneADN/CloneGuard/CloneTrace + 6..9 steps). */
  demoContractPass?: boolean;
  /** Le diagnostic produit byte-pour-byte les golden vectors LeadForge. */
  diagnosticContractPass?: boolean;
  /** `npx tsc --noEmit` retourne 0. */
  tscZeroErrors?: boolean;
  /** La suite BLOC 3 ciblée est verte. */
  bloc3TestsPass?: boolean;
  /** La suite Phase E est verte. */
  phaseETestsPass?: boolean;
  /** La suite complète est verte. */
  fullSuitePass?: boolean;
  /** `next build` est OK. */
  buildPass?: boolean;
  /** La revue adversariale ne laisse aucun HIGH/MEDIUM exploitable. */
  adversarialReviewPass?: boolean;
  /** Le commit BLOC 3 ne contient AUCUN changement Phase E pré-existant. */
  sharedRouteIsolationProven?: boolean;
}

export interface ReadinessReport {
  verdict: B3Verdict;
  leadforge_commit: string;
  fixture_fingerprint: string;
  evidence_summary: Readonly<Record<keyof ReadinessEvidence, boolean | "unknown">>;
  failed_checks: readonly string[];
  claims_audit: ReturnType<typeof auditClaims>;
  blocking_external: readonly string[];
  notes: readonly string[];
}

/**
 * Verdict strictement dérivé des preuves fournies. Aucune valeur par défaut.
 * Si une preuve n'est pas fournie, elle est traitée comme NON-PASS.
 */
export function buildB3ConversionVerdict(evidence: ReadinessEvidence = {}): ReadinessReport {
  const checks: Array<{ key: keyof ReadinessEvidence; failedVerdict: B3Verdict; label: string }> = [
    { key: "fixtureFingerprintMatches", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_CONTRACT_DRIFT", label: "fixture fingerprint" },
    { key: "parityWithFixture", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_PARITY_FAILURE", label: "parity with LeadForge fixture" },
    { key: "tokenVectorsPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_TOKEN_VECTOR_FAILURE", label: "Python→TS token vectors" },
    { key: "storageFailsClosedInProd", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_STORAGE_NOT_FAIL_CLOSED", label: "storage fail-closed in production" },
    { key: "checkoutRouteBridged", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_CHECKOUT_ROUTE_NOT_WIRED", label: "/api/checkout bridge invocation" },
    { key: "webhookRouteBridged", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_WEBHOOK_ROUTE_NOT_WIRED", label: "/api/webhooks/stripe bridge invocation" },
    { key: "tenancyAttachWired", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_TENANCY_NOT_WIRED", label: "session/tenant attach guard" },
    { key: "surfaceEventsWired", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_SURFACE_EVENTS_NOT_WIRED", label: "/demo + /diagnostic events" },
    { key: "demoContractPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_DEMO_CONTRACT_FAILURE", label: "demo behaviors (6-9 steps, CloneOS/ADN/Guard/Trace)" },
    { key: "diagnosticContractPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_DIAGNOSTIC_CONTRACT_FAILURE", label: "diagnostic golden vectors" },
    { key: "tscZeroErrors", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_BUILD_FAILURE", label: "tsc --noEmit" },
    { key: "bloc3TestsPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_FULL_SUITE_FAILURE", label: "BLOC 3 ciblé" },
    { key: "phaseETestsPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_FULL_SUITE_FAILURE", label: "Phase E suite" },
    { key: "fullSuitePass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_FULL_SUITE_FAILURE", label: "full test suite" },
    { key: "buildPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_BUILD_FAILURE", label: "next build" },
    { key: "adversarialReviewPass", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_ADVERSARIAL_FINDING", label: "adversarial review" },
    { key: "sharedRouteIsolationProven", failedVerdict: "V0_CONVERSION_ENGINE_BLOCKED_DIRTY_SHARED_ROUTE_INTEGRATION", label: "shared-route hunk isolation" },
  ];

  const failed: { check: typeof checks[number]; reason: string }[] = [];
  const summary: Record<string, boolean | "unknown"> = {};
  for (const c of checks) {
    const v = evidence[c.key];
    if (v === true) summary[c.key] = true;
    else if (v === false) {
      summary[c.key] = false;
      failed.push({ check: c, reason: `${c.label} → FAIL` });
    } else {
      summary[c.key] = "unknown";
      failed.push({ check: c, reason: `${c.label} → MISSING_EVIDENCE` });
    }
  }

  let verdict: B3Verdict;
  if (failed.length === 0) {
    verdict = "V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED";
  } else {
    // Premier critère échoué décide du verdict (le plus discriminant en haut).
    verdict = failed[0].check.failedVerdict;
    // Si la cause primaire est "missing evidence" (= aucune preuve fournie),
    // on rend BLOCKED_MISSING_EVIDENCE pour distinguer une absence d'evidence
    // d'un FAIL réel.
    const allMissing = failed.every((f) => summary[f.check.key] === "unknown");
    if (allMissing) verdict = "V0_CONVERSION_ENGINE_BLOCKED_MISSING_EVIDENCE";
  }

  return {
    verdict,
    leadforge_commit: LEADFORGE_COMMIT,
    fixture_fingerprint: LEADFORGE_FIXTURE_FINGERPRINT,
    evidence_summary: summary as Readonly<Record<keyof ReadinessEvidence, boolean | "unknown">>,
    failed_checks: failed.map((f) => f.reason),
    claims_audit: auditClaims(),
    blocking_external: [
      "Stripe live non activé (TEST uniquement requis par BLOC 3)",
      "Aucune vraie grant LeadForge importée dans CloneStore",
      "Aucune campagne réelle activée",
      "Domaines outreach non provisionnés",
      "Public launch flags inchangés",
    ],
    notes: [
      "BLOC 3 code-only : pas de modification go-live, pas de paiement, pas d'email réel.",
      "Le verdict CODE_READY ne signifie pas que la campagne LeadForge est activée.",
    ],
  };
}
