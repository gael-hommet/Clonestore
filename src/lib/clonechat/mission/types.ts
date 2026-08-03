// src/lib/clonechat/mission/types.ts
//
// CloneChat BLOC 11 (Partie B) — MISSION SUPPORT. Recueille et structure une demande de mission,
// vérifie qu'elle est suffisamment définie, et prépare un BROUILLON / PLAN sûr — JAMAIS une création
// ou exécution réelle. Aucun statut executed/running/completed ne peut être produit sans runtime réel
// et preuve observable. Types PURS, versionnés, déterministes (temps INJECTÉ). Réutilise CloneCare
// (redaction), CloneContext (isolation), CloneInspector (pièces jointes), CloneActions
// (prepare_pierre_mission reste indisponible pour l'exécution réelle).

import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";

export const CLONECHAT_MISSION_VERSION = "mission-1" as const;

/** Type de mission (distinctions Pierre incluses). */
export type MissionType =
  | "informative" // question RH informative
  | "analysis" // demande d'analyse
  | "preparation" // demande de préparation
  | "document_draft" // brouillon de document
  | "advice" // demande de conseil
  | "business_action" // demande nécessitant une action métier (mutation) — jamais exécutée ici
  | "sensitive" // légalement / opérationnellement sensible
  | "unsupported" // non supportée
  | "ambiguous" // ambiguë
  | "human_review"; // nécessite une intervention humaine

export type MissionStatus =
  | "draft"
  | "collecting_information"
  | "needs_clarification"
  | "blocked"
  | "ready_to_prepare"
  | "prepared"
  | "unavailable"
  | "requires_confirmation"
  | "requires_human_review"
  | "cancelled"
  | "expired";

export type MissionRisk = "low" | "medium" | "high" | "critical";
export type MissionPriority = "low" | "normal" | "high";

/** Champ d'entrée de mission (recueilli uniquement s'il est nécessaire). */
export type MissionInputKey =
  | "objective" | "expected_result" | "company" | "agent" | "context" | "scope"
  | "people" | "documents" | "constraints" | "deadline" | "priority";

/** Hypothèse EXPLICITEMENT marquée (jamais un fait). */
export interface MissionAssumption {
  readonly text: string;
  readonly source: "user" | "context" | "inspector_inferred";
}

/** Contrat de mission versionné, tenant-scopé, sans donnée sensible. */
export interface MissionContract {
  readonly version: typeof CLONECHAT_MISSION_VERSION;
  readonly missionId: string; // LOCAL
  readonly type: MissionType;
  readonly status: MissionStatus;
  readonly normalizedObjective: string | null;
  readonly originalRequestRedacted: string; // demande originale REDIGÉE
  readonly tenantKey: string; // strictement scopé
  readonly viewerKey: string;
  readonly requestedAgent: string | null; // employé IA demandé (ex. "pierre")
  readonly validatedInputs: Readonly<Partial<Record<MissionInputKey, string>>>;
  readonly missingInputs: readonly MissionInputKey[];
  readonly inspectedAttachments: readonly string[]; // ids de preuves inspectées (jamais le contenu)
  readonly assumptions: readonly MissionAssumption[]; // hypothèses explicites
  readonly risks: readonly string[];
  readonly requiredPermissions: readonly CloneChatPrerequisite[];
  readonly requiresConfirmation: boolean;
  readonly prerequisites: readonly CloneChatPrerequisite[];
  readonly capabilityAvailable: boolean; // capacité RÉELLEMENT disponible (runtime)
  readonly limitation: string | null; // limitation réelle (ex. runtime indisponible)
  readonly proposedPlan: readonly string[]; // plan / checklist (préparatoire, jamais exécuté)
  readonly expectedDeliverable: string | null;
  readonly successCriteria: readonly string[]; // critères OBSERVABLES de réussite
  readonly recommendedRoute: string | null;
  readonly escalation: string | null;
  readonly provenance: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string; // empreinte déterministe
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly expiresAtMs: number | null;
}

/** Verdict du Readiness Gate (déterministe). */
export type ReadinessDecision =
  | "insufficient_detail"
  | "no_real_capability"
  | "can_prepare"
  | "needs_clarification"
  | "needs_information"
  | "needs_permission"
  | "needs_confirmation"
  | "needs_human_review"
  | "unsupported"
  | "forbidden"
  | "runtime_unavailable";

export interface ReadinessResult {
  readonly decision: ReadinessDecision;
  readonly status: MissionStatus;
  readonly reason: string;
  readonly missingInputs: readonly MissionInputKey[];
  readonly requiresConfirmation: boolean;
  readonly requiresHumanReview: boolean;
}
