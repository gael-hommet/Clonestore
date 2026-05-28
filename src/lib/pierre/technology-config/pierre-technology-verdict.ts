// B46 — Pierre Technology Verdict
// Builds B46 Pierre technology verdict for launch readiness.
// Pure: no Supabase, no Next, no async, no side effects. No throw.

import type {
  B46TechnologyItem,
  B46ReadinessContext,
} from "../../clonestore/technologies/technology-b46-types";
import { computePierreTechnologyReadiness } from "./pierre-technology-readiness";
import { applyTechnologyConfigToPierreWorkflow } from "./pierre-technology-bridge";

export type B46PierreVerdict = {
  status: "validated_with_followups" | "degraded" | "blocked";
  score: number;
  safe_to_continue_to_b47: boolean;
  pierre_ready: boolean;
  missing_critical: string[];
  blocked_features: string[];
  warnings: string[];
  followups: string[];
};

export function buildB46PierreTechnologyVerdict(
  items: B46TechnologyItem[],
  context: B46ReadinessContext,
): B46PierreVerdict {
  const readiness = computePierreTechnologyReadiness(items, context);
  const workflow = applyTechnologyConfigToPierreWorkflow(items);

  const followups: string[] = [];

  if (!readiness.voice_ready) {
    followups.push("Activer CloneVoice avec un fournisseur vocal pour interactions vocales.");
  }
  if (!readiness.chat_ready) {
    followups.push("Configurer CloneChat pour support et orientation utilisateur.");
  }
  if (!readiness.premium_documents_ready) {
    followups.push("Configurer Document Style Kit B45 pour documents premium.");
  }
  if (context.email_runtime_mode === "mock") {
    followups.push("Configurer EMAIL_RUNTIME_MODE=production pour envoi emails réels.");
  }
  if (context.ai_runtime_mode === "mock") {
    followups.push("Configurer AI_RUNTIME_MODE=production pour génération IA réelle.");
  }

  let status: B46PierreVerdict["status"] = "validated_with_followups";
  if (workflow.block_all_missions || readiness.missing_critical.length > 0) status = "blocked";
  else if (readiness.degraded_capabilities.length > 2) status = "degraded";

  return {
    status,
    score: readiness.score,
    safe_to_continue_to_b47: status !== "blocked" && readiness.score >= 60,
    pierre_ready: readiness.ready,
    missing_critical: readiness.missing_critical,
    blocked_features: workflow.blocked_reasons,
    warnings: readiness.warnings,
    followups,
  };
}
