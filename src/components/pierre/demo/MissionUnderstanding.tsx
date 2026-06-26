"use client";

// PIERRE FINAL INTERACTIVE DEMO — first wow: understanding the free request.
// Numbers are read from the scenario (derived), not invented.

import { Target, ListChecks, CalendarClock, Users, ShieldCheck, HelpCircle } from "lucide-react";
import type { DemoScenario } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

const FIELDS: { key: keyof DemoScenario["understanding"]; label: string; Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { key: "objectifs", label: "objectifs", Icon: Target },
  { key: "taches", label: "tâches", Icon: ListChecks },
  { key: "echeances", label: "échéances", Icon: CalendarClock },
  { key: "personnes", label: "personnes concernées", Icon: Users },
  { key: "validations", label: "validations nécessaires", Icon: ShieldCheck },
  { key: "informationsManquantes", label: "information manquante", Icon: HelpCircle },
];

export function MissionUnderstanding({ scenario }: { scenario: DemoScenario }) {
  const u = scenario.understanding;
  return (
    <section data-testid="mission-understanding">
      <StepHeading
        eyebrow="Compréhension"
        title="Pierre n'a pas seulement répondu. Il a compris."
        caption="En quelques secondes, la demande devient un plan structuré — sans rien inventer."
      />
      <div className="pd-grid-3 pd-stagger" style={{ marginBottom: 14 }}>
        {FIELDS.map(({ key, label, Icon }) => (
          <div key={key} className="pd-card" style={{ padding: "14px", display: "flex", gap: 10, alignItems: "center" }}>
            <span className="pd-tech__badge" aria-hidden>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span style={{ display: "block", fontSize: "1.5rem", fontWeight: 720, lineHeight: 1, color: "var(--pd-ink-1)" }}>
                {u[key]}
              </span>
              <span style={{ fontSize: "0.74rem", color: "var(--pd-ink-3)" }}>{label}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="pd-board">
        {scenario.missions.map((m) => (
          <div key={m.id} className="pd-mission" style={{ cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--pd-ink-1)", fontSize: "0.92rem" }}>{m.title}</span>
              <span className="pd-chip" style={{ marginLeft: "auto" }}>{m.dueLabel}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.76rem", color: "var(--pd-ink-3)" }}>
              Responsable&nbsp;: {m.owner} · {m.tasks.length} tâche{m.tasks.length > 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
