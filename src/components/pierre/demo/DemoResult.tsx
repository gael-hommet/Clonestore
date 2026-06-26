"use client";

// PIERRE FINAL INTERACTIVE DEMO — final proof of value.
// Metrics are computed from the scenario (never invented). No fabricated time
// savings: we show a qualitative before/after, not an unmethodical hour count.

import type { DemoScenario } from "@/lib/pierre/demo";
import { computeScenarioMetrics } from "@/lib/pierre/demo";
import { ProofGrid, StepHeading, type ProofItem } from "./parts";

export function DemoResult({ scenario }: { scenario: DemoScenario }) {
  const m = computeScenarioMetrics(scenario);
  const items: ProofItem[] = [
    { value: m.demande, label: "demande" },
    { value: m.missions, label: "missions coordonnées" },
    { value: m.taches, label: "tâches organisées" },
    { value: m.documents, label: "documents préparés" },
    { value: m.communications, label: "communications prêtes" },
    { value: m.validations, label: "validations isolées" },
    { value: m.suivis, label: "suivis programmés" },
    { value: m.blocages, label: "blocage signalé" },
  ];

  return (
    <section data-testid="demo-result">
      <StepHeading
        eyebrow="Résultat"
        title="Une demande. Un travail RH complet, organisé et tracé."
        caption="Tous ces chiffres proviennent du scénario que vous venez de voir."
      />
      <div style={{ display: "grid", gap: 10 }}>
        <ProofGrid items={items.slice(0, 4)} columns={4} />
        <ProofGrid items={items.slice(4, 8)} columns={4} />
      </div>

      <div className="pd-card" style={{ marginTop: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", borderColor: "var(--pd-ok-soft)" }}>
        <span className="pd-stat__value" style={{ fontSize: "1.6rem", color: "var(--pd-ok)" }}>{m.informationsInventees}</span>
        <span style={{ fontSize: "0.84rem", color: "var(--pd-ink-2)", fontWeight: 600 }}>
          information inventée — Pierre signale ce qui manque, il ne le comble jamais seul.
        </span>
      </div>

      <div className="pd-split" style={{ marginTop: 16 }}>
        <div className="pd-card" style={{ padding: 16 }}>
          <p className="pd-eyebrow" style={{ marginBottom: 8 }}>Avant</p>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--pd-ink-3)", lineHeight: 1.6 }}>
            Messages dispersés, documents séparés, relances oubliables, validations difficiles à suivre.
          </p>
        </div>
        <div className="pd-glass" style={{ padding: 16 }}>
          <p className="pd-eyebrow" style={{ marginBottom: 8 }}>Avec Pierre</p>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--pd-ink-1)", lineHeight: 1.6 }}>
            Une mission, un plan, des livrables, des validations isolées et un suivi traçable.
          </p>
        </div>
      </div>
    </section>
  );
}
