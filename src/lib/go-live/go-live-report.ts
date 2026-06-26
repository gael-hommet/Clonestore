// P-FINAL 02 — Go-Live Report
// Markdown/text renderer for the go-live command center report.
// Pure: no Supabase, no Next, no async, no throw.

import type { GoLiveCommandCenterReport } from "./go-live-command-center";
import { formatVerdictStatus } from "./go-live-command-center";

export function renderGoLiveReportMarkdown(report: GoLiveCommandCenterReport): string {
  const lines: string[] = [];

  lines.push(`# P-FINAL 02 — Go-Live Verdict\n`);
  lines.push(`**Évalué le:** ${report.evaluated_at}`);
  lines.push(`**Statut:** ${formatVerdictStatus(report.verdict.status)}\n`);

  lines.push(`## Couverture`);
  lines.push(`- Preuves vérifiées: ${report.summary.verified}/${report.summary.total_proofs_in_registry}`);
  lines.push(`- Couverture lancement public: ${report.summary.public_launch_coverage_percent}%`);
  lines.push(`- Lancement public: ${report.summary.is_public_launch_go ? "✅ PRÊT" : "❌ BLOQUÉ"}`);
  lines.push(`- Pilote privé: ${report.summary.is_private_pilot_ready ? "✅ PRÊT" : "❌ BLOQUÉ"}\n`);

  if (report.verdict.missing_for_public_launch.length > 0) {
    lines.push(`## Preuves manquantes (lancement public)`);
    for (const id of report.verdict.missing_for_public_launch) {
      lines.push(`- [ ] ${id}`);
    }
    lines.push("");
  }

  if (report.next_actions.length > 0) {
    lines.push(`## Prochaines actions`);
    for (const action of report.next_actions) {
      lines.push(`### [${action.priority.toUpperCase()}] ${action.category}`);
      lines.push(`**Action:** ${action.action}`);
      lines.push(`**Effort estimé:** ${action.estimated_effort}`);
      lines.push(`**Documentation:** ${action.documentation_ref}`);
      lines.push(`**Proof IDs:** ${action.proof_ids.join(", ")}`);
      lines.push("");
    }
  }

  lines.push(`## Flags`);
  lines.push(`- B48_PUBLIC_LAUNCH_ENABLED: ${report.flags_required.B48_PUBLIC_LAUNCH_ENABLED} (ne pas changer sans preuves complètes)`);
  lines.push(`- Pilote privé autorisé: ${report.flags_required.GO_LIVE_ALLOW_PRIVATE_PILOT}`);

  return lines.join("\n");
}
