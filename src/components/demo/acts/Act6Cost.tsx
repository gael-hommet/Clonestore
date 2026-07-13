"use client";

// /demo — ACTE 6 : le coût de continuer comme avant.
//
// Placement : après la confiance (Acte 5), avant le passage à Pierre (Acte 7).
// Le visiteur sait désormais ce qu'un employé IA exécute (Actes 3 et 4) et sous
// quel contrôle (Acte 5). C'est le seul moment où un raisonnement économique est
// légitime : plus tôt, il chiffrerait une capacité qu'il n'a pas encore vue ;
// plus tard, il arriverait après la décision.
//
// Posture : on montre les deux méthodes, on ne plaide pas. Aucun CTA n'est placé
// dans cet acte — la retenue EST l'argument. La conversion appartient à l'Acte 7.

import * as React from "react";
import { useInView } from "framer-motion";

import { Reveal } from "../primitives/motion";
import { GlassSurface } from "../primitives/GlassSurface";
import { useSceneView } from "../primitives/useSceneView";
import { ScenarioComparator } from "../cost/ScenarioComparator";
import { CapacityCalculator } from "../cost/CapacityCalculator";

import { DEMO_EVENTS, emitDemoEvent } from "@/lib/demo/presentation/analytics";
import { SCENE_COST } from "@/lib/demo/presentation/content";
import { HR_SCENARIOS, OPERATING_DOMAINS } from "@/lib/demo/presentation/operating-model";

export function Act6Cost() {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.costSectionViewed);
  const comparatorRef = React.useRef<HTMLDivElement>(null);
  const comparatorInView = useInView(comparatorRef, { once: true, amount: 0.25 });

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
      {/* Largeur standard de la démo (1240px) : le rail de progression fixe est
          positionné pour cette largeur — un shell élargi passerait DESSOUS lui. */}
      <div className="demo-shell">
        {/* ── Ouverture ── */}
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="demo-kicker">{SCENE_COST.kicker}</p>
          <h2 className="demo-title demo-title--compact-long mt-3">
            {SCENE_COST.title[0]}
            <br />
            <span className="demo-accent">{SCENE_COST.title[1]}</span>
          </h2>
          <p className="demo-lede mx-auto mt-4 max-w-2xl">{SCENE_COST.lede}</p>
        </Reveal>

        {/* ── Le respect dû aux équipes : la phrase centrale, mise en scène ── */}
        <Reveal delay={0.06} className="mt-12">
          <GlassSurface
            kind="material"
            weight="structure"
            className="demo-cost-respect rounded-[1.8rem] p-6 sm:p-9"
          >
            <p className="demo-cost-respect__line">{SCENE_COST.respect[0]}</p>
            <p className="demo-cost-respect__line demo-cost-respect__line--accent">
              {SCENE_COST.respect[1]}
            </p>
            <p className="demo-cost-respect__detail">{SCENE_COST.respectDetail}</p>
          </GlassSurface>
        </Reveal>

        {/* ── Le comparateur ── */}
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

          {/* Le modèle n'appartient pas aux RH : il appartient à CloneStore. */}
          <Reveal delay={0.06} className="mt-8">
            <div className="demo-cost-scope">
              <p className="demo-cost-scope__text">{SCENE_COST.scopeNote}</p>
              <div className="demo-cost-scope__domains">
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
              <p className="demo-note demo-cost-scope__note">
                Les périmètres suivants sont annoncés sans nom, sans prix et sans date : ils ne sont pas
                encore ouverts.
              </p>
            </div>
          </Reveal>
        </div>

        {/* ── La conclusion du comparateur, avant les chiffres ── */}
        <Reveal delay={0.04} className="mx-auto mt-14 max-w-2xl text-center">
          <p className="demo-statement mx-auto">{SCENE_COST.respectConclusion[0]}</p>
          <p className="demo-statement mx-auto mt-1 text-[var(--demo-violet-deep)]">
            {SCENE_COST.respectConclusion[1]}
          </p>
        </Reveal>

        {/* ── Le calculateur ── */}
        <div className="mt-14">
          <CapacityCalculator onAdjust={handleAdjust} />
        </div>

        {/* ── La posture commerciale : on ne plaide pas. ── */}
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
