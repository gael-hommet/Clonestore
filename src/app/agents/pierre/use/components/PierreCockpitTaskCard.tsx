// src/app/agents/pierre/use/components/PierreCockpitTaskCard.tsx
// Individual task card with guarded action buttons — Pierre Cockpit B31.
// NEVER auto-executes email.send or approval_required tasks.

"use client";

import * as React from "react";
import type { PierreCockpitTaskSummary, PierreCockpitActionResult } from "@/lib/pierre/cockpit/types";
import { StatusBadge, RiskBadge, ValidationRequiredBadge, SensitiveBadge, EmailTaskBadge } from "./PierreStatusBadges";
import { cn } from "@/lib/utils";

type TaskActions = {
  onApprove?: (taskId: string) => Promise<PierreCockpitActionResult>;
  onCancel?: (taskId: string) => Promise<PierreCockpitActionResult>;
  onRun?: (taskId: string) => Promise<PierreCockpitActionResult>;
};

function ActionButton({
  label,
  onClick,
  variant,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  variant: "approve" | "cancel" | "run" | "neutral";
  disabled?: boolean;
  title?: string;
}) {
  const colorMap = {
    approve: { bg: "var(--cs-success-bg)", color: "var(--cs-success)" },
    cancel:  { bg: "var(--cs-danger-bg)",  color: "var(--cs-danger)" },
    run:     { bg: "var(--cs-blue-soft)",   color: "var(--cs-blue)" },
    neutral: { bg: "var(--cs-bg-3)",        color: "var(--cs-ink-3)" },
  };
  const c = colorMap[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-80 active:scale-95",
      )}
      style={{ background: c.bg, color: c.color }}
    >
      {label}
    </button>
  );
}

export function PierreCockpitTaskCard({
  task,
  actions,
}: {
  task: PierreCockpitTaskSummary;
  actions?: TaskActions;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const status = task.status.toLowerCase();
  const canApprove = task.requiresValidation && (status === "pending" || status === "queued");
  const canCancel = status !== "done" && status !== "completed" && status !== "cancelled";
  const canRun = !task.isSensitive && !task.isEmailTask && !task.requiresValidation
    && (status === "pending" || status === "queued" || status === "failed");

  async function handleAction(
    action: string,
    fn?: (id: string) => Promise<PierreCockpitActionResult>,
  ) {
    if (!fn || busy) return;
    setBusy(action);
    setLocalError(null);
    try {
      const res = await fn(task.id);
      if (!res.ok) setLocalError(res.error ?? "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: "var(--cs-surface-strong)",
        border: "1px solid var(--cs-line)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="font-medium leading-snug"
            style={{ color: "var(--cs-ink-1)", fontSize: 13 }}
          >
            {task.title}
          </p>
          {task.description && (
            <p
              className="mt-0.5 text-xs line-clamp-2"
              style={{ color: "var(--cs-ink-4)" }}
            >
              {task.description}
            </p>
          )}
        </div>
        <StatusBadge status={task.status} className="shrink-0" />
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {task.riskLevel !== "low" && <RiskBadge level={task.riskLevel} />}
        {task.requiresValidation && <ValidationRequiredBadge />}
        {task.isSensitive && <SensitiveBadge />}
        {task.isEmailTask && <EmailTaskBadge />}
        {task.executeAt && (
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--cs-ink-4)" }}
          >
            ⏰ {new Date(task.executeAt).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Blocked reason */}
      {task.blockedReason && (
        <p
          className="mt-2 rounded-lg px-2 py-1 text-xs"
          style={{
            background: "var(--cs-danger-bg)",
            color: "var(--cs-danger)",
          }}
        >
          🚫 {task.blockedReason}
        </p>
      )}

      {/* Sensitive gate */}
      {(task.isSensitive || task.isEmailTask) && task.requiresValidation && (
        <p
          className="mt-2 rounded-lg px-2 py-1 text-xs"
          style={{
            background: "var(--cs-warn-bg)",
            color: "var(--cs-warn)",
          }}
        >
          ✋ Cette action requiert une validation humaine avant exécution.
        </p>
      )}

      {/* Error */}
      {localError && (
        <p
          className="mt-1.5 text-xs"
          style={{ color: "var(--cs-danger)" }}
        >
          {localError}
        </p>
      )}

      {/* Actions */}
      {(canApprove || canCancel || canRun) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-2.5" style={{ borderColor: "var(--cs-line)" }}>
          {canApprove && (
            <ActionButton
              label={busy === "approve" ? "…" : "Approuver"}
              onClick={() => handleAction("approve", actions?.onApprove)}
              variant="approve"
              disabled={!!busy}
              title="Approuver et autoriser l'exécution de cette tâche"
            />
          )}
          {canRun && (
            <ActionButton
              label={busy === "run" ? "…" : "Exécuter"}
              onClick={() => handleAction("run", actions?.onRun)}
              variant="run"
              disabled={!!busy}
              title="Lancer l'exécution de cette tâche"
            />
          )}
          {canCancel && (
            <ActionButton
              label={busy === "cancel" ? "…" : "Annuler"}
              onClick={() => handleAction("cancel", actions?.onCancel)}
              variant="cancel"
              disabled={!!busy}
              title="Annuler cette tâche"
            />
          )}
        </div>
      )}
    </div>
  );
}
