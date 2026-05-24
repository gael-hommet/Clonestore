// src/app/agents/pierre/use/components/PierreScenariosPanel.tsx
// Golden scenarios list with dry-run — Pierre Cockpit B31.1.
// All scenario runs default to dry_run:true, ai_mode:"off".

"use client";

import * as React from "react";
import { ChevronsRight, FlaskConical, Play } from "lucide-react";
import type {
  PierreCockpitScenarioSummary,
  PierreCockpitActionResult,
} from "@/lib/pierre/cockpit/types";
import { EmptyState } from "./PierreEmptyStates";
import { cn } from "@/lib/utils";

function ScenarioCard({
  scenario,
  onRun,
  loading,
}: {
  scenario: PierreCockpitScenarioSummary;
  onRun: (id: string) => void;
  loading: boolean;
}) {
  const [launched, setLaunched] = React.useState(false);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--cs-surface-strong)", border: "1px solid var(--cs-line)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: scenario.positive ? "var(--cs-success-bg)" : "var(--cs-danger-bg)",
                color: scenario.positive ? "var(--cs-success)" : "var(--cs-danger)",
              }}
            >
              {scenario.positive ? "Positif" : "Négatif"}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--cs-bg-3)", color: "var(--cs-ink-4)" }}
            >
              {scenario.domain}
            </span>
          </div>
          <p className="font-semibold text-sm" style={{ color: "var(--cs-ink-1)" }}>
            {scenario.label}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--cs-ink-4)" }}>
            {scenario.description}
          </p>
          {scenario.officialId && (
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--cs-ink-4)" }}>
              ID : {scenario.officialId}
            </p>
          )}
        </div>

        <button
          onClick={() => {
            onRun(scenario.id);
            setLaunched(true);
          }}
          disabled={loading}
          className={cn(
            "shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            loading ? "opacity-40 cursor-wait" : "hover:opacity-80 active:scale-95",
          )}
          style={{ background: "var(--cs-blue-soft)", color: "var(--cs-blue)" }}
          title="Lancer en mode simulation (dry-run, sans IA)"
          aria-label={`Simuler le scénario : ${scenario.label}`}
        >
          {loading ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <Play className="h-3 w-3" aria-hidden="true" />
          )}
          Simuler
        </button>
      </div>

      {launched && !loading && (
        <p
          className="mt-2 text-xs rounded-lg px-2 py-1"
          style={{ background: "var(--cs-blue-soft)", color: "var(--cs-blue)" }}
        >
          Simulation lancée (dry-run)
        </p>
      )}
    </div>
  );
}

export function PierreScenariosPanel({
  scenarios,
  onRunScenario,
  onRunSuite,
  loadingScenario,
}: {
  scenarios: PierreCockpitScenarioSummary[];
  onRunScenario: (id: string) => Promise<PierreCockpitActionResult>;
  onRunSuite: () => Promise<PierreCockpitActionResult>;
  loadingScenario: string | null;
}) {
  const [suiteOk, setSuiteOk] = React.useState<boolean | null>(null);
  const [suiteMsg, setSuiteMsg] = React.useState<string | null>(null);
  const [runningSuite, setRunningSuite] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "positive" | "negative">("all");

  async function handleSuite() {
    setRunningSuite(true);
    setSuiteOk(null);
    setSuiteMsg(null);
    try {
      const res = await onRunSuite();
      setSuiteOk(res.ok);
      setSuiteMsg(res.ok ? "Suite complète exécutée (dry-run)" : (res.error ?? "Erreur"));
    } finally {
      setRunningSuite(false);
    }
  }

  const filtered = scenarios.filter((s) => {
    if (filter === "positive") return s.positive;
    if (filter === "negative") return !s.positive;
    return true;
  });

  if (scenarios.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical className="h-5 w-5" />}
        title="Aucun scénario disponible"
        subtitle="Les scénarios de test golden apparaîtront ici."
      />
    );
  }

  const positiveCount = scenarios.filter((s) => s.positive).length;
  const negativeCount = scenarios.length - positiveCount;

  return (
    <div className="flex flex-col gap-4">
      {/* Header + suite button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--cs-ink-1)" }}>
            {scenarios.length} scénario{scenarios.length > 1 ? "s" : ""}
          </p>
          <p className="text-xs" style={{ color: "var(--cs-ink-4)" }}>
            {positiveCount} positifs · {negativeCount} négatifs
          </p>
        </div>
        <button
          onClick={handleSuite}
          disabled={runningSuite || !!loadingScenario}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
            runningSuite ? "opacity-40" : "hover:opacity-80 active:scale-95",
          )}
          style={{ background: "var(--cs-graphite)", color: "var(--cs-ivory)" }}
          title="Lancer tous les scénarios (dry-run)"
        >
          {runningSuite ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Tout simuler
        </button>
      </div>

      {suiteMsg && (
        <p
          className="text-xs rounded-xl px-3 py-2"
          style={{
            background: suiteOk ? "var(--cs-success-bg)" : "var(--cs-danger-bg)",
            color: suiteOk ? "var(--cs-success)" : "var(--cs-danger)",
          }}
        >
          {suiteMsg}
        </p>
      )}

      {/* Filter tabs */}
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ background: "var(--cs-bg-2)" }}
        role="tablist"
      >
        {(["all", "positive", "negative"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all",
              filter === f ? "shadow-sm" : "opacity-60 hover:opacity-80",
            )}
            style={
              filter === f
                ? { background: "var(--cs-surface-strong)", color: "var(--cs-ink-1)" }
                : { color: "var(--cs-ink-3)" }
            }
          >
            {f === "all" ? "Tous" : f === "positive" ? "Positifs" : "Négatifs"}
          </button>
        ))}
      </div>

      {/* Scenario list */}
      <div className="flex flex-col gap-3">
        {filtered.map((s) => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            onRun={(id) => { void onRunScenario(id); }}
            loading={loadingScenario === s.id}
          />
        ))}
      </div>
    </div>
  );
}
