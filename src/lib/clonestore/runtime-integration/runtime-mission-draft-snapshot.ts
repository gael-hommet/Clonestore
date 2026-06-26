// src/lib/clonestore/runtime-integration/runtime-mission-draft-snapshot.ts
// PHASE 4.3 — Runtime Mission Draft — Snapshot / Local Preview
//
// Module pur. Snapshot UI/local only. Ne sauvegarde rien (pas de localStorage en P4.3).
// Pas de fetch, pas de Supabase, pas de write, pas d'import Pierre.

import type {
  RuntimeMissionDraft,
} from "./runtime-mission-draft-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimeMissionDraftBadge = {
  id: string;
  label: string;
  tone: RuntimeMissionDraftTone;
};

export type RuntimeMissionDraftCard = {
  id: string;
  label: string;
  value: string;
  sub_label?: string;
  tone: RuntimeMissionDraftTone;
};

export type RuntimeMissionDraftSectionKind =
  | "objective" | "steps" | "validations" | "risks" | "guard" | "trace" | "scale" | "security";

export type RuntimeMissionDraftSection = {
  id: string;
  kind: RuntimeMissionDraftSectionKind;
  title: string;
  lines: string[];
  tone: RuntimeMissionDraftTone;
};

export type RuntimeMissionDraftTimelineItem = {
  id: string;
  label: string;
  detail: string;
  tone: RuntimeMissionDraftTone;
};

export type RuntimeMissionDraftSnapshot = {
  draft: RuntimeMissionDraft;
  badges: RuntimeMissionDraftBadge[];
  cards: RuntimeMissionDraftCard[];
  sections: RuntimeMissionDraftSection[];
  timeline: RuntimeMissionDraftTimelineItem[];
  read_only: true;
  local_in_memory: true;
};

// ── Tone helper ───────────────────────────────────────────────────────────────

function statusTone(status: RuntimeMissionDraft["status"]): RuntimeMissionDraftTone {
  if (status === "blocked") return "danger";
  if (status === "awaiting_validation") return "warning";
  if (status === "ready_for_review") return "success";
  if (status === "simulated_only") return "info";
  return "neutral";
}

// ── Badges (invariants) ───────────────────────────────────────────────────────

export function buildRuntimeMissionDraftBadges(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftBadge[] {
  return [
    { id: "badge-status", label: draft.status, tone: statusTone(draft.status) },
    { id: "badge-local", label: "Brouillon local", tone: "info" },
    { id: "badge-no-exec", label: "No-execution", tone: "neutral" },
    { id: "badge-readonly", label: "Lecture seule", tone: "neutral" },
    { id: "badge-no-db", label: "Aucune mission créée en base", tone: "neutral" },
    { id: "badge-no-pierre", label: "Aucun appel Pierre", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
    { id: "badge-no-email", label: "Aucun email envoyé", tone: "neutral" },
    { id: "badge-no-doc", label: "Aucun document généré", tone: "neutral" },
    { id: "badge-guard", label: "CloneGuard requis", tone: "violet" },
    { id: "badge-trace", label: "CloneTrace requis", tone: "violet" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSummaryCards(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftCard[] {
  return [
    { id: "card-status", label: "Statut", value: draft.status, sub_label: draft.kind, tone: statusTone(draft.status) },
    { id: "card-employee", label: "Employé", value: draft.employee_key ?? "Aucun actif", sub_label: draft.domain, tone: draft.employee_key ? "success" : "warning" },
    { id: "card-risk", label: "Risque", value: draft.risk_level, sub_label: `Validation : ${draft.validation_mode}`, tone: draft.risk_level === "blocked" ? "danger" : draft.risk_level === "sensitive" ? "warning" : "neutral" },
    { id: "card-steps", label: "Étapes", value: `${draft.steps.length}`, sub_label: `${draft.validation_requirements.length} validation(s)`, tone: "violet" },
    { id: "card-idem", label: "Idempotency", value: draft.idempotency.required ? "Requise" : "—", sub_label: draft.idempotency.idempotency_key, tone: "neutral" },
    { id: "card-queue", label: "Queue future", value: draft.queue_snapshot.queue_name, sub_label: `priorité ${draft.queue_snapshot.priority}`, tone: "neutral" },
    { id: "card-cost", label: "Coût / modèle", value: draft.cost_snapshot.orchestration_model_tier, sub_label: `premium évité : ${draft.cost_snapshot.avoid_premium_model_for}`, tone: "neutral" },
  ];
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSections(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftSection[] {
  return [
    {
      id: "sec-objective",
      kind: "objective",
      title: "Objectif",
      lines: [draft.objective, draft.summary],
      tone: "neutral",
    },
    {
      id: "sec-steps",
      kind: "steps",
      title: "Étapes (plan-only)",
      lines: draft.steps.map((s) => `• ${s.label} — ${s.status}${s.requires_human_validation ? " (validation)" : ""}`),
      tone: "violet",
    },
    {
      id: "sec-validations",
      kind: "validations",
      title: "Validations",
      lines: draft.validation_requirements.length > 0
        ? draft.validation_requirements.map((v) => `• ${v.label} — ${v.reason} (${v.required_approver_role})`)
        : ["Aucune validation humaine requise pour ce brouillon."],
      tone: draft.validation_requirements.length > 0 ? "warning" : "neutral",
    },
    {
      id: "sec-risks",
      kind: "risks",
      title: "Risques / blocages",
      lines: draft.blocked_reasons.length > 0
        ? draft.blocked_reasons
        : [`Risque : ${draft.risk_level}.`, draft.missing_context.length > 0 ? `Contexte manquant : ${draft.missing_context.join(", ")}.` : "Aucun blocage."],
      tone: draft.blocked_reasons.length > 0 ? "danger" : "neutral",
    },
    {
      id: "sec-guard",
      kind: "guard",
      title: "CloneGuard",
      lines: [
        `Décision : ${draft.guard_snapshot.decision}`,
        `CloneGuard requis : ${draft.guard_snapshot.cloneguard_required} · Bypass : ${draft.guard_snapshot.bypass_allowed}`,
        ...draft.guard_snapshot.reasons,
      ],
      tone: draft.guard_snapshot.decision === "block" ? "danger" : "warning",
    },
    {
      id: "sec-trace",
      kind: "trace",
      title: "CloneTrace",
      lines: [
        `CloneTrace requis : ${draft.trace_snapshot.clonetrace_required}`,
        `Écriture serveur : ${draft.trace_snapshot.server_write_enabled}`,
        `Données personnelles : ${draft.trace_snapshot.contains_personal_data}`,
        `Événement final : ${draft.trace_snapshot.final_event}`,
      ],
      tone: "info",
    },
    {
      id: "sec-scale",
      kind: "scale",
      title: "Scale / queue / cost",
      lines: [
        `Idempotency : ${draft.idempotency.idempotency_key}`,
        `Queue : ${draft.queue_snapshot.queue_name} · priorité ${draft.queue_snapshot.priority} · retry ${draft.queue_snapshot.retry_count_recommended}`,
        `Cost : ${draft.cost_snapshot.orchestration_model_tier} · premium évité pour ${draft.cost_snapshot.avoid_premium_model_for}`,
        `Rate limit requis : ${draft.scale_snapshot.rate_limit_required} · Load test requis : ${draft.scale_snapshot.load_test_required}`,
        `Scale 80k prouvé : ${!draft.scale_snapshot.scale_80k_not_proven} (préparation scale — non prouvé).`,
      ],
      tone: "neutral",
    },
    {
      id: "sec-security",
      kind: "security",
      title: "Sécurité / no-execution",
      lines: [
        "Brouillon local / in-memory — aucune mission créée en base.",
        "Aucun appel Pierre. Aucun appel IA. Aucun write DB.",
        "Aucun email/message/document envoyé. CloneVoice non actif.",
        "lancement public externe non validé.",
      ],
      tone: "success",
    },
  ];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftTimeline(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftTimelineItem[] {
  return draft.steps.map((s, i) => ({
    id: `tl-${i}`,
    label: s.label,
    detail: `${s.status}${s.requires_human_validation ? " · validation humaine" : ""} · plan-only`,
    tone: s.status === "blocked" ? "danger" : s.requires_human_validation ? "warning" : "neutral",
  }));
}

// ── Snapshot complet ──────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSnapshot(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftSnapshot {
  return {
    draft,
    badges: buildRuntimeMissionDraftBadges(draft),
    cards: buildRuntimeMissionDraftSummaryCards(draft),
    sections: buildRuntimeMissionDraftSections(draft),
    timeline: buildRuntimeMissionDraftTimeline(draft),
    read_only: true,
    local_in_memory: true,
  };
}

// ── Local preview (alias sémantique) ──────────────────────────────────────────

export function buildRuntimeMissionDraftLocalPreview(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftSnapshot {
  return buildRuntimeMissionDraftSnapshot(draft);
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeMissionDraftSnapshot(
  snapshot: RuntimeMissionDraftSnapshot
): string {
  return [
    `[Mission Draft Snapshot] ${snapshot.draft.title} · ${snapshot.draft.status}`,
    `  Brouillon local / in-memory — aucune mission créée en base.`,
    `  Badges : ${snapshot.badges.length} · Cards : ${snapshot.cards.length} · Sections : ${snapshot.sections.length}`,
    `  Aucun appel Pierre. Aucun appel IA. CloneVoice non actif. Scale 80k non prouvé.`,
  ].join("\n");
}
