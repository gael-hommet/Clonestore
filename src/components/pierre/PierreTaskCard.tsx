"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileText,
  Mail,
  PlayCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

type PierreTaskLike = Record<string, unknown>;

type Props = {
  task: PierreTaskLike;
  onRunTask?: (taskId: string) => void | Promise<void>;
  onApproveTask?: (taskId: string) => void | Promise<void>;
  onCancelTask?: (taskId: string) => void | Promise<void>;
  onRescheduleTask?: (taskId: string, scheduledFor?: string | null) => void | Promise<void>;
  relatedDocument?: Record<string, unknown> | null;
  relatedEmail?: Record<string, unknown> | null;
};

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusMeta(statusRaw: string) {
  const status = statusRaw.toLowerCase();

  switch (status) {
    case "awaiting_info":
      return {
        label: "En attente d’info",
        tone: "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]",
        icon: CircleHelp,
      };
    case "awaiting_validation":
    case "awaiting_approval":
      return {
        label: "Validation requise",
        tone: "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]",
        icon: ShieldAlert,
      };
    case "planned":
      return {
        label: "Planifiée",
        tone: "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]",
        icon: CalendarClock,
      };
    case "ready":
    case "queued":
      return {
        label: "Prête",
        tone: "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]",
        icon: Clock3,
      };
    case "running":
    case "in_progress":
      return {
        label: "En cours",
        tone: "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]",
        icon: PlayCircle,
      };
    case "done":
    case "completed":
      return {
        label: "Terminée",
        tone: "border-[#d7e8da] bg-[#edf8ef] text-[#2f6c43]",
        icon: CheckCircle2,
      };
    case "retry":
      return {
        label: "À relancer",
        tone: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
    case "failed":
    case "blocked":
      return {
        label: "Bloquée",
        tone: "border-[#f0c2bc] bg-[#fff1ef] text-[#8b3d33]",
        icon: AlertTriangle,
      };
    case "cancelled":
      return {
        label: "Annulée",
        tone: "border-[#eadbc9] bg-[#faf7f2] text-[#7b6b59]",
        icon: XCircle,
      };
    case "draft":
      return {
        label: "Brouillon",
        tone: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
    default:
      return {
        label: statusRaw || "Draft",
        tone: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
  }
}

function getRiskMeta(riskRaw: string) {
  const risk = riskRaw.toLowerCase();

  switch (risk) {
    case "critical":
      return "border-[#f0c2bc] bg-[#fff1ef] text-[#8b3d33]";
    case "sensitive":
      return "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]";
    default:
      return "border-[#d7e8da] bg-[#edf8ef] text-[#2f6c43]";
  }
}

function canRunTask(status: string) {
  return ["queued", "ready", "retry", "planned", "draft"].includes(status.toLowerCase());
}

function canApproveTask(status: string, approvalRequired: boolean) {
  return approvalRequired || ["awaiting_validation", "awaiting_approval"].includes(status.toLowerCase());
}

function outputKindLabel(value: unknown) {
  const kind = text(value, "").toLowerCase();

  switch (kind) {
    case "document":
      return "Document";
    case "email":
      return "Email";
    case "pdf":
      return "PDF";
    case "followup":
      return "Relance";
    case "plan":
      return "Plan";
    case "none":
      return "Aucune sortie";
    default:
      return kind ? kind : "—";
  }
}

export function PierreTaskCard({
  task,
  onRunTask,
  onApproveTask,
  onCancelTask,
  onRescheduleTask,
  relatedDocument,
  relatedEmail,
}: Props) {
  const taskId = text(task.id, "");
  const status = text(task.status, "draft");
  const risk = text(task.risk_level, "normal");
  const title = text(task.title, "Tâche Pierre");
  const type = text(task.type, "other");
  const approvalRequired = bool(task.approval_required);
  const priority = numberValue(task.priority);
  const metadata = record(task.metadata);

  const notes = text(metadata?.notes, "");
  const blockingReason = text(metadata?.blocking_reason, "");
  const scheduledFor = formatDate(task.scheduled_for);
  const dueAt = formatDate(task.due_at);
  const outputKind = outputKindLabel(metadata?.output_kind);

  const statusMeta = getStatusMeta(status);
  const StatusIcon = statusMeta.icon;

  return (
    <div className="rounded-[24px] border border-[#eadfce] bg-white p-4 shadow-[0_10px_30px_rgba(70,55,37,0.05)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                statusMeta.tone
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {statusMeta.label}
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                getRiskMeta(risk)
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Risque : {risk}
            </span>

            {approvalRequired && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ecd8b4] bg-[#fff8ea] px-3 py-1.5 text-xs font-semibold text-[#8a5b17]">
                <ShieldAlert className="h-3.5 w-3.5" />
                Validation
              </span>
            )}

            {typeof priority === "number" && (
              <span className="inline-flex items-center rounded-full border border-[#eadbc9] bg-[#fffdf8] px-3 py-1.5 text-xs font-semibold text-[#735f4b]">
                Priorité {priority}
              </span>
            )}

            <span className="inline-flex items-center rounded-full border border-[#eadbc9] bg-[#fffdf8] px-3 py-1.5 text-xs font-semibold text-[#735f4b]">
              Sortie : {outputKind}
            </span>
          </div>

          <h4 className="mt-3 text-lg font-semibold text-[#241b12]">{title}</h4>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#7c6a58]">
            <span>Type : {type}</span>
            <span>Planifiée : {scheduledFor}</span>
            <span>Échéance : {dueAt}</span>
          </div>

          {notes && notes !== "—" && (
            <p className="mt-4 text-sm leading-7 text-[#5f5144]">{notes}</p>
          )}

          {blockingReason && blockingReason !== "—" && (
            <div className="mt-4 rounded-[18px] border border-[#f0c2bc] bg-[#fff4f2] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a44d41]">
                Motif de blocage
              </p>
              <p className="mt-2 text-sm leading-6 text-[#8b3d33]">{blockingReason}</p>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-[#eadfce] bg-[#fffdf8] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a856f]">
                Document lié
              </p>
              {relatedDocument ? (
                <div className="mt-2 flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-[#6d573d]" />
                  <div>
                    <p className="text-sm font-medium text-[#2b2118]">
                      {text(relatedDocument.title, "Document Pierre")}
                    </p>
                    <p className="mt-1 text-xs text-[#7c6a58]">
                      {text(relatedDocument.status, "ready")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#6b5b4b]">Aucun document lié.</p>
              )}
            </div>

            <div className="rounded-[18px] border border-[#eadfce] bg-[#fffdf8] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a856f]">
                Email lié
              </p>
              {relatedEmail ? (
                <div className="mt-2 flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-[#6d573d]" />
                  <div>
                    <p className="text-sm font-medium text-[#2b2118]">
                      {text(relatedEmail.subject, "Email Pierre")}
                    </p>
                    <p className="mt-1 text-xs text-[#7c6a58]">
                      {text(relatedEmail.status, "draft")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#6b5b4b]">Aucun email lié.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:max-w-[280px] xl:justify-end">
          {taskId && canRunTask(status) && onRunTask && (
            <button
              type="button"
              onClick={() => void onRunTask(taskId)}
              className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3]"
            >
              <PlayCircle className="h-4 w-4" />
              Lancer
            </button>
          )}

          {taskId && canApproveTask(status, approvalRequired) && onApproveTask && (
            <button
              type="button"
              onClick={() => void onApproveTask(taskId)}
              className="inline-flex items-center gap-2 rounded-full bg-[#2a2118] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d160f]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Valider
            </button>
          )}

          {taskId && onRescheduleTask && (
            <button
              type="button"
              onClick={() => void onRescheduleTask(taskId, null)}
              className="inline-flex items-center gap-2 rounded-full border border-[#e5d7c7] bg-white px-4 py-2.5 text-sm font-semibold text-[#4c4033] transition hover:bg-[#fffaf3]"
            >
              <CalendarClock className="h-4 w-4" />
              Replanifier
            </button>
          )}

          {taskId && onCancelTask && !["done", "completed", "cancelled"].includes(status.toLowerCase()) && (
            <button
              type="button"
              onClick={() => void onCancelTask(taskId)}
              className="inline-flex items-center gap-2 rounded-full border border-[#f0c2bc] bg-[#fff4f2] px-4 py-2.5 text-sm font-semibold text-[#8b3d33] transition hover:bg-[#fff1ef]"
            >
              <XCircle className="h-4 w-4" />
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PierreTaskCard;