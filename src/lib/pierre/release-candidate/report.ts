// src/lib/pierre/release-candidate/report.ts
// Pierre Release Candidate — Executive summary and Markdown renderer.
// Pure module: no Supabase, no Next, no async, no side effects. Never throws.

import type { PierreReleaseCandidateReport } from "./types";

// ══════════════════════════════════════════════════════════════
// 1. EXECUTIVE SUMMARY
// ══════════════════════════════════════════════════════════════

export function buildPierreReleaseCandidateExecutiveSummary(
  report: PierreReleaseCandidateReport,
): {
  headline: string;
  summary: string;
  decision: string;
  next_steps: string[];
} {
  try {
    const { status, score, blocking_issues, warnings } = report;

    const statusLabel: Record<string, string> = {
      ready: "PRET",
      almost_ready: "PRESQUE PRET",
      blocked: "BLOQUE",
      failed: "ECHEC",
    };

    const headline =
      `Pierre Backend V1 — Release Candidate ${statusLabel[status] ?? status} (${score}/100)`;

    const summary = buildSummaryText(report);
    const decision = report.release_decision.recommendation;

    const next_steps: string[] = [];

    if (status === "ready" || status === "almost_ready") {
      next_steps.push("Lancer le Bloc 31 — Cockpit Pierre Final UI / Mission Center.");
      next_steps.push("Planifier la revue Bloc 32 — Production IA/Cost Router si nécessaire.");
    }

    if (blocking_issues.length > 0) {
      next_steps.push(
        `Corriger ${blocking_issues.length} issue(s) bloquante(s) avant release.`,
      );
      for (const issue of blocking_issues.slice(0, 3)) {
        if (issue.recommendation) next_steps.push(`  - ${issue.label}: ${issue.recommendation}`);
      }
    }

    if (warnings.length > 0) {
      next_steps.push(
        `Traiter ${warnings.length} avertissement(s) non-bloquant(s) avant démo client.`,
      );
    }

    if (report.release_decision.requires_hotfix) {
      next_steps.push("HOTFIX REQUIS — corriger les issues critiques avant tout déploiement.");
    }

    if (next_steps.length === 0) {
      next_steps.push("Aucune action corrective requise. Pierre Backend V1 est opérationnel.");
    }

    return { headline, summary, decision, next_steps };
  } catch {
    return {
      headline: "Pierre Backend V1 — Release Candidate (erreur de rapport)",
      summary: "Erreur lors de la génération du résumé exécutif.",
      decision: "Vérification manuelle requise.",
      next_steps: ["Investiguer l'erreur dans buildPierreReleaseCandidateExecutiveSummary()."],
    };
  }
}

function buildSummaryText(report: PierreReleaseCandidateReport): string {
  const parts: string[] = [];
  parts.push(
    `Score global : ${report.score}/100. Status : ${report.status}.`,
  );
  parts.push(
    `${report.checks.filter((c) => c.status === "pass").length} checks passants, ` +
    `${report.blocking_issues.length} bloquants, ${report.warnings.length} avertissements.`,
  );
  if (report.strongest_proofs.length > 0) {
    parts.push(`Points forts : ${report.strongest_proofs.slice(0, 3).join(" / ")}.`);
  }
  if (report.blocking_issues.length > 0) {
    parts.push(
      `Issues bloquantes : ${report.blocking_issues.slice(0, 2).map((i) => i.label).join(", ")}.`,
    );
  }
  return parts.join(" ");
}

// ══════════════════════════════════════════════════════════════
// 2. MARKDOWN RENDERER
// ══════════════════════════════════════════════════════════════

export function renderPierreReleaseCandidateMarkdown(
  report: PierreReleaseCandidateReport,
): string {
  try {
    const lines: string[] = [];
    const summary = buildPierreReleaseCandidateExecutiveSummary(report);

    lines.push(`# Pierre Backend V1 — Release Candidate Report`);
    lines.push(``);
    lines.push(`**Généré le :** ${report.generated_at}`);
    lines.push(`**Version :** ${report.version}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    // Status + score
    const statusEmoji: Record<string, string> = {
      ready: "PRET",
      almost_ready: "PRESQUE PRET",
      blocked: "BLOQUE",
      failed: "ECHEC",
    };
    lines.push(`## Statut : ${statusEmoji[report.status] ?? report.status}`);
    lines.push(``);
    lines.push(`**Score :** ${report.score}/100`);
    lines.push(``);
    lines.push(`**Décision backend :**`);
    lines.push(report.release_decision.recommendation);
    lines.push(``);
    lines.push(`| Indicateur | Valeur |`);
    lines.push(`|---|---|`);
    lines.push(`| Backend prêt | ${report.release_decision.can_release_backend ? "Oui" : "Non"} |`);
    lines.push(`| Cockpit peut démarrer | ${report.release_decision.can_start_cockpit ? "Oui" : "Non"} |`);
    lines.push(`| Hotfix requis | ${report.release_decision.requires_hotfix ? "Oui" : "Non"} |`);
    lines.push(``);

    // Modules
    if (report.modules.length > 0) {
      lines.push(`## Modules`);
      lines.push(``);
      lines.push(`| Module | Score | Statut | Pass | Warn | Fail |`);
      lines.push(`|---|---|---|---|---|---|`);
      for (const mod of report.modules) {
        lines.push(
          `| ${mod.area} | ${mod.score}/100 | ${mod.status} | ${mod.passed} | ${mod.warnings} | ${mod.failed} |`,
        );
      }
      lines.push(``);
    }

    // Blocking issues
    if (report.blocking_issues.length > 0) {
      lines.push(`## Issues bloquantes (${report.blocking_issues.length})`);
      lines.push(``);
      for (const issue of report.blocking_issues) {
        lines.push(`### ${issue.label}`);
        lines.push(``);
        lines.push(`- **ID :** ${issue.id}`);
        lines.push(`- **Zone :** ${issue.area}`);
        lines.push(`- **Sévérité :** ${issue.severity}`);
        lines.push(`- **Attendu :** ${issue.expected}`);
        lines.push(`- **Réel :** ${issue.actual}`);
        if (issue.recommendation) {
          lines.push(`- **Recommandation :** ${issue.recommendation}`);
        }
        lines.push(``);
      }
    }

    // Warnings
    if (report.warnings.length > 0) {
      lines.push(`## Avertissements (${report.warnings.length})`);
      lines.push(``);
      for (const warn of report.warnings) {
        lines.push(`- **${warn.label}** — ${warn.actual}`);
        if (warn.recommendation) lines.push(`  - *${warn.recommendation}*`);
      }
      lines.push(``);
    }

    // Strongest proofs
    if (report.strongest_proofs.length > 0) {
      lines.push(`## Points forts`);
      lines.push(``);
      for (const proof of report.strongest_proofs) {
        lines.push(`- ${proof}`);
      }
      lines.push(``);
    }

    // Next step
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Prochaine étape`);
    lines.push(``);
    if (
      report.status === "ready" ||
      report.status === "almost_ready" ||
      report.release_decision.can_start_cockpit
    ) {
      lines.push(
        `**Bloc 31 — Cockpit Pierre Final UI / Mission Center** peut démarrer.`,
      );
      lines.push(``);
      lines.push(
        `Le moteur Pierre V1 backend est finalisé. Il reste à rendre cette puissance visible ` +
        `et pilotable par le client via le cockpit final.`,
      );
    } else {
      lines.push(
        `Corriger les issues bloquantes avant de démarrer le Bloc 31.`,
      );
    }
    lines.push(``);
    lines.push(`> **Note :** Bloc 32 (futur) = Production IA / Cost Router / Model Selection.`);
    lines.push(``);
    lines.push(
      `*Rapport généré automatiquement par Pierre Release Candidate Engine v${report.version}*`,
    );

    return lines.join("\n");
  } catch {
    return `# Pierre Backend V1 — Release Candidate Report\n\nErreur lors de la génération du rapport Markdown.\n`;
  }
}
