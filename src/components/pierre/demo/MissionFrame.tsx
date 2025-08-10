"use client";

// PIERRE FINAL INTERACTIVE DEMO — beats 03 (A REAL MISSION) + 04 (HOW HE WORKS).
// Frames the interactive cockpit so the whole run is readable in ~5s BEFORE the
// prospect touches anything: the real natural-language request, the four-verb
// method, and a staged storyline that mirrors the cockpit phases 1:1. A single
// launch button drops the visitor straight into the live cockpit.

import { MessageSquareText, Brain, ListTree, PlayCircle, PackageCheck, ArrowRight } from "lucide-react";
import { COCKPIT_PHASES, type DemoScenario } from "@/lib/pierre/demo";
import { BeatHeading } from "./parts";

const METHOD = [
  { Icon: MessageSquareText, k: "Comprendre", d: "Il lit la demande, en extrait objectifs et échéances — sans rien inventer." },
  { Icon: Brain, k: "Organiser", d: "Il la transforme en missions, tâches, priorités et validations." },
  { Icon: ListTree, k: "Exécuter", d: "Il fait avancer plusieurs missions en parallèle et produit les documents." },
  { Icon: PackageCheck, k: "Livrer", d: "Il prépare messages et livrables, sollicite la validation utile, poursuit le suivi." },
] as const;

export function MissionFrame({
  scenario,
  started,
  onLaunch,
}: {
  scenario: DemoScenario;
  started: boolean;
  onLaunch: () => void;
}) {
  return (
    <section aria-label="Une vraie mission, du brief au livrable">
      <BeatHeading
        n="03"
        eyebrow="Une vraie mission"
        title="Du brief en langage naturel jusqu'au livrable."
        caption="Voici la demande réelle de ce scénario. Regardez comment Pierre la mène, étape par étape."
      />

      <div className="pd-mission-frame">
        {/* The request, as it actually arrives (breath / product proof) */}
        <figure className="pd-composer pd-mission-frame__req">
          <figcaption className="pd-composer__bar">
            <span className="pd-dot" style={{ background: "#e5715c" }} aria-hidden />
            <span className="pd-dot" style={{ background: "#e6b45c" }} aria-hidden />
            <span className="pd-dot" style={{ background: "#5cb079" }} aria-hidden />
            <span style={{ marginLeft: 8, fontSize: "0.72rem", fontWeight: 700, color: "var(--pd-ink-4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              La demande — langage naturel
            </span>
          </figcaption>
          <blockquote className="pd-composer__body" style={{ margin: 0 }}>
            &ldquo;{scenario.request}&rdquo;
          </blockquote>
        </figure>

        {/* How he works — the four-verb method (beat 04) */}
        <div className="pd-method" aria-label="Comment Pierre travaille">
          <p className="pd-eyebrow" style={{ marginBottom: 2 }}>04 · Comment il travaille</p>
          {METHOD.map((m, i) => (
            <div key={m.k} className="pd-method__row">
              <span className="pd-method__n" aria-hidden>{i + 1}</span>
              <span className="pd-method__ico" aria-hidden><m.Icon className="h-4 w-4" aria-hidden /></span>
              <span>
                <span className="pd-method__k">{m.k}</span>
                <span className="pd-method__d">{m.d}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The staged storyline — mirrors the cockpit phases the prospect is about to drive */}
      <div className="pd-story" role="list" aria-label="Déroulé de la mission">
        {COCKPIT_PHASES.map((p, i) => (
          <div key={p.id} className="pd-story__step" role="listitem">
            <span className="pd-story__n" aria-hidden>{i + 1}</span>
            <span className="pd-story__title">{p.title}</span>
            <span className="pd-story__cap">{p.caption}</span>
            {i < COCKPIT_PHASES.length - 1 ? (
              <span className="pd-story__link" aria-hidden><ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <button type="button" className="pd-btn pd-btn-primary" onClick={onLaunch} data-step-id="mission-launch">
          <PlayCircle className="h-4 w-4" aria-hidden />
          {started ? "Revenir au cockpit" : "Lancer la mission dans le cockpit"}
        </button>
      </div>
    </section>
  );
}
