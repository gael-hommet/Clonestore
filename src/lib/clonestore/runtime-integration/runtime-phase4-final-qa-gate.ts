// src/lib/clonestore/runtime-integration/runtime-phase4-final-qa-gate.ts
// PHASE 4.12 — Phase 4 Final QA — Gate Builder
//
// Module PUR. Assemble le gate final de clôture PHASE 4. Aucun write. Aucune route.
// Aucune exécution. Aucun import Pierre. "Phase 4 closed" = clôture design/
// simulation/gated runtime — JAMAIS validation du lancement public externe ni
// preuve de scale 80k ni exécution réelle.

import type {
  RuntimePhase4FinalQaGate,
  RuntimePhase4FinalQaClosure,
  RuntimePhase4FinalQaVerdict,
  RuntimePhase4FinalQaIssue,
  RuntimePhase4FinalQaRecommendation,
  RuntimePhase4FinalQaAction,
} from "./runtime-phase4-final-qa-types";
import {
  buildRuntimePhase4FinalQaBlockRegistry,
  getRuntimePhase4FinalQaExpectedDocs,
  getRuntimePhase4FinalQaExpectedScripts,
  getRuntimePhase4FinalQaExpectedTests,
  getRuntimePhase4FinalQaExpectedSqlDrafts,
  getRuntimePhase4FinalQaExpectedRoutes,
  getRuntimePhase4FinalQaForbiddenRoutes,
} from "./runtime-phase4-final-qa-registry";
import {
  buildRuntimePhase4FinalQaInvariants,
  type RuntimePhase4FinalQaInvariantOverrides,
} from "./runtime-phase4-final-qa-invariants";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimePhase4FinalQaGateOptions = {
  now?: string;
  include_next_phase_plan?: boolean;
  manual_notes?: string;
  invariant_overrides?: RuntimePhase4FinalQaInvariantOverrides;
};

// ── Actions / recommendations ─────────────────────────────────────────────────

function buildActions(): RuntimePhase4FinalQaAction[] {
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
  ];
}

function buildRecommendations(): RuntimePhase4FinalQaRecommendation[] {
  return [
    { id: "rec-phase5", text: "Démarrer la PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First (feature-flaggée, no-execution).", href: "/profile/messages", action_label: "Messages" },
    { id: "rec-manual", text: "L'activation runtime contrôlée reste manuelle et future. Aucun lancement public externe validé.", href: "/profile/messages", action_label: "Messages" },
  ];
}

// ── Closure ───────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaClosure(
  gate: RuntimePhase4FinalQaGate
): RuntimePhase4FinalQaClosure {
  const blocksPassed = gate.blocks.every((b) => b.status === "passed");
  const blockingFailed = gate.invariants.filter((i) => i.severity === "blocking" && i.status !== "passed");
  const allBlockingPassed = blockingFailed.length === 0;
  const phase4Closed = blocksPassed && allBlockingPassed;

  const issues: RuntimePhase4FinalQaIssue[] = [];
  if (!blocksPassed) issues.push({ code: "block_not_passed", message: "Un bloc PHASE 4 n'est pas passed.", severity: "blocking" });
  for (const inv of blockingFailed) {
    issues.push({ code: `invariant_failed_${inv.id}`, message: `Invariant bloquant non satisfait : ${inv.id}.`, severity: "blocking" });
  }

  let verdict: RuntimePhase4FinalQaVerdict;
  if (!allBlockingPassed || !blocksPassed) verdict = "blocked";
  else verdict = "phase4_closed";

  return {
    phase: "4.12",
    verdict,
    closed_at: gate.generated_at,
    blocks: gate.blocks,
    invariants: gate.invariants,
    issues,
    recommendations: buildRecommendations(),
    actions: buildActions(),
    phase4_closed: phase4Closed,
    ready_for_phase5: phase4Closed,
    public_launch_external_validated: false,
    scale_80k_not_proven: true,
    runtime_execution_enabled: false,
    real_mission_created: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    clonevoice_active: false,
    read_only: true,
  };
}

// ── Gate builder ──────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaGate(
  options?: RuntimePhase4FinalQaGateOptions
): RuntimePhase4FinalQaGate {
  const now = options?.now ?? new Date().toISOString();
  const blocks = buildRuntimePhase4FinalQaBlockRegistry();
  const invariants = buildRuntimePhase4FinalQaInvariants(options?.invariant_overrides);

  const gate: RuntimePhase4FinalQaGate = {
    phase: "4.12",
    status: "auditing",
    verdict: "needs_review",
    blocks,
    invariants,
    closure: {} as RuntimePhase4FinalQaClosure,
    expected_docs: getRuntimePhase4FinalQaExpectedDocs(),
    expected_scripts: getRuntimePhase4FinalQaExpectedScripts(),
    expected_tests: getRuntimePhase4FinalQaExpectedTests(),
    expected_sql_drafts: getRuntimePhase4FinalQaExpectedSqlDrafts(),
    allowed_routes: getRuntimePhase4FinalQaExpectedRoutes(),
    forbidden_routes: getRuntimePhase4FinalQaForbiddenRoutes(),
    generated_at: now,
    read_only: true,
  };

  gate.closure = buildRuntimePhase4FinalQaClosure(gate);
  gate.verdict = gate.closure.verdict;
  gate.status = gate.closure.phase4_closed ? "closed" : "needs_review";
  return gate;
}

// ── Evaluate / verdict ────────────────────────────────────────────────────────

export function evaluateRuntimePhase4FinalQaGate(gate: RuntimePhase4FinalQaGate): {
  verdict: RuntimePhase4FinalQaVerdict;
  phase4_closed: boolean;
  ready_for_phase5: boolean;
  blocks_passed: number;
  invariants_passed: number;
} {
  return {
    verdict: gate.closure.verdict,
    phase4_closed: gate.closure.phase4_closed,
    ready_for_phase5: gate.closure.ready_for_phase5,
    blocks_passed: gate.blocks.filter((b) => b.status === "passed").length,
    invariants_passed: gate.invariants.filter((i) => i.status === "passed").length,
  };
}

export function getRuntimePhase4FinalQaVerdict(gate: RuntimePhase4FinalQaGate): RuntimePhase4FinalQaVerdict {
  return gate.closure.verdict;
}

// ── Assertions (throw si non sûr) ─────────────────────────────────────────────

export function assertRuntimePhase4FinalQaNoExecution(gate: RuntimePhase4FinalQaGate): void {
  const c = gate.closure;
  if (
    c.runtime_execution_enabled !== false ||
    c.real_mission_created !== false ||
    c.pierre_engine_called !== false ||
    c.ai_call_performed !== false ||
    c.clonevoice_active !== false ||
    c.public_launch_external_validated !== false
  ) {
    throw new Error("Phase 4 Final QA : violation d'un invariant no-execution.");
  }
}

export function assertRuntimePhase4FinalQaClosureSafe(closure: RuntimePhase4FinalQaClosure): void {
  if (
    closure.read_only !== true ||
    closure.public_launch_external_validated !== false ||
    closure.scale_80k_not_proven !== true ||
    closure.runtime_execution_enabled !== false ||
    closure.real_mission_created !== false
  ) {
    throw new Error("Phase 4 Final QA : closure non sûre.");
  }
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimePhase4FinalQaGate(gate: RuntimePhase4FinalQaGate): string {
  const c = gate.closure;
  return [
    `[Phase 4 Final QA Gate] verdict : ${gate.verdict} · status : ${gate.status}`,
    `  Blocks : ${gate.blocks.length} · Invariants : ${gate.invariants.length}`,
    `  phase4_closed : ${c.phase4_closed} · ready_for_phase5 : ${c.ready_for_phase5}`,
    `  public_launch_external_validated : ${c.public_launch_external_validated} · scale_80k_not_proven : ${c.scale_80k_not_proven}`,
    `  runtime_execution_enabled : ${c.runtime_execution_enabled} · real_mission_created : ${c.real_mission_created}`,
    `  Phase 4 closed = clôture design/simulation/gated runtime — pas validation lancement public externe, pas scale 80k prouvé, pas exécution réelle.`,
  ].join("\n");
}
