// src/app/agents/pierre/use/components/PierreEmployeeFileCard.tsx
// Employee 360 summary card — Pierre Cockpit B31.

import * as React from "react";
import type { PierreCockpitEmployeeSummary } from "@/lib/pierre/cockpit/types";
import { RiskBadge } from "./PierreStatusBadges";

function HealthBar({ score }: { score: number }) {
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--cs-bg-3)" }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{
          width: `${score}%`,
          background:
            score >= 75
              ? "var(--cs-success)"
              : score >= 45
              ? "var(--cs-warn)"
              : "var(--cs-danger)",
        }}
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PierreEmployeeFileCard({
  employee,
  onSelect,
}: {
  employee: PierreCockpitEmployeeSummary;
  onSelect?: (id: string) => void;
}) {
  const score = employee.healthScore ?? 0;

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.005]"
      style={{
        background: "var(--cs-surface-strong)",
        border: "1px solid var(--cs-line)",
      }}
      onClick={() => onSelect?.(employee.id)}
      role={onSelect ? "button" : undefined}
      aria-label={`Fiche employé : ${employee.name}`}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(employee.id);
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: "var(--cs-graphite)",
            color: "var(--cs-ivory)",
          }}
          aria-hidden="true"
        >
          {initials(employee.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--cs-ink-1)" }}>
            {employee.name}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--cs-ink-4)" }}>
            {employee.role ?? "—"} · {employee.contractType ?? "—"}
          </p>
          {employee.email && (
            <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--cs-ink-4)" }}>
              {employee.email}
            </p>
          )}
        </div>

        {/* Risk */}
        <div className="shrink-0">
          {employee.riskLevel !== "low" && <RiskBadge level={employee.riskLevel} />}
        </div>
      </div>

      {/* Health */}
      {employee.healthScore !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span style={{ color: "var(--cs-ink-4)", fontSize: 11 }}>Santé RH</span>
            <span style={{ color: "var(--cs-ink-3)", fontSize: 11, fontWeight: 600 }}>
              {score}%
            </span>
          </div>
          <HealthBar score={score} />
        </div>
      )}

      {/* Counters */}
      <div className="mt-2 flex gap-4 border-t pt-2.5" style={{ borderColor: "var(--cs-line)" }}>
        <span className="text-xs" style={{ color: "var(--cs-ink-4)" }}>
          <strong style={{ color: "var(--cs-ink-2)" }}>{employee.openTasks}</strong> tâche{employee.openTasks !== 1 ? "s" : ""}
        </span>
        {employee.missingInfo.length > 0 && (
          <span className="text-xs" style={{ color: "var(--cs-warn)" }}>
            ⚠ {employee.missingInfo.length} info manquante{employee.missingInfo.length > 1 ? "s" : ""}
          </span>
        )}
        {employee.lastActivity && (
          <span className="ml-auto text-[11px]" style={{ color: "var(--cs-ink-4)" }}>
            {new Date(employee.lastActivity).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>

      {/* Missing info chips */}
      {employee.missingInfo.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {employee.missingInfo.slice(0, 4).map((info) => (
            <span
              key={info}
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "var(--cs-warn-bg)", color: "var(--cs-warn)" }}
            >
              {info}
            </span>
          ))}
          {employee.missingInfo.length > 4 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "var(--cs-bg-3)", color: "var(--cs-ink-4)" }}
            >
              +{employee.missingInfo.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
