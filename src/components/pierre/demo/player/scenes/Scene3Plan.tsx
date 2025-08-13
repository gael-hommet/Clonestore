"use client";

// SCENE 3 · PLAN / WOW — SHOW, don't tell (one sentence).
// The request visibly transforms into objectives → tasks → deadlines → people →
// validations (the real scenario.understanding), then the concrete missions. Elements
// appear progressively via a reduced-motion-safe CSS stagger (always in the DOM).

import { ArrowRight, ArrowLeft } from "lucide-react";
import type { DemoScenario } from "@/lib/pierre/demo";

export function Scene3Plan({
  scenario,
  onNext,
  onPrev,
}: {
  scenario: DemoScenario;
  onNext: () => void;
  onPrev: () => void;
}) {
  const u = scenario.understanding;
  const chips = [
    { v: u.objectifs, l: "objectifs" },
    { v: u.taches, l: "tâches" },
    { v: u.echeances, l: "échéances" },
    { v: u.personnes, l: "personnes" },
    { v: u.validations, l: "validations" },
    { v: u.informationsManquantes, l: "à confirmer", flag: true },
  ];
  return (
    <div className="pdp-scene__inner pdp-scene__inner--wide">
      <div className="pdp-plan">
        <header style={{ display: "grid", gap: 6 }}>
          <p className="pd-eyebrow">Le plan</p>
          <h2 className="pd-h2">Pierre a compris la mission. Il organise maintenant le travail.</h2>
        </header>

        <div className="pdp-understand pd-stagger" aria-label="Ce que Pierre a extrait de la demande">
          {chips.map((ch) => (
            <div key={ch.l} className={`pdp-uchip${ch.flag ? " pdp-uchip--flag" : ""}`}>
              <span className="pdp-uchip__v">{ch.v}</span>
              <span className="pdp-uchip__l">{ch.l}</span>
            </div>
          ))}
        </div>

        <div className="pdp-plan__missions pd-stagger" aria-label="Missions organisées par Pierre">
          {scenario.missions.map((m) => (
            <div key={m.id} className="pdp-mrow">
              <div className="pdp-mrow__top">
                <span className="pd-dot" aria-hidden style={{ background: m.autonomy === "validation_requise" ? "var(--pd-warn)" : "var(--pd-cool)" }} />
                <span className="pdp-mrow__title">{m.title}</span>
              </div>
              <span className="pdp-mrow__due">{m.tasks.length} tâches · {m.dueLabel}</span>
            </div>
          ))}
        </div>

        <div className="pdp-nav pdp-nav--between">
          <button type="button" className="pd-btn pd-btn-ghost" onClick={onPrev}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
          </button>
          <button type="button" className="pd-btn pd-btn-primary" onClick={onNext} data-step-id="plan_watch" data-conversion-demo-cockpit>
            Le regarder travailler <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
