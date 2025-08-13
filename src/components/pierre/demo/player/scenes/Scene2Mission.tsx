"use client";

// SCENE 2 · MISSION — one interaction, no form.
// The real natural-language request (scenario.request) shown in a simple compose UI,
// and a single button "Confier à Pierre". No paragraph explaining what he'll do.

import { ArrowRight, ArrowLeft, MessageSquare } from "lucide-react";
import { trackDemoEvent, type DemoScenario } from "@/lib/pierre/demo";

export function Scene2Mission({
  scenario,
  onNext,
  onPrev,
}: {
  scenario: DemoScenario;
  onNext: () => void;
  onPrev: () => void;
}) {
  function confier() {
    trackDemoEvent("pierre_demo_mission_submitted", { scenario_id: scenario.id, step_index: 1 });
    onNext();
  }
  return (
    <div className="pdp-scene__inner">
      <div className="pdp-mission">
        <header style={{ display: "grid", gap: 6, textAlign: "center", justifyItems: "center" }}>
          <p className="pd-eyebrow">La mission</p>
          <h2 className="pd-h2">Une demande, en langage naturel.</h2>
        </header>

        <div className="pdp-compose">
          <div className="pdp-compose__bar">
            <MessageSquare className="h-4 w-4" aria-hidden style={{ color: "var(--pd-cool)" }} />
            <span className="pdp-compose__who">Vous → Pierre</span>
          </div>
          <p className="pdp-compose__body">&ldquo;{scenario.request}&rdquo;</p>
          <div className="pdp-compose__foot">
            <span className="pdp-hint">Aucun formulaire. Vous écrivez, il s&apos;organise.</span>
            <button type="button" className="pd-btn pd-btn-primary" onClick={confier} data-step-id="mission_submit" data-conversion-demo-cockpit>
              Confier à Pierre <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="pdp-nav" style={{ justifyContent: "center" }}>
          <button type="button" className="pd-btn pd-btn-ghost" onClick={onPrev}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
          </button>
        </div>
      </div>
    </div>
  );
}
