"use client";

// /demo — ACTE 4 : un résultat concret.
// L'aboutissement naturel de l'histoire : le système n'a pas seulement analysé,
// il a produit, organisé et suivi. Livrables réellement visibles.

import * as React from "react";
import { Lock, Mail, AlertTriangle } from "lucide-react";
import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { MissionCard } from "../primitives/MissionCard";
import { DocumentPreview } from "../primitives/DocumentPreview";
import { CloneBriefCard } from "../primitives/CloneBriefCard";
import { TraceTimeline } from "../primitives/TraceTimeline";
import { useSceneView } from "../primitives/useSceneView";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_SYSTEM } from "@/lib/demo/presentation/content";
import { DEMO_DOCUMENT, DEMO_TRACE, DEMO_DATA_DISCLAIMER } from "@/lib/demo/presentation/fixtures";

export function Act4Result() {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.footprintSectionViewed);
  const { brief } = SCENE_SYSTEM;
  return (
    <section ref={ref} id="demo-act-result" className="demo-section demo-cv" aria-label="Le résultat : le travail réellement produit">
      <div className="demo-shell">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="demo-kicker">Le résultat</p>
          <h2 className="demo-title demo-title--section mt-3">
            Pierre n&apos;a pas seulement produit des documents.
            <br />
            <span className="demo-accent">Il a pris en charge une partie de la semaine RH.</span>
          </h2>
          <p className="demo-lede mx-auto mt-3 max-w-2xl">
            Une seule demande — et Pierre a organisé plusieurs missions en parallèle, coordonné leurs dépendances,
            préparé les documents et les communications, signalé ce qui manquait et gardé chaque mission active.
          </p>
        </Reveal>

        <div className="mt-9 grid gap-4 lg:grid-cols-2 lg:items-start">
          <Reveal>
            <MissionCard showTasks taskCount={4} footnote={false} />
          </Reveal>
          <Reveal delay={0.08}>
            <DocumentPreview
              title={DEMO_DOCUMENT.title}
              meta={DEMO_DOCUMENT.meta}
              body={DEMO_DOCUMENT.body}
              disclaimer={DEMO_DOCUMENT.disclaimer}
            />
          </Reveal>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
          <Reveal className="lg:col-span-1">
            <CloneBriefCard
              title={brief.title}
              lines={brief.lines}
              decisionTitle={brief.decisionTitle}
              decision={brief.decision}
            />
          </Reveal>
          <Reveal delay={0.06} className="lg:col-span-1">
            <div className="grid gap-4">
              <GlassSurface kind="read" weight="card" className="rounded-[1.4rem] p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--demo-violet)]" aria-hidden="true" />
                  <p className="text-[0.82rem] font-semibold text-[var(--cs-ink-1)]">Message à la manager — prêt</p>
                </div>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--cs-ink-2)]">
                  « Bonjour Hélène, tout est prêt pour l&apos;arrivée de Clara lundi. Voici le récapitulatif et les
                  points qui attendent votre validation. »
                </p>
                <p className="mt-2 text-[0.7rem] font-medium text-[var(--demo-amber)]">Brouillon — envoyé après validation.</p>
              </GlassSurface>
              <div className="flex items-start gap-2.5 rounded-[1.4rem] border border-[rgba(184,74,74,0.22)] bg-[rgba(184,74,74,0.06)] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-danger)]" aria-hidden="true" />
                <p className="text-[0.8rem] leading-relaxed text-[var(--cs-ink-2)]">
                  <strong className="text-[var(--cs-ink-1)]">Information manquante&nbsp;:</strong> matériel attribué.
                  Pierre la signale et bloque la tâche — il ne l&apos;invente jamais.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="lg:col-span-1">
            <GlassSurface kind="material" weight="card" className="rounded-[1.4rem] p-4">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
                CloneTrace — l&apos;historique
              </p>
              <div className="mt-3">
                <TraceTimeline entries={DEMO_TRACE} />
              </div>
            </GlassSurface>
          </Reveal>
        </div>

        <Reveal delay={0.06} className="mx-auto mt-8 max-w-2xl text-center">
          <p className="demo-statement">Vous ne voyez pas une tâche isolée : vous voyez le modèle d&apos;une fonction RH prise en charge — plusieurs missions absorbées en parallèle, dans la durée, ce qui mobiliserait autrement plusieurs collaborateurs.</p>
          <p className="mt-3 flex items-center justify-center gap-2 text-[0.72rem] text-[var(--cs-ink-4)]">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {DEMO_DATA_DISCLAIMER}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
