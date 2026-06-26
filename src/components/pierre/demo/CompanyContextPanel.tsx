"use client";

// PIERRE FINAL INTERACTIVE DEMO — second value moment: company context recall.
// Pierre re-reads the enterprise footprint; missing info is flagged, never invented.

import { Building2, AlertTriangle } from "lucide-react";
import type { DemoScenario } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

export function CompanyContextPanel({ scenario }: { scenario: DemoScenario }) {
  const ctx = scenario.context;
  return (
    <section data-testid="company-context">
      <StepHeading
        eyebrow="Contexte entreprise"
        title="Pierre relit ce que l'entreprise lui a déjà appris."
        caption="Règles, équipes, managers, modèles : Pierre s'appuie sur le contexte, il ne le devine pas."
      />
      <div className="pd-split">
        <div className="pd-glass" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Building2 className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} />
            <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>{ctx.subject}</span>
          </div>
          <dl className="pd-doc__meta">
            {ctx.rows.map((r) => (
              <div key={r.label} className="pd-doc__meta-row">
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="pd-card" style={{ padding: 16, borderColor: "var(--pd-warn-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle className="h-4 w-4" aria-hidden style={{ color: "var(--pd-warn)" }} />
            <span style={{ fontWeight: 700, color: "var(--pd-warn)" }}>Information manquante</span>
          </div>
          {ctx.missing.map((m) => (
            <p key={m} style={{ margin: "4px 0", fontSize: "0.84rem", color: "var(--pd-ink-2)" }}>
              • {m} — en attente
            </p>
          ))}
          <p style={{ margin: "10px 0 0", fontSize: "0.76rem", color: "var(--pd-ink-4)" }}>
            Pierre signale et bloque la tâche concernée. Il ne comble jamais le trou seul.
          </p>
        </div>
      </div>
    </section>
  );
}
