"use client";

// SCENE 4 · EXECUTION + VALIDATION — teaches governance BY USING it.
// A clean timeline (scenario.trace) is already advanced with ✓ steps; then it STOPS
// on a sensitive action (scenario.guardrail) → a big "VALIDATION REQUISE" state
// showing what Pierre wanted to do + why it needs a human + the human action. The
// prospect clicks "Valider" (or "Refuser") themselves → the timeline resumes.
// No multi-paragraph PEUT/DOIT/NE block; one short helper only.

import { useState } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, ShieldAlert, Check, X } from "lucide-react";
import { trackDemoEvent, type DemoScenario } from "@/lib/pierre/demo";

type Decision = "pending" | "approved" | "refused";

export function Scene4ExecutionValidation({
  scenario,
  onNext,
  onPrev,
}: {
  scenario: DemoScenario;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [decision, setDecision] = useState<Decision>("pending");
  const g = scenario.guardrail;
  // The work Pierre does autonomously — shown already completed (✓). The sensitive
  // step is the gate below; capped so the scene fits the shortest viewports.
  const steps = scenario.trace.filter((t) => t.category !== "validation").slice(0, 6);

  function decide(next: "approved" | "refused") {
    setDecision(next);
    trackDemoEvent("pierre_demo_approval_clicked", {
      scenario_id: scenario.id,
      step_index: 3,
      cta_kind: next === "approved" ? "validate" : "refuse",
    });
  }

  return (
    <div className="pdp-scene__inner pdp-scene__inner--wide">
      <header style={{ display: "grid", gap: 5 }}>
        <p className="pd-eyebrow">Exécution &amp; garde-fou</p>
        <h2 className="pd-h2">Il travaille — puis il s&apos;arrête où il le faut.</h2>
        <p className="pd-lede" style={{ fontSize: "0.82rem" }}>
          Pierre s&apos;arrête exactement là où une décision humaine reste nécessaire.
        </p>
      </header>

      <div className="pdp-exec">
        <ol className="pdp-timeline" aria-label="Étapes exécutées par Pierre">
          {steps.map((s, i) => (
            <li key={i} className="pdp-tl">
              <span className="pdp-tl__time">{s.time}</span>
              <CheckCircle2 className="pdp-tl__ico h-4 w-4" aria-hidden style={{ color: "var(--pd-ok)" }} />
              <span className="pdp-tl__label">{s.label}</span>
            </li>
          ))}
          <li className={`pdp-tl${decision === "pending" ? " pdp-tl--pending" : ""}`}>
            <span className="pdp-tl__time">→</span>
            {decision === "approved" ? (
              <Check className="pdp-tl__ico h-4 w-4" aria-hidden style={{ color: "var(--pd-ok)" }} />
            ) : decision === "refused" ? (
              <X className="pdp-tl__ico h-4 w-4" aria-hidden style={{ color: "var(--pd-block)" }} />
            ) : (
              <ShieldAlert className="pdp-tl__ico h-4 w-4" aria-hidden style={{ color: "var(--pd-warn)" }} />
            )}
            <span className="pdp-tl__label">
              {decision === "approved"
                ? "Validé — Pierre poursuit et clôt la mission."
                : decision === "refused"
                  ? "Refusé — Pierre n'exécute pas et garde le dossier prêt."
                  : "Action sensible — en attente de votre décision."}
            </span>
          </li>
        </ol>

        <div className="pdp-gate" role="group" aria-label="Validation requise">
          <div className="pdp-gate__head">
            <span className="pdp-gate__badge">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Validation requise
            </span>
          </div>
          <div>
            <p className="pdp-gate__k">Ce que Pierre veut faire</p>
            <p className="pdp-gate__want">&ldquo;{g.prompt}&rdquo;</p>
          </div>
          <div>
            <p className="pdp-gate__k">Pourquoi une validation humaine</p>
            <p className="pdp-gate__why">{g.intro} {g.cannotReason}</p>
          </div>

          {decision === "pending" ? (
            <div className="pdp-gate__actions">
              <button type="button" className="pd-btn pd-btn-primary" onClick={() => decide("approved")} data-step-id="validation_approve" data-conversion-demo-cockpit>
                <Check className="h-4 w-4" aria-hidden /> Valider
              </button>
              <button type="button" className="pd-btn pd-btn-secondary" onClick={() => decide("refused")} data-step-id="validation_refuse" data-conversion-demo-cockpit>
                <X className="h-4 w-4" aria-hidden /> Refuser
              </button>
            </div>
          ) : (
            <p className="pdp-gate__done">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {decision === "approved" ? "Décision enregistrée — la décision reste la vôtre." : "Décision enregistrée — rien n'a été exécuté."}
            </p>
          )}
        </div>
      </div>

      <div className="pdp-nav pdp-nav--between">
        <button type="button" className="pd-btn pd-btn-ghost" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </button>
        <button
          type="button"
          className="pd-btn pd-btn-primary"
          onClick={onNext}
          disabled={decision === "pending"}
          data-step-id="execution_result"
          data-conversion-demo-cockpit
        >
          Voir le résultat <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
