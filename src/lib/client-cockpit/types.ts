// src/lib/client-cockpit/types.ts
// P9.3 — Modèles d'affichage CANONIQUES du cockpit opérationnel client de Pierre.
//
// Couche de PRÉSENTATION pure : aucune logique métier P8 dupliquée, aucun import
// serveur. Elle transforme les contrats réels existants (voir
// P9_3_OPERATIONAL_COCKPIT_ARCHITECTURE.md §4) en modèles stables, humains et
// non-techniques. Chaque item porte : identifiant, statut canonique, libellé
// humain, urgence, date, salarié concerné, prochaine action, permission,
// provenance, et état stale/live. Aucun statut inventé.

/** Tonalité visuelle stable (mappe vers les tokens --cs-*). */
export type CockpitTone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

/** Urgence humaine — pilote le tri et la mise en avant « À traiter ». */
export type CockpitUrgency = "critical" | "high" | "normal" | "low";

/** Fraîcheur d'un modèle affiché (live = frais, stale = potentiellement périmé). */
export type CockpitFreshness = "live" | "stale";

/** Provenance d'un élément (d'où vient la donnée, sans exposer d'ID technique). */
export type CockpitProvenance = "pierre" | "human" | "system" | "import" | "unknown";

/** Statut canonique de mission (stable, indépendant des libellés bruts). */
export type CockpitMissionStatus =
  | "draft"
  | "understanding"       // awaiting_info / missing_info
  | "awaiting_approval"
  | "in_progress"         // active / scheduled
  | "blocked"
  | "done"
  | "cancelled"
  | "unknown";

/** Statut canonique de tâche. */
export type CockpitTaskStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "awaiting_approval"
  | "queued"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

/** Statut canonique de validation humaine. */
export type CockpitValidationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "cancelled"
  | "unknown";

/** Statut canonique d'un document/livrable.
 *  P16D — `scheduled` (« Planifié ») existe pour NE PAS confondre « planifié » et « envoyé » :
 *  une relance/un rappel est PROGRAMMÉ, aucun message ne part. « Envoyé » reste réservé à un
 *  envoi réellement effectué. Programmé ne vaut jamais terminé. */
export type CockpitArtifactStatus =
  | "draft"
  | "awaiting_validation"
  | "needs_review"
  | "validated"
  | "signed"
  | "scheduled"
  | "sent"
  | "unknown";

/** Décision affichée pour un statut : libellé humain + tonalité. */
export interface CockpitStatusView {
  readonly canonical: string;
  readonly label: string;
  readonly tone: CockpitTone;
  readonly urgency: CockpitUrgency;
}

/** Référence salarié affichable (jamais de données sensibles brutes). */
export interface CockpitEmployeeReference {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly href: string;               // route Employee 360 canonique
}

/** Salarié listé dans le cockpit (quick-list ; le détail vit dans Employee 360). */
export interface CockpitEmployeeListItem {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly status: string;             // canonique (active/onboarding/…)
  readonly statusLabel: string;
  readonly tone: CockpitTone;
  readonly href: string;               // Employee 360
}

/** Action humaine proposée pour un item (CTA gouverné par permission). */
export interface CockpitNextAction {
  readonly label: string;
  readonly kind: "open" | "approve" | "reject" | "request_changes" | "reschedule" | "cancel" | "create" | "preview" | "download";
  readonly allowed: boolean;           // false → CTA désactivé avec explication
  readonly reason?: string;            // raison si non autorisé
}

export interface CockpitMissionSummary {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: CockpitMissionStatus;
  readonly statusView: CockpitStatusView;
  readonly urgency: CockpitUrgency;
  readonly progress: number;           // 0..1, dérivé des tâches
  readonly tasksTotal: number;
  readonly tasksDone: number;
  readonly tasksBlocked: number;
  readonly tasksAwaiting: number;
  readonly employee: CockpitEmployeeReference | null;
  readonly nextAction: CockpitNextAction;
  readonly createdAt: string | null;
  readonly dueAt: string | null;
  readonly blockedReason: string | null;
  readonly provenance: CockpitProvenance;
  readonly freshness: CockpitFreshness;
}

export interface CockpitTask {
  readonly id: string;
  readonly missionId: string | null;
  readonly title: string;
  readonly status: CockpitTaskStatus;
  readonly statusView: CockpitStatusView;
  readonly requiresValidation: boolean;
  readonly isSensitive: boolean;
  readonly isEmail: boolean;
  readonly scheduledFor: string | null;
  readonly blockedReason: string | null;
}

export interface CockpitValidation {
  readonly id: string;                 // validationId (V1) ou taskId (fallback)
  readonly taskId: string | null;
  readonly missionId: string | null;
  readonly title: string;
  readonly intent: string;             // ce que Pierre veut faire (humain)
  readonly status: CockpitValidationStatus;
  readonly statusView: CockpitStatusView;
  readonly urgency: CockpitUrgency;
  readonly reason: string | null;
  readonly isSensitive: boolean;
  readonly isEmail: boolean;
  readonly employee: CockpitEmployeeReference | null;
  readonly version: number | null;     // requis pour muter (optimistic-lock V1)
  readonly createdAt: string | null;
  readonly actions: readonly CockpitNextAction[];
}

export interface CockpitArtifact {
  readonly id: string;
  readonly missionId: string | null;
  readonly title: string;
  readonly family: string;             // libellé humain de famille
  readonly status: CockpitArtifactStatus;
  readonly statusView: CockpitStatusView;
  readonly isPdf: boolean;
  readonly qualityScore: number | null;
  readonly requiresValidation: boolean;
  readonly employee: CockpitEmployeeReference | null;
  readonly createdAt: string | null;
  readonly canPreview: boolean;
  readonly canDownload: boolean;       // via lien signé uniquement
}

export type CockpitTimelineKind =
  | "mission"
  | "task"
  | "validation"
  | "document"
  | "communication"
  | "incident"
  | "system";

export interface CockpitTimelineEvent {
  readonly id: string;
  readonly kind: CockpitTimelineKind;
  readonly title: string;
  readonly at: string | null;
  readonly actor: CockpitProvenance;
  readonly missionId: string | null;
  readonly employee: CockpitEmployeeReference | null;
  readonly tone: CockpitTone;
  readonly detail: string | null;
}

/** Élément « À traiter maintenant » (action humaine attendue). */
export interface CockpitAttentionItem {
  readonly id: string;
  readonly kind: "validation" | "missing_info" | "incident" | "blocked_mission" | "document_review";
  readonly title: string;
  readonly context: string | null;
  readonly urgency: CockpitUrgency;
  readonly ageIso: string | null;
  readonly employee: CockpitEmployeeReference | null;
  readonly missionId: string | null;
  readonly action: CockpitNextAction;
}

/** Indicateurs calculables depuis les données réelles (jamais fictifs). */
export interface CockpitIndicators {
  readonly missionsInProgress: number;
  readonly validationsPending: number;
  readonly documentsProduced: number;
  readonly employeesConcerned: number;
  readonly incidentsOpen: number;
}

/** Santé opérationnelle globale du cockpit. */
export interface CockpitHealthState {
  readonly tone: CockpitTone;
  readonly label: string;
  readonly summary: string;
  readonly attentionCount: number;
}

/** Vue d'ensemble : réponse en < 5 s à « que fait Pierre, que dois-je faire ? ». */
export interface CockpitOverview {
  readonly health: CockpitHealthState;
  readonly attention: readonly CockpitAttentionItem[];
  readonly inProgress: readonly CockpitMissionSummary[];
  readonly recentlyDone: readonly CockpitMissionSummary[];
  readonly indicators: CockpitIndicators;
  readonly isEmpty: boolean;           // aucune mission → état vide honnête
}
