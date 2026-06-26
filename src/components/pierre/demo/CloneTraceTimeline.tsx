"use client";

// PIERRE FINAL INTERACTIVE DEMO — CloneTrace history with filters.
// "Je sais toujours ce que Pierre a fait, pourquoi et avec quelle autorisation."

import { useMemo, useState } from "react";
import type { DemoScenario, TraceCategory } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

const FILTERS: { id: "all" | TraceCategory; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "document", label: "Documents" },
  { id: "message", label: "Messages" },
  { id: "validation", label: "Validations" },
  { id: "action", label: "Actions" },
  { id: "blocage", label: "Blocages" },
];

const TONE_COLOR: Record<string, string> = {
  ok: "var(--pd-ok)",
  warn: "var(--pd-warn)",
  block: "var(--pd-block)",
  info: "var(--pd-cool)",
};

const ACTOR_VARIANT: Record<string, string> = {
  Dirigeant: "pd-chip",
  Pierre: "pd-chip pd-chip--cool",
  CloneADN: "pd-chip",
  CloneGuard: "pd-chip pd-chip--warn",
  CloneTrust: "pd-chip pd-chip--cool",
  CloneContinuum: "pd-chip",
  CloneTrace: "pd-chip",
};

export function CloneTraceTimeline({ scenario }: { scenario: DemoScenario }) {
  const [filter, setFilter] = useState<"all" | TraceCategory>("all");
  const rows = useMemo(
    () => scenario.trace.filter((e) => filter === "all" || e.category === filter),
    [scenario.trace, filter],
  );

  return (
    <section data-testid="clonetrace-timeline" data-conversion-demo-cockpit>
      <StepHeading
        eyebrow="Historique · CloneTrace"
        title="Chaque décision, génération et action est tracée."
        caption="Qui a demandé, quand, quoi, avec quelle autorisation — tout reste visible."
      />
      <div className="pd-progress" role="group" aria-label="Filtrer l'historique" style={{ gap: 8, marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pd-btn ${filter === f.id ? "pd-btn-secondary" : "pd-btn-ghost"}`}
            style={{ minHeight: 34, padding: "0 12px", fontSize: "0.78rem" }}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            data-step-id={`trace-filter:${f.id}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="pd-trace" aria-live="polite">
        {rows.length === 0 ? (
          <p style={{ fontSize: "0.82rem", color: "var(--pd-ink-4)" }}>Aucune entrée pour ce filtre.</p>
        ) : (
          rows.map((e, i) => (
            <div key={i} className="pd-trace__row">
              <span className="pd-trace__time">{e.time}</span>
              <span className="pd-trace__dot" style={{ background: TONE_COLOR[e.tone] }} aria-hidden />
              <span style={{ flex: 1, fontSize: "0.82rem", color: "var(--pd-ink-2)" }}>{e.label}</span>
              <span className={ACTOR_VARIANT[e.actor] ?? "pd-chip"} style={{ minHeight: 24, fontSize: "0.68rem" }}>{e.actor}</span>
            </div>
          ))
        )}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: "0.74rem", color: "var(--pd-ink-4)" }}>
        Données de démonstration — horodatage illustratif. Aucune trace réelle n&apos;est enregistrée ici.
      </p>
    </section>
  );
}
