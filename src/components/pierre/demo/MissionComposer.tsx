"use client";

// PIERRE FINAL INTERACTIVE DEMO — mission composer.
// Shows a real mission-input surface with the director's natural request typed
// out (respecting reduced-motion: full text shown instantly when reduced).

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { SafetyChip } from "./parts";

export function MissionComposer({
  request,
  reducedMotion,
  onSubmit,
  submitted,
}: {
  request: string;
  reducedMotion: boolean;
  onSubmit: () => void;
  submitted: boolean;
}) {
  const [shown, setShown] = useState(reducedMotion ? request.length : 0);

  useEffect(() => {
    if (reducedMotion) {
      setShown(request.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += Math.max(1, Math.round(request.length / 90));
      setShown((prev) => {
        const next = Math.min(request.length, Math.max(prev, i));
        if (next >= request.length) window.clearInterval(id);
        return next;
      });
    }, 26);
    return () => window.clearInterval(id);
  }, [request, reducedMotion]);

  const typing = shown < request.length;

  return (
    <div className="pd-composer pd-animate-rise" data-testid="mission-composer">
      <div className="pd-composer__bar">
        <span className="pd-dot" style={{ background: "var(--pd-graphite)" }} />
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--pd-ink-2)" }}>Confier une mission à Pierre</span>
        <span style={{ marginLeft: "auto" }}>
          <SafetyChip>Démonstration · aucune action réelle</SafetyChip>
        </span>
      </div>
      <p className="pd-composer__body" aria-live="polite">
        {request.slice(0, shown)}
        {typing ? <span className="pd-caret pd-pulse" aria-hidden /> : null}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "0 16px 16px", alignItems: "center" }}>
        <button
          type="button"
          className="pd-btn pd-btn-primary"
          onClick={onSubmit}
          data-step-id="confier-mission"
          disabled={submitted}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {submitted ? "Mission confiée" : "Confier la mission à Pierre"}
          {!submitted ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </button>
        <span style={{ fontSize: "0.76rem", color: "var(--pd-ink-4)" }}>
          Démonstration interactive · environ 2 min
        </span>
      </div>
    </div>
  );
}
