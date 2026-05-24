// src/lib/pierre/context/context-runtime.ts
// B35 — Main orchestrator: buildPierreContextPack().
// Pure, synchronous, deterministic. No async, no DB, no AI calls.

import type { PierreContextBuildInput, PierreContextBuildResult } from "./types";
import { buildCompanyContextSignals } from "./company-context";
import { buildEmployeeContextSignals } from "./employee-context";
import { buildMissionContextSignals } from "./mission-context";
import { buildTaskContextSignals } from "./task-context";
import { buildFileContextSignals } from "./file-context";
import { buildChannelContextSignals } from "./channel-context";
import { buildHistoryContextSignals } from "./history-context";
import { buildRulesContextSignals } from "./rules-context";
import { buildValidationContextSignals } from "./validation-context";
import { buildRiskContextSignals } from "./risk-context";
import { assemblePierreContextPack } from "./context-pack";

export function buildPierreContextPack(
  input: PierreContextBuildInput,
): PierreContextBuildResult {
  const startMs = Date.now();
  const warnings: string[] = [];

  const {
    company_id,
    built_for,
    employee_id,
    mission_id,
    task_id,
    file_id,
    channel_identity_id,
    company_memory,
    clone_adn_profile,
    employee_profile,
    employees = [],
    mission,
    tasks = [],
    files = [],
    channel_identity,
    channel_identities = [],
    recent_logs = [],
    recent_missions = [],
    current_task_type,
    current_domain,
    current_risk_level: _current_risk_level, // available but not used at signal-builder level
  } = input;

  if (!company_id) {
    warnings.push("company_id manquant — contexte dégradé.");
  }

  // ── Phase 1: Build domain signals ─────────────────────────────────────────

  const companySignals = buildCompanyContextSignals({
    company_id,
    company_memory: company_memory ?? null,
    clone_adn_profile: clone_adn_profile ?? null,
    current_task_type,
    current_domain,
  });

  const employeeSignals = buildEmployeeContextSignals({
    company_id,
    employee_id: employee_id ?? null,
    employee_profile: employee_profile ?? null,
    employees,
    recent_missions,
    recent_tasks: tasks,
    current_task_type,
    current_domain,
  });

  const missionSignals = buildMissionContextSignals({
    company_id,
    mission_id: mission_id ?? null,
    mission: mission ?? null,
    tasks,
    employee_id: employee_id ?? null,
    current_task_type,
    current_domain,
  });

  const taskSignals = buildTaskContextSignals({
    company_id,
    task_id: task_id ?? null,
    tasks,
    mission_id: mission_id ?? null,
    employee_id: employee_id ?? null,
    current_task_type,
    current_domain,
  });

  const fileSignals = buildFileContextSignals({
    company_id,
    file_id: file_id ?? null,
    files,
    mission_id: mission_id ?? null,
    employee_id: employee_id ?? null,
    current_task_type,
    current_domain,
  });

  const channelSignals = buildChannelContextSignals({
    company_id,
    channel_identity_id: channel_identity_id ?? null,
    channel_identity: channel_identity ?? null,
    channel_identities,
    mission_id: mission_id ?? null,
    employee_id: employee_id ?? null,
    current_task_type,
    current_domain,
  });

  const historySignals = buildHistoryContextSignals({
    company_id,
    recent_logs,
    recent_missions,
    employee_id: employee_id ?? null,
    mission_id: mission_id ?? null,
    current_task_type,
    current_domain,
  });

  const rulesSignals = buildRulesContextSignals({
    company_id,
    clone_adn_profile: clone_adn_profile ?? null,
    current_task_type,
    current_domain,
  });

  // ── Phase 2: Aggregate all signals ────────────────────────────────────────

  const allSignals = [
    ...companySignals,
    ...employeeSignals,
    ...missionSignals,
    ...taskSignals,
    ...fileSignals,
    ...channelSignals,
    ...historySignals,
    ...rulesSignals,
  ];

  // ── Phase 3: Validation + risk overlay signals (use aggregated signals) ───

  const validationSignals = buildValidationContextSignals({
    company_id,
    clone_adn_profile: clone_adn_profile ?? null,
    tasks,
    files,
    current_task_type,
    employee_id: employee_id ?? null,
    mission_id: mission_id ?? null,
  });

  const riskSignals = buildRiskContextSignals({
    company_id,
    existing_signals: [...allSignals, ...validationSignals],
    current_task_type,
    current_domain,
    employee_id: employee_id ?? null,
    mission_id: mission_id ?? null,
  });

  const finalSignals = [...allSignals, ...validationSignals, ...riskSignals];

  // ── Phase 4: Assemble pack ────────────────────────────────────────────────

  const pack = assemblePierreContextPack({
    company_id,
    built_for,
    employee_id: employee_id ?? null,
    mission_id: mission_id ?? null,
    task_id: task_id ?? null,
    file_id: file_id ?? null,
    channel_identity_id: channel_identity_id ?? null,
    signals: finalSignals,
  });

  const buildDurationMs = Date.now() - startMs;

  return {
    pack,
    signal_count: finalSignals.length,
    missing_info: pack.missing_info,
    should_require_validation: pack.should_require_validation,
    recommended_next_action: pack.recommended_next_action,
    warnings,
    build_duration_ms: buildDurationMs,
  };
}
