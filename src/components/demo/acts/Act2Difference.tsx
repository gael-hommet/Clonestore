"use client";

// /demo — ACTE 2 : montrer la différence, presque sans lecture.
// Une même demande traverse trois systèmes : logiciel, assistant IA, employé IA.
// Le contraste doit être compris visuellement.

import * as React from "react";
import { AppWindow, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { useSceneView } from "../primitives/useSceneView";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_CATEGORY } from "@/lib/demo/presentation/content";

const SHARED_REQUEST = "« Clara rejoint l'équipe commerciale lundi. Préparez son arrivée. »";

const LANES = [
  {
    key: "logiciel",
    Icon: AppWindow,
    kind: "read" as const,
    title: "Un logiciel",
    sub: "Vous fournit un espace et des fonctions.",
    provides: ["Dossier", "Document", "Calendrier", "Tâches", "Messagerie"],
    outcome: "Votre équipe doit encore retrouver, coordonner, relancer, vérifier et rendre compte.",
    highlight: false,
  },
  {
    key: "assistant",
    Icon: MessageSquare,
    kind: "read" as const,
    title: "Un assistant IA",
    sub: "Répond à une demande ponctuelle.",
    provides: ["Réponse", "Checklist", "Résumé"],
    outcome: "Il s'arrête quand la conversation s'arrête. Vous exécutez ensuite tout le travail.",
    highlight: false,
  },
  {
    key: "employe",
    Icon: Sparkles,
    kind: "material" as const,
    title: "Un employé IA CloneStore",
    sub: "Reçoit un objectif et prend en charge la mission.",
    provides: ["Comprend", "Organise", "Prépare", "Exécute", "Attend", "Relance", "Fait valider", "Trace"],
    outcome: "La demande devient une mission organisée, exécutée, suivie et contrôlée jusqu'au résultat.",
    highlight: true,
  },
];

export function Act2Difference() {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.categorySectionViewed);
  return (
    <section
      ref={ref}
      id="demo-act-difference"
      className="demo-section demo-cv"
      aria-label="Logiciel, assistant IA, employé IA — la différence"
    >
      <div className="demo-shell">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="demo-kicker">La différence</p>
          <h2 className="demo-title demo-title--section mt-3">
            Un outil attend une action.
            <br />
            <span className="demo-accent">Un employé IA prend en charge le travail.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-6 max-w-2xl">
          <div className="flex items-center justify-center gap-2 rounded-full border border-[var(--cs-line)] bg-white/60 px-4 py-2 text-center">
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">La même demande</span>
            <span className="text-[0.86rem] font-medium text-[var(--cs-ink-1)]">{SHARED_REQUEST}</span>
          </div>
        </Reveal>

        <Stagger className="mt-8 grid gap-4 md:grid-cols-3" step={0.12}>
          {LANES.map((lane) => (
            <StaggerItem key={lane.key}>
              <GlassSurface
                kind={lane.kind}
                weight="card"
                className={`h-full rounded-[1.5rem] p-5 ${lane.highlight ? "ring-2 ring-[var(--demo-violet-soft)]" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      lane.highlight
                        ? "bg-[rgba(107,99,232,0.14)] text-[var(--demo-violet)]"
                        : "bg-white/70 text-[var(--cs-ink-3)]"
                    }`}
                  >
                    <lane.Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[0.92rem] font-semibold text-[var(--cs-ink-1)]">{lane.title}</p>
                    {lane.highlight ? (
                      <span className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--demo-violet)]">
                        CloneStore
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-[0.8rem] text-[var(--cs-ink-3)]">{lane.sub}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {lane.provides.map((p) => (
                    <span
                      key={p}
                      className={`rounded-full border px-2.5 py-0.5 text-[0.68rem] font-medium ${
                        lane.highlight
                          ? "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.08)] text-[var(--demo-violet-deep)]"
                          : "border-white/70 bg-white/55 text-[var(--cs-ink-3)]"
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <div
                  className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[0.78rem] leading-snug ${
                    lane.highlight
                      ? "bg-[rgba(107,99,232,0.08)] text-[var(--cs-ink-1)]"
                      : "bg-white/50 text-[var(--cs-ink-2)]"
                  }`}
                >
                  <ArrowRight
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${lane.highlight ? "text-[var(--demo-violet)]" : "text-[var(--cs-ink-4)]"}`}
                    aria-hidden="true"
                  />
                  <span>{lane.outcome}</span>
                </div>
              </GlassSurface>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1} className="mx-auto mt-7 max-w-2xl space-y-1 text-center">
          {SCENE_CATEGORY.conclusion.map((line, i) => (
            <p key={line} className={i === 2 ? "demo-statement" : "demo-lede mx-auto"}>
              {line}
            </p>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
