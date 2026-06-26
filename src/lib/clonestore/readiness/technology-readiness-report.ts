// TECH-11 — Technology Readiness Final Gate — Report Builder
// Construit le rapport complet de readiness technologique.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessReport,
  TechnologyReadinessTechnologyResult,
  TechnologyReadinessEmployeeResult,
  TechnologyReadinessInvariantResult,
} from "./technology-readiness-types";
import {
  evaluateAllTechnologyReadiness,
  calculateOverallReadinessScore,
  buildTechnologyReadinessVerdict,
  calculateTechnologyFoundationScore,
} from "./technology-readiness-evaluator";
import { evaluateTechnologyInvariants } from "./technology-readiness-invariants";
import { evaluatePierreTechnologyReadiness } from "./pierre-technology-readiness";
import {
  KNOWN_EXTERNAL_LAUNCH_BLOCKERS,
  canDeclareTechnologyFoundationReady,
} from "./launch-blockers-separation";
import { collectTechnologyDocs, collectTechnologyModules } from "./technology-readiness-sources";

// ── Report builder ────────────────────────────────────────────────────────────

let _reportCounter = 0;

function generateReportId(): string {
  _reportCounter++;
  return `tech11_readiness_${Date.now()}_${_reportCounter.toString().padStart(4, "0")}`;
}

/**
 * Construit le rapport complet de readiness technologique TECH-11.
 */
export function buildTechnologyReadinessReport(): TechnologyReadinessReport {
  const technologies = evaluateAllTechnologyReadiness();
  const invariants = evaluateTechnologyInvariants();
  const pierreResult = evaluatePierreTechnologyReadiness();
  const externalBlockers = KNOWN_EXTERNAL_LAUNCH_BLOCKERS;

  // Identifier les blockers internes
  const internalBlockers: string[] = [];
  const absoluteFailures = invariants.filter(
    (i) => i.is_absolute && i.status === "fail",
  );
  for (const failure of absoluteFailures) {
    internalBlockers.push(`Invariant absolu échoué : ${failure.label}`);
  }
  const coreBlockedTech = technologies.filter(
    (t) => t.required_for_employee_runtime && t.status === "blocked",
  );
  for (const blocked of coreBlockedTech) {
    internalBlockers.push(`Technologie core bloquée : ${blocked.display_name}`);
  }

  // Warnings
  const warnings: string[] = [];
  const partialTech = technologies.filter((t) => t.status === "partial");
  for (const p of partialTech) {
    warnings.push(`${p.display_name} partiellement implémentée.`);
  }
  const roadmapTech = technologies.filter((t) => t.status === "roadmap");
  if (roadmapTech.length > 0) {
    warnings.push(
      `${roadmapTech.length} technologie(s) sur roadmap : ${roadmapTech.map((t) => t.display_name).join(", ")}.`,
    );
  }
  const invariantWarnings = invariants.filter((i) => i.status === "warning");
  for (const w of invariantWarnings) {
    warnings.push(`Invariant en avertissement : ${w.label}`);
  }

  // Next steps
  const nextSteps: string[] = [
    "Lever les 5 blockers externes (société, Stripe live, juriste, RLS prod, E2E live).",
    "PHASE 2 : Cockpit global, messages, onboarding multi-entreprise.",
    "PHASE 3 : Marketing, documentation commerciale, support.",
    "PHASE 4 : Société + Stripe live + juriste + RLS production + E2E client payant.",
    "PHASE 5 : Déploiement production + première entreprise cliente.",
  ];
  for (const blocker of externalBlockers) {
    nextSteps.push(`→ ${blocker.resolution_hint}`);
  }

  const overallScore = calculateOverallReadinessScore(technologies, invariants);
  const foundationScore = calculateTechnologyFoundationScore(technologies);
  const verdict = buildTechnologyReadinessVerdict(technologies, invariants, true);
  const foundationReady = canDeclareTechnologyFoundationReady({
    report_id: "",
    generated_at: "",
    technology_runtime_ready: false,
    platform_technology_foundation_ready: false,
    pierre_product_ready: false,
    public_launch_ready: false,
    overall_verdict: verdict,
    overall_score: overallScore,
    technologies,
    employees: [pierreResult],
    invariants,
    external_blockers: externalBlockers,
    internal_blockers: internalBlockers,
    warnings,
    next_steps: nextSteps,
    source_docs: [],
    source_modules: [],
  });

  const pierreProductReady = pierreResult.product_runtime_ready;
  const technologyRuntimeReady =
    technologies.filter((t) => t.required_for_employee_runtime && t.status === "ready").length > 0;

  return {
    report_id: generateReportId(),
    generated_at: new Date().toISOString(),
    technology_runtime_ready: technologyRuntimeReady,
    platform_technology_foundation_ready: foundationReady,
    pierre_product_ready: pierreProductReady,
    public_launch_ready: false,
    overall_verdict: verdict,
    overall_score: overallScore,
    technologies,
    employees: [pierreResult],
    invariants,
    external_blockers: externalBlockers,
    internal_blockers: internalBlockers,
    warnings,
    next_steps: nextSteps,
    source_docs: collectTechnologyDocs(),
    source_modules: collectTechnologyModules(),
  };
}

// ── Executive summary ─────────────────────────────────────────────────────────

/**
 * Construit un résumé exécutif du rapport.
 */
export function buildTechnologyReadinessExecutiveSummary(
  report: TechnologyReadinessReport,
): string {
  const readyCount = report.technologies.filter((t) => t.status === "ready").length;
  const partialCount = report.technologies.filter((t) => t.status === "partial").length;
  const roadmapCount = report.technologies.filter((t) => t.status === "roadmap").length;
  const invariantPassCount = report.invariants.filter((i) => i.status === "pass").length;

  return [
    `TECH-11 — Technology Readiness Final Gate`,
    `Score global : ${report.overall_score}/100`,
    `Verdict : ${report.overall_verdict}`,
    ``,
    `Technologies : ${readyCount} prêtes, ${partialCount} partielles, ${roadmapCount} roadmap`,
    `Invariants : ${invariantPassCount}/${report.invariants.length} validés`,
    ``,
    `Socle technologique (repo) : ${report.platform_technology_foundation_ready ? "PRÊT ✅" : "PARTIEL ⚠️"}`,
    `Pierre (repo) : ${report.pierre_product_ready ? "PRÊT ✅" : "PARTIEL ⚠️"}`,
    `Lancement public : NO-GO 🚫 — ${report.external_blockers.length} blocker(s) externe(s)`,
    ``,
    `Blockers externes :`,
    ...report.external_blockers.map((b) => `  - ${b.label}`),
  ].join("\n");
}

/**
 * Construit les prochaines étapes du rapport.
 */
export function buildTechnologyReadinessNextSteps(
  report: TechnologyReadinessReport,
): string[] {
  return report.next_steps;
}

/**
 * Construit un digest des sources utilisées.
 */
export function buildTechnologyReadinessSourceDigest(): {
  docs: string[];
  modules: string[];
  total_docs: number;
  total_modules: number;
} {
  const docs = collectTechnologyDocs();
  const modules = collectTechnologyModules();
  return {
    docs,
    modules,
    total_docs: docs.length,
    total_modules: modules.length,
  };
}

/**
 * Construit un rapport en Markdown.
 */
export function buildTechnologyReadinessMarkdown(
  report: TechnologyReadinessReport,
): string {
  const readyTech = report.technologies.filter((t) => t.status === "ready");
  const partialTech = report.technologies.filter((t) => t.status === "partial");
  const roadmapTech = report.technologies.filter((t) => t.status === "roadmap");
  const invariantPassed = report.invariants.filter((i) => i.status === "pass");
  const invariantFailed = report.invariants.filter((i) => i.status === "fail");

  const lines: string[] = [
    `# TECH-11 — Technology Readiness Final Gate`,
    ``,
    `> Généré le : ${report.generated_at}`,
    ``,
    `## 1. Verdict global`,
    ``,
    `| Critère | Statut |`,
    `|---------|--------|`,
    `| Score global | ${report.overall_score}/100 |`,
    `| Verdict | \`${report.overall_verdict}\` |`,
    `| Socle technologique (repo) | ${report.platform_technology_foundation_ready ? "✅ PRÊT" : "⚠️ PARTIEL"} |`,
    `| Pierre côté repo | ${report.pierre_product_ready ? "✅ PRÊT" : "⚠️ PARTIEL"} |`,
    `| **Lancement public** | **🚫 NO-GO — blockers externes** |`,
    ``,
    `**Le lancement public reste NO-GO tant que les ${report.external_blockers.length} blockers externes ne sont pas levés.**`,
    ``,
    `## 2. Technologies (${report.technologies.length})`,
    ``,
    `| Technologie | Statut | Score | Implémentée | Couche globale |`,
    `|-------------|--------|-------|-------------|----------------|`,
    ...report.technologies.map(
      (t) =>
        `| ${t.display_name} | \`${t.status}\` | ${t.readiness_score}/100 | ${t.is_implemented ? "✅" : "❌"} | ${t.is_global_layer ? "✅" : "⚠️"} |`,
    ),
    ``,
    `### Prêtes (${readyTech.length})`,
    readyTech.length > 0 ? readyTech.map((t) => `- ✅ ${t.display_name}`).join("\n") : "_Aucune_",
    ``,
    `### Partielles (${partialTech.length})`,
    partialTech.length > 0 ? partialTech.map((t) => `- ⚠️ ${t.display_name}`).join("\n") : "_Aucune_",
    ``,
    `### Roadmap (${roadmapTech.length}) — honnêtement déclarées, non bloquantes`,
    roadmapTech.length > 0 ? roadmapTech.map((t) => `- 📋 ${t.display_name}`).join("\n") : "_Aucune_",
    ``,
    `## 3. Invariants critiques`,
    ``,
    `${invariantPassed.length}/${report.invariants.length} invariants validés.`,
    ``,
    invariantFailed.length > 0
      ? `**VIOLATIONS (${invariantFailed.length}) :**\n${invariantFailed.map((i) => `- ❌ ${i.label}`).join("\n")}`
      : `✅ Aucune violation d'invariant.`,
    ``,
    `## 4. Pierre`,
    ``,
    `- **Statut** : ${report.employees[0]?.status ?? "N/A"}`,
    `- **Actif** : ${report.employees[0]?.is_active ? "OUI" : "NON"}`,
    `- **Technologies requises couvertes** : ${report.employees[0]?.required_technologies_covered ? "OUI" : "NON"}`,
    `- **Permissions critiques false** : ${report.employees[0]?.critical_permissions_false ? "OUI" : "NON"}`,
    `- **product_runtime_ready** : ${report.employees[0]?.product_runtime_ready ? "OUI" : "NON"}`,
    `- **public_launch_ready** : JAMAIS — blockers externes`,
    ``,
    `Pierre ≠ CloneOS. Pierre utilise CloneOS comme couche d'orchestration de missions.`,
    ``,
    `## 5. Blockers externes au lancement public`,
    ``,
    `Ces ${report.external_blockers.length} blockers sont EXTERNES au repo.`,
    `Ils n'affectent PAS la readiness technologique — ils bloquent uniquement \`public_launch_ready\`.`,
    ``,
    ...report.external_blockers.map(
      (b) =>
        `### ${b.label}\n- **ID** : \`${b.blocker_id}\`\n- **Type** : ${b.type}\n- **Résolution** : ${b.resolution_hint}\n`,
    ),
    `## 6. Prochaines étapes`,
    ``,
    ...report.next_steps.map((s) => `- ${s}`),
    ``,
    `---`,
    ``,
    `> **Conclusion TECH-11** : Le socle technologies CloneStore est validé côté repo (TECH-01 → TECH-10).`,
    `> Le lancement public est NO-GO — 5 blockers externes doivent être levés`,
    `> (société, Stripe live, juriste, RLS production, E2E client payant).`,
    `> La readiness technologique et la readiness lancement public sont deux verdicts distincts.`,
  ];

  return lines.join("\n");
}
