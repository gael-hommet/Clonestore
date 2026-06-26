"use client";

// E2.10 — Passage vers la preuve : scène épinglée + passe de conversion.
// Le système se condense dans une mission unique → 3 bénéfices → CTA violet.

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { MissionCard } from "../primitives/MissionCard";
import { DemoCTALink } from "../primitives/DemoCTA";
import { FounderAccessStatus } from "../primitives/FounderAccessStatus";
import { useSceneView } from "../primitives/useSceneView";
import { SHARED_MISSION_LAYOUT_ID } from "../shared";
import { SCENE_COMPLETION, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";

const RECAP = SCENE_COMPLETION.recap;
// Anneau compact : confiné dans la zone (minHeight 300) sous le titre, jamais dessus.
const RING = RECAP.map((_, i) => {
  const angle = (-90 + i * (360 / RECAP.length)) * (Math.PI / 180);
  return { x: Math.round(250 * Math.cos(angle)), y: Math.round(128 * Math.sin(angle)) };
});

// Bénéfices courts (autorisés par la passe de conversion ; reformulent le sens
// déjà verrouillé, sans nouvelle promesse chiffrée).
const BENEFITS = [
  "Le travail RH opérationnel est pris en charge.",
  "Les actions sensibles restent sous contrôle.",
  "Chaque étape reste visible et traçable.",
];

function CompletionStage({
  onTransition,
  onDirectReservation,
}: {
  onTransition?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onDirectReservation?: () => void;
}) {
  const { step, pinned } = useScene();
  const ctaRef = useSceneView<HTMLDivElement>(DEMO_EVENTS.pierreCtaVisible, 0.4);
  const condensed = step >= 1;

  return (
    <div className="mx-auto w-full max-w-[1040px] text-center">
      <h2 className="demo-title demo-title--compact-long mx-auto max-w-[880px]" data-demo-title>
        <span className="block">{SCENE_COMPLETION.title[0]}</span>
        <span className="block"><span className="demo-accent">{SCENE_COMPLETION.title[1]}</span></span>
      </h2>

      <p className="demo-statement mx-auto mt-4 !max-w-[34ch] !text-[1.3rem]">
        {SCENE_COMPLETION.paragraphs[5]} {SCENE_COMPLETION.paragraphs[6]}
      </p>

      {/* Le système se condense dans une seule mission. La carte joue son climax à
          l'étape 1 ; à l'étape de conversion (≥2) son ESPACE se résorbe en douceur
          (grid-rows 1fr→0fr) pour laisser la place aux bénéfices + au CTA — sans saut
          de mise en page ni empilement transitoire (sinon, le CTA est coupé en bas). */}
      <div
        className="relative mx-auto mt-7 flex items-center justify-center"
        style={{ minHeight: pinned && step < 2 ? 300 : undefined }}
      >
        {pinned
          ? RECAP.map((label, i) => (
              <div key={label} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  initial={false}
                  animate={{ x: condensed ? 0 : RING[i].x, y: condensed ? 0 : RING[i].y, opacity: condensed ? 0 : 1, scale: condensed ? 0.6 : 1 }}
                  transition={{ type: "spring", stiffness: 80, damping: 18, delay: condensed ? 0 : i * 0.03 }}
                >
                  <span className="demo-chip"><span className="demo-chip__dot" aria-hidden="true" />{label}</span>
                </motion.div>
              </div>
            ))
          : (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              {RECAP.map((label) => (<span key={label} className="demo-chip"><span className="demo-chip__dot" aria-hidden="true" />{label}</span>))}
            </div>
          )}

        <div
          className="relative z-10 grid w-[min(100%,440px)]"
          style={
            pinned
              ? { gridTemplateRows: step < 2 ? "1fr" : "0fr", transition: "grid-template-rows 0.55s cubic-bezier(0.22,1,0.36,1)" }
              : undefined
          }
        >
          <div className="min-h-0 overflow-hidden">
            <Appear when={condensed}>
              <MissionCard layoutId={SHARED_MISSION_LAYOUT_ID} showTasks taskCount={4} compact title={SCENE_COMPLETION.recapCard} footnote={false} />
            </Appear>
          </div>
        </div>
      </div>

      {/* Trois bénéfices courts : entrent avec le CTA (étape de conversion) */}
      <Appear when={!pinned || step >= 2} className="demo-cmp-benefits mx-auto mt-8 grid max-w-[920px] gap-2.5 text-left sm:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b} className="flex items-start gap-2.5 rounded-2xl border border-white/60 bg-white/55 p-4 backdrop-blur-md">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-[0.86rem] font-semibold leading-snug text-[var(--cs-ink-1)]">{b}</span>
          </div>
        ))}
      </Appear>

      {/* CTA principal violet + secondaire fondateur */}
      <Appear when={step >= 2} className="demo-cmp-cta mt-9">
        <div ref={ctaRef} className="mx-auto flex max-w-[560px] flex-col items-center gap-4">
          <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="primary" withArrow onClick={onTransition} className="w-full sm:w-auto">
            {SCENE_COMPLETION.primaryCta}
          </DemoCTALink>
          <p className="text-[0.82rem] text-[var(--cs-ink-4)]">{SCENE_COMPLETION.primaryCtaSubtext}</p>
          <div className="mt-2 w-full border-t border-[var(--cs-line-soft)] pt-5">
            <FounderAccessStatus variant="full" onReserve={onDirectReservation} />
          </div>
        </div>
      </Appear>

      <div className="sr-only">
        {SCENE_COMPLETION.paragraphs.map((p) => <p key={p}>{p}</p>)}
        {RECAP.map((r) => <span key={r}>{r} </span>)}
        <p>{SCENE_COMPLETION.recapCard}</p>
      </div>
    </div>
  );
}

export function Scene10PierreTransition({
  onTransition,
  onDirectReservation,
}: {
  onTransition?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onDirectReservation?: () => void;
}) {
  return (
    <PinnedScene id="demo-completion" event={DEMO_EVENTS.completionViewed} ariaLabel="Passage vers la preuve" steps={3} align="top" decor={<SceneDecor />}>
      <CompletionStage onTransition={onTransition} onDirectReservation={onDirectReservation} />
    </PinnedScene>
  );
}
