// src/lib/clonestore/runtime-integration/runtime-mission-draft-restore-ui.ts
// PHASE 4.7 — Runtime Mission Draft — Server Restore UI Polish (modèle UI pur)
//
// Module PUR / read-only. Transforme les résultats existants P4.5
// (persist / restore safe apply + capabilities serveur + flag) en un statut UI
// clair pour /profile/messages : source effective, statut local/serveur,
// dernière sauvegarde locale, dernière tentative serveur, warnings, fallback.
//
// Ne change PAS la persistance P4.5. N'ajoute aucun write, aucun appel réseau.
// Pas de base de données. Pas d'appel moteur Pierre. Pas d'appel IA.
// Pas d'exécution CloneOS. Pas d'activation CloneVoice. Jamais throw brut.
// Serveur feature-flaggé · activation manuelle P4.6 · brouillon uniquement.

import type {
  RuntimeMissionDraftSafeApplyResult,
  RuntimeMissionDraftSafeApplyRestoreResult,
} from "./runtime-mission-draft-safe-apply-types";
import type { RuntimeMissionDraftServerCapabilities } from "./runtime-mission-draft-server-api-contract";
import type { RuntimeMissionDraftLocalStorageEnvelope } from "./runtime-mission-draft-localstorage";
import type { RuntimeMissionDraft } from "./runtime-mission-draft-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftRestoreUiTone =
  | "success" | "warning" | "info" | "neutral" | "danger" | "violet";

export type RuntimeMissionDraftRestoreUiStatus =
  | "local_only"
  | "local_saved"
  | "local_restored"
  | "server_disabled"
  | "server_attempted"
  | "server_synced"
  | "server_restored"
  | "server_failed"
  | "auth_required"
  | "table_unavailable"
  | "rls_blocked"
  | "restored_none"
  | "pending"
  | "unknown";

export type RuntimeMissionDraftRestoreUiSource =
  | "localstorage"
  | "server"
  | "local_newer_than_server"
  | "server_newer_than_local"
  | "fallback_local"
  | "server_disabled"
  | "manual_activation_required"
  | "unknown";

export type RuntimeMissionDraftRestoreUiBadge = {
  id: string;
  label: string;
  tone: RuntimeMissionDraftRestoreUiTone;
};

export type RuntimeMissionDraftRestoreUiCard = {
  id: string;
  label: string;
  value: string;
  sub_label?: string;
  tone: RuntimeMissionDraftRestoreUiTone;
};

export type RuntimeMissionDraftRestoreUiTimelineItem = {
  id: string;
  event: string;
  label: string;
  detail: string;
  tone: RuntimeMissionDraftRestoreUiTone;
};

export type RuntimeMissionDraftRestoreUiAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

export type RuntimeMissionDraftRestoreUiWarning = {
  id: string;
  label: string;
  detail: string;
  tone: RuntimeMissionDraftRestoreUiTone;
};

export type RuntimeMissionDraftRestoreUiSnapshot = {
  status: RuntimeMissionDraftRestoreUiStatus;
  status_label: string;
  status_title: string;
  status_body: string;
  source: RuntimeMissionDraftRestoreUiSource;
  source_label: string;
  tone: RuntimeMissionDraftRestoreUiTone;
  feature_flag_enabled: boolean;
  server_feature_flagged: true;
  manual_activation_required: boolean;
  manual_activation_known: boolean;
  has_local_draft: boolean;
  draft_title: string | null;
  local_saved_at: string | null;
  server_synced_at: string | null;
  last_attempt_at: string | null;
  // Invariants no-execution (toujours faux/constant)
  mission_created: false;
  execution_started: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
  scale_80k_not_proven: true;
  public_launch_external_validated: false;
  read_only: true;
};

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftRestoreUiOptions = {
  latestLocalEnvelope?: RuntimeMissionDraftLocalStorageEnvelope | null;
  latestLocalDraft?: RuntimeMissionDraft | null;
  lastPersistResult?: RuntimeMissionDraftSafeApplyResult | null;
  lastRestoreResult?: RuntimeMissionDraftSafeApplyRestoreResult | null;
  serverCapabilities?: RuntimeMissionDraftServerCapabilities | null;
  featureFlagEnabled?: boolean;
  lastAttemptAt?: string | null;
  localSavedAt?: string | null;
  serverSyncedAt?: string | null;
  manualActivationKnown?: boolean;
};

// ── Labels ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RuntimeMissionDraftRestoreUiStatus, string> = {
  local_only: "Brouillon local uniquement",
  local_saved: "Brouillon sauvegardé localement",
  local_restored: "Brouillon restauré depuis localStorage",
  server_disabled: "Serveur désactivé",
  server_attempted: "Tentative serveur",
  server_synced: "Brouillon synchronisé serveur",
  server_restored: "Brouillon restauré depuis serveur",
  server_failed: "Serveur indisponible — fallback local",
  auth_required: "Connexion requise",
  table_unavailable: "Table serveur à vérifier",
  rls_blocked: "RLS/permissions à vérifier",
  restored_none: "Aucun brouillon à restaurer",
  pending: "En attente",
  unknown: "Statut inconnu",
};

type StatusCopy = { title: string; body: string };

const STATUS_COPY: Record<RuntimeMissionDraftRestoreUiStatus, StatusCopy> = {
  local_only: {
    title: "Brouillon local uniquement",
    body: "Le brouillon vit dans le navigateur. localStorage reste le fallback actif.",
  },
  local_saved: {
    title: "Brouillon sauvegardé localement",
    body: "localStorage reste le fallback actif.",
  },
  local_restored: {
    title: "Brouillon restauré depuis localStorage",
    body: "Aucune mission réelle n'a été créée.",
  },
  server_disabled: {
    title: "Serveur désactivé",
    body: "Le brouillon reste sauvegardé localement. Le serveur nécessite l'activation manuelle P4.6.",
  },
  server_attempted: {
    title: "Tentative serveur en cours",
    body: "Le brouillon local reste prioritaire pendant la tentative serveur.",
  },
  server_synced: {
    title: "Brouillon synchronisé serveur",
    body: "Le serveur a sauvegardé un brouillon uniquement, sans exécution.",
  },
  server_restored: {
    title: "Brouillon restauré depuis serveur",
    body: "Le snapshot serveur a été relu, puis conservé localement si nécessaire.",
  },
  server_failed: {
    title: "Serveur indisponible — fallback local",
    body: "La sauvegarde locale reste disponible.",
  },
  auth_required: {
    title: "Connexion requise",
    body: "Connectez-vous pour tester la synchronisation serveur.",
  },
  table_unavailable: {
    title: "Table serveur à vérifier",
    body: "Le SQL P4.4 doit être appliqué manuellement dans Supabase.",
  },
  rls_blocked: {
    title: "RLS/permissions à vérifier",
    body: "La session ou les policies empêchent la lecture/écriture du brouillon.",
  },
  restored_none: {
    title: "Aucun brouillon à restaurer",
    body: "Préparez puis sauvegardez un brouillon local pour le restaurer ensuite.",
  },
  pending: {
    title: "En attente",
    body: "Aucune sauvegarde ni restauration n'a encore été déclenchée. Aucune exécution.",
  },
  unknown: {
    title: "Statut inconnu",
    body: "Le brouillon local reste le fallback actif.",
  },
};

const SOURCE_LABELS: Record<RuntimeMissionDraftRestoreUiSource, string> = {
  localstorage: "localStorage (navigateur)",
  server: "Serveur (brouillon Supabase)",
  local_newer_than_server: "Local plus récent que le serveur",
  server_newer_than_local: "Serveur plus récent que le local",
  fallback_local: "Fallback local",
  server_disabled: "Serveur désactivé",
  manual_activation_required: "Activation manuelle P4.6 requise",
  unknown: "Source inconnue",
};

export function getRuntimeMissionDraftRestoreUiStatusLabel(
  status: RuntimeMissionDraftRestoreUiStatus
): string {
  return STATUS_LABELS[status] ?? "Statut inconnu";
}

export function getRuntimeMissionDraftRestoreUiSourceLabel(
  source: RuntimeMissionDraftRestoreUiSource
): string {
  return SOURCE_LABELS[source] ?? "Source inconnue";
}

export function getRuntimeMissionDraftRestoreUiTone(
  status: RuntimeMissionDraftRestoreUiStatus
): RuntimeMissionDraftRestoreUiTone {
  switch (status) {
    case "server_synced":
    case "server_restored":
    case "local_saved":
    case "local_restored":
      return "success";
    case "server_failed":
    case "auth_required":
    case "table_unavailable":
    case "rls_blocked":
      return "warning";
    case "server_disabled":
    case "server_attempted":
    case "local_only":
    case "pending":
      return "info";
    default:
      return "neutral";
  }
}

// ── Mapping interne (résultats P4.5 → statut restore UI) ──────────────────────

function mapPersistResultToStatus(
  result: RuntimeMissionDraftSafeApplyResult
): RuntimeMissionDraftRestoreUiStatus {
  switch (result.status) {
    case "local_saved_server_synced":
    case "restored_server":
      return "server_synced";
    case "local_saved_server_disabled":
      return "server_disabled";
    case "local_saved_server_failed":
    case "server_unavailable":
      return "server_failed";
    case "server_blocked":
      return "rls_blocked";
    case "auth_required":
      return "auth_required";
    case "local_saved":
      return "local_saved";
    case "restored_local":
      return "local_restored";
    case "local_failed":
    case "validation_failed":
      return "local_only";
    default:
      return result.local_saved ? "local_saved" : "local_only";
  }
}

function mapRestoreResultToStatus(
  result: RuntimeMissionDraftSafeApplyRestoreResult
): RuntimeMissionDraftRestoreUiStatus {
  switch (result.status) {
    case "restored_server":
      return "server_restored";
    case "restored_local":
      return "local_restored";
    case "restored_none":
      return "restored_none";
    case "auth_required":
      return "auth_required";
    case "server_unavailable":
      return "server_failed";
    case "server_blocked":
      return "rls_blocked";
    default:
      return result.draft ? "local_restored" : "restored_none";
  }
}

function deriveSource(
  status: RuntimeMissionDraftRestoreUiStatus,
  options: RuntimeMissionDraftRestoreUiOptions
): RuntimeMissionDraftRestoreUiSource {
  const localAt = options.localSavedAt ?? null;
  const serverAt = options.serverSyncedAt ?? null;
  if (localAt && serverAt) {
    const lt = new Date(localAt).getTime();
    const st = new Date(serverAt).getTime();
    if (Number.isFinite(lt) && Number.isFinite(st)) {
      if (lt > st) return "local_newer_than_server";
      if (st > lt) return "server_newer_than_local";
    }
  }
  switch (status) {
    case "server_synced":
    case "server_restored":
      return "server";
    case "server_failed":
      return "fallback_local";
    case "server_disabled":
      return options.featureFlagEnabled ? "server_disabled" : "manual_activation_required";
    case "auth_required":
    case "table_unavailable":
    case "rls_blocked":
      return "fallback_local";
    case "local_saved":
    case "local_restored":
    case "local_only":
      return "localstorage";
    default:
      return "unknown";
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftRestoreUiSnapshot(
  options?: RuntimeMissionDraftRestoreUiOptions
): RuntimeMissionDraftRestoreUiSnapshot {
  const opts = options ?? {};
  const flagEnabled = opts.featureFlagEnabled ?? opts.serverCapabilities?.flag_enabled ?? false;

  // Le résultat le plus récent (restore prioritaire sur persist pour l'affichage
  // de la "source effective"). Sans résultat → statut local sûr.
  let status: RuntimeMissionDraftRestoreUiStatus;
  if (opts.lastRestoreResult) {
    status = mapRestoreResultToStatus(opts.lastRestoreResult);
  } else if (opts.lastPersistResult) {
    status = mapPersistResultToStatus(opts.lastPersistResult);
  } else if (opts.latestLocalEnvelope || opts.latestLocalDraft) {
    status = "local_only";
  } else {
    status = "local_only";
  }

  // Si le flag est false mais qu'on affiche un statut serveur "réussi" incohérent,
  // on rabat sur server_disabled (sécurité d'affichage).
  if (!flagEnabled && (status === "server_synced" || status === "server_restored")) {
    status = "server_disabled";
  }

  const source = deriveSource(status, { ...opts, featureFlagEnabled: flagEnabled });
  const copy = STATUS_COPY[status] ?? STATUS_COPY.unknown;

  const draft =
    opts.lastRestoreResult?.draft ??
    opts.latestLocalDraft ??
    opts.latestLocalEnvelope?.payload ??
    opts.lastPersistResult?.draft ??
    null;

  const manualActivationRequired = !flagEnabled || status === "server_disabled";

  return {
    status,
    status_label: getRuntimeMissionDraftRestoreUiStatusLabel(status),
    status_title: copy.title,
    status_body: copy.body,
    source,
    source_label: getRuntimeMissionDraftRestoreUiSourceLabel(source),
    tone: getRuntimeMissionDraftRestoreUiTone(status),
    feature_flag_enabled: flagEnabled,
    server_feature_flagged: true,
    manual_activation_required: manualActivationRequired,
    manual_activation_known: opts.manualActivationKnown ?? false,
    has_local_draft: Boolean(draft),
    draft_title: draft?.title ?? null,
    local_saved_at: opts.localSavedAt ?? opts.latestLocalEnvelope?.saved_at ?? null,
    server_synced_at: opts.serverSyncedAt ?? null,
    last_attempt_at:
      opts.lastAttemptAt ??
      opts.lastRestoreResult?.attempted_at ??
      opts.lastPersistResult?.attempted_at ??
      null,
    mission_created: false,
    execution_started: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    scale_80k_not_proven: true,
    public_launch_external_validated: false,
    read_only: true,
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftRestoreUiBadges(
  snapshot: RuntimeMissionDraftRestoreUiSnapshot
): RuntimeMissionDraftRestoreUiBadge[] {
  return [
    { id: "badge-status", label: snapshot.status_label, tone: snapshot.tone },
    { id: "badge-source", label: `Source : ${snapshot.source_label}`, tone: "info" },
    { id: "badge-ls-first", label: "localStorage-first", tone: "info" },
    { id: "badge-local-draft", label: "Brouillon local", tone: snapshot.has_local_draft ? "success" : "neutral" },
    { id: "badge-server-flagged", label: "Serveur feature-flaggé", tone: snapshot.feature_flag_enabled ? "success" : "neutral" },
    { id: "badge-no-real-mission", label: "Aucune mission réelle", tone: "neutral" },
    { id: "badge-no-exec", label: "No-execution", tone: "neutral" },
    { id: "badge-no-pierre", label: "Aucun appel Pierre", tone: "neutral" },
    { id: "badge-no-ai", label: "Aucun appel IA", tone: "neutral" },
    { id: "badge-no-clonevoice", label: "CloneVoice non actif", tone: "neutral" },
    { id: "badge-scale", label: "Scale 80k non prouvé", tone: "info" },
    { id: "badge-public-launch", label: "Lancement public externe non validé", tone: "info" },
  ];
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "—";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function buildRuntimeMissionDraftRestoreUiCards(
  snapshot: RuntimeMissionDraftRestoreUiSnapshot
): RuntimeMissionDraftRestoreUiCard[] {
  const serverValue = snapshot.feature_flag_enabled
    ? (snapshot.status === "server_synced" || snapshot.status === "server_restored" ? "Synchronisé" : "Activé (flaggé)")
    : "Désactivé";
  return [
    {
      id: "card-source",
      label: "Source effective",
      value: snapshot.source_label,
      sub_label: "localStorage-first",
      tone: snapshot.tone,
    },
    {
      id: "card-local",
      label: "Statut local",
      value: snapshot.has_local_draft ? "Brouillon disponible" : "Aucun brouillon",
      sub_label: snapshot.draft_title ?? "localStorage fallback",
      tone: snapshot.has_local_draft ? "success" : "neutral",
    },
    {
      id: "card-server",
      label: "Statut serveur",
      value: serverValue,
      sub_label: snapshot.feature_flag_enabled ? "Brouillon uniquement" : "Activation manuelle P4.6",
      tone: snapshot.status === "server_synced" || snapshot.status === "server_restored" ? "success" : "neutral",
    },
    {
      id: "card-last-local",
      label: "Dernière sauvegarde locale",
      value: formatWhen(snapshot.local_saved_at),
      sub_label: "Au clic uniquement",
      tone: "neutral",
    },
    {
      id: "card-last-server",
      label: "Dernière tentative serveur",
      value: formatWhen(snapshot.server_synced_at ?? snapshot.last_attempt_at),
      sub_label: snapshot.feature_flag_enabled ? "Best-effort" : "Aucune (flag false)",
      tone: "neutral",
    },
    {
      id: "card-flag",
      label: "Flag serveur",
      value: snapshot.feature_flag_enabled ? "true" : "false",
      sub_label: "NEXT_PUBLIC_..._SERVER_PERSISTENCE_ENABLED",
      tone: snapshot.feature_flag_enabled ? "violet" : "info",
    },
    {
      id: "card-safety",
      label: "Safety flags",
      value: "Tous false",
      sub_label: "Aucune exécution / mission réelle",
      tone: "success",
    },
    {
      id: "card-fallback",
      label: "Fallback local",
      value: "Actif",
      sub_label: "Aucune donnée perdue au rollback",
      tone: "success",
    },
  ];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftRestoreUiTimeline(
  snapshot: RuntimeMissionDraftRestoreUiSnapshot
): RuntimeMissionDraftRestoreUiTimelineItem[] {
  const items: RuntimeMissionDraftRestoreUiTimelineItem[] = [];

  if (snapshot.has_local_draft || snapshot.local_saved_at) {
    items.push({
      id: "tl-draft-created",
      event: "draft_created",
      label: "Brouillon préparé",
      detail: snapshot.draft_title ? `Brouillon : ${snapshot.draft_title}.` : "Brouillon local préparé (au clic).",
      tone: "info",
    });
  }

  if (snapshot.local_saved_at || snapshot.status === "local_saved" || snapshot.has_local_draft) {
    items.push({
      id: "tl-local-saved",
      event: "local_saved",
      label: "Sauvegarde locale",
      detail: "localStorage sauvegardé en premier. localStorage reste le fallback actif.",
      tone: "success",
    });
  }

  if (snapshot.status === "local_restored") {
    items.push({
      id: "tl-local-restored",
      event: "local_restored",
      label: "Restauration locale",
      detail: "Brouillon restauré depuis localStorage. Aucune mission réelle.",
      tone: "success",
    });
  }

  if (!snapshot.feature_flag_enabled) {
    items.push({
      id: "tl-server-skipped",
      event: "server_skipped_disabled",
      label: "Serveur ignoré (désactivé)",
      detail: "Flag serveur false — activation manuelle P4.6 requise.",
      tone: "info",
    });
  } else {
    items.push({
      id: "tl-server-attempted",
      event: "server_attempted",
      label: "Tentative serveur",
      detail: "Sauvegarde serveur best-effort (brouillon uniquement).",
      tone: "neutral",
    });
    if (snapshot.status === "server_synced") {
      items.push({
        id: "tl-server-synced",
        event: "server_synced",
        label: "Synchronisation serveur",
        detail: "Brouillon synchronisé côté serveur, sans exécution.",
        tone: "success",
      });
    } else if (snapshot.status === "server_restored") {
      items.push({
        id: "tl-server-restored",
        event: "server_restored",
        label: "Restauration serveur",
        detail: "Snapshot serveur relu puis conservé localement si nécessaire.",
        tone: "success",
      });
    } else if (snapshot.status === "server_failed" || snapshot.status === "auth_required" || snapshot.status === "table_unavailable" || snapshot.status === "rls_blocked") {
      items.push({
        id: "tl-server-failed",
        event: "server_failed",
        label: "Fallback local",
        detail: "Serveur indisponible — brouillon conservé localement.",
        tone: "warning",
      });
    }
  }

  items.push({
    id: "tl-rollback-ready",
    event: "rollback_ready",
    label: "Rollback prêt",
    detail: "Retirer le flag → POST 423 → localStorage restore OK.",
    tone: "info",
  });

  items.push({
    id: "tl-execution-not-started",
    event: "execution_not_started",
    label: "Aucune exécution",
    detail: "execution_not_started · aucune mission réelle · aucun appel Pierre / IA.",
    tone: "neutral",
  });

  return items;
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftRestoreUiWarnings(
  snapshot: RuntimeMissionDraftRestoreUiSnapshot
): RuntimeMissionDraftRestoreUiWarning[] {
  const warnings: RuntimeMissionDraftRestoreUiWarning[] = [];

  if (!snapshot.feature_flag_enabled) {
    warnings.push({
      id: "warn-flag-false",
      label: "Flag serveur false",
      detail: "La persistance serveur est désactivée (default false). POST → 423.",
      tone: "info",
    });
    warnings.push({
      id: "warn-sql-not-applied",
      label: "SQL non appliqué",
      detail: "Le SQL P4.4 n'est pas appliqué automatiquement. Activation manuelle P4.6 requise.",
      tone: "info",
    });
  }

  if (snapshot.status === "auth_required") {
    warnings.push({
      id: "warn-auth-required",
      label: "Connexion requise",
      detail: "Connectez-vous pour tester la synchronisation serveur. Fallback local actif.",
      tone: "warning",
    });
  }

  if (snapshot.status === "table_unavailable") {
    warnings.push({
      id: "warn-table",
      label: "Table/RLS à vérifier",
      detail: "Le SQL P4.4 doit être appliqué manuellement dans Supabase.",
      tone: "warning",
    });
  }

  if (snapshot.status === "rls_blocked") {
    warnings.push({
      id: "warn-rls",
      label: "RLS/permissions à vérifier",
      detail: "La session ou les policies empêchent la lecture/écriture du brouillon.",
      tone: "warning",
    });
  }

  if (snapshot.status === "server_failed") {
    warnings.push({
      id: "warn-server-failed",
      label: "Serveur indisponible",
      detail: "Le serveur est indisponible — fallback local. La sauvegarde locale reste disponible.",
      tone: "warning",
    });
  }

  // Toujours : rappel d'invariants safety (no-execution).
  warnings.push({
    id: "warn-safety-flags",
    label: "Safety flags tous false",
    detail: "Aucune mission réelle. Aucune exécution. Aucun appel Pierre / IA. CloneVoice non actif. Scale 80k non prouvé.",
    tone: "neutral",
  });

  return warnings;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftRestoreUiActions(
  snapshot: RuntimeMissionDraftRestoreUiSnapshot
): RuntimeMissionDraftRestoreUiAction[] {
  void snapshot;
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
  ];
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainRuntimeMissionDraftRestoreUiStatus(
  snapshot: RuntimeMissionDraftRestoreUiSnapshot
): string {
  return [
    `[Restore UI] ${snapshot.status_label} — source : ${snapshot.source_label}`,
    `  ${snapshot.status_body}`,
    `  Flag serveur : ${snapshot.feature_flag_enabled} · activation manuelle P4.6 ${snapshot.manual_activation_required ? "requise" : "faite"}.`,
    `  localStorage-first · Aucune mission réelle · Aucune exécution · Aucun appel Pierre · Aucun appel IA.`,
    `  CloneVoice non actif · Scale 80k non prouvé · Lancement public externe non validé.`,
  ].join("\n");
}
