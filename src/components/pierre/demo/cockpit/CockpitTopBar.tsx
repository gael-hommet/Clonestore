"use client";

// PIERRE COCKPIT — the context bar.
// Always-visible scenario clock, live derived counters, and the phase caption/
// question. Counters come from cockpitCounters() — derived from the scenario,
// never invented.

import { CalendarClock } from "lucide-react";
import type { CockpitCounters, CockpitPhase, DemoScenario } from "@/lib/pierre/demo";

export function CockpitTopBar({
  scenario,
  phase,
  counters,
}: {
  scenario: DemoScenario;
  phase: CockpitPhase;
  counters: CockpitCounters;
}) {
  const metrics: { v: number; l: string; flag?: boolean }[] = [
    { v: counters.missions, l: "missions" },
    { v: counters.actions, l: "actions" },
    { v: counters.documents, l: "documents" },
    { v: counters.validations, l: "validations", flag: counters.validations > 0 },
    { v: counters.waiting, l: "en attente", flag: counters.waiting > 0 },
  ];

  return (
    <div className="pdc-bar">
      <div className="pdc-bar__top">
        <div className="pdc-bar__scenario">
          <span className="pdc-zone__ico" aria-hidden>
            <CalendarClock className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="pdc-bar__clock">{scenario.clockLabel ?? "Cette semaine"}</span>{" "}
            <span className="pdc-bar__title">· {scenario.name}</span>
          </span>
        </div>
        <div className="pdc-metrics" aria-label="État de la semaine">
          {metrics.map((m) => (
            <span key={m.l} className={`pdc-metric${m.flag ? " pdc-metric--flag" : ""}`}>
              <span className="pdc-metric__v">{m.v}</span>
              <span className="pdc-metric__l">{m.l}</span>
            </span>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--pd-ink-3)" }}>
        <strong style={{ color: "var(--pd-ink-1)" }}>{phase.title}.</strong> {phase.caption}
      </p>
    </div>
  );
}
