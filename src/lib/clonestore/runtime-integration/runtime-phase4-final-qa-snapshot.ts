// src/lib/clonestore/runtime-integration/runtime-phase4-final-qa-snapshot.ts
// PHASE 4.12 — Phase 4 Final QA — Snapshot / Report Model
//
// Module PUR / read-only. Transforme le gate en report lisible (badges/cards/
// sections/timeline/warnings) pour docs / future UI. Aucun write, aucune exécution.

import type {
  RuntimePhase4FinalQaGate,
  RuntimePhase4FinalQaVerdict,
} from "./runtime-phase4-final-qa-types";

export type RuntimePhase4FinalQaSnapshotTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimePhase4FinalQaSnapshotBadge = { id: string; label: string; tone: RuntimePhase4FinalQaSnapshotTone };
export type RuntimePhase4FinalQaSnapshotCard = { id: string; label: string; value: string; sub_label?: string; tone: RuntimePhase4FinalQaSnapshotTone };
export type RuntimePhase4FinalQaSnapshotSection = { id: string; title: string; lines: string[] };
export type RuntimePhase4FinalQaSnapshotTimelineItem = { id: string; event: string; label: string; detail: string; tone: RuntimePhase4FinalQaSnapshotTone };
export type RuntimePhase4FinalQaSnapshotWarning = { id: string; label: string; detail: string; tone: RuntimePhase4FinalQaSnapshotTone };
export type RuntimePhase4FinalQaSnapshotAction = { id: string; label: string; href: string; primary: boolean };

export type RuntimePhase4FinalQaReportSnapshot = {
  verdict: RuntimePhase4FinalQaVerdict;
  verdict_label: string;
  tone: RuntimePhase4FinalQaSnapshotTone;
  gate: RuntimePhase4FinalQaGate;
  read_only: true;
};

// ── Tone / label ──────────────────────────────────────────────────────────────

export function getRuntimePhase4FinalQaTone(
  verdict: RuntimePhase4FinalQaVerdict
): RuntimePhase4FinalQaSnapshotTone {
  switch (verdict) {
    case "phase4_closed":
    case "ready_for_phase5":
      return "success";
    case "needs_review":
      return "warning";
    case "blocked":
      return "danger";
    default:
      return "neutral";
  }
}

const VERDICT_LABELS: Record<RuntimePhase4FinalQaVerdict, string> = {
  phase4_closed: "Phase 4 closed (design/simulation/gated runtime)",
  ready_for_phase5: "Ready for Phase 5",
  needs_review: "À revoir",
  blocked: "Bloqué",
};

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaSnapshot(
  gate: RuntimePhase4FinalQaGate
): RuntimePhase4FinalQaReportSnapshot {
  return {
    verdict: gate.verdict,
    verdict_label: VERDICT_LABELS[gate.verdict] ?? gate.verdict,
    tone: getRuntimePhase4FinalQaTone(gate.verdict),
    gate,
    read_only: true,
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaBadges(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): RuntimePhase4FinalQaSnapshotBadge[] {
  const c = snapshot.gate.closure;
  return [
    { id: "badge-final-qa", label: "Phase 4 Final QA", tone: "info" },
    { id: "badge-closure", label: "Runtime Closure", tone: "info" },
    { id: "badge-closed", label: "Phase 4 closed", tone: c.phase4_closed ? "success" : "neutral" },
    { id: "badge-ready", label: "Ready for Phase 5", tone: c.ready_for_phase5 ? "success" : "neutral" },
    { id: "badge-foundation", label: "Design/simulation/gated foundation", tone: "info" },
    { id: "badge-no-mission", label: "No real mission", tone: "neutral" },
    { id: "badge-no-exec", label: "No-execution", tone: "neutral" },
    { id: "badge-no-pierre", label: "No Pierre engine call", tone: "neutral" },
    { id: "badge-no-ai", label: "No AI call", tone: "neutral" },
    { id: "badge-cloneguard", label: "CloneGuard required", tone: "neutral" },
    { id: "badge-clonetrace", label: "CloneTrace required", tone: "neutral" },
    { id: "badge-human", label: "Human validation required", tone: "neutral" },
    { id: "badge-sql", label: "SQL drafts not applied", tone: "neutral" },
    { id: "badge-flags", label: "Feature flags default false", tone: "neutral" },
    { id: "badge-clonevoice", label: "CloneVoice non actif", tone: "neutral" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
    { id: "badge-public-launch", label: "Lancement public externe non validé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaCards(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): RuntimePhase4FinalQaSnapshotCard[] {
  const g = snapshot.gate;
  const blocksPassed = g.blocks.filter((b) => b.status === "passed").length;
  const invPassed = g.invariants.filter((i) => i.status === "passed").length;
  return [
    { id: "card-verdict", label: "Verdict", value: snapshot.verdict_label, sub_label: "closure", tone: snapshot.tone },
    { id: "card-blocks", label: "Blocks passés", value: `${blocksPassed}/${g.blocks.length}`, sub_label: "P4.1 → P4.12", tone: blocksPassed === g.blocks.length ? "success" : "warning" },
    { id: "card-invariants", label: "Invariants passés", value: `${invPassed}/${g.invariants.length}`, sub_label: "no-execution", tone: invPassed === g.invariants.length ? "success" : "warning" },
    { id: "card-scripts", label: "Scripts attendus", value: String(g.expected_scripts.length), sub_label: "read-only", tone: "neutral" },
    { id: "card-docs", label: "Docs présents", value: String(g.expected_docs.length), sub_label: "P4.1 → P4.12", tone: "neutral" },
    { id: "card-tests", label: "Tests attendus", value: String(g.expected_tests.length), sub_label: "phase4-1 → phase4-12", tone: "neutral" },
    { id: "card-build", label: "Build requis", value: "Oui", sub_label: "npm run build", tone: "neutral" },
    { id: "card-next", label: "Prochaine phase", value: "PHASE 5.1", sub_label: "Controlled Mission Safe Apply", tone: "violet" },
  ];
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaSections(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): RuntimePhase4FinalQaSnapshotSection[] {
  const g = snapshot.gate;
  return [
    {
      id: "sec-blocks",
      title: "Phase 4 blocks",
      lines: g.blocks.map((b) => `${b.status === "passed" ? "✓" : "○"} ${b.phase_number} — ${b.title}`),
    },
    {
      id: "sec-chain",
      title: "Runtime chain",
      lines: [
        "CloneOS command → intent → route → plan (plan-only)",
        "RuntimeMissionDraft → RuntimeMissionPromotionContract → ControlledMission candidate",
        "Human validation workflow (design) → safe apply futur (Phase 5)",
      ],
    },
    {
      id: "sec-activated",
      title: "Activated now",
      lines: g.blocks.flatMap((b) => b.activated_now.map((a) => `• ${b.phase_number} : ${a}`)),
    },
    {
      id: "sec-design-only",
      title: "Still design-only",
      lines: [
        "SQL drafts non appliqués · feature flags default false",
        "Promotion non appliquée · approbation non appliquée",
        "Persistance serveur / safe apply gouverné → Phase 5",
      ],
    },
    {
      id: "sec-forbidden",
      title: "Forbidden actions",
      lines: g.forbidden_routes.map((r) => `✗ ${r}`),
    },
    {
      id: "sec-invariants",
      title: "Safety invariants",
      lines: [
        "no_real_mission_created · no_runtime_execution · no_pierre_engine_call · no_ai_call",
        "promotion_not_applied · approval_not_applied · human_validation_required",
        "scale_80k_not_proven · lancement public externe non validé",
      ],
    },
    {
      id: "sec-phase5",
      title: "Phase 5 recommendations",
      lines: [
        "PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First (feature-flaggée, no-execution)",
        "PHASE 5.4 — Human Validation Safe Apply / No Execution",
        "PHASE 5.6 — Runtime Queue / Worker Readiness Design",
      ],
    },
  ];
}

// ── Timeline (12 events) ──────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaTimeline(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): RuntimePhase4FinalQaSnapshotTimelineItem[] {
  void snapshot;
  const events: Array<[string, string]> = [
    ["p4_1_foundation", "Runtime Foundation"],
    ["p4_2_simulation", "Simulation Endpoint"],
    ["p4_3_draft", "Mission Draft Contract"],
    ["p4_4_persistence_design", "Draft Persistence Design"],
    ["p4_5_safe_apply", "Draft Safe Apply"],
    ["p4_6_manual_activation", "Manual Activation QA"],
    ["p4_7_restore_ui", "Restore UI"],
    ["p4_8_promotion_contract", "Promotion Contract"],
    ["p4_9_controlled_preview", "Controlled Mission Preview"],
    ["p4_10_governed_persistence_design", "Governed Persistence Design"],
    ["p4_11_human_validation", "Human Validation Workflow"],
    ["p4_12_closure", "Phase 4 Closure"],
  ];
  return events.map(([event, label], i) => ({
    id: `tl-${i + 1}`,
    event,
    label,
    detail: i === events.length - 1 ? "Phase 4 closed (design/simulation/gated runtime)." : "Validé · no-execution.",
    tone: i === events.length - 1 ? "success" : "neutral",
  }));
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaWarnings(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): RuntimePhase4FinalQaSnapshotWarning[] {
  void snapshot;
  return [
    { id: "warn-public-launch", label: "Lancement public externe non validé", detail: "Phase 4 closed ne valide pas le lancement public externe.", tone: "info" },
    { id: "warn-scale", label: "Scale 80k non prouvé", detail: "Préparation scale uniquement — scale 80k non prouvé.", tone: "info" },
    { id: "warn-sql", label: "SQL drafts non appliqués", detail: "Les SQL drafts P4.4/P4.10 ne sont pas appliqués automatiquement.", tone: "info" },
    { id: "warn-flags", label: "Feature flags default false", detail: "Aucun flag activé automatiquement.", tone: "info" },
    { id: "warn-no-mission", label: "Aucune mission réelle / aucune exécution", detail: "Aucune mission réelle, aucune exécution runtime.", tone: "neutral" },
    { id: "warn-phase5", label: "Phase 5 requise avant activation contrôlée", detail: "L'activation runtime contrôlée nécessite la Phase 5 (safe apply gouverné).", tone: "warning" },
  ];
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaActions(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): RuntimePhase4FinalQaSnapshotAction[] {
  void snapshot;
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
  ];
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimePhase4FinalQaSnapshot(
  snapshot: RuntimePhase4FinalQaReportSnapshot
): string {
  const c = snapshot.gate.closure;
  return [
    `[Phase 4 Final QA Report] ${snapshot.verdict_label}`,
    `  phase4_closed : ${c.phase4_closed} · ready_for_phase5 : ${c.ready_for_phase5}`,
    `  Phase 4 closed = design/simulation/gated runtime foundation closed.`,
    `  Pas validation lancement public externe · pas scale 80k prouvé · pas exécution réelle · pas mission réelle.`,
    `  CloneVoice non actif · Scale 80k non prouvé · Lancement public externe non validé.`,
  ].join("\n");
}
