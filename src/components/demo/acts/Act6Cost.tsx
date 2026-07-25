"use client";

// /demo — ACTE 6 (refonte cinématographique) : le coût de continuer comme avant.
//
// Refonte : la PREUVE domine désormais l'écran. Le même scénario RH, exécuté de
// deux façons, s'ouvre sur DEUX NOMBRES géants (effort humain mobilisé) — la
// donnée écrite beaucoup plus grand que les légendes. Le détail (le comparateur
// pas-à-pas, le calculateur, la posture) reste, mais révélé progressivement.
//
// Contraintes tenues : aucun CTA (la retenue EST l'argument, conversion = Acte 7),
// aucun prix codé en dur (le moteur lit le tarif canonique), aucune donnée saisie
// n'est jamais émise ({ scene: "cost" } seulement). Design system demo-* réutilisé.

import * as React from "react";
import { useInView } from "framer-motion";

import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { useSceneView } from "../primitives/useSceneView";
import { Disclosure } from "../primitives/cine";
import { ScenarioComparator } from "../cost/ScenarioComparator";
import { CapacityCalculator } from "../cost/CapacityCalculator";

import { DEMO_EVENTS, emitDemoEvent } from "@/lib/demo/presentation/analytics";
import { SCENE_COST } from "@/lib/demo/presentation/content";
import { HR_SCENARIOS, OPERATING_DOMAINS } from "@/lib/demo/presentation/operating-model";

export function Act6Cost() {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.costSectionViewed);
  const comparatorRef = React.useRef<HTMLDivElement>(null);
  // "some" : le comparateur détaillé est plus haut qu'un viewport mobile — un ratio
  // (0.25) pourrait ne jamais être atteint et la révélation ne partirait jamais.
  const comparatorInView = useInView(comparatorRef, { once: true, amount: "some" });

  const [activeScenario, setActiveScenario] = React.useState<string>(HR_SCENARIOS[0].id);

  const handleSelect = React.useCallback((id: string) => {
    setActiveScenario(id);
    emitDemoEvent(DEMO_EVENTS.costScenarioSelected, { scene: "cost" }, { once: true });
  }, []);

  const handleAdjust = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.costCalculatorAdjusted, { scene: "cost" }, { once: true });
  }, []);

  const openDomain = OPERATING_DOMAINS.filter((d) => d.available);
  const nextDomains = OPERATING_DOMAINS.filter((d) => !d.available);

  return (
    <section
      ref={ref}
      id="demo-act-cost"
      className="demo-section demo-section--breath demo-cost"
      aria-label="Le coût de continuer comme avant"
    >
      <div className="demo-shell">
        {/* ── CH.7 — l'ouverture : une idée ── */}
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="demo-kicker">{SCENE_COST.kicker}</p>
          <h2 className="demo-title cine-title mt-3">
            {SCENE_COST.title[0]}
            <br />
            <span className="demo-accent cine-accent">{SCENE_COST.title[1]}</span>
          </h2>
        </Reveal>

        {/* La preuve chiffrée « effort manuel → résidu gouverné » vit désormais dans
            le chapitre VALEUR (juste après le hero) — ici reste la comparaison
            détaillée des deux méthodes, le calculateur et la posture. */}
        <Reveal delay={0.05} className="mx-auto mt-6 max-w-2xl text-center">
          <p className="demo-lede mx-auto">{SCENE_COST.lede}</p>
        </Reveal>

        {/* ── Le respect dû aux équipes — allégé, en une carte ── */}
        <Reveal delay={0.05} className="mx-auto mt-12 max-w-3xl">
          <GlassSurface kind="material" weight="structure" className="demo-cost-respect rounded-[1.8rem] p-6 sm:p-8">
            <p className="demo-cost-respect__line">{SCENE_COST.respect[0]}</p>
            <p className="demo-cost-respect__line demo-cost-respect__line--accent">{SCENE_COST.respect[1]}</p>
            <Disclosure summary="Le travail qui empêche l’expertise" className="mt-4">
              <p className="text-[0.95rem] leading-relaxed text-[var(--cs-ink-2)]">{SCENE_COST.respectDetail}</p>
            </Disclosure>
          </GlassSurface>
        </Reveal>

        {/* ── Le comparateur détaillé : le « voir le détail » de la preuve ── */}
        <div ref={comparatorRef} className="mt-14">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="demo-kicker">{SCENE_COST.comparatorKicker}</p>
            <p className="demo-question mt-3">{SCENE_COST.comparatorTitle}</p>
          </Reveal>

          <div className="mt-8">
            <ScenarioComparator
              scenarios={HR_SCENARIOS}
              activeId={activeScenario}
              onSelect={handleSelect}
              inView={comparatorInView}
            />
          </div>

          <Reveal delay={0.06} className="mt-8">
            <Disclosure summary="Ce modèle n’est pas propre aux RH" className="mx-auto">
              <p className="text-[0.92rem] leading-relaxed text-[var(--cs-ink-2)]">{SCENE_COST.scopeNote}</p>
              <div className="demo-cost-scope__domains mt-3">
                {openDomain.map((domain) => (
                  <span key={domain.id} className="demo-chip">
                    <span className="demo-chip__dot" aria-hidden="true" />
                    {domain.label} — {domain.employee}
                  </span>
                ))}
                {nextDomains.map((domain) => (
                  <span key={domain.id} className="demo-cost-scope__next">
                    {domain.label}
                  </span>
                ))}
              </div>
            </Disclosure>
          </Reveal>
        </div>

        {/* ── La conclusion du comparateur ── */}
        <Reveal delay={0.04} className="mx-auto mt-14 max-w-2xl text-center">
          <p className="demo-statement mx-auto">{SCENE_COST.respectConclusion[0]}</p>
          <p className="demo-statement mx-auto mt-1 text-[var(--demo-violet-deep)]">{SCENE_COST.respectConclusion[1]}</p>
        </Reveal>

        {/* ── CH.8 — le calculateur : vos données, votre verdict ── */}
        <div className="mt-14">
          <CapacityCalculator onAdjust={handleAdjust} />
        </div>

        {/* ── La posture commerciale : on ne plaide pas ── */}
        <Reveal delay={0.04} className="mx-auto mt-16 max-w-3xl">
          <div className="demo-cost-posture">
            <p className="demo-kicker text-center">{SCENE_COST.postureKicker}</p>
            <div className="mt-6 space-y-4">
              {SCENE_COST.posture.map((line) => (
                <p key={line} className="demo-cost-posture__line">
                  {line}
                </p>
              ))}
            </div>

            <p className="demo-cost-posture__statement">{SCENE_COST.postureStatement}</p>

            <div className="demo-cost-posture__close">
              <p>{SCENE_COST.postureConclusion[0]}</p>
              <p className="demo-cost-posture__close-strong">{SCENE_COST.postureConclusion[1]}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
