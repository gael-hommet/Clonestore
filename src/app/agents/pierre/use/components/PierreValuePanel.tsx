// src/app/agents/pierre/use/components/PierreValuePanel.tsx
// ROI and customer success value panel — Pierre Cockpit B31.

import * as React from "react";
import type { PierreCockpitROI } from "@/lib/pierre/cockpit/types";
import { EmptyState } from "./PierreEmptyStates";

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: "var(--cs-surface-strong)",
        border: "1px solid var(--cs-line)",
      }}
    >
      <p style={{ color: "var(--cs-ink-4)", fontSize: 11, fontWeight: 500 }}>{label}</p>
      <p
        className="text-2xl font-bold"
        style={{ color: color ?? "var(--cs-ink-1)" }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ color: "var(--cs-ink-4)", fontSize: 11 }}>{sub}</p>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span style={{ color: "var(--cs-ink-3)", fontSize: 12 }}>{label}</span>
        <span style={{ color: "var(--cs-ink-2)", fontSize: 12, fontWeight: 600 }}>
          {value}/100
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: "var(--cs-bg-3)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${value}%`,
            background:
              value >= 75
                ? "var(--cs-success)"
                : value >= 45
                ? "var(--cs-warn)"
                : "var(--cs-danger)",
          }}
        />
      </div>
    </div>
  );
}

export function PierreValuePanel({ roi }: { roi: PierreCockpitROI | null }) {
  if (!roi) {
    return (
      <EmptyState
        icon="📈"
        title="Aucune donnée de valeur"
        subtitle="Les métriques ROI et santé client apparaîtront après l'exécution de missions."
      />
    );
  }

  const valueRange =
    roi.valueEurLow !== null && roi.valueEurHigh !== null
      ? `${roi.valueEurLow.toLocaleString("fr-FR")} – ${roi.valueEurHigh.toLocaleString("fr-FR")} €`
      : "—";

  return (
    <div className="flex flex-col gap-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Heures économisées (est.)"
          value={roi.hoursEstimated !== null ? `${roi.hoursEstimated}h` : "—"}
          sub="estimation Pierre"
        />
        <MetricCard
          label="Valeur créée"
          value={valueRange}
          sub="fourchette basse–haute"
          color="var(--cs-success)"
        />
        <MetricCard
          label="Tâches complétées"
          value={roi.tasksCompleted}
        />
        <MetricCard
          label="Documents produits"
          value={roi.documentsProduced}
        />
      </div>

      {/* Scores */}
      {(roi.conversionScore !== null || roi.retentionScore !== null || roi.healthScore !== null) && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--cs-surface-strong)",
            border: "1px solid var(--cs-line)",
          }}
        >
          <h4
            className="mb-4 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--cs-ink-4)" }}
          >
            Scores qualité
          </h4>
          {roi.healthScore !== null && (
            <ScoreBar label="Santé globale" value={roi.healthScore} />
          )}
          {roi.conversionScore !== null && (
            <ScoreBar label="Conversion" value={roi.conversionScore} />
          )}
          {roi.retentionScore !== null && (
            <ScoreBar label="Rétention" value={roi.retentionScore} />
          )}
        </div>
      )}

      {/* Stage */}
      {roi.healthStage && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-center"
          style={{ background: "var(--cs-bg-2)", color: "var(--cs-ink-3)" }}
        >
          Stage : <strong style={{ color: "var(--cs-ink-1)" }}>{roi.healthStage}</strong>
        </div>
      )}
    </div>
  );
}
