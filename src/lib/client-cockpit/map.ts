// src/lib/client-cockpit/map.ts
// P9.3 — Mappers PURS : sorties de la couche de normalisation existante
// (src/lib/pierre/cockpit) → modèles d'affichage canoniques P9.3.
// Aucun import serveur. Déterministe → testable en `node`.

import type {
  PierreCockpitMissionSummary,
  PierreCockpitTaskSummary,
  PierreCockpitValidationSummary,
  PierreCockpitDocumentSummary,
  PierreCockpitEmployeeSummary,
} from "@/lib/pierre/cockpit/types";
import {
  artifactStatusView,
  humanize,
  maxUrgency,
  missionStatusView,
  riskUrgency,
  taskStatusView,
  validationStatusView,
} from "./status";
import type { CockpitPermissions } from "./permissions";
import { DEFAULT_PERMISSIONS } from "./permissions";
import type {
  CockpitArtifact,
  CockpitEmployeeReference,
  CockpitMissionSummary,
  CockpitNextAction,
  CockpitTask,
  CockpitValidation,
} from "./types";

const EMPLOYEES_ROUTE = "/agents/pierre/employees";

/** Référence salarié affichable (lien 360, jamais de donnée sensible brute). */
export function employeeReference(
  id: string | null | undefined,
  name: string | null | undefined,
  role?: string | null,
): CockpitEmployeeReference | null {
  const cleanId = (id ?? "").trim();
  const cleanName = (name ?? "").trim();
  if (!cleanId && !cleanName) return null;
  return {
    id: cleanId,
    name: cleanName || "Salarié",
    role: role?.trim() || null,
    href: cleanId ? `${EMPLOYEES_ROUTE}?employee=${encodeURIComponent(cleanId)}` : EMPLOYEES_ROUTE,
  };
}

function missionNextAction(status: CockpitMissionSummary["status"]): CockpitNextAction {
  switch (status) {
    case "understanding":
      return { label: "Compléter les informations", kind: "open", allowed: true };
    case "awaiting_approval":
      return { label: "Voir les validations", kind: "open", allowed: true };
    case "blocked":
      return { label: "Débloquer la mission", kind: "open", allowed: true };
    case "done":
      return { label: "Voir le récapitulatif", kind: "open", allowed: true };
    default:
      return { label: "Ouvrir la mission", kind: "open", allowed: true };
  }
}

export function mapMission(
  m: PierreCockpitMissionSummary,
  opts: { employee?: CockpitEmployeeReference | null; freshness?: "live" | "stale" } = {},
): CockpitMissionSummary {
  const statusView = missionStatusView(m.status);
  const total = Math.max(0, m.tasksTotal || 0);
  const done = Math.max(0, m.tasksDone || 0);
  const progress = total > 0 ? Math.min(1, done / total) : m.status === "done" ? 1 : 0;
  const urgency = maxUrgency(statusView.urgency, riskUrgency(m.riskLevel));
  const canonical = statusView.canonical as CockpitMissionSummary["status"];
  return {
    id: m.id,
    title: m.title || "Mission",
    summary: m.summary,
    status: canonical,
    statusView,
    urgency,
    progress,
    tasksTotal: total,
    tasksDone: done,
    tasksBlocked: Math.max(0, m.tasksBlocked || 0),
    tasksAwaiting: Math.max(0, m.tasksAwaiting || 0),
    employee: opts.employee ?? null,
    nextAction: missionNextAction(canonical),
    createdAt: m.createdAt,
    dueAt: null,
    blockedReason: canonical === "blocked" ? "Une tâche de la mission est bloquée." : null,
    provenance: "pierre",
    freshness: opts.freshness ?? "live",
  };
}

export function mapTask(t: PierreCockpitTaskSummary): CockpitTask {
  const statusView = taskStatusView(t.status);
  return {
    id: t.id,
    missionId: t.missionId,
    title: t.title || humanize(t.type),
    status: statusView.canonical as CockpitTask["status"],
    statusView,
    requiresValidation: !!t.requiresValidation,
    isSensitive: !!t.isSensitive,
    isEmail: !!t.isEmailTask,
    scheduledFor: t.executeAt,
    blockedReason: t.blockedReason,
  };
}

/** Actions de validation gouvernées par permission (le serveur reste l'autorité). */
function validationActions(perms: CockpitPermissions): CockpitNextAction[] {
  const denied = (label: string, kind: CockpitNextAction["kind"]): CockpitNextAction => ({
    label, kind, allowed: false, reason: "Votre rôle ne permet pas de décider des validations.",
  });
  if (!perms.canDecideValidations) {
    return [denied("Approuver", "approve"), denied("Demander des modifications", "request_changes"), denied("Refuser", "reject")];
  }
  return [
    { label: "Approuver", kind: "approve", allowed: true },
    { label: "Demander des modifications", kind: "request_changes", allowed: true },
    { label: "Refuser", kind: "reject", allowed: true },
  ];
}

export function mapValidation(
  v: PierreCockpitValidationSummary,
  opts: { permissions?: CockpitPermissions; employee?: CockpitEmployeeReference | null } = {},
): CockpitValidation {
  const perms = opts.permissions ?? DEFAULT_PERMISSIONS;
  const statusView = validationStatusView(v.status ?? "pending");
  const urgency = maxUrgency(statusView.urgency, riskUrgency(v.riskLevel));
  return {
    id: v.validationId ?? v.taskId,
    taskId: v.taskId ?? null,
    missionId: v.missionId,
    title: v.title || humanize(v.type),
    intent: v.title || humanize(v.type),
    status: statusView.canonical as CockpitValidation["status"],
    statusView,
    urgency,
    reason: v.reason,
    isSensitive: !!v.isSensitive,
    isEmail: !!v.isEmailTask,
    employee: opts.employee ?? null,
    version: typeof v.version === "number" ? v.version : null,
    createdAt: v.createdAt,
    actions: statusView.canonical === "pending" ? validationActions(perms) : [],
  };
}

export function mapArtifact(
  d: PierreCockpitDocumentSummary,
  opts: { permissions?: CockpitPermissions; employee?: CockpitEmployeeReference | null } = {},
): CockpitArtifact {
  const perms = opts.permissions ?? DEFAULT_PERMISSIONS;
  // Statut canonique dérivé du statut brut, complété par les drapeaux qualité/validation.
  let rawStatus = d.status;
  if (d.requiresValidation && (!d.status || d.status === "generated" || d.status === "draft")) {
    rawStatus = "awaiting_validation";
  }
  const statusView = artifactStatusView(rawStatus);
  return {
    id: d.id,
    missionId: d.missionId,
    title: d.title || "Document",
    family: humanize(d.docType),
    status: statusView.canonical as CockpitArtifact["status"],
    statusView,
    isPdf: !!d.isPdf,
    qualityScore: d.qualityScore,
    requiresValidation: !!d.requiresValidation,
    employee: opts.employee ?? null,
    createdAt: d.createdAt,
    canPreview: true,
    canDownload: perms.canDownloadDocuments,
  };
}

export function mapEmployeeSummaryToReference(e: PierreCockpitEmployeeSummary): CockpitEmployeeReference {
  return employeeReference(e.id, e.name, e.role) as CockpitEmployeeReference;
}
