// src/app/agents/pierre/use/components/PierreEmployeeFilesPanel.tsx
// Employee list with health/risk overview — Pierre Cockpit B31.

"use client";

import * as React from "react";
import { Users, X } from "lucide-react";
import type {
  PierreCockpitEmployeeSummary,
  PierreCockpitActionResult,
} from "@/lib/pierre/cockpit/types";
import { PierreEmployeeFileCard } from "./PierreEmployeeFileCard";
import { EmptyState, LoadingState, ErrorState } from "./PierreEmptyStates";

export function PierreEmployeeFilesPanel({
  employees,
  loading,
  onSelectEmployee,
}: {
  employees: PierreCockpitEmployeeSummary[];
  loading: boolean;
  onSelectEmployee: (id: string) => Promise<PierreCockpitActionResult>;
}) {
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const filtered = employees.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.role ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  async function handleSelect(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
    try {
      const res = await onSelectEmployee(id);
      if (res.ok && res.data) {
        setDetail(res.data as Record<string, unknown>);
      } else {
        setDetailError(res.error ?? "Erreur de chargement");
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loading) return <LoadingState label="Chargement des fiches employés…" />;

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Aucun employé"
        subtitle="Les fiches employés apparaîtront ici une fois synchronisées."
      />
    );
  }

  // Summary stats
  const atRisk = employees.filter((e) => e.riskLevel === "high" || e.riskLevel === "critical").length;
  const avgHealth = Math.round(
    employees.reduce((acc, e) => acc + (e.healthScore ?? 0), 0) / employees.length,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: employees.length },
          { label: "À risque", value: atRisk, warn: atRisk > 0 },
          { label: "Santé moy.", value: `${avgHealth}%` },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl px-3 py-2.5 text-center"
            style={{
              background: "var(--cs-surface-strong)",
              border: "1px solid var(--cs-line)",
            }}
          >
            <p
              className="text-lg font-bold"
              style={{ color: s.warn ? "var(--cs-danger)" : "var(--cs-ink-1)" }}
            >
              {s.value}
            </p>
            <p className="text-[11px]" style={{ color: "var(--cs-ink-4)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un employé…"
        aria-label="Rechercher un employé"
        className="w-full rounded-xl px-4 py-2 text-sm outline-none"
        style={{
          background: "var(--cs-surface-strong)",
          border: "1px solid var(--cs-line)",
          color: "var(--cs-ink-1)",
        }}
      />

      {/* Employee grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((emp) => (
          <PierreEmployeeFileCard
            key={emp.id}
            employee={emp}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selectedId && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--cs-bg-2)",
            border: "1px solid var(--cs-line)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold" style={{ color: "var(--cs-ink-1)" }}>
              Fiche détaillée
            </h4>
            <button
              onClick={() => { setSelectedId(null); setDetail(null); }}
              className="rounded p-0.5 opacity-60 hover:opacity-100"
              style={{ color: "var(--cs-ink-4)" }}
              aria-label="Fermer la fiche"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {loadingDetail && <LoadingState label="Chargement de la fiche…" />}
          {detailError && <ErrorState message={detailError} />}
          {detail && !loadingDetail && (
            <pre
              className="whitespace-pre-wrap text-xs leading-relaxed overflow-auto max-h-80"
              style={{
                color: "var(--cs-ink-2)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {JSON.stringify(detail, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
