"use client";

// PIERRE FINAL INTERACTIVE DEMO — beat 02 · VALUE.
// A single, legible progression: you hand over one request → Pierre absorbs the
// operational load → the coordination time returns to your team → you keep the
// control. Every number is DERIVED from the active scenario (cockpitCounters /
// roleSplit) — nothing is invented, no fabricated "hours saved" claim.

import { MessageSquareText, Layers, Clock3, ShieldCheck, ArrowRight } from "lucide-react";
import type { CockpitCounters, DemoScenario } from "@/lib/pierre/demo";
import { BeatHeading } from "./parts";

export function ValueRail({
  scenario,
  counters,
}: {
  scenario: DemoScenario;
  counters: CockpitCounters;
}) {
  const takenOver = scenario.roleSplit?.pierre.length ?? counters.actions;

  const steps = [
    {
      key: "hand",
      Icon: MessageSquareText,
      eyebrow: "Vous confiez",
      value: "1",
      unit: "demande",
      line: "Un brief RH en langage naturel, comme à un collègue.",
      accent: false,
    },
    {
      key: "absorb",
      Icon: Layers,
      eyebrow: "Pierre absorbe",
      value: String(counters.actions),
      unit: `tâches · ${counters.missions} missions`,
      line: `${counters.documents} documents préparés, plusieurs missions menées en parallèle.`,
      accent: true,
    },
    {
      key: "time",
      Icon: Clock3,
      eyebrow: "Temps rendu",
      value: String(takenOver),
      unit: "volets pris en charge",
      line: "Organisation, rédaction, relances et suivi — hors de vos mains.",
      accent: false,
    },
    {
      key: "control",
      Icon: ShieldCheck,
      eyebrow: "Contrôle conservé",
      value: String(counters.validations),
      unit: "validations isolées",
      line: "Les décisions sensibles restent les vôtres — rien ne part sans vous.",
      accent: false,
    },
  ];

  return (
    <section aria-label="La valeur de Pierre">
      <BeatHeading
        n="02"
        eyebrow="La valeur"
        title="Ce que Pierre absorbe — et ce que vous gardez."
        caption="Une demande entre, une charge opérationnelle sort de votre équipe, la décision reste à vous."
      />
      <div className="pd-value">
        {steps.map((s, i) => (
          <div key={s.key} className="pd-value__cell">
            <div className={`pd-value__step${s.accent ? " pd-value__step--accent" : ""}`}>
              <span className="pd-value__ico" aria-hidden><s.Icon className="h-5 w-5" aria-hidden /></span>
              <span className="pd-value__eyebrow">{s.eyebrow}</span>
              <span className="pd-value__value">{s.value}</span>
              <span className="pd-value__unit">{s.unit}</span>
              <span className="pd-value__line">{s.line}</span>
            </div>
            {i < steps.length - 1 ? (
              <span className="pd-value__arrow" aria-hidden><ArrowRight className="h-4 w-4" aria-hidden /></span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
