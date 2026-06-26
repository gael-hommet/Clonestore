"use client";

// PIERRE FINAL INTERACTIVE DEMO — the parallel mission centre (the big "wow").
// Several missions advance at once; a mission can be opened for detail without
// leaving the narrative.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DemoMission, DemoScenario } from "@/lib/pierre/demo";
import { StatusMark, StepHeading, Chip } from "./parts";

function autonomyChip(m: DemoMission) {
  if (m.autonomy === "validation_requise") return <Chip variant="warn">Validation requise</Chip>;
  if (m.autonomy === "bloquee") return <Chip variant="block">Bloquée</Chip>;
  return <Chip variant="cool">Autonome</Chip>;
}

function MissionCard({
  mission,
  active,
  onSelect,
}: {
  mission: DemoMission;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="pd-mission"
      aria-current={active}
      aria-expanded={active}
      onClick={onSelect}
      data-step-id={`mission:${mission.id}`}
      data-mission-id={mission.id}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "var(--pd-ink-1)", fontSize: "0.95rem" }}>{mission.title}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
          {autonomyChip(mission)}
          <ChevronRight className="h-4 w-4" aria-hidden style={{ color: "var(--pd-ink-4)" }} />
        </span>
      </div>
      <p style={{ margin: "3px 0 8px", fontSize: "0.75rem", color: "var(--pd-ink-3)" }}>
        {mission.owner} · échéance {mission.dueLabel}
      </p>
      <div>
        {mission.tasks.map((t) => (
          <div key={t.id} className="pd-task">
            <span style={{ marginLeft: "auto", flex: "none", order: 2 }}>
              <StatusMark status={t.status} />
            </span>
            <span style={{ order: 1, flex: 1 }}>{t.label}</span>
          </div>
        ))}
      </div>
      {mission.dependsOn ? (
        <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--pd-ink-4)" }}>↳ {mission.dependsOn}</p>
      ) : null}
    </button>
  );
}

export function MissionControl({
  scenario,
  activeMissionId,
  onSelectMission,
}: {
  scenario: DemoScenario;
  activeMissionId: string | null;
  onSelectMission: (id: string) => void;
}) {
  const [local, setLocal] = useState<string | null>(activeMissionId);
  const current = local ?? activeMissionId;

  return (
    <section data-testid="mission-control" data-conversion-demo-cockpit>
      <StepHeading
        eyebrow="Centre de missions"
        title="Plusieurs missions avancent en parallèle."
        caption="Pierre ne fait pas une chose à la fois : il tient le fil de tout, et signale ce qui bloque."
      />
      <div className="pd-board pd-stagger">
        {scenario.missions.map((m) => (
          <MissionCard
            key={m.id}
            mission={m}
            active={current === m.id}
            onSelect={() => {
              const next = current === m.id ? null : m.id;
              setLocal(next);
              if (next) onSelectMission(next);
            }}
          />
        ))}
      </div>
    </section>
  );
}
