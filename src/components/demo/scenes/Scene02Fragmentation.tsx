"use client";

// E2.2 — Fragmentation : scène épinglée. Une mission se disperse puis se restructure.

import * as React from "react";
import { motion } from "framer-motion";
import { Layers, Sparkles } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_FRAGMENTATION } from "@/lib/demo/presentation/content";
import { DEMO_MISSION } from "@/lib/demo/presentation/fixtures";

const FRAGMENTS = SCENE_FRAGMENTATION.fragments;
const SCATTER = FRAGMENTS.map((_, i) => {
  const angle = (-90 + i * (360 / FRAGMENTS.length)) * (Math.PI / 180);
  return { x: Math.round(250 * Math.cos(angle)), y: Math.round(205 * Math.sin(angle)) };
});

function FragmentField() {
  const { step, pinned } = useScene();
  const dispersed = step === 1 || step === 2;
  const consolidated = step >= 3;

  if (!pinned) {
    // Composition statique (mobile / reduced-motion) : dispersion → consolidation, en vertical.
    return (
      <div className="space-y-4">
        <GlassSurface kind="read" weight="card" className="rounded-[1.5rem] p-5">
          <div className="flex items-center gap-2 text-[var(--cs-ink-4)]">
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span className="text-[0.64rem] font-bold uppercase tracking-[0.16em]">Le même travail, dispersé</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {FRAGMENTS.map((f) => (
              <span key={f} className="rounded-full border border-white/60 bg-white/55 px-3 py-1 text-[0.74rem] font-medium text-[var(--cs-ink-2)]">
                {f}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCENE_FRAGMENTATION.statuses.map((s) => (
              <span key={s} className="rounded-full border border-[rgba(156,102,26,0.2)] bg-[rgba(156,102,26,0.08)] px-2.5 py-0.5 text-[0.68rem] font-semibold text-[var(--demo-amber)]">
                {s}
              </span>
            ))}
          </div>
        </GlassSurface>
        <ConsolidatedMission />
      </div>
    );
  }

  // Champ animé (desktop épinglé)
  return (
    <div className="relative mx-auto" style={{ width: 620, height: 540 }}>
      {/* Noyau mission au centre */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: consolidated ? 0.001 : 1, opacity: consolidated ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-[rgba(107,99,232,0.28)] bg-[linear-gradient(135deg,rgba(35,43,58,0.96),rgba(64,82,121,0.92))] px-4 py-3 text-white shadow-[0_22px_50px_rgba(38,32,22,0.2)]">
          <Sparkles className="h-4 w-4 text-[#b5afff]" aria-hidden="true" />
          <span className="text-[0.78rem] font-bold">Une demande</span>
        </div>
      </motion.div>

      {/* Fragments qui se dispersent puis convergent */}
      {FRAGMENTS.map((f, i) => (
        <div key={f} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            initial={false}
            animate={{
              x: dispersed ? SCATTER[i].x : 0,
              y: dispersed ? SCATTER[i].y : 0,
              opacity: consolidated ? 0 : dispersed ? 1 : 0.85,
              scale: consolidated ? 0.6 : 1,
            }}
            transition={{ type: "spring", stiffness: 90, damping: 18, delay: dispersed ? i * 0.02 : 0 }}
          >
            <span className="whitespace-nowrap rounded-full border border-white/65 bg-white/80 px-3 py-1 text-[0.72rem] font-semibold text-[var(--cs-ink-2)] shadow-[0_10px_24px_rgba(18,24,36,0.08)] backdrop-blur-md">
              {f}
            </span>
          </motion.div>
        </div>
      ))}

      {/* Statuts d'attente / blocage au pic de dispersion */}
      <Appear when={step === 2} className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2">
        {SCENE_FRAGMENTATION.statuses.map((s) => (
          <span key={s} className="rounded-full border border-[rgba(156,102,26,0.22)] bg-[rgba(156,102,26,0.1)] px-2.5 py-0.5 text-[0.68rem] font-semibold text-[var(--demo-amber)] backdrop-blur-md">
            {s}
          </span>
        ))}
      </Appear>

      {/* Mission restructurée à la convergence */}
      <Appear when={consolidated} className="absolute left-1/2 top-1/2 w-[min(100%,440px)] -translate-x-1/2 -translate-y-1/2">
        <ConsolidatedMission />
      </Appear>
    </div>
  );
}

function ConsolidatedMission() {
  return (
    <GlassSurface kind="floating" weight="structure" className="rounded-[1.6rem] p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Une mission, suivie</p>
          <p className="text-[0.95rem] font-semibold text-[var(--cs-ink-1)]">{DEMO_MISSION.title}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {SCENE_FRAGMENTATION.consolidated.map((c) => (
          <span key={c} className="demo-chip">
            <span className="demo-chip__dot" aria-hidden="true" />
            {c}
          </span>
        ))}
      </div>
    </GlassSurface>
  );
}

function FragmentationStage() {
  const { step } = useScene();
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      <div className="space-y-6">
        <h2 className="demo-title demo-title--cinematic" data-demo-title>
          <span className="block">{SCENE_FRAGMENTATION.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_FRAGMENTATION.title[1]}</span></span>
        </h2>
        <Appear when={step >= 1}>
          <p className="demo-lede">{SCENE_FRAGMENTATION.paragraphs[0]}</p>
        </Appear>
        <Appear when={step >= 2}>
          <p className="demo-statement">{SCENE_FRAGMENTATION.keyPhrase}</p>
        </Appear>
        <Appear when={step >= 3}>
          <p className="demo-lede">{SCENE_FRAGMENTATION.paragraphs[3]}</p>
        </Appear>
        {/* Paragraphes complets, présents dans le DOM */}
        <div className="sr-only">
          {SCENE_FRAGMENTATION.paragraphs.map((p) => <p key={p}>{p}</p>)}
          <p>{SCENE_FRAGMENTATION.zones.join(" · ")}</p>
        </div>
      </div>
      <FragmentField />
    </div>
  );
}

export function Scene02Fragmentation() {
  return (
    <PinnedScene
      id="demo-fragmentation"
      event={DEMO_EVENTS.problemSectionViewed}
      ariaLabel="Fragmentation du travail"
      steps={4}
      decor={<SceneDecor />}
    >
      <FragmentationStage />
    </PinnedScene>
  );
}
