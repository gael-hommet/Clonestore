// src/lib/clonestore/technologies/t1/technology-validation.ts
// T1 — Validation d'un résultat de technologie. RÈGLE ABSOLUE : la validation machine ne
// contourne JAMAIS la validation humaine (`machineCanAutoApprove: false` au niveau du type).
// Elle vérifie la STRUCTURE d'un résultat ; elle n'approuve aucun effet. Module PUR.

import type { TechnologyContext, TechnologyId } from "./technology-types";
import { ALL_TECHNOLOGY_RESULT_KINDS, type TechnologyResult, type TechnologyResultKind } from "./technology-result";

export interface TechnologyValidationReport {
  readonly technologyId: TechnologyId;
  readonly resultKind: TechnologyResultKind;
  /** Le résultat est-il structurellement valide (id cohérent, jamais live, kind connu) ? */
  readonly structurallyValid: boolean;
  /** true dès que la techno OU le résultat exige l'humain — la machine ne peut pas le rabaisser. */
  readonly humanValidationRequired: boolean;
  /** INVARIANT : la machine n'auto-approuve JAMAIS un effet à la place de l'humain. */
  readonly machineCanAutoApprove: false;
  readonly notes: readonly string[];
}

export interface TechnologyValidationMeta {
  readonly id: TechnologyId;
  readonly requiresValidation: boolean;
}

// ── Invariants structurels des artefacts (anti-blanchiment) ────────────────────
// Un résultat forgé qui se re-étiquette vers une techno `requiresValidation:false`
// (evidence/permission/bus) doit être détecté : l'artefact embarqué trahit sa techno
// d'origine via `artifactKind`, et aucun artefact T1 ne peut prétendre à un effet.

const EXPECTED_ARTIFACT_KIND: Readonly<Record<TechnologyId, string>> = {
  document: "prepared_document",
  mail: "drafted_email",
  calendar: "prepared_calendar_event",
  signature: "prepared_signature_package",
  voice: "voice_fallback",
  notification: "cockpit_reminder",
  connector: "connector_fallback",
  memory: "memory_operation",
  evidence: "evidence_entry",
  workflow: "workflow_plan",
  analytics: "metrics_report",
  file: "file_ingestion",
  export: "export_package",
  permission: "permission_decision",
  integration_bus: "bus_summary",
};

/** Drapeaux qu'aucun artefact T1 ne peut porter à true (un effet n'a jamais eu lieu). */
const FORBIDDEN_EFFECT_CLAIMS: readonly string[] = [
  "sent", "executed", "committed", "createdLive", "liveSignature", "pushSent",
  "transferred", "parsed", "decidesHrOutcomes", "legalGuarantee", "roiGuaranteed", "deliveredToClient",
];

/**
 * Construit le rapport de validation d'un résultat.
 * FAIL-CLOSED : toute incohérence (id différent, `live` forgé, kind inconnu) rend le résultat
 * structurellement invalide ET maintient la validation humaine requise.
 */
export function buildTechnologyValidationReport<T>(
  meta: TechnologyValidationMeta,
  result: TechnologyResult<T>,
  _ctx: TechnologyContext,
): TechnologyValidationReport {
  const notes: string[] = [];
  let structurallyValid = true;

  if (result.technologyId !== meta.id) {
    structurallyValid = false;
    notes.push(`Incohérence d'identifiant : résultat « ${result.technologyId} » vs contrat « ${meta.id} ».`);
  }
  // `live` est `false` au niveau du type, mais un résultat forgé (cast) pourrait mentir → re-vérifié au runtime.
  if ((result as { live: boolean }).live !== false) {
    structurallyValid = false;
    notes.push("Résultat forgé : `live` doit être false en T1 (aucun effet live).");
  }
  if (!ALL_TECHNOLOGY_RESULT_KINDS.includes(result.kind)) {
    structurallyValid = false;
    notes.push(`Kind de résultat inconnu : « ${String(result.kind)} ».`);
  }

  // Anti-blanchiment : l'artefact doit appartenir à la techno déclarée, et ne peut
  // prétendre à AUCUN effet. Un résultat mail « needs_validation » re-étiqueté
  // « evidence/ok » est démasqué ici (artifactKind ≠ evidence_entry) — fail-closed.
  const artifact = result.artifact;
  if (artifact !== null && typeof artifact === "object") {
    const record = artifact as Record<string, unknown>;
    const expectedKind = EXPECTED_ARTIFACT_KIND[meta.id];
    if (record.artifactKind !== expectedKind) {
      structurallyValid = false;
      notes.push(`Artefact étranger : artifactKind « ${String(record.artifactKind)} » ≠ « ${expectedKind} » attendu pour « ${meta.id} ».`);
    }
    for (const flag of FORBIDDEN_EFFECT_CLAIMS) {
      if (record[flag] === true) {
        structurallyValid = false;
        notes.push(`Artefact forgé : « ${flag}: true » — aucun artefact T1 ne peut prétendre à un effet/une garantie.`);
      }
    }
  } else if (result.kind === "ok" || result.kind === "needs_validation") {
    structurallyValid = false;
    notes.push("Artefact absent pour un résultat ok/needs_validation — fail-closed.");
  }

  const humanValidationRequired =
    meta.requiresValidation ||
    result.requiresHumanValidation ||
    result.kind === "needs_validation" ||
    !structurallyValid; // fail-closed : un résultat douteux exige l'humain

  if (humanValidationRequired) {
    notes.push("Validation humaine requise avant tout usage/effet — non contournable par la machine.");
  }

  return {
    technologyId: meta.id,
    resultKind: result.kind,
    structurallyValid,
    humanValidationRequired,
    machineCanAutoApprove: false,
    notes,
  };
}
