// B46 — Global Technologies Verdict
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type {
  CloneStoreTechnologyId,
  B46TechnologyItem,
  B46ReadinessContext,
  GlobalTechnologiesVerdict,
} from "./technology-b46-types";
import { B46_LAUNCH_CRITICAL } from "./technology-b46-types";

export function buildB46TechnologiesVerdict(
  items: B46TechnologyItem[],
  context: B46ReadinessContext,
): GlobalTechnologiesVerdict {
  const criticalItems = items.filter((t) => B46_LAUNCH_CRITICAL.includes(t.id));
  const blockers: string[] = [];
  const followups: string[] = [];
  const degraded_technologies: CloneStoreTechnologyId[] = [];

  for (const item of items) {
    for (const b of item.readiness.blockers) {
      blockers.push(`[${item.id}] ${b}`);
    }
    if (item.status === "degraded") degraded_technologies.push(item.id);
  }

  const criticalScores = criticalItems.map((t) => t.readiness.score);
  const score = criticalScores.length > 0
    ? Math.round(criticalScores.reduce((a, b) => a + b, 0) / criticalScores.length)
    : 0;

  const critical_technologies_ready = criticalItems.every(
    (t) => t.readiness.score >= 60 && t.readiness.blockers.length === 0,
  );

  // Followups
  followups.push("B47 Legal & Commercial Guardrails — contrats, CGU, conformité commerciale.");
  followups.push("B48 Final Launch Readiness — validation finale, go-live.");
  if (items.some((t) => t.id === "clonevoice" && !t.enabled)) {
    followups.push("CloneVoice — configurer fournisseur vocal (ElevenLabs/Whisper) quand prêt.");
  }
  if (items.some((t) => t.id === "clonechat" && t.status !== "active")) {
    followups.push("CloneChat — brain omniscient et support complet planifiés pour B4x futur.");
  }
  if (!context.b45_closed || !context.document_style_ready) {
    followups.push("Document Style Kit — configurer empreinte entreprise pour documents premium.");
  }
  followups.push("Supabase persistance pour configurations technologies si non branchée.");

  const status: GlobalTechnologiesVerdict["status"] =
    blockers.length > 0 ? "blocked" : "validated_with_followups";

  const safe_to_continue_to_b47 =
    status !== "blocked" && score >= 70 && critical_technologies_ready;
  const ready_for_launch_after_b48 =
    safe_to_continue_to_b47 && degraded_technologies.length === 0;

  return {
    status,
    score,
    safe_to_continue_to_b47,
    ready_for_launch_after_b48,
    critical_technologies_ready,
    degraded_technologies,
    blockers,
    followups,
  };
}
