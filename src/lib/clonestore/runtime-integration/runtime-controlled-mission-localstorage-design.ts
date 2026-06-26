// src/lib/clonestore/runtime-integration/runtime-controlled-mission-localstorage-design.ts
// PHASE 4.10 — Controlled Mission — LocalStorage Design (DESIGN-ONLY)
//
// Définit la stratégie future localStorage-first pour les CANDIDATES de
// ControlledMission SANS écrire ni lire le navigateur en P4.10.
// Module pur — aucune écriture/lecture (design-only).

import type { RuntimeMissionPromotionContract } from "./runtime-mission-promotion-types";

// ── Clés (déclarées, jamais écrites en P4.10) ─────────────────────────────────

export const RUNTIME_CONTROLLED_MISSION_LOCALSTORAGE_KEY =
  "clonestore.runtimeControlledMissions.local.v1" as const;

export const RUNTIME_CONTROLLED_MISSION_LAST_PREVIEW_KEY =
  "clonestore.runtimeControlledMissions.lastPreview.v1" as const;

// ── Stratégie future ──────────────────────────────────────────────────────────

export type RuntimeControlledMissionLocalStorageStrategy = {
  primary_key: string;
  last_preview_key: string;
  localstorage_first: true;
  future_flow: string[];
  writes_in_p4_10: false;
  reads_in_p4_10: false;
  read_only: true;
};

export function buildRuntimeControlledMissionLocalStorageStrategy(): RuntimeControlledMissionLocalStorageStrategy {
  return {
    primary_key: RUNTIME_CONTROLLED_MISSION_LOCALSTORAGE_KEY,
    last_preview_key: RUNTIME_CONTROLLED_MISSION_LAST_PREVIEW_KEY,
    localstorage_first: true,
    future_flow: [
      "1. Créer l'aperçu de candidate de mission contrôlée (contrat de promotion).",
      "2. Sauvegarder une copie locale en premier (localStorage-first, futur).",
      "3. Si flag + serveur prêt + auth → safe apply serveur best-effort (futur).",
      "4. Fallback local si serveur indisponible.",
      "5. Restaurer la version la plus récente (local/server).",
      "6. Validation humaine requise avant toute mission réelle.",
    ],
    writes_in_p4_10: false,
    reads_in_p4_10: false,
    read_only: true,
  };
}

// ── Envelope (forme future, jamais persistée en P4.10) ────────────────────────

export type RuntimeControlledMissionLocalStorageEnvelope = {
  schema_version: "v1";
  key: string;
  candidate_id: string;
  promotion_id: string;
  draft_id: string;
  saved_at: string;
  persisted_in_p4_10: false;
  human_validation_required: true;
  promotion_applied: false;
  payload: RuntimeMissionPromotionContract;
};

export function buildRuntimeControlledMissionLocalStorageEnvelope(
  contract: RuntimeMissionPromotionContract
): RuntimeControlledMissionLocalStorageEnvelope {
  return {
    schema_version: "v1",
    key: RUNTIME_CONTROLLED_MISSION_LOCALSTORAGE_KEY,
    candidate_id: `cand_${contract.promotion_id}`,
    promotion_id: contract.promotion_id,
    draft_id: contract.draft_id,
    saved_at: new Date().toISOString(),
    persisted_in_p4_10: false,
    human_validation_required: true,
    promotion_applied: false,
    payload: contract,
  };
}

export function validateRuntimeControlledMissionLocalStorageEnvelope(
  envelope: RuntimeControlledMissionLocalStorageEnvelope
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (envelope.schema_version !== "v1") issues.push("schema_version doit être v1.");
  if (!envelope.candidate_id?.trim()) issues.push("candidate_id requis.");
  if (!envelope.promotion_id?.trim()) issues.push("promotion_id requis.");
  if (envelope.persisted_in_p4_10 !== false) issues.push("persisted_in_p4_10 doit être false.");
  if (envelope.promotion_applied !== false) issues.push("promotion_applied doit être false.");
  if (envelope.human_validation_required !== true) issues.push("human_validation_required doit être true.");
  if (!envelope.payload || envelope.payload.read_only !== true) issues.push("payload.read_only doit être true.");
  return { valid: issues.length === 0, issues };
}

export function summarizeRuntimeControlledMissionLocalStorageDesign(): string {
  const s = buildRuntimeControlledMissionLocalStorageStrategy();
  return [
    "[Controlled Mission LocalStorage Design] localStorage-first future flow (design-only).",
    `  Clé : ${s.primary_key}`,
    `  Écritures en P4.10 : ${s.writes_in_p4_10} · Lectures en P4.10 : ${s.reads_in_p4_10}`,
    ...s.future_flow.map((f) => `  ${f}`),
    "  P4.10 design only — aucune écriture navigateur. Validation humaine requise.",
  ].join("\n");
}
