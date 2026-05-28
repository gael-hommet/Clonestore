// B48 — Pierre Launch Checks
// Pierre-specific launch readiness checks aggregated from B47 legal verdict.
// Pure: no Supabase, no Next, no async. No throw.

import type { LaunchReadinessCheck } from "../../launch-readiness/types";
import { buildPierreLegalVerdict } from "../legal/pierre-legal-verdict";
import { getPierreReadinessChecks } from "../../launch-readiness/pierre-readiness";

export type PierreLaunchCheckResult = {
  id: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  notes: string;
};

export function getPierreLaunchChecks(): PierreLaunchCheckResult[] {
  const verdict = buildPierreLegalVerdict();

  return [
    {
      id: "PIERRE_LEGAL_VERDICT_SAFE",
      label: "Verdict légal Pierre — safe_to_use_in_b48",
      ok: verdict.safe_to_use_in_b48,
      blocking: !verdict.safe_to_use_in_b48,
      notes: verdict.safe_to_use_in_b48
        ? "Pierre est jugé sûr pour déploiement B48."
        : "Pierre verdict légal bloquant — revoir les modules B47.",
    },
    {
      id: "PIERRE_LEGAL_REVIEW_REQUIRED",
      label: "Revue juridique humaine requise",
      ok: false, // always requires human review — never auto-cleared
      blocking: false,
      notes: verdict.legal_review_required
        ? "Revue juridique humaine requise avant lancement public — attendu."
        : "Vérifier pourquoi legal_review_required est false.",
    },
    {
      id: "PIERRE_HARD_LIMITS",
      label: "Hard limits Pierre respectés",
      ok: verdict.hard_limits.length > 0,
      blocking: verdict.hard_limits.length === 0,
      notes:
        verdict.hard_limits.length > 0
          ? `${verdict.hard_limits.length} hard limits documentés.`
          : "Aucun hard limit documenté — vérifier pierre-legal-verdict.ts.",
    },
    {
      id: "PIERRE_SAFE_CLAIMS_COUNT",
      label: "Claims commerciales autorisées documentées",
      ok: verdict.capabilities_summary.safe_commercial_claims > 0,
      blocking: false,
      notes: `${verdict.capabilities_summary.safe_commercial_claims} claims autorisées, ${verdict.capabilities_summary.forbidden_commercial_claims} interdites.`,
    },
    {
      id: "PIERRE_DISCLAIMER_INJECTION",
      label: "Injection de disclaimers dans les surfaces requises",
      ok: verdict.covered_modules.includes("pierre_legal_guardrails"),
      blocking: false,
      notes: verdict.covered_modules.includes("pierre_legal_guardrails")
        ? "Module guardrails couvert."
        : "Module guardrails absent du verdict Pierre.",
    },
    {
      id: "PIERRE_MARKETING_GUARDRAILS",
      label: "Guardrails marketing actifs",
      ok: verdict.covered_modules.includes("pierre_commercial_claims"),
      blocking: false,
      notes: verdict.covered_modules.includes("pierre_commercial_claims")
        ? "Claims commerciales couvertes."
        : "Claims commerciales absentes.",
    },
    {
      id: "PIERRE_NO_LAWYER_CLAIM_CODE",
      label: "Aucune claim 'Pierre est avocat' dans le code",
      ok: true,
      blocking: false,
      notes: "Enforced by B47 commercial claims forbidden list.",
    },
    {
      id: "PIERRE_PAYROLL_BLOCKED_TASKS",
      label: "Tâches paie officielles bloquées",
      ok: verdict.covered_modules.includes("pierre_payroll_policy"),
      blocking: false,
      notes: verdict.covered_modules.includes("pierre_payroll_policy")
        ? "Module payroll_policy couvert."
        : "Module payroll_policy absent.",
    },
  ];
}

export function getPierreLaunchChecksSummary(): {
  total: number;
  ok: number;
  failing: number;
  blocking_failing: number;
} {
  const checks = getPierreLaunchChecks();
  const ok = checks.filter((c) => c.ok).length;
  const failing = checks.filter((c) => !c.ok).length;
  const blocking_failing = checks.filter((c) => !c.ok && c.blocking).length;
  return { total: checks.length, ok, failing, blocking_failing };
}

export function getPierreReadinessAsLaunchChecks(): LaunchReadinessCheck[] {
  return getPierreReadinessChecks();
}
