// src/lib/clonestore/runtime-integration/runtime-phase4-final-qa-registry.ts
// PHASE 4.12 — Phase 4 Final QA — Block Registry
//
// Module PUR. Registre des blocs PHASE 4.1 → 4.12 (docs/tests/scripts/sql/routes).
// Ne crée aucune route. Ne supprime aucune route. Aucun write. Aucun import Pierre.

import type {
  RuntimePhase4FinalQaBlockSummary,
  RuntimePhase4FinalQaBlockId,
} from "./runtime-phase4-final-qa-types";

const DOC = (name: string) => `docs/${name}`;
const EVID = (name: string) => `docs/templates/${name}`;
const SCRIPT = (name: string) => `scripts/${name}`;
const SQL = (name: string) => `supabase/sql/${name}`;
const ROUTE = (path: string) => `src/app/api/clonestore/runtime/${path}`;

// ── Routes autorisées / interdites ────────────────────────────────────────────

const ALLOWED_ROUTES: string[] = [
  ROUTE("simulate/route.ts"),
  ROUTE("mission-drafts/route.ts"),
];

const FORBIDDEN_ROUTES: string[] = [
  ROUTE("controlled-mission-validation/route.ts"),
  ROUTE("controlled-mission-candidates/route.ts"),
  ROUTE("controlled-missions/route.ts"),
  ROUTE("execute/route.ts"),
  ROUTE("promote/route.ts"),
];

export function getRuntimePhase4FinalQaForbiddenRoutes(): string[] {
  return [...FORBIDDEN_ROUTES];
}

export function getRuntimePhase4FinalQaExpectedRoutes(): string[] {
  return [...ALLOWED_ROUTES];
}

// ── Block registry ────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaBlockRegistry(): RuntimePhase4FinalQaBlockSummary[] {
  return [
    {
      id: "phase4_1_runtime_foundation",
      phase_number: "4.1",
      title: "CloneOS / Pierre Runtime Operational Integration Foundation",
      status: "passed",
      scope: "simulation",
      main_files: ["runtime-integration-orchestrator.ts", "runtime-integration-types.ts"],
      docs: [DOC("PHASE_4_1_CLONEOS_PIERRE_RUNTIME_OPERATIONAL_INTEGRATION_FOUNDATION.md")],
      tests: ["test:phase4-1"],
      scripts: [],
      sql_drafts: [],
      routes: [],
      invariants: ["no_runtime_execution", "no_pierre_engine_call", "no_ai_call", "scale_80k_not_proven"],
      activated_now: ["CloneOS command → intent → route → plan (plan-only)"],
      not_activated: ["Aucune exécution"],
      risk_note: "Plan-only. CloneGuard/CloneTrace obligatoires. Aucune exécution.",
    },
    {
      id: "phase4_2_simulation_endpoint",
      phase_number: "4.2",
      title: "Runtime API Simulation Endpoint / Command Center Preview",
      status: "passed",
      scope: "simulation",
      main_files: ["runtime-integration-api-contract.ts", "runtime-integration-api-client.ts"],
      docs: [DOC("PHASE_4_2_RUNTIME_API_SIMULATION_ENDPOINT_COMMAND_CENTER_PREVIEW.md")],
      tests: ["test:phase4-2"],
      scripts: [],
      sql_drafts: [],
      routes: [ROUTE("simulate/route.ts")],
      invariants: ["no_unflagged_db_write", "no_ai_call", "no_pierre_engine_call"],
      activated_now: ["Simulation au clic (Command Center Preview)"],
      not_activated: ["Aucun write", "Aucun appel IA"],
      risk_note: "Simulation-only. Aucune mission créée.",
    },
    {
      id: "phase4_3_mission_draft_contract",
      phase_number: "4.3",
      title: "Runtime Mission Draft Creation Contract",
      status: "passed",
      scope: "design",
      main_files: ["runtime-mission-draft-types.ts", "runtime-mission-draft-builder.ts"],
      docs: [DOC("PHASE_4_3_RUNTIME_MISSION_DRAFT_CREATION_CONTRACT.md")],
      tests: ["test:phase4-3"],
      scripts: [],
      sql_drafts: [],
      routes: [],
      invariants: ["no_real_mission_created", "no_runtime_execution", "no_ai_call"],
      activated_now: ["Brouillon local/in-memory (au clic)"],
      not_activated: ["Aucun write DB"],
      risk_note: "Brouillon local. Aucune mission en base.",
    },
    {
      id: "phase4_4_draft_persistence_design",
      phase_number: "4.4",
      title: "Runtime Mission Draft Safe Persistence Design",
      status: "passed",
      scope: "design",
      main_files: ["runtime-mission-draft-persistence-design.ts", "runtime-mission-draft-persistence-flags.ts"],
      docs: [DOC("PHASE_4_4_RUNTIME_MISSION_DRAFT_SAFE_PERSISTENCE_DESIGN.md")],
      tests: ["test:phase4-4"],
      scripts: [SCRIPT("check-runtime-mission-draft-persistence-design.mjs")],
      sql_drafts: [SQL("PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql")],
      routes: [],
      invariants: ["no_sql_auto_apply", "no_env_auto_change", "no_flag_auto_activation", "feature_flags_default_false", "rls_design_only_where_applicable"],
      activated_now: ["Design de persistance (SQL draft non appliqué)"],
      not_activated: ["SQL non appliqué", "Flag default false"],
      risk_note: "Design-only. SQL non appliqué automatiquement.",
    },
    {
      id: "phase4_5_draft_safe_apply",
      phase_number: "4.5",
      title: "Runtime Mission Draft Safe Apply / LocalStorage First",
      status: "passed",
      scope: "gated_runtime",
      main_files: ["runtime-mission-draft-safe-apply.ts", "runtime-mission-draft-localstorage.ts"],
      docs: [DOC("PHASE_4_5_RUNTIME_MISSION_DRAFT_SAFE_APPLY_LOCALSTORAGE_FIRST.md")],
      tests: ["test:phase4-5"],
      scripts: [],
      sql_drafts: [],
      routes: [ROUTE("mission-drafts/route.ts")],
      invariants: ["localstorage_fallback_preserved", "feature_flags_default_false", "no_real_mission_created", "no_runtime_execution"],
      activated_now: ["Sauvegarde localStorage-first (au clic)", "POST 423 si flag false"],
      not_activated: ["Aucun auto-save", "Persistance serveur non activée"],
      risk_note: "localStorage-first. POST 423 tant que flag false.",
    },
    {
      id: "phase4_6_manual_activation_qa",
      phase_number: "4.6",
      title: "Runtime Mission Draft Manual Activation QA",
      status: "passed",
      scope: "design",
      main_files: ["runtime-mission-draft-manual-activation-qa.ts"],
      docs: [DOC("PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_QA.md")],
      tests: ["test:phase4-6"],
      scripts: [SCRIPT("check-runtime-mission-draft-manual-activation-qa.mjs")],
      sql_drafts: [],
      routes: [],
      invariants: ["no_sql_auto_apply", "no_env_auto_change", "no_flag_auto_activation"],
      activated_now: ["Checklist d'activation manuelle (read-only)"],
      not_activated: ["Aucune activation automatique"],
      risk_note: "Activation manuelle documentée. Aucun write script.",
    },
    {
      id: "phase4_7_restore_ui",
      phase_number: "4.7",
      title: "Runtime Mission Draft Server Restore UI Polish",
      status: "passed",
      scope: "gated_runtime",
      main_files: ["runtime-mission-draft-restore-ui.ts"],
      docs: [DOC("PHASE_4_7_RUNTIME_MISSION_DRAFT_SERVER_RESTORE_UI_POLISH.md")],
      tests: ["test:phase4-7"],
      scripts: [],
      sql_drafts: [],
      routes: [],
      invariants: ["no_unflagged_db_write", "localstorage_fallback_preserved", "no_runtime_execution"],
      activated_now: ["Panneau « Statut brouillon runtime » (read-only)"],
      not_activated: ["Aucun write ajouté"],
      risk_note: "UI/observability. Aucun POST ajouté.",
    },
    {
      id: "phase4_8_promotion_contract",
      phase_number: "4.8",
      title: "Runtime Mission Promotion Contract / Draft → Controlled Mission",
      status: "passed",
      scope: "design",
      main_files: ["runtime-mission-promotion-contract.ts", "runtime-mission-promotion-types.ts"],
      docs: [DOC("PHASE_4_8_RUNTIME_MISSION_PROMOTION_CONTRACT.md")],
      tests: ["test:phase4-8"],
      scripts: [],
      sql_drafts: [],
      routes: [],
      invariants: ["promotion_not_applied", "no_real_mission_created", "human_validation_required_before_controlled_mission"],
      activated_now: ["Contrat de promotion design-only"],
      not_activated: ["Promotion non appliquée"],
      risk_note: "Design-only. promotion_applied false.",
    },
    {
      id: "phase4_9_controlled_mission_preview_ui",
      phase_number: "4.9",
      title: "Runtime Controlled Mission Preview UI / Read-Only Promotion Panel",
      status: "passed",
      scope: "gated_runtime",
      main_files: ["runtime-mission-promotion-preview-ui-qa.ts"],
      docs: [DOC("PHASE_4_9_RUNTIME_CONTROLLED_MISSION_PREVIEW_UI.md")],
      tests: ["test:phase4-9"],
      scripts: [],
      sql_drafts: [],
      routes: [],
      invariants: ["promotion_not_applied", "no_real_mission_created", "no_runtime_execution"],
      activated_now: ["Panneau aperçu de promotion (au clic, read-only)"],
      not_activated: ["Promotion non appliquée"],
      risk_note: "Aperçu read-only. Aucune mission réelle.",
    },
    {
      id: "phase4_10_controlled_mission_persistence_design",
      phase_number: "4.10",
      title: "Controlled Mission Governed Persistence Design",
      status: "passed",
      scope: "design",
      main_files: ["runtime-controlled-mission-persistence-design.ts", "runtime-controlled-mission-persistence-flags.ts"],
      docs: [DOC("PHASE_4_10_CONTROLLED_MISSION_GOVERNED_PERSISTENCE_DESIGN.md")],
      tests: ["test:phase4-10"],
      scripts: [SCRIPT("check-runtime-controlled-mission-persistence-design.mjs")],
      sql_drafts: [SQL("PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql")],
      routes: [],
      invariants: ["no_sql_auto_apply", "feature_flags_default_false", "human_validation_required_before_controlled_mission", "promotion_not_applied", "rls_design_only_where_applicable"],
      activated_now: ["Design de persistance candidate (SQL draft non appliqué)"],
      not_activated: ["SQL non appliqué", "Flag default false"],
      risk_note: "Design-only. Aucun write DB.",
    },
    {
      id: "phase4_11_human_validation_workflow",
      phase_number: "4.11",
      title: "Controlled Mission Human Validation Workflow Design",
      status: "passed",
      scope: "design",
      main_files: ["runtime-controlled-mission-human-validation-workflow.ts", "runtime-controlled-mission-human-validation-policy.ts"],
      docs: [DOC("PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_DESIGN.md")],
      tests: ["test:phase4-11"],
      scripts: [SCRIPT("check-runtime-controlled-mission-human-validation-workflow.mjs")],
      sql_drafts: [],
      routes: [],
      invariants: ["approval_not_applied", "human_validation_required_before_controlled_mission", "no_real_mission_created", "no_runtime_execution"],
      activated_now: ["Workflow de validation humaine design-only"],
      not_activated: ["approval_applied false", "Aucune route POST approve/reject"],
      risk_note: "Design-only. approval_preview ne crée aucune mission.",
    },
    {
      id: "phase4_12_final_qa_gate",
      phase_number: "4.12",
      title: "Phase 4 Final QA Gate / Runtime Closure",
      status: "passed",
      scope: "closure",
      main_files: ["runtime-phase4-final-qa-gate.ts", "runtime-phase4-final-qa-registry.ts"],
      docs: [DOC("PHASE_4_12_PHASE_4_FINAL_QA_GATE_RUNTIME_CLOSURE.md")],
      tests: ["test:phase4-12"],
      scripts: [SCRIPT("check-runtime-phase4-final-qa-gate.mjs")],
      sql_drafts: [],
      routes: [],
      invariants: ["no_real_mission_created", "no_runtime_execution", "no_public_external_launch_validation", "scale_80k_not_proven"],
      activated_now: ["Gate final de clôture (read-only)"],
      not_activated: ["Aucune activation runtime"],
      risk_note: "Clôture, pas activation. Phase 4 closed côté repo.",
    },
  ];
}

// ── Listes attendues ──────────────────────────────────────────────────────────

export function getRuntimePhase4FinalQaExpectedDocs(): string[] {
  return buildRuntimePhase4FinalQaBlockRegistry().flatMap((b) => b.docs);
}

export function getRuntimePhase4FinalQaExpectedScripts(): string[] {
  return Array.from(new Set(buildRuntimePhase4FinalQaBlockRegistry().flatMap((b) => b.scripts)));
}

export function getRuntimePhase4FinalQaExpectedTests(): string[] {
  return buildRuntimePhase4FinalQaBlockRegistry().flatMap((b) => b.tests);
}

export function getRuntimePhase4FinalQaExpectedSqlDrafts(): string[] {
  return Array.from(new Set(buildRuntimePhase4FinalQaBlockRegistry().flatMap((b) => b.sql_drafts)));
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimePhase4FinalQaBlock(block: RuntimePhase4FinalQaBlockSummary): string {
  return [
    `[Block ${block.phase_number}] ${block.title} — ${block.status}`,
    `  Scope : ${block.scope} · Docs : ${block.docs.length} · Tests : ${block.tests.length} · Scripts : ${block.scripts.length} · SQL : ${block.sql_drafts.length}`,
    `  Activé : ${block.activated_now.join(" ; ") || "—"}`,
    `  Non activé : ${block.not_activated.join(" ; ") || "—"}`,
    `  ${block.risk_note}`,
  ].join("\n");
}

export type { RuntimePhase4FinalQaBlockId };
