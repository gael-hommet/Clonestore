// src/lib/clonestore/runtime-integration/runtime-controlled-mission-human-validation-snapshot.ts
// PHASE 4.11 — Controlled Mission Human Validation — Snapshot / UI Model
//
// Module PUR / read-only. Transforme un workflow en preview lisible (badges/cards/
// sections/timeline/warnings) pour une future UI / docs. Pas de fetch, pas de base
// de données, pas de write, pas d'import Pierre, pas d'exécution.

import type {
  RuntimeControlledMissionHumanValidationWorkflow,
  RuntimeControlledMissionHumanValidationStatus,
} from "./runtime-controlled-mission-human-validation-types";

export type RuntimeControlledMissionHumanValidationSnapshotTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimeControlledMissionHumanValidationSnapshotBadge = {
  id: string;
  label: string;
  tone: RuntimeControlledMissionHumanValidationSnapshotTone;
};

export type RuntimeControlledMissionHumanValidationSnapshotCard = {
  id: string;
  label: string;
  value: string;
  sub_label?: string;
  tone: RuntimeControlledMissionHumanValidationSnapshotTone;
};

export type RuntimeControlledMissionHumanValidationSnapshotSection = {
  id: string;
  title: string;
  lines: string[];
};

export type RuntimeControlledMissionHumanValidationSnapshotTimelineItem = {
  id: string;
  event: string;
  label: string;
  detail: string;
  tone: RuntimeControlledMissionHumanValidationSnapshotTone;
};

export type RuntimeControlledMissionHumanValidationSnapshotWarning = {
  id: string;
  label: string;
  detail: string;
  tone: RuntimeControlledMissionHumanValidationSnapshotTone;
};

export type RuntimeControlledMissionHumanValidationSnapshotAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type RuntimeControlledMissionHumanValidationSnapshot = {
  status: RuntimeControlledMissionHumanValidationStatus;
  status_label: string;
  tone: RuntimeControlledMissionHumanValidationSnapshotTone;
  workflow: RuntimeControlledMissionHumanValidationWorkflow;
  read_only: true;
};

// ── Labels / tone ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RuntimeControlledMissionHumanValidationStatus, string> = {
  not_started: "Validation non démarrée",
  awaiting_validator: "En attente de validateur",
  awaiting_second_validator: "En attente d'un second validateur",
  changes_requested: "Modifications demandées",
  approved_preview: "Approuvé (aperçu) — non appliqué",
  rejected: "Rejeté",
  blocked: "Bloqué",
  expired: "Expiré",
  cancelled: "Annulé",
};

export function getRuntimeControlledMissionHumanValidationStatusLabel(
  status: RuntimeControlledMissionHumanValidationStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getRuntimeControlledMissionHumanValidationTone(
  status: RuntimeControlledMissionHumanValidationStatus
): RuntimeControlledMissionHumanValidationSnapshotTone {
  switch (status) {
    case "approved_preview":
      return "success";
    case "awaiting_validator":
    case "awaiting_second_validator":
    case "changes_requested":
      return "warning";
    case "rejected":
    case "blocked":
      return "danger";
    case "expired":
    case "cancelled":
      return "neutral";
    default:
      return "info";
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationSnapshot(
  workflow: RuntimeControlledMissionHumanValidationWorkflow
): RuntimeControlledMissionHumanValidationSnapshot {
  return {
    status: workflow.status,
    status_label: getRuntimeControlledMissionHumanValidationStatusLabel(workflow.status),
    tone: getRuntimeControlledMissionHumanValidationTone(workflow.status),
    workflow,
    read_only: true,
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationBadges(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): RuntimeControlledMissionHumanValidationSnapshotBadge[] {
  const w = snapshot.workflow;
  return [
    { id: "badge-status", label: snapshot.status_label, tone: snapshot.tone },
    { id: "badge-design", label: "Validation humaine design", tone: "info" },
    { id: "badge-readonly", label: "Lecture seule", tone: "info" },
    { id: "badge-preview", label: "Preview only", tone: "info" },
    { id: "badge-human", label: "Human validation required", tone: "neutral" },
    { id: "badge-double", label: "Double validation si sensible", tone: w.second_validation_required ? "warning" : "neutral" },
    { id: "badge-cloneguard", label: "CloneGuard obligatoire", tone: "neutral" },
    { id: "badge-clonetrace", label: "CloneTrace obligatoire", tone: "neutral" },
    { id: "badge-no-mission", label: "Aucune mission réelle", tone: "neutral" },
    { id: "badge-no-exec", label: "No-execution", tone: "neutral" },
    { id: "badge-promotion", label: "Promotion non appliquée", tone: "neutral" },
    { id: "badge-no-pierre", label: "Aucun appel Pierre", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
    { id: "badge-no-email", label: "Aucun email envoyé", tone: "neutral" },
    { id: "badge-no-doc", label: "Aucun document généré", tone: "neutral" },
    { id: "badge-no-clonevoice", label: "CloneVoice non actif", tone: "neutral" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
    { id: "badge-public-launch", label: "Lancement public externe non validé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationCards(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): RuntimeControlledMissionHumanValidationSnapshotCard[] {
  const w = snapshot.workflow;
  const requiredValidators = w.required_validators.filter((v) => v.required);
  return [
    { id: "card-status", label: "Statut workflow", value: snapshot.status_label, sub_label: "design-only", tone: snapshot.tone },
    { id: "card-validation", label: "Validation requise", value: w.human_validation_required ? "Oui" : "Non", sub_label: w.second_validation_required ? "double" : "simple", tone: "neutral" },
    { id: "card-validators", label: "Validateurs", value: String(requiredValidators.length), sub_label: requiredValidators.map((v) => v.role).join(", "), tone: "neutral" },
    { id: "card-gates", label: "Gates", value: String(w.gates.length), sub_label: "humains + invariants", tone: "neutral" },
    { id: "card-sensitivity", label: "Sensibilité", value: w.sensitivity, sub_label: "classification", tone: w.sensitivity === "low" ? "neutral" : "warning" },
    { id: "card-risk", label: "Risque", value: w.risk_level, sub_label: "classification", tone: "neutral" },
    { id: "card-decision", label: "Décision (aperçu)", value: w.decisions.length > 0 ? w.decisions[w.decisions.length - 1].decision : "—", sub_label: "preview_only", tone: "violet" },
    { id: "card-trace", label: "Trace preview", value: w.trace_preview.final_event, sub_label: `${w.trace_preview.events.length} events`, tone: "neutral" },
    { id: "card-noexec", label: "No-execution flags", value: "Tous false", sub_label: "approval_applied false", tone: "success" },
  ];
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationSections(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): RuntimeControlledMissionHumanValidationSnapshotSection[] {
  const w = snapshot.workflow;
  return [
    {
      id: "sec-validators",
      title: "Validateurs requis",
      lines: w.required_validators.map((v) => `${v.required ? "•" : "·"} ${v.role} — ${v.reason}`),
    },
    {
      id: "sec-gates",
      title: "Gates de validation",
      lines: w.gates.map((g) => `${g.status === "passed" ? "✓" : g.status === "not_required" ? "·" : "○"} ${g.label} (${g.status})`),
    },
    {
      id: "sec-invariants",
      title: "Invariants",
      lines: [
        "approval_applied false · promotion_applied false · mission_created false",
        "execution_enabled false · execution_started false · db_write_performed false",
        "Aucun appel Pierre · Aucun appel IA · CloneVoice non actif",
        "Scale 80k non prouvé · Lancement public externe non validé",
      ],
    },
  ];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationTimeline(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): RuntimeControlledMissionHumanValidationSnapshotTimelineItem[] {
  const w = snapshot.workflow;
  const items: RuntimeControlledMissionHumanValidationSnapshotTimelineItem[] = [
    { id: "tl-created", event: "workflow_created", label: "Workflow créé", detail: `workflow ${w.workflow_id}.`, tone: "info" },
    { id: "tl-classified", event: "policy_classified", label: "Sensibilité classée", detail: `sensibilité : ${w.sensitivity} · risque : ${w.risk_level}.`, tone: snapshot.tone },
    { id: "tl-gates", event: "gates_built", label: "Gates construits", detail: `${w.gates.length} gate(s).`, tone: "neutral" },
    { id: "tl-validators", event: "validators_required", label: "Validateurs requis", detail: `${w.required_validators.filter((v) => v.required).length} requis.`, tone: "neutral" },
    { id: "tl-decision", event: w.decisions.length > 0 ? "decision_preview_only" : "decision_pending", label: w.decisions.length > 0 ? "Décision (aperçu)" : "Décision en attente", detail: "Aucune approbation appliquée.", tone: "violet" },
    { id: "tl-no-mission", event: "controlled_mission_not_created", label: "Mission contrôlée non créée", detail: "Aucune mission réelle.", tone: "neutral" },
    { id: "tl-exec-not-started", event: "execution_not_started", label: "Aucune exécution", detail: "execution_not_started · approval_applied false.", tone: "neutral" },
  ];
  return items;
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationWarnings(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): RuntimeControlledMissionHumanValidationSnapshotWarning[] {
  const w = snapshot.workflow;
  const warnings: RuntimeControlledMissionHumanValidationSnapshotWarning[] = [];

  warnings.push({
    id: "warn-human",
    label: "Validation humaine requise",
    detail: "Aucune mission réelle ne peut être créée sans validation humaine.",
    tone: "warning",
  });
  if (w.second_validation_required) {
    warnings.push({ id: "warn-second", label: "Double validation requise", detail: "Cas sensible — un second validateur est requis.", tone: "warning" });
  }
  if (w.required_validators.some((v) => v.role === "legal_reviewer" && v.required)) {
    warnings.push({ id: "warn-legal", label: "Revue légale requise", detail: "Cas juridique — revue légale requise.", tone: "warning" });
  }
  if (w.status === "blocked" || w.status === "rejected") {
    warnings.push({ id: "warn-blocked", label: "Workflow bloqué/rejeté", detail: "Aucune promotion ni mission réelle.", tone: "danger" });
  }
  warnings.push({
    id: "warn-no-exec",
    label: "Aucune mission réelle / aucune exécution",
    detail: "approval_applied false · promotion_applied false · Aucun appel Pierre / IA.",
    tone: "neutral",
  });
  return warnings;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationActions(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): RuntimeControlledMissionHumanValidationSnapshotAction[] {
  void snapshot;
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
  ];
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeControlledMissionHumanValidationSnapshot(
  snapshot: RuntimeControlledMissionHumanValidationSnapshot
): string {
  const w = snapshot.workflow;
  return [
    `[Human Validation Snapshot] ${snapshot.status_label} · sensibilité ${w.sensitivity}`,
    `  Validation humaine requise · Double validation : ${w.second_validation_required}.`,
    `  approved_preview ne crée AUCUNE vraie mission. approval_applied false.`,
    `  Aucune mission réelle · Aucune exécution · Aucun appel Pierre · Aucun appel IA.`,
    `  CloneVoice non actif · Scale 80k non prouvé · Lancement public externe non validé.`,
  ].join("\n");
}
