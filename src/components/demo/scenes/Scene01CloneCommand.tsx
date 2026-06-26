"use client";

// E2.1 — Ouverture : scène épinglée, composition CENTRÉE, large et respirante.
// Une demande devient une mission, sous le texte (pas dans une colonne étroite).

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Terminal, Sparkles, CalendarClock, Users, ShieldCheck } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { TaskCard } from "../primitives/TaskCard";
import { DemoCTALink } from "../primitives/DemoCTA";
import { FounderAccessStatus } from "../primitives/FounderAccessStatus";
import { SCENE_OPENING, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";
import { DEMO_MISSION, DEMO_DATA_DISCLAIMER } from "@/lib/demo/presentation/fixtures";
import { emitDemoEvent, DEMO_EVENTS } from "@/lib/demo/presentation/analytics";

/** Indicateur de défilement (première vue) : main translucide CloneStore, index vers le
 *  bas, respiration douce. Décoratif (aria-hidden), respecte prefers-reduced-motion.
 *  Disparaît en fondu dès que la première carte entre (step ≥ 1). */
function ScrollCue({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="demo-scrollcue"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <motion.span
            className="demo-scrollcue__hand"
            animate={reduce ? undefined : { y: [0, 7, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg viewBox="0 0 40 52" className="h-[52px] w-10" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18 4c-1.66 0-3 1.34-3 3v14.4l-3.1-3.3c-1.18-1.26-3.16-1.3-4.38-.08-1.2 1.2-1.22 3.12-.06 4.34l7.9 8.9C16.92 33.05 19.2 34 21.6 34h2.9c4.7 0 8.5-3.8 8.5-8.5V15.2c0-1.66-1.34-3-3-3-.62 0-1.2.19-1.68.51C28.07 11.18 26.86 10 25.4 10c-.7 0-1.34.27-1.82.71C23.13 9.18 21.93 8 20.5 8c-.55 0-1.06.16-1.5.43V7c0-1.66-1.34-3-3-3z"
              />
            </svg>
          </motion.span>
          <span className="demo-scrollcue__text">Faites défiler pour découvrir</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function HeroStage({ onDirectPierre }: { onDirectPierre?: () => void }) {
  const { step, pinned } = useScene();

  function handlePrimary() {
    emitDemoEvent(DEMO_EVENTS.started, { scene: "E2.1" }, { once: true });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center text-center">
      <p className="demo-kicker">{SCENE_OPENING.brandLine}</p>

      <h1 className="demo-title demo-title--hero mt-4 mx-auto max-w-[1120px]" data-demo-title="">

        <span className="block">{SCENE_OPENING.title[0]}</span>
        <span className="block">
          <span className="demo-accent">{SCENE_OPENING.title[1]}</span>
        </span>
      </h1>

      <p className="demo-lede mx-auto mt-5 max-w-[780px] text-[var(--cs-ink-3)]">
        {SCENE_OPENING.subtext}
      </p>

      {/* Composition large sous le texte : commande → mission */}
      <div className="mt-7 w-full max-w-[940px] space-y-4 text-left">
        <Appear when={step >= 1}>
          <GlassSurface kind="material" weight="structure" sheen className="rounded-[1.6rem] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[var(--cs-ink-4)]">
              <Terminal className="h-4 w-4 text-[var(--demo-violet)]" aria-hidden="true" />
              <span className="text-[0.64rem] font-bold uppercase tracking-[0.18em]">Barre de commande CloneStore</span>
            </div>
            <p className="mt-2.5 text-[0.98rem] leading-relaxed text-[var(--cs-ink-1)] sm:text-[1.05rem]">
              {SCENE_OPENING.initialMission}
              <motion.span
                aria-hidden="true"
                className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[var(--demo-violet)]"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
              />
            </p>
            <Appear when={step >= 2} className="mt-3.5">
              <div className="flex flex-wrap gap-2">
                {[
                  SCENE_OPENING.comprehension.understood,
                  SCENE_OPENING.comprehension.mobilized,
                  SCENE_OPENING.comprehension.organized,
                  SCENE_OPENING.comprehension.validation,
                ].map((label) => (
                  <span key={label} className="demo-chip">
                    <span className="demo-chip__dot" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </Appear>
          </GlassSurface>
        </Appear>

        <Appear when={step >= 2} className="demo-hero-mission">
          <GlassSurface kind="floating" weight="structure" className="rounded-[1.6rem] p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Mission CloneStore</p>
                <p className="text-[0.98rem] font-semibold text-[var(--cs-ink-1)]">{DEMO_MISSION.title}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="demo-chip"><CalendarClock className="h-3.5 w-3.5 text-[var(--cs-ink-3)]" aria-hidden="true" />Échéance {DEMO_MISSION.deadline}</span>
              <span className="demo-chip"><Users className="h-3.5 w-3.5 text-[var(--cs-ink-3)]" aria-hidden="true" />{DEMO_MISSION.intervenants} intervenants</span>
              <span className="demo-chip"><ShieldCheck className="h-3.5 w-3.5 text-[var(--demo-amber)]" aria-hidden="true" />{DEMO_MISSION.validations} validation</span>
            </div>
            <div className="demo-hero-tasks mt-3.5 grid gap-2.5 sm:grid-cols-2">
              {DEMO_MISSION.tasks.slice(0, 4).map((task, i) => (
                <Appear key={task.id} when={step >= 3}>
                  <motion.div transition={{ delay: i * 0.06 }}>
                    <TaskCard task={task} index={i} />
                  </motion.div>
                </Appear>
              ))}
            </div>
            <p className="mt-3 text-[0.7rem] text-[var(--cs-ink-4)]">{DEMO_DATA_DISCLAIMER}</p>
          </GlassSurface>
        </Appear>
      </div>

      {/* CTA */}
      <Appear when={step >= 3} className="mt-8 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <DemoCTALink href="#demo-fragmentation" variant="primary" hero withArrow onClick={handlePrimary}>
            {SCENE_OPENING.primaryCta}
          </DemoCTALink>
          <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="secondary" onClick={onDirectPierre}>
            {SCENE_OPENING.secondaryCta}
          </DemoCTALink>
        </div>
        <FounderAccessStatus variant="compact" />
      </Appear>

      {/* Indicateur « faire défiler » : visible uniquement sur la première vue épinglée
          (titre seul), disparaît en fondu dès qu'une carte entre en scène. */}
      <ScrollCue show={pinned && step === 0} />
    </div>
  );
}

export function Scene01CloneCommand({ onDirectPierre }: { onDirectPierre?: () => void }) {
  return (
    <PinnedScene id="demo-opening" steps={4} align="top" ariaLabel="Ouverture — CloneStore" decor={<SceneDecor />}>
      <HeroStage onDirectPierre={onDirectPierre} />
    </PinnedScene>
  );
}
