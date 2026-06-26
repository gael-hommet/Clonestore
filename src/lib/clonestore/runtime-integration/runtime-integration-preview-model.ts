// src/lib/clonestore/runtime-integration/runtime-integration-preview-model.ts
// PHASE 4.2 — Runtime API Simulation — Preview UI Model
//
// Module pur. Transforme RuntimeIntegrationReadResult en cards UI read-only.
// Pas de fetch, pas de Supabase, pas de write, pas d'import Pierre.

import type {
  RuntimeIntegrationReadResult,
} from "./runtime-integration-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuntimeIntegrationPreviewStatus =
  | "ready"
  | "blocked"
  | "awaiting_validation"
  | "simulated_only"
  | "empty";

export type RuntimeIntegrationPreviewTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimeIntegrationPreviewBadge = {
  id: string;
  label: string;
  tone: RuntimeIntegrationPreviewTone;
};

export type RuntimeIntegrationPreviewCard = {
  id: string;
  label: string;
  value: string;
  sub_label?: string;
  tone: RuntimeIntegrationPreviewTone;
};

export type RuntimeIntegrationPreviewSectionKind =
  | "intent" | "route" | "guard" | "plan" | "trace" | "scale";

export type RuntimeIntegrationPreviewSection = {
  id: string;
  kind: RuntimeIntegrationPreviewSectionKind;
  title: string;
  lines: string[];
  tone: RuntimeIntegrationPreviewTone;
};

export type RuntimeIntegrationPreviewTimelineItem = {
  id: string;
  label: string;
  detail: string;
  tone: RuntimeIntegrationPreviewTone;
};

export type RuntimeIntegrationPreviewAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type RuntimeIntegrationPreviewSnapshot = {
  status: RuntimeIntegrationPreviewStatus;
  status_label: string;
  tone: RuntimeIntegrationPreviewTone;
  command_raw: string;
  command_normalized: string;
  result: RuntimeIntegrationReadResult;
  read_only: true;
};

// ── Status helpers ────────────────────────────────────────────────────────────

export function getRuntimeIntegrationPreviewStatusLabel(
  status: RuntimeIntegrationPreviewStatus
): string {
  const labels: Record<RuntimeIntegrationPreviewStatus, string> = {
    ready: "Plan prêt (plan-only)",
    blocked: "Bloqué par CloneGuard",
    awaiting_validation: "Validation humaine requise",
    simulated_only: "Simulation uniquement",
    empty: "Aucune simulation",
  };
  return labels[status] ?? "Inconnu";
}

export function getRuntimeIntegrationPreviewTone(
  status: RuntimeIntegrationPreviewStatus
): RuntimeIntegrationPreviewTone {
  const tones: Record<RuntimeIntegrationPreviewStatus, RuntimeIntegrationPreviewTone> = {
    ready: "success",
    blocked: "danger",
    awaiting_validation: "warning",
    simulated_only: "info",
    empty: "neutral",
  };
  return tones[status] ?? "neutral";
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPreviewSnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeIntegrationPreviewSnapshot {
  const planStatus = result.plan.status;
  const guard = result.plan.guard_decision.decision;

  let status: RuntimeIntegrationPreviewStatus;
  if (guard === "block" || planStatus === "blocked") status = "blocked";
  else if (result.plan.guard_decision.human_validation_required || planStatus === "awaiting_validation") status = "awaiting_validation";
  else if (planStatus === "simulated_only") status = "simulated_only";
  else status = "ready";

  return {
    status,
    status_label: getRuntimeIntegrationPreviewStatusLabel(status),
    tone: getRuntimeIntegrationPreviewTone(status),
    command_raw: result.command.raw_text,
    command_normalized: result.intent.normalized_text,
    result,
    read_only: true,
  };
}

// ── Badges (invariants safety) ────────────────────────────────────────────────

export function buildRuntimeIntegrationPreviewBadges(
  snapshot: RuntimeIntegrationPreviewSnapshot
): RuntimeIntegrationPreviewBadge[] {
  return [
    { id: "badge-status", label: snapshot.status_label, tone: snapshot.tone },
    { id: "badge-simulation", label: "Simulation uniquement", tone: "info" },
    { id: "badge-readonly", label: "Lecture seule", tone: "neutral" },
    { id: "badge-no-mission", label: "Aucune mission créée", tone: "neutral" },
    { id: "badge-no-message", label: "Aucun message envoyé", tone: "neutral" },
    { id: "badge-no-email", label: "Aucun email envoyé", tone: "neutral" },
    { id: "badge-no-doc", label: "Aucun document généré", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
    { id: "badge-no-clonevoice", label: "CloneVoice non actif", tone: "neutral" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPreviewCards(
  snapshot: RuntimeIntegrationPreviewSnapshot
): RuntimeIntegrationPreviewCard[] {
  const r = snapshot.result;
  return [
    {
      id: "card-domain",
      label: "Domaine / Risque",
      value: `${r.intent.domain} · ${r.intent.risk_level}`,
      sub_label: `Confiance ${Math.round(r.intent.confidence * 100)}%`,
      tone: r.intent.risk_level === "blocked" ? "danger" : r.intent.risk_level === "sensitive" ? "warning" : "neutral",
    },
    {
      id: "card-route",
      label: "Routage",
      value: r.route.employee_key ?? "Aucun employé actif",
      sub_label: r.route.requires_human_validation ? "Validation humaine" : "Plan-only",
      tone: r.route.employee_key ? "success" : "warning",
    },
    {
      id: "card-guard",
      label: "CloneGuard",
      value: r.plan.guard_decision.decision,
      sub_label: r.plan.guard_decision.human_validation_required ? "Validation requise" : "Plan-only autorisé",
      tone: r.plan.guard_decision.decision === "block" ? "danger" : r.plan.guard_decision.human_validation_required ? "warning" : "success",
    },
    {
      id: "card-plan",
      label: "Plan",
      value: `${r.plan.steps.length} étape(s)`,
      sub_label: `Statut : ${r.plan.status}`,
      tone: "violet",
    },
  ];
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPreviewSections(
  snapshot: RuntimeIntegrationPreviewSnapshot
): RuntimeIntegrationPreviewSection[] {
  const r = snapshot.result;
  const scale = r.plan.scale_hints;
  const queue = r.plan.queue_hints;
  const cost = r.plan.cost_hints;

  return [
    {
      id: "sec-intent",
      kind: "intent",
      title: "Intention",
      lines: [
        `Texte normalisé : ${r.intent.normalized_text || "—"}`,
        `Domaine : ${r.intent.domain} · Risque : ${r.intent.risk_level}`,
        `Validation : ${r.intent.validation_mode} · Confiance : ${Math.round(r.intent.confidence * 100)}%`,
        r.intent.missing_context.length > 0 ? `Contexte manquant : ${r.intent.missing_context.join(", ")}` : "Contexte suffisant.",
      ],
      tone: "neutral",
    },
    {
      id: "sec-route",
      kind: "route",
      title: "Routage",
      lines: [
        `Employé : ${r.route.employee_key ?? "aucun (simulation)"}`,
        r.route.route_reason,
        `Validation humaine : ${r.route.requires_human_validation}`,
      ],
      tone: r.route.employee_key ? "success" : "warning",
    },
    {
      id: "sec-guard",
      kind: "guard",
      title: "CloneGuard",
      lines: [
        `Décision : ${r.plan.guard_decision.decision}`,
        `CloneGuard requis : ${r.plan.guard_decision.cloneguard_required} · Bypass : ${r.plan.guard_decision.bypass_allowed}`,
        ...r.plan.guard_decision.reasons,
      ],
      tone: r.plan.guard_decision.decision === "block" ? "danger" : "warning",
    },
    {
      id: "sec-plan",
      kind: "plan",
      title: "Plan (plan-only)",
      lines: r.plan.steps.map((s) => `• ${s.label} — ${s.status}${s.requires_human_validation ? " (validation)" : ""}`),
      tone: "violet",
    },
    {
      id: "sec-trace",
      kind: "trace",
      title: "CloneTrace",
      lines: [
        `Trace requise : ${r.plan.trace_contract.clonetrace_required}`,
        `Écriture serveur : ${r.plan.trace_contract.server_write_enabled}`,
        `Données personnelles : ${r.plan.trace_contract.contains_personal_data}`,
        "Événement final : execution_not_started",
      ],
      tone: "info",
    },
    {
      id: "sec-scale",
      kind: "scale",
      title: "Scale readiness",
      lines: [
        `Idempotency requise : ${scale.idempotency_key_required} (clé : ${r.plan.idempotency.idempotency_key})`,
        `Queue : ${queue.queue_name} · priorité ${queue.priority} · retry ${queue.retry_count_recommended}`,
        `Cost : ${cost.orchestration_model_tier} · premium évité pour ${cost.avoid_premium_model_for}`,
        `Rate limit requis : ${scale.rate_limit_required} · Load test requis : ${scale.load_test_required}`,
        `Scale 80k prouvé : ${!scale.scale_80k_not_proven} (préparation scale — non prouvé).`,
      ],
      tone: "neutral",
    },
  ];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPreviewTimeline(
  snapshot: RuntimeIntegrationPreviewSnapshot
): RuntimeIntegrationPreviewTimelineItem[] {
  const r = snapshot.result;
  return r.plan.steps.map((s, i) => ({
    id: `tl-${i}`,
    label: s.label,
    detail: `${s.status}${s.requires_human_validation ? " · validation humaine" : ""} · plan-only`,
    tone: s.status === "blocked" ? "danger" : s.requires_human_validation ? "warning" : "neutral",
  }));
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationPreviewActions(
  snapshot: RuntimeIntegrationPreviewSnapshot
): RuntimeIntegrationPreviewAction[] {
  void snapshot;
  return [
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: true },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
    { id: "go-pierre-use", label: "Cockpit Pierre", href: "/agents/pierre/use", primary: false },
  ];
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeIntegrationPreview(
  snapshot: RuntimeIntegrationPreviewSnapshot
): string {
  return [
    `[Runtime Preview] ${snapshot.status_label}`,
    `  Commande : ${snapshot.command_raw}`,
    `  Employé : ${snapshot.result.route.employee_key ?? "aucun"}`,
    `  Simulation uniquement — aucune mission créée, aucun appel IA.`,
    `  CloneVoice non actif. Scale 80k non prouvé.`,
  ].join("\n");
}
