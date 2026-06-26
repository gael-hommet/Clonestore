// src/lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui.ts
// PHASE 3.18 — Enterprise Footprint Server Restore UI Polish
//
// Module pur — transforme les résultats safe apply / restore (P3.14) en labels
// UI lisibles pour /profile/onboarding. Aucune logique métier, aucune persistance.
//
// INVARIANTS ABSOLUS :
//   - module pur : pas de Supabase, pas de réseau, pas de write
//   - pas d'import src/lib/pierre
//   - aucun throw brut
//   - observabilité UI uniquement (P3.18 = UI polish, pas nouvelle persistance)

import type {
  EnterpriseFootprintSafeApplyResult,
  EnterpriseFootprintSafeRestoreResult,
} from "./enterprise-footprint-safe-apply-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintRestoreUiTone =
  | "success"
  | "warning"
  | "info"
  | "neutral"
  | "danger";

export type EnterpriseFootprintRestoreUiStatus =
  | "local_only"
  | "server_synced"
  | "server_restored"
  | "local_newer"
  | "server_disabled"
  | "server_unavailable"
  | "auth_required"
  | "validation_failed"
  | "empty"
  | "pending";

export type EnterpriseFootprintRestoreUiSource =
  | "localstorage"
  | "server"
  | "local_newer_than_server"
  | "server_newer_than_local"
  | "server_disabled"
  | "auth_required"
  | "table_unavailable"
  | "rls_failed"
  | "validation_failed"
  | "unknown";

export type EnterpriseFootprintRestoreUiBadge = {
  id: string;
  label: string;
  tone: EnterpriseFootprintRestoreUiTone;
};

export type EnterpriseFootprintRestoreUiCard = {
  id: string;
  label: string;
  value: string;
  sub_label?: string;
  tone: EnterpriseFootprintRestoreUiTone;
};

export type EnterpriseFootprintRestoreUiTimelineItem = {
  id: string;
  label: string;
  detail: string;
  tone: EnterpriseFootprintRestoreUiTone;
  at?: string;
};

export type EnterpriseFootprintRestoreUiAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
};

// Options acceptées par le snapshot UI.
export type EnterpriseFootprintRestoreUiSnapshotOptions = {
  lastPersistResult?: EnterpriseFootprintSafeApplyResult | null;
  lastRestoreResult?: EnterpriseFootprintSafeRestoreResult | null;
  currentFootprint?: { company_id?: string; updated_at?: string } | null;
  featureFlagEnabled: boolean;
  serverHealth?: {
    table_available?: boolean;
    rls_select_ok?: boolean;
  } | null;
  lastAttemptAt?: string | null;
  localUpdatedAt?: string | null;
  serverUpdatedAt?: string | null;
};

export type EnterpriseFootprintRestoreUiSnapshot = {
  status: EnterpriseFootprintRestoreUiStatus;
  status_label: string;
  source: EnterpriseFootprintRestoreUiSource;
  source_label: string;
  tone: EnterpriseFootprintRestoreUiTone;
  title: string;
  body: string;
  feature_flag_enabled: boolean;
  has_footprint: boolean;
  server_attempted: boolean;
  server_synced: boolean;
  fallback_local_active: true;
  last_attempt_at: string | null;
  local_updated_at: string | null;
  server_updated_at: string | null;
  warning: string | null;
  read_only: true;
};

// ── Labels statut / source ────────────────────────────────────────────────────

export function getEnterpriseFootprintRestoreUiStatusLabel(
  status: EnterpriseFootprintRestoreUiStatus
): string {
  const labels: Record<EnterpriseFootprintRestoreUiStatus, string> = {
    local_only: "Empreinte sauvegardée localement",
    server_synced: "Empreinte synchronisée serveur",
    server_restored: "Empreinte restaurée depuis serveur",
    local_newer: "Version locale conservée",
    server_disabled: "Persistance serveur désactivée",
    server_unavailable: "Serveur indisponible — fallback local",
    auth_required: "Session requise",
    validation_failed: "Empreinte non synchronisée",
    empty: "Aucune empreinte disponible",
    pending: "Sauvegarde en cours…",
  };
  return labels[status] ?? "Statut inconnu";
}

export function getEnterpriseFootprintRestoreUiSourceLabel(
  source: EnterpriseFootprintRestoreUiSource
): string {
  const labels: Record<EnterpriseFootprintRestoreUiSource, string> = {
    localstorage: "localStorage (fallback actif)",
    server: "Serveur",
    local_newer_than_server: "Local plus récent que serveur",
    server_newer_than_local: "Serveur plus récent que local",
    server_disabled: "Serveur désactivé",
    auth_required: "Session requise",
    table_unavailable: "Table indisponible",
    rls_failed: "RLS/permissions à vérifier",
    validation_failed: "Validation bloquée",
    unknown: "Source inconnue",
  };
  return labels[source] ?? "Source inconnue";
}

export function getEnterpriseFootprintRestoreUiTone(
  status: EnterpriseFootprintRestoreUiStatus
): EnterpriseFootprintRestoreUiTone {
  const tones: Record<EnterpriseFootprintRestoreUiStatus, EnterpriseFootprintRestoreUiTone> = {
    local_only: "neutral",
    server_synced: "success",
    server_restored: "success",
    local_newer: "info",
    server_disabled: "info",
    server_unavailable: "warning",
    auth_required: "info",
    validation_failed: "warning",
    empty: "neutral",
    pending: "info",
  };
  return tones[status] ?? "neutral";
}

// ── Microcopy title/body par statut ───────────────────────────────────────────

function getStatusCopy(
  status: EnterpriseFootprintRestoreUiStatus,
  source: EnterpriseFootprintRestoreUiSource
): { title: string; body: string } {
  switch (status) {
    case "server_disabled":
      return {
        title: "Persistance serveur désactivée",
        body: "L'Empreinte est sauvegardée localement. Activez le flag uniquement en test local après SQL/RLS. Aucune action exécutée.",
      };
    case "server_synced":
      return {
        title: "Empreinte synchronisée serveur",
        body: "La dernière sauvegarde locale a été synchronisée côté serveur. localStorage reste le fallback actif. Aucune action exécutée.",
      };
    case "server_restored":
      return {
        title: "Empreinte restaurée depuis serveur",
        body: "Le snapshot serveur a été relu puis conservé localement. Lecture contrôlée — aucune action exécutée.",
      };
    case "local_newer":
      return {
        title: "Version locale conservée",
        body: "La version locale est plus récente que le serveur. localStorage reste le fallback actif. Aucune action exécutée.",
      };
    case "server_unavailable":
      if (source === "rls_failed") {
        return {
          title: "RLS/permissions à vérifier",
          body: "La lecture serveur est bloquée par les règles ou la session. SQL/RLS à vérifier manuellement. localStorage reste le fallback actif.",
        };
      }
      return {
        title: "Serveur indisponible — fallback local",
        body: "La table Enterprise Footprint n'est pas disponible ou le SQL n'est pas appliqué. SQL/RLS à vérifier manuellement. localStorage reste le fallback actif.",
      };
    case "auth_required":
      return {
        title: "Session requise",
        body: "Connectez-vous pour tenter la synchronisation serveur. L'Empreinte reste sauvegardée localement. Aucune action exécutée.",
      };
    case "validation_failed":
      return {
        title: "Empreinte non synchronisée",
        body: "La validation/sanitization a bloqué la synchronisation serveur. localStorage reste le fallback actif. Aucune action exécutée.",
      };
    case "empty":
      return {
        title: "Aucune empreinte disponible",
        body: "Renseignez l'onboarding pour générer une Empreinte Entreprise. localStorage reste le fallback actif.",
      };
    case "pending":
      return {
        title: "Sauvegarde en cours…",
        body: "Sauvegarde locale en cours. localStorage reste le fallback actif. Aucune action exécutée.",
      };
    case "local_only":
    default:
      return {
        title: "Empreinte sauvegardée localement",
        body: "localStorage reste le fallback actif. Synchronisation serveur uniquement si activée. Aucune action exécutée.",
      };
  }
}

// ── Dérivation depuis persist result ──────────────────────────────────────────

function deriveFromPersist(
  result: EnterpriseFootprintSafeApplyResult
): { status: EnterpriseFootprintRestoreUiStatus; source: EnterpriseFootprintRestoreUiSource } {
  switch (result.outcome.status) {
    case "local_saved_server_synced":
      return { status: "server_synced", source: "server" };
    case "local_saved_server_disabled":
      return { status: "server_disabled", source: "server_disabled" };
    case "local_saved_auth_required":
      return { status: "auth_required", source: "auth_required" };
    case "local_saved_validation_failed":
      return { status: "validation_failed", source: "validation_failed" };
    case "local_saved_table_unavailable":
      return { status: "server_unavailable", source: "table_unavailable" };
    case "local_saved_rls_failed":
      return { status: "server_unavailable", source: "rls_failed" };
    case "local_saved_server_failed":
      return { status: "server_unavailable", source: "server_newer_than_local" };
    case "local_saved":
    default:
      return { status: "local_only", source: "localstorage" };
  }
}

// ── Dérivation depuis restore result ──────────────────────────────────────────

function deriveFromRestore(
  result: EnterpriseFootprintSafeRestoreResult
): { status: EnterpriseFootprintRestoreUiStatus; source: EnterpriseFootprintRestoreUiSource } {
  switch (result.outcome.status) {
    case "server_restored":
      return { status: "server_restored", source: "server_newer_than_local" };
    case "local_newer_than_server":
      return { status: "local_newer", source: "local_newer_than_server" };
    case "server_disabled":
      return { status: "server_disabled", source: "server_disabled" };
    case "auth_required":
      return { status: "auth_required", source: "auth_required" };
    case "table_unavailable":
      return { status: "server_unavailable", source: "table_unavailable" };
    case "rls_failed":
      return { status: "server_unavailable", source: "rls_failed" };
    case "empty_state":
      return { status: "empty", source: "unknown" };
    case "local_restored":
    default:
      return { status: "local_only", source: "localstorage" };
  }
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export function buildEnterpriseFootprintRestoreUiSnapshot(
  options: EnterpriseFootprintRestoreUiSnapshotOptions
): EnterpriseFootprintRestoreUiSnapshot {
  const hasFootprint = Boolean(options.currentFootprint?.company_id);

  // Priorité : persist result (driver principal côté onboarding), sinon restore,
  // sinon état flag/footprint.
  let status: EnterpriseFootprintRestoreUiStatus;
  let source: EnterpriseFootprintRestoreUiSource;

  if (options.lastPersistResult) {
    const d = deriveFromPersist(options.lastPersistResult);
    status = d.status;
    source = d.source;
  } else if (options.lastRestoreResult) {
    const d = deriveFromRestore(options.lastRestoreResult);
    status = d.status;
    source = d.source;
  } else if (!hasFootprint) {
    status = "empty";
    source = "unknown";
  } else if (!options.featureFlagEnabled) {
    status = "server_disabled";
    source = "server_disabled";
  } else {
    status = "pending";
    source = "localstorage";
  }

  // Health override : si la table/RLS est explicitement KO, refléter le warning.
  let warning: string | null = null;
  if (options.serverHealth) {
    if (options.serverHealth.table_available === false) {
      warning = "Table clonestore_enterprise_footprints absente. SQL/RLS à vérifier manuellement.";
    } else if (options.serverHealth.rls_select_ok === false) {
      warning = "RLS/permissions à vérifier. SQL/RLS à vérifier manuellement.";
    }
  }
  if (!warning && status === "server_unavailable") {
    warning = source === "rls_failed"
      ? "RLS/permissions à vérifier. SQL/RLS à vérifier manuellement."
      : "Table indisponible ou SQL non appliqué. SQL/RLS à vérifier manuellement.";
  }

  const copy = getStatusCopy(status, source);
  const tone = getEnterpriseFootprintRestoreUiTone(status);

  const serverAttempted = options.lastPersistResult?.outcome.server_attempted ?? false;
  const serverSynced =
    options.lastPersistResult?.outcome.server_synced ??
    (status === "server_restored");

  return {
    status,
    status_label: getEnterpriseFootprintRestoreUiStatusLabel(status),
    source,
    source_label: getEnterpriseFootprintRestoreUiSourceLabel(source),
    tone,
    title: copy.title,
    body: copy.body,
    feature_flag_enabled: options.featureFlagEnabled,
    has_footprint: hasFootprint,
    server_attempted: serverAttempted,
    server_synced: serverSynced,
    fallback_local_active: true,
    last_attempt_at: options.lastAttemptAt ?? null,
    local_updated_at: options.localUpdatedAt ?? options.currentFootprint?.updated_at ?? null,
    server_updated_at: options.serverUpdatedAt ?? null,
    warning,
    read_only: true,
  };
}

// ── Badges builder ────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintRestoreUiBadges(
  snapshot: EnterpriseFootprintRestoreUiSnapshot
): EnterpriseFootprintRestoreUiBadge[] {
  const badges: EnterpriseFootprintRestoreUiBadge[] = [
    {
      id: "badge-status",
      label: snapshot.status_label,
      tone: snapshot.tone,
    },
    {
      id: "badge-source",
      label: snapshot.source_label,
      tone: "neutral",
    },
    {
      id: "badge-fallback",
      label: "localStorage reste le fallback actif",
      tone: "neutral",
    },
    {
      id: "badge-no-action",
      label: "Aucune action exécutée",
      tone: "neutral",
    },
  ];

  badges.push({
    id: "badge-flag",
    label: snapshot.feature_flag_enabled
      ? "Flag serveur : activé (test local)"
      : "Synchronisation serveur uniquement si activée",
    tone: snapshot.feature_flag_enabled ? "info" : "neutral",
  });

  return badges;
}

// ── Cards builder ─────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintRestoreUiCards(
  snapshot: EnterpriseFootprintRestoreUiSnapshot
): EnterpriseFootprintRestoreUiCard[] {
  return [
    {
      id: "card-source",
      label: "Source effective",
      value: snapshot.source_label,
      sub_label: "localStorage reste le fallback actif",
      tone: "neutral",
    },
    {
      id: "card-status",
      label: "Statut",
      value: snapshot.status_label,
      sub_label: snapshot.read_only ? "Lecture contrôlée" : undefined,
      tone: snapshot.tone,
    },
    {
      id: "card-flag",
      label: "Persistance serveur",
      value: snapshot.feature_flag_enabled ? "Activée (test local)" : "Désactivée",
      sub_label: "Synchronisation serveur uniquement si activée",
      tone: snapshot.feature_flag_enabled ? "info" : "neutral",
    },
    {
      id: "card-attempt",
      label: "Dernière tentative",
      value: snapshot.last_attempt_at ? formatUiDate(snapshot.last_attempt_at) : "—",
      sub_label: snapshot.server_attempted ? "Serveur tenté" : "Local uniquement",
      tone: "neutral",
    },
  ];
}

// ── Timeline builder ──────────────────────────────────────────────────────────

export function buildEnterpriseFootprintRestoreUiTimeline(
  snapshot: EnterpriseFootprintRestoreUiSnapshot
): EnterpriseFootprintRestoreUiTimelineItem[] {
  const timeline: EnterpriseFootprintRestoreUiTimelineItem[] = [];

  // 1. Sauvegarde locale toujours en premier (invariant localStorage-first).
  timeline.push({
    id: "tl-local",
    label: "Sauvegarde locale",
    detail: "localStorage sauvegardé en premier — fallback actif.",
    tone: "success",
    at: snapshot.local_updated_at ?? undefined,
  });

  // 2. Tentative serveur.
  if (snapshot.feature_flag_enabled) {
    if (snapshot.server_synced) {
      timeline.push({
        id: "tl-server-sync",
        label: "Synchronisation serveur réussie",
        detail: "Le snapshot a été synchronisé côté serveur.",
        tone: "success",
        at: snapshot.server_updated_at ?? snapshot.last_attempt_at ?? undefined,
      });
    } else if (snapshot.status === "server_restored") {
      timeline.push({
        id: "tl-server-restore",
        label: "Restauration serveur",
        detail: "Snapshot serveur relu puis conservé localement.",
        tone: "success",
        at: snapshot.server_updated_at ?? undefined,
      });
    } else if (snapshot.status === "local_newer") {
      timeline.push({
        id: "tl-local-newer",
        label: "Version locale conservée",
        detail: "Local plus récent que serveur.",
        tone: "info",
        at: snapshot.last_attempt_at ?? undefined,
      });
    } else if (snapshot.status === "server_unavailable") {
      timeline.push({
        id: "tl-server-unavailable",
        label: "Fallback local",
        detail: snapshot.warning ?? "Serveur indisponible — fallback local.",
        tone: "warning",
        at: snapshot.last_attempt_at ?? undefined,
      });
    } else if (snapshot.status === "auth_required") {
      timeline.push({
        id: "tl-auth",
        label: "Session requise",
        detail: "Connexion requise pour la synchronisation serveur.",
        tone: "info",
        at: snapshot.last_attempt_at ?? undefined,
      });
    } else if (snapshot.status === "validation_failed") {
      timeline.push({
        id: "tl-validation",
        label: "Synchronisation bloquée",
        detail: "Validation/sanitization a bloqué la synchronisation serveur.",
        tone: "warning",
        at: snapshot.last_attempt_at ?? undefined,
      });
    }
  } else {
    timeline.push({
      id: "tl-server-disabled",
      label: "Persistance serveur désactivée",
      detail: "Synchronisation serveur uniquement si activée.",
      tone: "info",
      at: undefined,
    });
  }

  return timeline;
}

// ── Actions builder ───────────────────────────────────────────────────────────

export function buildEnterpriseFootprintRestoreUiActions(
  snapshot: EnterpriseFootprintRestoreUiSnapshot
): EnterpriseFootprintRestoreUiAction[] {
  const actions: EnterpriseFootprintRestoreUiAction[] = [
    {
      id: "action-onboarding",
      label: "Compléter l'Empreinte",
      href: "/profile/onboarding",
      primary: !snapshot.has_footprint,
      description: "Mettre à jour les informations de l'Empreinte Entreprise.",
    },
    {
      id: "action-agents",
      label: "Voir dans Mon espace",
      href: "/profile/agents#empreinte-entreprise",
      primary: false,
    },
    {
      id: "action-messages",
      label: "Contexte dans Messages",
      href: "/profile/messages",
      primary: false,
    },
  ];

  return actions;
}

// ── Explain ───────────────────────────────────────────────────────────────────

export function explainEnterpriseFootprintRestoreUiStatus(
  snapshot: EnterpriseFootprintRestoreUiSnapshot
): string {
  const lines = [
    `[PHASE 3.18 Restore UI] ${snapshot.status_label}`,
    `  Source : ${snapshot.source_label}`,
    `  Flag serveur : ${snapshot.feature_flag_enabled ? "activé" : "désactivé"}`,
    `  Fallback local actif : oui`,
    `  Lecture contrôlée — aucune action exécutée.`,
  ];
  if (snapshot.warning) lines.push(`  Warning : ${snapshot.warning}`);
  return lines.join("\n");
}

// ── Helper date ───────────────────────────────────────────────────────────────

function formatUiDate(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}
