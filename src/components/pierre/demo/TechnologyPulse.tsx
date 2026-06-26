"use client";

// PIERRE FINAL INTERACTIVE DEMO — technologies surfaced WHILE they act.
// Human language, no jargon. ClonePolicy is framed as internal to CloneGuard.

import { DEMO_TECHNOLOGIES } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

export function TechnologyPulse() {
  return (
    <section data-testid="technology-pulse">
      <StepHeading
        eyebrow="Technologies CloneStore"
        title="Chaque technologie agit — expliquée simplement."
        caption="Pas un catalogue : ce que chaque brique fait pendant que Pierre travaille."
      />
      <div className="pd-tech pd-stagger">
        {DEMO_TECHNOLOGIES.map((t) => (
          <div key={t.id} className="pd-tech__item" data-tech-id={t.id}>
            <span className="pd-tech__badge" aria-hidden>{t.name.replace("Clone", "")[0]}</span>
            <span>
              <span style={{ display: "block", fontWeight: 700, color: "var(--pd-ink-1)" }}>{t.name}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--pd-ink-3)" }}>{t.role}</span>
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: "0.76rem", color: "var(--pd-ink-4)" }}>
        CloneGuard applique les politiques internes (ClonePolicy) avant toute action sensible.
      </p>
    </section>
  );
}
