// TECH-08 — CloneOS Command Center — Orchestrateur Principal
// Pipeline complet : classify → route → context → plan → guard → trace → result.
// Ne fait rien d'autre que planifier. Aucune exécution réelle.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSCommandInput,
  CloneOSCommandCenterResult,
  CloneOSCommandStatus,
  CloneOSCommandId,
} from "./cloneos-command-types";
import { generateCloneOSCommandId, classifyCloneOSCommand } from "./cloneos-command-classifier";
import { routeCloneOSCommand } from "./cloneos-employee-router";
import { buildCloneOSCommandContext, buildTraceContextForCommand } from "./cloneos-command-context";
import { buildCloneOSCommandPlan } from "./cloneos-command-plan";
import {
  evaluateCloneOSCommandPlanWithGuard,
  applyGuardDecisionToPlan,
} from "./cloneos-command-guard";
import {
  buildCloneOSCommandTraceEvents,
  buildCloneOSCommandTraceResult,
} from "./cloneos-command-trace";

// ── Input normalisation ───────────────────────────────────────────────────────

function normalizeCommandInput(input: CloneOSCommandInput): CloneOSCommandInput {
  return {
    ...input,
    command_id: input.command_id ?? generateCloneOSCommandId(),
    raw_request: input.raw_request.trim(),
    created_at: input.created_at ?? new Date().toISOString(),
    attached_file_refs: input.attached_file_refs ?? [],
    metadata: input.metadata ?? {},
    is_demo: input.is_demo ?? false,
  };
}

// ── Helpers next_action ───────────────────────────────────────────────────────

function buildNextAction(
  status: CloneOSCommandStatus,
  guardDecision?: string,
): string {
  switch (status) {
    case "ready_for_execution":
      return "Le plan est prêt. Déclencher l'employé IA avec la mission planifiée.";
    case "requires_validation":
      return "Validation humaine requise. Soumettre le plan au responsable pour approbation.";
    case "blocked":
      return "Action bloquée par CloneGuard. Revoir la demande ou contacter un administrateur.";
    case "refused":
      return "Action refusée — invariant absolu CloneGuard. Cette action ne peut être exécutée par un employé IA.";
    case "failed":
      return "Traitement échoué. Vérifier la demande et réessayer.";
    default:
      return `Statut : ${status}. Vérifier les étapes du pipeline.`;
  }
}

// ── Pipeline principal ────────────────────────────────────────────────────────

/**
 * Traite une commande CloneOS à travers le pipeline complet.
 * Ne fait que planifier — aucune exécution, aucune DB.
 *
 * Pipeline :
 * 1. Normalise l'input
 * 2. Classifie la commande
 * 3. Route vers l'employé
 * 4. Construit le contexte (TECH-02 + TECH-05 + TECH-06 + TECH-07)
 * 5. Construit le plan de mission
 * 6. Évalue avec CloneGuard (TECH-06)
 * 7. Génère les événements de trace (TECH-07)
 * 8. Retourne le résultat
 */
export function processCloneOSCommand(
  rawInput: CloneOSCommandInput,
): CloneOSCommandCenterResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const generatedAt = new Date().toISOString();

  // ── Étape 0 : Validation minimale ─────────────────────────────────────────
  if (!rawInput.company_id?.trim()) {
    return {
      ok: false,
      status: "failed",
      command_id: rawInput.command_id ?? generateCloneOSCommandId(),
      errors: ["company_id est requis."],
      warnings: [],
      next_action: "Fournir un company_id valide.",
      generated_at: generatedAt,
    };
  }

  if (!rawInput.raw_request?.trim()) {
    return {
      ok: false,
      status: "failed",
      command_id: rawInput.command_id ?? generateCloneOSCommandId(),
      errors: ["raw_request ne peut pas être vide."],
      warnings: [],
      next_action: "Fournir une demande non vide.",
      generated_at: generatedAt,
    };
  }

  // ── Étape 1 : Normalisation ────────────────────────────────────────────────
  const input = normalizeCommandInput(rawInput);
  const commandId = input.command_id as CloneOSCommandId;

  // ── Étape 2 : Classification ───────────────────────────────────────────────
  const classified = classifyCloneOSCommand(input);
  if (classified.classification_notes.length > 0) {
    warnings.push(...classified.classification_notes);
  }

  // ── Étape 3 : Routage ──────────────────────────────────────────────────────
  const route = routeCloneOSCommand(classified);
  if (route.route_warnings.length > 0) {
    warnings.push(...route.route_warnings);
  }

  // Si aucun employé disponible → retourner résultat bloqué
  if (!route.is_available) {
    const traceCtx = buildTraceContextForCommand(input.company_id);
    return {
      ok: false,
      status: "blocked",
      command_id: commandId,
      classified_command: classified,
      selected_route: route,
      errors: [route.route_reason],
      warnings,
      next_action: "Aucun employé IA disponible pour ce domaine en V1. "
        + "Seul Pierre (RH) est opérationnel.",
      generated_at: generatedAt,
      trace_result: buildCloneOSCommandTraceResult([], traceCtx.timeline_id),
    };
  }

  // ── Étape 4 : Contexte ─────────────────────────────────────────────────────
  const context = buildCloneOSCommandContext(input, classified, route);
  if (context.context_warnings.length > 0) {
    warnings.push(...context.context_warnings);
  }

  // ── Étape 5 : Plan ─────────────────────────────────────────────────────────
  const missionPlan = buildCloneOSCommandPlan(input, classified, route, context);

  // ── Étape 6 : Guard ────────────────────────────────────────────────────────
  const guardResult = evaluateCloneOSCommandPlanWithGuard(missionPlan, context);
  const updatedPlan = applyGuardDecisionToPlan(missionPlan, guardResult);

  // ── Étape 7 : Trace ────────────────────────────────────────────────────────
  const timelineId = context.trace_timeline_id ?? `tl_${input.company_id}`;
  const traceEvents = buildCloneOSCommandTraceEvents(
    input, classified, route, updatedPlan, guardResult, timelineId,
  );
  const traceResult = buildCloneOSCommandTraceResult(traceEvents, timelineId);

  // ── Étape 8 : Statut final ─────────────────────────────────────────────────
  let finalStatus: CloneOSCommandStatus = "trace_ready";

  if (guardResult.has_refused_tasks) {
    finalStatus = "refused";
    errors.push("Certaines actions ont été refusées par les invariants absolus CloneGuard.");
  } else if (guardResult.has_blocked_tasks) {
    finalStatus = "blocked";
    errors.push("Certaines actions ont été bloquées par CloneGuard.");
  } else if (guardResult.has_validation_required_tasks || updatedPlan.validation_required) {
    finalStatus = "requires_validation";
  } else {
    finalStatus = "ready_for_execution";
  }

  const ok = finalStatus !== "refused" && finalStatus !== "blocked";

  return {
    ok,
    status: finalStatus,
    command_id: commandId,
    classified_command: classified,
    selected_route: route,
    context,
    mission_plan: updatedPlan,
    guard_result: guardResult,
    trace_result: traceResult,
    errors,
    warnings,
    next_action: buildNextAction(finalStatus, guardResult.overall_decision),
    generated_at: generatedAt,
  };
}
