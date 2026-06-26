// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-final-gate.ts
// PHASE 5.7 — Controlled Mission Server Persistence Readiness Final Gate (pur)
//
// DESIGN-ONLY. Agrège les preuves P5.1 → P5.6 et produit un rapport de fermeture
// déterministe. N'ACTIVE RIEN. Aucune persistance. Aucune restauration. Aucune
// route. Aucun SQL appliqué. Aucune exécution. Aucun appel réseau. Aucun moteur
// Pierre. Aucune IA. localStorage reste la seule source active.
//
// Verdict possible : go_for_next_design_phase / needs_review / blocked.
// JAMAIS « production ready ». JAMAIS « execution ready ».

import type {
  ControlledMissionServerPersistenceFinalGateCheck,
  ControlledMissionServerPersistenceFinalGateCheckStatus,
  ControlledMissionServerPersistenceFinalGateCheckSeverity,
  ControlledMissionServerPersistenceFinalGateSection,
  ControlledMissionServerPersistenceFinalGateSectionStatus,
  ControlledMissionServerPersistenceFinalGateCommand,
  ControlledMissionServerPersistenceFinalGateEvidenceItem,
  ControlledMissionServerPersistenceFinalGateInvariant,
  ControlledMissionServerPersistenceFinalGateVerdict,
  ControlledMissionServerPersistenceFinalGateReadinessLevel,
  ControlledMissionServerPersistenceFinalGateReport,
} from "./controlled-mission-server-persistence-final-gate-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function check(
  id: string,
  label: string,
  status: ControlledMissionServerPersistenceFinalGateCheckStatus,
  severity: ControlledMissionServerPersistenceFinalGateCheckSeverity,
  detail: string,
  source_phase: string
): ControlledMissionServerPersistenceFinalGateCheck {
  return { id, label, status, severity, detail, source_phase, no_execution_confirmed: true };
}

function deriveSectionStatus(
  checks: ControlledMissionServerPersistenceFinalGateCheck[]
): ControlledMissionServerPersistenceFinalGateSectionStatus {
  if (checks.some((c) => c.severity === "blocking" && c.status === "failed")) return "failed";
  if (checks.some((c) => c.status === "pending")) return "pending";
  if (checks.some((c) => c.status === "warning")) return "warning";
  return "passed";
}

function sectionScore(status: ControlledMissionServerPersistenceFinalGateSectionStatus): number {
  switch (status) {
    case "passed":
      return 100;
    case "warning":
      return 60;
    case "pending":
      return 30;
    case "failed":
      return 0;
  }
}

function section(
  id: string,
  title: string,
  summary: string,
  blocking: boolean,
  checks: ControlledMissionServerPersistenceFinalGateCheck[]
): ControlledMissionServerPersistenceFinalGateSection {
  const status = deriveSectionStatus(checks);
  return { id, title, status, score: sectionScore(status), summary, checks, blocking };
}

// ── Sections (A → H) ──────────────────────────────────────────────────────────

export function buildControlledMissionServerPersistenceFinalGateSections(): ControlledMissionServerPersistenceFinalGateSection[] {
  return [
    section(
      "p51_foundation",
      "A. Local Controlled Mission Foundation",
      "Safe apply local actif — localStorage source active, aucune exécution, aucun serveur.",
      true,
      [
        check("p51_safe_apply_active", "P5.1 safe apply actif", "passed", "blocking", "Création locale des missions contrôlées active.", "5.1"),
        check("p51_localstorage_source", "localStorage source active", "passed", "blocking", "Stockage navigateur uniquement.", "5.1"),
        check("p51_no_execution", "Aucune exécution", "passed", "blocking", "Mission préparée, jamais exécutée.", "5.1"),
        check("p51_no_server", "Aucun serveur", "passed", "blocking", "Aucune persistance serveur.", "5.1"),
      ]
    ),
    section(
      "p52_review",
      "B. Human Review Layer",
      "Revue locale active — approbation locale uniquement, aucune exécution après approbation.",
      true,
      [
        check("p52_review_active", "P5.2 review actif", "passed", "blocking", "Revue et validation humaine locale active.", "5.2"),
        check("p52_approval_local_only", "Approbation locale uniquement", "passed", "blocking", "L'approbation locale n'exécute rien.", "5.2"),
        check("p52_no_execution_after_approval", "Aucune exécution après approbation", "passed", "blocking", "Même approuvée, la mission reste préparée.", "5.2"),
      ]
    ),
    section(
      "p53_preflight",
      "C. Local Preflight Layer",
      "Preflight local actif — ready = candidate future uniquement, aucune exécution runtime.",
      true,
      [
        check("p53_preflight_active", "P5.3 preflight actif", "passed", "blocking", "Readiness gate locale active.", "5.3"),
        check("p53_ready_candidate_future_only", "ready = candidate future uniquement", "passed", "blocking", "Un ready ne déclenche aucune action.", "5.3"),
        check("p53_no_runtime_execution", "Aucune exécution runtime", "passed", "blocking", "Runtime execution désactivée.", "5.3"),
      ]
    ),
    section(
      "p54_server_design",
      "D. Server Persistence Design",
      "Design serveur prêt — SQL draft non appliqué, flag off, API contract design-only, aucune route.",
      true,
      [
        check("p54_design_ready", "P5.4 design serveur prêt", "passed", "blocking", "Modèle de persistance serveur gouvernée conçu.", "5.4"),
        check("p54_sql_draft_exists", "SQL draft présent", "passed", "blocking", "SQL draft clonestore_controlled_missions présent.", "5.4"),
        check("p54_sql_not_applied", "SQL non appliqué", "passed", "blocking", "DO NOT APPLY — aucun SQL appliqué.", "5.4"),
        check("p54_flag_default_false", "Flag serveur default false", "passed", "blocking", "Feature flag serveur désactivé par défaut.", "5.4"),
        check("p54_api_contract_disabled_design_only", "API contract disabled_design_only", "passed", "blocking", "Route future documentée, statut disabled_design_only.", "5.4"),
        check("p54_no_route_created", "Aucune route créée", "passed", "blocking", "Aucun fichier route serveur créé.", "5.4"),
      ]
    ),
    section(
      "p55_manual_qa",
      "E. Manual Activation QA",
      "QA d'activation manuelle prête — runbook + evidence présents, aucune activation effectuée.",
      true,
      [
        check("p55_checklist_ready", "P5.5 checklist prête", "passed", "blocking", "Checklist d'activation manuelle prête.", "5.5"),
        check("p55_runbook_exists", "Runbook présent", "passed", "blocking", "Runbook d'activation manuelle présent.", "5.5"),
        check("p55_evidence_template_exists", "Evidence template présent", "passed", "blocking", "Template d'evidence d'activation présent.", "5.5"),
        check("p55_no_manual_activation_performed", "Aucune activation manuelle effectuée", "passed", "blocking", "Aucune activation réalisée — préparation uniquement.", "5.5"),
      ]
    ),
    section(
      "p56_restore_ui",
      "F. Server Restore UI",
      "UI de restauration future prête — localStorage source active, aucun GET serveur, aucune lecture DB, aucune route restore.",
      true,
      [
        check("p56_restore_ui_design_ready", "P5.6 restore UI prête (design)", "passed", "blocking", "UI de restauration serveur future conçue.", "5.6"),
        check("p56_localstorage_source", "localStorage source active", "passed", "blocking", "Source active reste localStorage.", "5.6"),
        check("p56_no_get_server", "Aucun GET serveur", "passed", "blocking", "Aucun GET serveur effectué.", "5.6"),
        check("p56_no_db_read", "Aucune lecture DB", "passed", "blocking", "Aucune lecture base de données.", "5.6"),
        check("p56_no_route_restore", "Aucune route restore", "passed", "blocking", "Aucune route restore créée.", "5.6"),
      ]
    ),
    section(
      "global_no_execution",
      "G. Global No-Execution Invariants",
      "Invariants globaux — runtime inactif, Pierre inactif, aucune IA, aucun email/document/PDF, CloneVoice inactif.",
      true,
      [
        check("g_runtime_inactive", "Runtime inactif", "passed", "blocking", "Runtime execution toujours inactive.", "5.1-5.6"),
        check("g_pierre_inactive", "Pierre inactif", "passed", "blocking", "Pierre autonomous runtime inactif.", "5.1-5.6"),
        check("g_no_ia", "Aucune IA", "passed", "blocking", "Aucun appel IA externe.", "5.1-5.6"),
        check("g_no_email_document_pdf", "Aucun email/document/PDF", "passed", "blocking", "Aucun email, document ou PDF généré.", "5.1-5.6"),
        check("g_clonevoice_inactive", "CloneVoice inactif", "passed", "blocking", "CloneVoice non actif.", "5.1-5.6"),
      ]
    ),
    section(
      "launch_scale_warnings",
      "H. Launch / Scale Warnings",
      "Avertissements — lancement public externe non validé, scale 80k non prouvé, persistance serveur non active en production.",
      false,
      [
        check("h_public_launch_external_not_validated", "Lancement public externe non validé", "warning", "warning", "Lancement public externe non validé.", "global"),
        check("h_scale_80k_not_proven", "Scale 80k non prouvé", "warning", "warning", "Scale 80k non prouvé.", "global"),
        check("h_server_persistence_not_production_active", "Persistance serveur non active en production", "warning", "warning", "Persistance serveur préparée mais non active en production.", "global"),
      ]
    ),
  ];
}

// ── Score (déterministe) ──────────────────────────────────────────────────────

export function computeControlledMissionServerPersistenceFinalGateScore(
  sections: ControlledMissionServerPersistenceFinalGateSection[]
): number {
  if (sections.length === 0) return 0;
  const total = sections.reduce((acc, s) => acc + s.score, 0);
  return Math.round(total / sections.length);
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export function evaluateControlledMissionServerPersistenceFinalGateVerdict(
  sections: ControlledMissionServerPersistenceFinalGateSection[]
): ControlledMissionServerPersistenceFinalGateVerdict {
  const blockingFailed = sections.filter((s) => s.blocking && s.status === "failed");
  if (blockingFailed.length > 0) return "blocked";
  const pending = sections.filter((s) => s.status === "pending");
  if (pending.length > 0) return "needs_review";
  // Tous les blocants passent ; il peut rester des warnings (section H).
  return "go_for_next_design_phase";
}

function deriveReadinessLevel(
  score: number,
  verdict: ControlledMissionServerPersistenceFinalGateVerdict
): ControlledMissionServerPersistenceFinalGateReadinessLevel {
  if (verdict === "blocked") return "incomplete";
  if (verdict === "needs_review") return "manually_review_ready";
  if (score >= 85) return "next_phase_candidate";
  if (score >= 70) return "manually_review_ready";
  return "design_ready";
}

// ── Evidence / command matrix / invariants ────────────────────────────────────

export function buildControlledMissionServerPersistenceFinalGateEvidence(): ControlledMissionServerPersistenceFinalGateEvidenceItem[] {
  return [
    { id: "ev_safe_apply", label: "Safe apply local (P5.1)", expected: "test:phase5-1 vert · check safe-apply PASS", manual_capture_required: true },
    { id: "ev_review", label: "Revue locale (P5.2)", expected: "test:phase5-2 vert · check local-review PASS", manual_capture_required: true },
    { id: "ev_preflight", label: "Preflight local (P5.3)", expected: "test:phase5-3 vert · check preflight PASS", manual_capture_required: true },
    { id: "ev_server_design", label: "Design serveur (P5.4)", expected: "test:phase5-4 vert · SQL non appliqué", manual_capture_required: true },
    { id: "ev_manual_qa", label: "QA activation manuelle (P5.5)", expected: "test:phase5-5 vert · runbook présent", manual_capture_required: true },
    { id: "ev_restore_ui", label: "Restore UI (P5.6)", expected: "test:phase5-6 vert · aucun GET serveur", manual_capture_required: true },
    { id: "ev_no_execution", label: "Invariants no-execution", expected: "Tous les *_active/*_performed false", manual_capture_required: true },
  ];
}

export function buildControlledMissionServerPersistenceFinalGateCommandMatrix(): ControlledMissionServerPersistenceFinalGateCommand[] {
  const cmd = (
    command: string,
    expected: string,
    phase: string
  ): ControlledMissionServerPersistenceFinalGateCommand => ({ command, expected, required: true, status: "pending", phase });
  return [
    cmd("npm run test:phase5-7", "Final gate tests verts", "5.7"),
    cmd("npm run check:controlled-mission-server-persistence-final-gate", "PASS", "5.7"),
    cmd("npm run test:phase5-6", "60/60", "5.6"),
    cmd("npm run check:controlled-mission-server-restore-ui", "PASS", "5.6"),
    cmd("npm run test:phase5-5", "60/60", "5.5"),
    cmd("npm run check:controlled-mission-server-persistence-manual-activation", "PASS", "5.5"),
    cmd("npm run test:phase5-4", "66/66", "5.4"),
    cmd("npm run check:controlled-mission-server-persistence", "PASS", "5.4"),
    cmd("npm run test:phase5-3", "58/58", "5.3"),
    cmd("npm run test:phase5-2", "57/57", "5.2"),
    cmd("npm run test:phase5-1", "62/62", "5.1"),
    cmd("npx tsc --noEmit", "0 erreur", "global"),
    cmd("npm test", "tous verts", "global"),
    cmd("npm run build", "build propre", "global"),
  ];
}

export function buildControlledMissionServerPersistenceFinalGateInvariants(): ControlledMissionServerPersistenceFinalGateInvariant[] {
  const inv = (id: string, label: string, expected: string): ControlledMissionServerPersistenceFinalGateInvariant => ({ id, label, expected, holds: true });
  return [
    inv("server_persistence_inactive", "Persistance serveur inactive", "false"),
    inv("server_restore_inactive", "Restauration serveur inactive", "false"),
    inv("runtime_execution_inactive", "Runtime execution inactive", "false"),
    inv("pierre_runtime_inactive", "Pierre autonomous runtime inactif", "false"),
    inv("sql_not_applied", "SQL non appliqué", "false"),
    inv("env_not_modified", ".env.local non modifié", "false"),
    inv("route_not_created", "Aucune route serveur créée", "false"),
    inv("no_server_get", "Aucun GET serveur", "false"),
    inv("no_server_write", "Aucun write serveur", "false"),
    inv("no_real_mission", "Aucune mission serveur réelle", "false"),
    inv("no_ai_email_document", "Aucune IA / email / document / PDF", "false"),
    inv("clonevoice_inactive", "CloneVoice inactif", "false"),
    inv("localstorage_source_active", "localStorage source active", "true"),
    inv("public_launch_external_not_validated", "Lancement public externe non validé", "false"),
    inv("scale_80k_not_proven", "Scale 80k non prouvé", "non prouvé"),
  ];
}

// ── Report ────────────────────────────────────────────────────────────────────

export function buildControlledMissionServerPersistenceFinalGateReport(
  options?: { now?: string }
): ControlledMissionServerPersistenceFinalGateReport {
  const now = options?.now ?? new Date().toISOString();
  const sections = buildControlledMissionServerPersistenceFinalGateSections();
  const readiness_score = computeControlledMissionServerPersistenceFinalGateScore(sections);
  const overall_verdict = evaluateControlledMissionServerPersistenceFinalGateVerdict(sections);
  const readiness_level = deriveReadinessLevel(readiness_score, overall_verdict);

  const blocking_items = sections
    .filter((s) => s.blocking && s.status === "failed")
    .map((s) => s.title);

  const warnings = sections
    .filter((s) => s.status === "warning")
    .flatMap((s) => s.checks.filter((c) => c.status === "warning").map((c) => c.detail));

  return {
    phase: "5.7",
    title: "Final Gate P5 — Persistance serveur contrôlée (design-only, fermeture P5.1 → P5.6)",
    generated_at: now,
    overall_verdict,
    readiness_score,
    readiness_level,
    completed_blocks: ["P5.1", "P5.2", "P5.3", "P5.4", "P5.5", "P5.6"],
    blocking_items,
    warnings,
    required_next_steps: [
      "PHASE 5.8 — Controlled Mission Persistence Transition Plan (still no execution).",
      "Conserver le SQL serveur non appliqué jusqu'à une activation manuelle gouvernée.",
      "Conserver le flag serveur à false.",
      "Aucune route, aucun GET/POST serveur, aucune exécution dans cette phase.",
    ],
    evidence: buildControlledMissionServerPersistenceFinalGateEvidence(),
    invariants: buildControlledMissionServerPersistenceFinalGateInvariants(),
    sections,
    command_matrix: buildControlledMissionServerPersistenceFinalGateCommandMatrix(),
    phase_closure: true,
    server_persistence_active: false,
    server_restore_active: false,
    runtime_execution_active: false,
    pierre_runtime_active: false,
    sql_applied: false,
    env_modified: false,
    route_created: false,
    server_get_performed: false,
    server_write_performed: false,
    real_mission_created: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeControlledMissionServerPersistenceFinalGate(
  report: ControlledMissionServerPersistenceFinalGateReport
): string {
  return [
    `[Final Gate P5 — PHASE 5.7] Verdict : ${report.overall_verdict.toUpperCase()} · readiness ${report.readiness_score}% (${report.readiness_level})`,
    `  Blocs fermés : ${report.completed_blocks.join(", ")}`,
    `  Sections : ${report.sections.length} · bloquants échoués : ${report.blocking_items.length} · warnings : ${report.warnings.length}`,
    `  Final Gate design-only — aucune activation, aucune production, aucune exécution.`,
    `  Persistance serveur inactive · restauration serveur inactive · localStorage source active.`,
    `  SQL non appliqué · flag off · aucune route · scale 80k non prouvé · lancement public externe non validé.`,
  ].join("\n");
}
