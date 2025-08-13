"use client";

// SCENE 1 · HOOK — understandable in < 5s.
// Big premium title + one sub-line (you entrust work like an employee) + up to 3
// real proof signals + a compact live cockpit snapshot (real product preview) +
// the primary CTA. Every number is derived from the scenario (cockpitCounters),
// never invented.

import { ArrowRight, Layers, FileText, ShieldCheck } from "lucide-react";
import { cockpitCounters, type DemoScenario } from "@/lib/pierre/demo";

export function Scene1Hook({ scenario, onNext }: { scenario: DemoScenario; onNext: () => void }) {
  const c = cockpitCounters(scenario);
  const missionTitles = scenario.missions.slice(0, 3);
  const tiles = [
    { v: c.missions, l: "missions" },
    { v: c.actions, l: "tâches" },
    { v: c.documents, l: "documents" },
    { v: c.validations, l: "validations" },
  ];
  return (
    <div className="pdp-scene__inner pdp-scene__inner--wide">
      <div className="pdp-hook">
        <div className="pdp-hook__lead">
          <p className="pd-eyebrow">CloneStore · Pierre</p>
          <h1 className="pd-display pdp-hook__title">
            Pierre — <span className="pd-accent">votre employé IA RH</span>
          </h1>
          <p className="pd-lede pdp-hook__sub">
            Vous lui confiez du travail, comme à un employé. Il prend la charge opérationnelle.
          </p>
          <div className="pdp-hook__signals" aria-label="Repères issus de données réelles de la démonstration">
            <span className="pdp-signal">
              <Layers className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-cool)" }} />
              <span className="pdp-signal__v">{c.missions}</span>
              <span className="pdp-signal__l">missions orchestrées</span>
            </span>
            <span className="pdp-signal">
              <FileText className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-cool)" }} />
              <span className="pdp-signal__v">{c.documents}</span>
              <span className="pdp-signal__l">documents produits</span>
            </span>
            <span className="pdp-signal">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-warn)" }} />
              <span className="pdp-signal__v">{c.validations}</span>
              <span className="pdp-signal__l">validation humaine</span>
            </span>
          </div>
          <div className="pdp-nav" style={{ marginTop: 4 }}>
            <button type="button" className="pd-btn pd-btn-primary" onClick={onNext} data-step-id="hook_start">
              Donner une mission à Pierre <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Real product preview — a compact cockpit snapshot. */}
        <aside className="pdp-snap" aria-label="Aperçu du cockpit de Pierre">
          <div className="pdp-snap__bar">
            <span className="pdp-brand__mark" aria-hidden style={{ width: 24, height: 24, fontSize: "0.72rem" }}>P</span>
            <span style={{ minWidth: 0 }}>
              <span className="pdp-snap__clock" style={{ display: "block" }}>{scenario.clockLabel ?? "Cockpit RH"}</span>
              <span className="pdp-snap__title">{scenario.name}</span>
            </span>
            <span className="pd-chip pd-chip--cool" style={{ marginLeft: "auto" }}>En activité</span>
          </div>
          <div className="pdp-snap__tiles">
            {tiles.map((t) => (
              <div key={t.l} className="pdp-snap__tile">
                <span className="pdp-snap__tv">{t.v}</span>
                <span className="pdp-snap__tl">{t.l}</span>
              </div>
            ))}
          </div>
          <div className="pdp-snap__rows">
            {missionTitles.map((m) => (
              <div key={m.id} className="pdp-snap__row">
                <span className="pd-dot" aria-hidden style={{ background: m.autonomy === "validation_requise" ? "var(--pd-warn)" : "var(--pd-cool)" }} />
                <span className="pdp-snap__rt">{m.title}</span>
                <span className="pd-chip" style={{ minHeight: 24, fontSize: "0.66rem" }}>{m.dueLabel}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
