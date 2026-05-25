// src/lib/cloneos/ai/live-validation/report.ts
// B38B — Report builder. Pure, no async, no DB.

import type { LiveValidationReport, LiveValidationResult, B38BConfig, B38BEnvSummary, LiveValidationMode } from "./types";

export function buildLiveValidationReport(
  mode: LiveValidationMode,
  _config: B38BConfig,
  results: LiveValidationResult[],
  envSummary: B38BEnvSummary,
): LiveValidationReport {
  const passed = results.filter(
    (r) => r.ok && !r.score.hard_fail && r.score.verdict !== "fail",
  ).length;
  const failed = results.filter(
    (r) => !r.ok || r.score.verdict === "fail" || r.score.verdict === "hard_fail",
  ).length;
  const hardFails = results.filter((r) => r.score.hard_fail).length;
  const totalEstimated = results.reduce((s, r) => s + r.estimated_cost_cents, 0);
  const totalActual = results.reduce((s, r) => s + r.actual_cost_cents, 0);
  const avgScore =
    results.length > 0
      ? Math.round((results.reduce((s, r) => s + r.score.total, 0) / results.length) * 10) / 10
      : 0;

  return {
    generated_at: new Date().toISOString(),
    run_mode: mode,
    env_summary: envSummary,
    total_estimated_cost_cents: totalEstimated,
    total_actual_cost_cents: totalActual,
    scenarios_run: results.length,
    passed,
    failed,
    hard_fails: hardFails,
    average_score: avgScore,
    results,
    recommendations: buildRecommendations(results, avgScore),
    next_steps: buildNextSteps(mode, hardFails, avgScore),
  };
}

function buildRecommendations(results: LiveValidationResult[], avgScore: number): string[] {
  const recs: string[] = [];

  // Hard fails are critical
  const hardFailResults = results.filter((r) => r.score.hard_fail);
  if (hardFailResults.length > 0) {
    recs.push(
      `CRITIQUE: ${hardFailResults.length} hard fail(s) détecté(s). Corriger avant toute activation en production.`,
    );
    for (const r of hardFailResults) {
      recs.push(`  → ${r.scenario_name}: ${r.score.hard_fail_reason}`);
    }
  }

  // Low structure score
  const lowStructure = results.filter((r) => r.ok && r.score.structure < 10);
  if (lowStructure.length >= 2) {
    recs.push(
      "Améliorer le contrat de prompt pierre.mission.interpret — plusieurs scénarios ont un JSON incomplet.",
    );
  }

  // Cost overruns
  const highCost = results.filter((r) => r.estimated_cost_cents > 15);
  if (highCost.length > 0) {
    recs.push(
      "Certains scénarios dépassent 15¢ — envisager gpt-4.1-mini pour les micro-tâches.",
    );
  }

  // Global score assessment
  if (avgScore >= 75) {
    recs.push(
      "Score moyen >= 75: qualité Pierre B38B validée. Prochaine étape : B38C (ledger Supabase) ou B39 (email live).",
    );
  } else if (avgScore >= 60) {
    recs.push(
      "Score moyen 60–74: qualité Pierre correcte mais perfectible. Continuer les tests avant B39.",
    );
  } else if (avgScore > 0) {
    recs.push(
      "Score moyen < 60: améliorer les contrats de prompt et relancer B38B avant B39.",
    );
  }

  if (recs.length === 0) {
    recs.push(
      "Tous les scénarios ont passé sans hard fail. Pierre est prêt pour la prochaine étape.",
    );
  }

  return recs;
}

function buildNextSteps(mode: LiveValidationMode, hardFails: number, avgScore: number): string {
  if (mode === "dry-run") {
    return "Dry-run validé. Lancer 'npm run b38b:live-openai' avec les variables env B38B correctes pour la validation live réelle.";
  }
  if (hardFails > 0) {
    return "Hard fails détectés — corriger les prompts/guards et relancer B38B avant tout passage en B39.";
  }
  if (avgScore >= 75) {
    return "B38B validé. Prochaine étape selon roadmap : B38C (Supabase ledger) + B39 (Resend email live) ou B40 (Cockpit client).";
  }
  return "B38B partiel. Améliorer les prompts et relancer avant B39. Voir recommendations.";
}
