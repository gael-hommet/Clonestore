// src/lib/clonestore/runtime-integration/runtime-mission-draft-safe-apply-ui.ts
// PHASE 4.5 — Runtime Mission Draft Safe Apply — UI Status Model
//
// Module pur. Transforme un RuntimeMissionDraftSafeApplyResult en cards UI read-only.
// Pas de fetch, pas de Supabase, pas de write, pas d'import Pierre.

import type {
  RuntimeMissionDraftSafeApplyResult,
  RuntimeMissionDraftSafeApplyStatus,
} from "./runtime-mission-draft-safe-apply-types";

export type RuntimeMissionDraftSafeApplyUiTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimeMissionDraftSafeApplyUiBadge = { id: string; label: string; tone: RuntimeMissionDraftSafeApplyUiTone };
export type RuntimeMissionDraftSafeApplyUiCard = { id: string; label: string; value: string; sub_label?: string; tone: RuntimeMissionDraftSafeApplyUiTone };
export type RuntimeMissionDraftSafeApplyUiTimelineItem = { id: string; label: string; detail: string; tone: RuntimeMissionDraftSafeApplyUiTone };
export type RuntimeMissionDraftSafeApplyUiAction = { id: string; label: string; href: string; primary: boolean };

export type RuntimeMissionDraftSafeApplyUiSnapshot = {
  status: RuntimeMissionDraftSafeApplyStatus;
  status_label: string;
  tone: RuntimeMissionDraftSafeApplyUiTone;
  result: RuntimeMissionDraftSafeApplyResult;
  read_only: true;
};

// ── Status label / tone ───────────────────────────────────────────────────────

export function getRuntimeMissionDraftSafeApplyUiStatusLabel(
  status: RuntimeMissionDraftSafeApplyStatus
): string {
  const labels: Record<RuntimeMissionDraftSafeApplyStatus, string> = {
    local_saved: "Brouillon sauvegardé localement",
    local_saved_server_disabled: "Sauvegardé localement · serveur désactivé",
    local_saved_server_synced: "Sauvegardé localement et serveur",
    local_saved_server_failed: "Sauvegardé localement · sync serveur échouée",
    local_failed: "Échec sauvegarde locale",
    validation_failed: "Brouillon non conforme",
    auth_required: "Session requise",
    server_unavailable: "Serveur indisponible — fallback local",
    server_blocked: "Serveur bloqué — fallback local",
    restored_local: "Brouillon restauré localement",
    restored_server: "Brouillon restauré depuis serveur",
    restored_none: "Aucun brouillon à restaurer",
  };
  return labels[status] ?? "Statut inconnu";
}

function tone(status: RuntimeMissionDraftSafeApplyStatus): RuntimeMissionDraftSafeApplyUiTone {
  if (status === "local_saved_server_synced") return "success";
  if (status === "local_failed" || status === "validation_failed") return "danger";
  if (status === "local_saved_server_failed" || status === "server_unavailable" || status === "server_blocked") return "warning";
  if (status === "local_saved_server_disabled" || status === "auth_required") return "info";
  if (status === "local_saved" || status === "restored_local") return "success";
  return "neutral";
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSafeApplyUiSnapshot(
  result: RuntimeMissionDraftSafeApplyResult
): RuntimeMissionDraftSafeApplyUiSnapshot {
  return {
    status: result.status,
    status_label: getRuntimeMissionDraftSafeApplyUiStatusLabel(result.status),
    tone: tone(result.status),
    result,
    read_only: true,
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSafeApplyUiBadges(
  snapshot: RuntimeMissionDraftSafeApplyUiSnapshot
): RuntimeMissionDraftSafeApplyUiBadge[] {
  return [
    { id: "badge-status", label: snapshot.status_label, tone: snapshot.tone },
    { id: "badge-ls-first", label: "localStorage-first", tone: "info" },
    { id: "badge-local-saved", label: "Brouillon sauvegardé localement", tone: snapshot.result.local_saved ? "success" : "neutral" },
    { id: "badge-server-disabled", label: "Serveur désactivé si flag false", tone: "neutral" },
    { id: "badge-no-mission", label: "Aucune mission créée", tone: "neutral" },
    { id: "badge-no-exec", label: "No-execution", tone: "neutral" },
    { id: "badge-no-pierre", label: "Aucun appel Pierre", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
    { id: "badge-no-clonevoice", label: "CloneVoice non actif", tone: "neutral" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSafeApplyUiCards(
  snapshot: RuntimeMissionDraftSafeApplyUiSnapshot
): RuntimeMissionDraftSafeApplyUiCard[] {
  const r = snapshot.result;
  return [
    { id: "card-local", label: "Statut local", value: r.local_saved ? "Sauvegardé" : "Non sauvegardé", sub_label: "localStorage-first", tone: r.local_saved ? "success" : "warning" },
    { id: "card-server", label: "Statut serveur", value: r.server_synced ? "Synchronisé" : r.server_attempted ? "Échec/optionnel" : "Désactivé", sub_label: `db_write : ${r.db_write_performed}`, tone: r.server_synced ? "success" : "neutral" },
    { id: "card-safety", label: "Safety flags", value: "Tous false", sub_label: "Aucune exécution / mission", tone: "success" },
    { id: "card-idem", label: "Idempotency", value: r.draft?.idempotency.required ? "Requise" : "—", sub_label: r.draft?.idempotency.idempotency_key ?? "", tone: "neutral" },
    { id: "card-next", label: "Prochaine action", value: r.server_synced ? "Restaurer / consulter" : "Restaurer le brouillon local", sub_label: "Aucune exécution", tone: "violet" },
  ];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSafeApplyUiTimeline(
  snapshot: RuntimeMissionDraftSafeApplyUiSnapshot
): RuntimeMissionDraftSafeApplyUiTimelineItem[] {
  const r = snapshot.result;
  const items: RuntimeMissionDraftSafeApplyUiTimelineItem[] = [];

  items.push({ id: "tl-validated", label: "Brouillon validé", detail: r.status === "validation_failed" ? "Validation échouée." : "Validation OK.", tone: r.status === "validation_failed" ? "danger" : "success" });

  if (r.local_saved) {
    items.push({ id: "tl-local-saved", label: "Sauvegarde locale", detail: "localStorage sauvegardé en premier.", tone: "success" });
  } else if (r.status === "local_failed") {
    items.push({ id: "tl-local-failed", label: "Échec sauvegarde locale", detail: "localStorage indisponible.", tone: "danger" });
  }

  if (!r.server_attempted && r.local_saved) {
    items.push({ id: "tl-server-skipped", label: "Serveur ignoré (désactivé)", detail: "Flag serveur false — brouillon local uniquement.", tone: "info" });
  } else if (r.server_attempted) {
    items.push({ id: "tl-server-attempted", label: "Tentative serveur", detail: "Sauvegarde serveur best-effort.", tone: "neutral" });
    if (r.server_synced) {
      items.push({ id: "tl-server-synced", label: "Sync serveur réussie", detail: "Brouillon sauvegardé côté serveur.", tone: "success" });
    } else {
      items.push({ id: "tl-server-failed", label: "Fallback local", detail: "Serveur indisponible — brouillon conservé localement.", tone: "warning" });
    }
  }

  return items;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSafeApplyUiActions(
  snapshot: RuntimeMissionDraftSafeApplyUiSnapshot
): RuntimeMissionDraftSafeApplyUiAction[] {
  void snapshot;
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-pierre-use", label: "Cockpit Pierre", href: "/agents/pierre/use", primary: false },
  ];
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeMissionDraftSafeApplyUiStatus(
  snapshot: RuntimeMissionDraftSafeApplyUiSnapshot
): string {
  return [
    `[Safe Apply UI] ${snapshot.status_label}`,
    `  localStorage-first · Brouillon uniquement — aucune mission créée.`,
    `  Aucun appel Pierre. Aucun appel IA. CloneVoice non actif. Scale 80k non prouvé.`,
  ].join("\n");
}
