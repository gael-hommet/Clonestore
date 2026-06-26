// src/lib/clonestore/runtime-integration/runtime-mission-promotion-snapshot.ts
// PHASE 4.8 — Runtime Mission Promotion — Preview Snapshot (modèle UI pur)
//
// Module PUR / read-only. Transforme un RuntimeMissionPromotionContract en preview
// UI (badges/cards/sections/timeline). Aucun appel réseau, pas de base de données,
// pas de write, pas d'import Pierre, pas d'exécution.

import type {
  RuntimeMissionPromotionContract,
  RuntimeMissionPromotionStatus,
  RuntimeMissionPromotionVerdict,
} from "./runtime-mission-promotion-types";

export type RuntimeMissionPromotionTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimeMissionPromotionBadge = { id: string; label: string; tone: RuntimeMissionPromotionTone };
export type RuntimeMissionPromotionCard = { id: string; label: string; value: string; sub_label?: string; tone: RuntimeMissionPromotionTone };
export type RuntimeMissionPromotionSectionKind = "gates" | "controlled_mission" | "governance" | "invariants";
export type RuntimeMissionPromotionSection = { id: string; title: string; kind: RuntimeMissionPromotionSectionKind; lines: string[] };
export type RuntimeMissionPromotionTimelineItem = { id: string; event: string; label: string; detail: string; tone: RuntimeMissionPromotionTone };

export type RuntimeMissionPromotionSnapshot = {
  status: RuntimeMissionPromotionStatus;
  status_label: string;
  verdict: RuntimeMissionPromotionVerdict;
  tone: RuntimeMissionPromotionTone;
  contract: RuntimeMissionPromotionContract;
  read_only: true;
};

// ── Labels / tone ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RuntimeMissionPromotionStatus, string> = {
  draft_received: "Brouillon reçu",
  eligibility_pending: "Éligibilité en attente",
  eligible_for_promotion: "Éligible à la promotion",
  requires_human_validation: "Validation humaine requise",
  promotion_contract_ready: "Contrat de promotion prêt",
  not_eligible: "Non éligible",
  blocked: "Bloqué (CloneGuard)",
};

export function getRuntimeMissionPromotionStatusLabel(
  status: RuntimeMissionPromotionStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getRuntimeMissionPromotionTone(
  verdict: RuntimeMissionPromotionVerdict
): RuntimeMissionPromotionTone {
  switch (verdict) {
    case "eligible":
      return "success";
    case "requires_human_validation":
      return "warning";
    case "not_eligible":
      return "info";
    case "blocked":
      return "danger";
    default:
      return "neutral";
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionSnapshot(
  contract: RuntimeMissionPromotionContract
): RuntimeMissionPromotionSnapshot {
  return {
    status: contract.status,
    status_label: getRuntimeMissionPromotionStatusLabel(contract.status),
    verdict: contract.decision.verdict,
    tone: getRuntimeMissionPromotionTone(contract.decision.verdict),
    contract,
    read_only: true,
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionBadges(
  snapshot: RuntimeMissionPromotionSnapshot
): RuntimeMissionPromotionBadge[] {
  return [
    { id: "badge-status", label: snapshot.status_label, tone: snapshot.tone },
    { id: "badge-contract", label: "Contrat de promotion", tone: "info" },
    { id: "badge-controlled", label: "Mission contrôlée", tone: "violet" },
    { id: "badge-design-only", label: "Design-only", tone: "info" },
    { id: "badge-human", label: "Validation humaine requise", tone: "neutral" },
    { id: "badge-no-exec", label: "No-execution", tone: "neutral" },
    { id: "badge-no-mission", label: "Aucune mission réelle", tone: "neutral" },
    { id: "badge-no-pierre", label: "Aucun appel Pierre", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
    { id: "badge-cloneguard", label: "CloneGuard obligatoire", tone: "neutral" },
    { id: "badge-clonetrace", label: "CloneTrace obligatoire", tone: "neutral" },
    { id: "badge-clonevoice", label: "CloneVoice non actif", tone: "neutral" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
    { id: "badge-public-launch", label: "Lancement public externe non validé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionCards(
  snapshot: RuntimeMissionPromotionSnapshot
): RuntimeMissionPromotionCard[] {
  const c = snapshot.contract;
  const cm = c.controlled_mission;
  const blockingGates = c.gates.filter((g) => g.severity === "blocking");
  const passedBlocking = blockingGates.filter((g) => g.passed).length;
  return [
    { id: "card-verdict", label: "Verdict", value: c.decision.verdict, sub_label: "promotion_applied : false", tone: snapshot.tone },
    { id: "card-gates", label: "Gates bloquants", value: `${passedBlocking}/${blockingGates.length}`, sub_label: "éligibilité", tone: passedBlocking === blockingGates.length ? "success" : "warning" },
    { id: "card-controlled", label: "Mission contrôlée", value: cm ? cm.status : "non produite", sub_label: cm ? cm.validation_mode : "—", tone: cm ? "violet" : "neutral" },
    { id: "card-validation", label: "Validations requises", value: cm ? String(cm.required_validations.length) : "0", sub_label: "validation humaine", tone: "neutral" },
    { id: "card-safety", label: "Safety flags", value: "Tous false", sub_label: "Aucune exécution / mission réelle", tone: "success" },
    { id: "card-scale", label: "Scale", value: "80k non prouvé", sub_label: "préparation scale", tone: "info" },
  ];
}

// ── Sections ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionSections(
  snapshot: RuntimeMissionPromotionSnapshot
): RuntimeMissionPromotionSection[] {
  const c = snapshot.contract;
  const cm = c.controlled_mission;
  const sections: RuntimeMissionPromotionSection[] = [];

  sections.push({
    id: "sec-gates",
    title: "Gates d'éligibilité",
    kind: "gates",
    lines: c.gates.map((g) => `${g.passed ? "✓" : "✗"} ${g.label}${g.reason ? ` — ${g.reason}` : ""}`),
  });

  if (cm) {
    sections.push({
      id: "sec-controlled",
      title: "Mission contrôlée (contrat)",
      kind: "controlled_mission",
      lines: [
        `Statut : ${cm.status} · Validation : ${cm.validation_mode}`,
        `Employé : ${cm.employee_key ?? "aucun"} · Domaine : ${cm.domain} · Risque : ${cm.risk_level}`,
        `Étapes plan-only : ${cm.steps.length} · Validations : ${cm.required_validations.length}`,
        "Aucune mission réelle créée. Aucune exécution.",
      ],
    });
    sections.push({
      id: "sec-governance",
      title: "Gouvernance",
      kind: "governance",
      lines: [
        `CloneGuard : ${cm.guard_snapshot.decision} · obligatoire`,
        `CloneTrace : requis · final_event ${cm.trace_snapshot.final_event}`,
        `Idempotency : ${cm.idempotency.required} · Queue : ${cm.queue_snapshot.queue_name}`,
      ],
    });
  }

  sections.push({
    id: "sec-invariants",
    title: "Invariants",
    kind: "invariants",
    lines: [
      "promotion_applied : false · execution_enabled : false · autonomous_execution : false",
      "Aucun appel Pierre · Aucun appel IA · CloneVoice non actif",
      "Scale 80k non prouvé · Lancement public externe non validé",
    ],
  });

  return sections;
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionTimeline(
  snapshot: RuntimeMissionPromotionSnapshot
): RuntimeMissionPromotionTimelineItem[] {
  const c = snapshot.contract;
  const items: RuntimeMissionPromotionTimelineItem[] = [];

  items.push({ id: "tl-draft", event: "draft_received", label: "Brouillon reçu", detail: `draft_id ${c.draft_id}.`, tone: "info" });
  items.push({ id: "tl-gates", event: "eligibility_evaluated", label: "Éligibilité évaluée", detail: `Verdict : ${c.decision.verdict}.`, tone: snapshot.tone });

  if (c.controlled_mission) {
    items.push({ id: "tl-controlled", event: "controlled_mission_proposed", label: "Mission contrôlée proposée", detail: "Contrat produit — validation humaine requise.", tone: "violet" });
    items.push({ id: "tl-human", event: "human_validation_required", label: "Validation humaine requise", detail: "Aucune exécution autonome.", tone: "warning" });
  } else {
    items.push({ id: "tl-no-controlled", event: "controlled_mission_not_produced", label: "Mission contrôlée non produite", detail: c.decision.verdict === "blocked" ? "Bloqué par CloneGuard." : "Non éligible.", tone: "neutral" });
  }

  items.push({ id: "tl-exec-not-started", event: "execution_not_started", label: "Aucune exécution", detail: "promotion_applied false · aucune mission réelle · aucun appel Pierre / IA.", tone: "neutral" });
  return items;
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeMissionPromotionSnapshot(
  snapshot: RuntimeMissionPromotionSnapshot
): string {
  return [
    `[Promotion Preview] ${snapshot.status_label} · verdict ${snapshot.verdict}`,
    `  Contrat design-only — promotion_applied false. Mission contrôlée : ${snapshot.contract.controlled_mission ? snapshot.contract.controlled_mission.status : "non produite"}.`,
    `  Validation humaine requise · CloneGuard et CloneTrace obligatoires.`,
    `  Aucune mission réelle · Aucune exécution · Aucun appel Pierre · Aucun appel IA.`,
    `  CloneVoice non actif · Scale 80k non prouvé · Lancement public externe non validé.`,
  ].join("\n");
}
