// src/app/agents/pierre/use/components/PierreMissionUnderstandingCard.tsx
// Mission comprehension display — domain, risk, quality, progress.

import * as React from "react";
import type { PierreCockpitMissionSummary } from "@/lib/pierre/cockpit/types";
import { RiskBadge, StatusBadge } from "./PierreStatusBadges";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--cs-bg-3)" }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: pct >= 80
            ? "var(--cs-success)"
            : pct >= 40
            ? "var(--cs-warn)"
            : "var(--cs-danger)",
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ color: "var(--cs-ink-4)", fontSize: 11, fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ color: "var(--cs-ink-1)", fontSize: 18, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

export function PierreMissionUnderstandingCard({
  mission,
}: {
  mission: PierreCockpitMissionSummary;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--cs-surface-strong)",
        border: "1px solid var(--cs-line)",
        boxShadow: "var(--cs-shadow-soft)",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className="truncate font-semibold leading-snug"
            style={{ color: "var(--cs-ink-1)", fontSize: 15 }}
          >
            {mission.title}
          </h3>
          {mission.summary && (
            <p
              className="mt-1 text-xs leading-relaxed line-clamp-2"
              style={{ color: "var(--cs-ink-3)" }}
            >
              {mission.summary}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={mission.status} />
          {mission.riskLevel !== "low" && (
            <RiskBadge level={mission.riskLevel} />
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span style={{ color: "var(--cs-ink-4)", fontSize: 11 }}>
            Avancement
          </span>
          <span style={{ color: "var(--cs-ink-3)", fontSize: 11, fontWeight: 600 }}>
            {mission.tasksDone}/{mission.tasksTotal}
          </span>
        </div>
        <ProgressBar value={mission.tasksDone} max={mission.tasksTotal || 1} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 border-t pt-4" style={{ borderColor: "var(--cs-line)" }}>
        <Stat label="Tâches" value={mission.tasksTotal} />
        <Stat
          label="En attente"
          value={
            <span style={mission.tasksAwaiting > 0 ? { color: "var(--cs-warn)" } : {}}>
              {mission.tasksAwaiting}
            </span>
          }
        />
        <Stat
          label="Bloquées"
          value={
            <span style={mission.tasksBlocked > 0 ? { color: "var(--cs-danger)" } : {}}>
              {mission.tasksBlocked}
            </span>
          }
        />
      </div>
    </div>
  );
}
