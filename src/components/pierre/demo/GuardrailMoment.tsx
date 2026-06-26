"use client";

// PIERRE FINAL INTERACTIVE DEMO — the trust moment.
// A sensitive request is met with a controlled, professional refusal — powerful,
// governed, never an anxiety-inducing error.

import { useState } from "react";
import { ShieldCheck, Check } from "lucide-react";
import type { DemoScenario } from "@/lib/pierre/demo";
import { StepHeading } from "./parts";

export function GuardrailMoment({ scenario }: { scenario: DemoScenario }) {
  const g = scenario.guardrail;
  const [revealed, setRevealed] = useState(false);

  return (
    <section data-testid="guardrail-moment" data-conversion-demo-cockpit>
      <StepHeading
        eyebrow="Garde-fous"
        title="Puissant, mais gouverné."
        caption="Face à une demande sensible, Pierre reste professionnel : il cadre, il ne décide pas seul."
      />
      <div className="pd-split">
        <div className="pd-card" style={{ padding: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.74rem", fontWeight: 700, color: "var(--pd-ink-4)" }}>Demande du dirigeant</p>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--pd-ink-1)", fontStyle: "italic" }}>
            &ldquo;{g.prompt}&rdquo;
          </p>
          {!revealed ? (
            <button type="button" className="pd-btn pd-btn-primary" style={{ marginTop: 14, minHeight: 40 }} onClick={() => setRevealed(true)} data-step-id="guardrail-reveal">
              Voir la réponse de Pierre
            </button>
          ) : null}
        </div>

        {revealed ? (
          <div className="pd-glass pd-animate-rise" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ShieldCheck className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} />
              <span style={{ fontWeight: 700, color: "var(--pd-ink-1)" }}>Pierre</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "var(--pd-ink-1)", fontWeight: 600 }}>{g.intro}</p>
            <p style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "var(--pd-ink-3)" }}>Je peux&nbsp;:</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {g.canDo.map((c) => (
                <li key={c} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.84rem", color: "var(--pd-ink-2)" }}>
                  <Check className="h-3.5 w-3.5" aria-hidden style={{ color: "var(--pd-ok)", marginTop: 2, flex: "none" }} />
                  {c}
                </li>
              ))}
            </ul>
            <p style={{ margin: "12px 0 0", fontSize: "0.76rem", color: "var(--pd-ink-4)" }}>{g.cannotReason}</p>
          </div>
        ) : (
          <div className="pd-card" style={{ padding: 16, display: "grid", placeItems: "center", color: "var(--pd-ink-4)", fontSize: "0.82rem", textAlign: "center" }}>
            Pierre est plus sûr qu&apos;une IA généraliste libre : il connaît les limites de son rôle.
          </div>
        )}
      </div>
    </section>
  );
}
