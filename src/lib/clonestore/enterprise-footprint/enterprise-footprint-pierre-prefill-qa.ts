// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-prefill-qa.ts
// PHASE 3.12 — Pierre Use Mission Composer Footprint Prefill QA — QA Module
//
// Module pur — aucun appel réseau, aucun Supabase, aucun write, aucun import pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierreFootprintPrefillQaStepId =
  | "suggestion_plan_only_available"
  | "prefill_payload_builds"
  | "prefill_payload_validates"
  | "prompt_sanitized"
  | "disabled_suggestion_not_prefilled"
  | "composer_setter_available"
  | "prefill_button_visible"
  | "prefill_sets_input_only"
  | "no_auto_submit"
  | "no_api_call"
  | "no_db_write"
  | "no_pierre_engine_import"
  | "confirmation_visible"
  | "existing_submit_preserved"
  | "rollback_no_footprint_safe";

export type PierreFootprintPrefillQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type PierreFootprintPrefillQaStep = {
  id: PierreFootprintPrefillQaStepId;
  label: string;
  description: string;
  severity: "blocking" | "warning" | "info";
  status: PierreFootprintPrefillQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type PierreFootprintPrefillQaVerdict =
  | "ready_for_qa"
  | "blocked"
  | "passed"
  | "needs_review";

export type PierreFootprintPrefillQaChecklist = {
  steps: PierreFootprintPrefillQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.12";
};

export type PierreFootprintPrefillQaSummary = {
  verdict: PierreFootprintPrefillQaVerdict;
  blocking_steps: PierreFootprintPrefillQaStepId[];
  passed_steps: PierreFootprintPrefillQaStepId[];
  pending_steps: PierreFootprintPrefillQaStepId[];
  message: string;
  qa_safe: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildPierreFootprintPrefillQaChecklist(): PierreFootprintPrefillQaChecklist {
  const steps: PierreFootprintPrefillQaStep[] = [
    {
      id: "suggestion_plan_only_available",
      label: "Suggestions plan-only disponibles",
      description: "Au moins une suggestion plan_only: true est disponible depuis l'Empreinte.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que buildPierreUseFootprintMissionSuggestions() retourne des suggestions avec plan_only: true.",
      expected_result: "Au moins 1 suggestion plan_only: true disponible.",
    },
    {
      id: "prefill_payload_builds",
      label: "Payload prefill construit",
      description: "buildPierreFootprintPrefillPayload(suggestion) retourne un payload valide.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Appeler buildPierreFootprintPrefillPayload avec une suggestion non-disabled.",
      expected_result: "Payload avec prompt, plan_only: true, requires_user_submit: true.",
    },
    {
      id: "prefill_payload_validates",
      label: "Payload prefill validé",
      description: "validatePierreFootprintPrefillPayload(payload) retourne valid: true.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Appeler validatePierreFootprintPrefillPayload avec payload valide.",
      expected_result: "{ valid: true, status: 'valid', issues: [] }",
    },
    {
      id: "prompt_sanitized",
      label: "Prompt sanitisé avant prefill",
      description: "sanitizePierreFootprintPrefillPrompt() retire les espaces excessifs.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Passer un prompt avec espaces multiples → vérifier le résultat.",
      expected_result: "Prompt propre sans espaces ou newlines excessifs.",
    },
    {
      id: "disabled_suggestion_not_prefilled",
      label: "Suggestion désactivée non préremplie",
      description: "shouldAllowPierreFootprintPrefill() retourne allowed: false si disabled: true.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Passer une suggestion disabled → vérifier que buildPierreFootprintPrefillPayload retourne null.",
      expected_result: "null — suggestion désactivée non préremplie.",
    },
    {
      id: "composer_setter_available",
      label: "Setter du composer accessible",
      description: "cockpit.setInputDraft est disponible dans usePierreCockpit et exposé.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que usePierreCockpit retourne setInputDraft dans son objet de retour.",
      expected_result: "setInputDraft présent dans le return du hook.",
    },
    {
      id: "prefill_button_visible",
      label: "Bouton 'Utiliser' visible sur suggestions non-disabled",
      description: "Un bouton 'Utiliser' / 'Préremplir' est affiché sur les suggestions non-disabled dans le cockpit actif.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Aller sur /agents/pierre/use (accès actif) → vérifier les boutons sur suggestions.",
      expected_result: "Bouton 'Utiliser' visible sur les suggestions non-disabled.",
    },
    {
      id: "prefill_sets_input_only",
      label: "Préremplissage modifie uniquement l'input",
      description: "Cliquer 'Utiliser' appelle uniquement cockpit.setInputDraft — pas submitMission.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Cliquer 'Utiliser' → vérifier que le textarea est rempli mais pas soumis.",
      expected_result: "Textarea rempli. Aucun message envoyé. Aucun appel API.",
    },
    {
      id: "no_auto_submit",
      label: "Pas d'auto-submit",
      description: "Le bouton 'Utiliser' ne déclenche pas l'envoi de la mission.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "DevTools Network → vérifier absence de POST /api/pierre/missions après clic 'Utiliser'.",
      expected_result: "Aucune requête vers l'API Pierre.",
    },
    {
      id: "no_api_call",
      label: "Pas d'appel API",
      description: "Le module prefill ne fait aucun fetch, XHR ou appel réseau.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier le code du prefill module : pas de fetch, axios, XHR.",
      expected_result: "Module 100% pur, pas de réseau.",
    },
    {
      id: "no_db_write",
      label: "Aucun write DB",
      description: "Le préremplissage ne déclenche aucune écriture DB.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "DevTools Network → vérifier absence de requêtes INSERT/UPDATE Supabase.",
      expected_result: "Aucune requête write Supabase.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Pas d'import moteur Pierre",
      description: "Le prefill module n'importe pas src/lib/pierre/**.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier enterprise-footprint-pierre-prefill.ts : pas d'import @/lib/pierre.",
      expected_result: "Aucun import moteur Pierre.",
    },
    {
      id: "confirmation_visible",
      label: "Confirmation visible après préremplissage",
      description: "Un message 'Suggestion ajoutée au composer' est affiché après clic 'Utiliser'.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Cliquer 'Utiliser' → vérifier l'apparition de la confirmation.",
      expected_result: "Message de confirmation visible ~4 secondes.",
    },
    {
      id: "existing_submit_preserved",
      label: "Submit existant préservé",
      description: "L'utilisateur peut toujours envoyer sa mission manuellement après préremplissage.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Après 'Utiliser', taper dans le textarea et appuyer sur Enter → mission envoyée normalement.",
      expected_result: "Submit fonctionne normalement. PierreCockpitShell inchangé.",
    },
    {
      id: "rollback_no_footprint_safe",
      label: "Rollback → sans empreinte propre",
      description: "Si localStorage supprimé, les boutons 'Utiliser' disparaissent proprement.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Supprimer localStorage → recharger /agents/pierre/use.",
      expected_result: "Strip sans suggestions. Aucun bouton 'Utiliser'. Aucune erreur.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.12",
  };
}

export function buildPierreFootprintPrefillQaVerdict(
  steps: PierreFootprintPrefillQaStep[]
): PierreFootprintPrefillQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: PierreFootprintPrefillQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_qa";
  else verdict = "needs_review";

  const qaSafe =
    verdict === "passed" ||
    (verdict === "needs_review" && blockingFailed.length === 0);

  const summary: PierreFootprintPrefillQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    qa_safe: qaSafe,
  };
  summary.message = summarizePierreFootprintPrefillQaVerdict(summary);
  return summary;
}

export function getPierreFootprintPrefillBlockingSteps(): PierreFootprintPrefillQaStep[] {
  return buildPierreFootprintPrefillQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizePierreFootprintPrefillQaVerdict(
  summary: PierreFootprintPrefillQaSummary
): string {
  const lines = [
    `[QA PHASE 3.12 Pierre Prefill] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
  ];
  if (summary.verdict === "passed") lines.push("  → QA Pierre Prefill validée.");
  else if (summary.verdict === "ready_for_qa") lines.push("  → Prêt pour QA manuelle.");
  return lines.join("\n");
}
