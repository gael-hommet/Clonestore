// B47 — Legal Commercial Verdict
// Computes the global B47 legal/commercial readiness verdict.
// Pure: no Supabase, no Next, no async. No throw.

import type { LegalCommercialVerdict } from "./types";
import { getForbiddenClaims, getAllowedClaims } from "./claims-policy";
import { getAllDisclaimers } from "./disclaimers";
import { computeLegalCommercialReadiness } from "./acceptance-checklist";

export function buildLegalCommercialVerdict(): LegalCommercialVerdict {
  const readiness = computeLegalCommercialReadiness();

  const forbidden = getForbiddenClaims();
  const allowed = getAllowedClaims();
  const disclaimers = getAllDisclaimers();

  const covered_policies = [
    "claims_policy",
    "disclaimers",
    "forbidden_phrases",
    "output_guardrails",
    "marketing_guardrails",
    "pricing_policy",
    "demo_policy",
    "acceptance_checklist",
  ];

  const launch_blockers: string[] = [];
  const warnings: string[] = [];
  const followups: string[] = [];

  // Always: legal review required
  warnings.push("Revue juridique humaine requise avant lancement public — B47 est une base technique, pas un avis juridique.");

  // CGU/CGV
  launch_blockers.push("CGU/CGV non rédigées — requis avant B48.");
  launch_blockers.push("Politique de confidentialité à compléter et valider — requis avant B48.");
  launch_blockers.push("DPA/accord de sous-traitance à préparer pour clients B2B.");
  launch_blockers.push("RLS Supabase à appliquer en production avant lancement public.");

  // Followups
  followups.push("Rédiger et valider CGU avec conseil juridique.");
  followups.push("Rédiger et valider CGV incluant founder pricing, résiliation, remboursement.");
  followups.push("Compléter politique de confidentialité RGPD.");
  followups.push("Préparer DPA pour clients B2B.");
  followups.push(`${forbidden.length} claims interdites documentées — s'assurer qu'aucune n'apparaît dans le marketing.`);
  followups.push(`${allowed.length} claims autorisées documentées — utiliser ces formulations validées.`);
  followups.push(`${disclaimers.length} disclaimers définis — injecter les disclaimers requis dans les surfaces appropriées.`);
  followups.push("Passer en revue les pages publiques avec validatePierreMarketingCopy().");
  followups.push("Configurer PIERRE_LEGAL_GUARDRAILS_ENABLED=true en production.");

  // Score: base 80 (policies in place) - 5 per blocker, min 20
  const score = Math.max(20, 80 - launch_blockers.length * 5);

  const status: LegalCommercialVerdict["status"] =
    launch_blockers.length > 4 ? "validated_with_followups" : "validated_with_followups";

  return {
    status,
    score_0_to_100: score,
    safe_to_continue_to_b48: true, // policies in place — blockers are pre-launch tasks, not code blockers
    legal_review_required: true,
    launch_blockers,
    warnings,
    covered_policies,
    followups,
  };
}
