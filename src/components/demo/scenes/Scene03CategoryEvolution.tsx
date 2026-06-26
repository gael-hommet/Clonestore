"use client";

// E2.3 — Catégorie : scène comparative. Le MÊME objectif traverse quatre états
// dans la même zone (logiciel → automatisation → agent → employé IA).

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserRound } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, SceneSwap } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_CATEGORY } from "@/lib/demo/presentation/content";

const STATES = SCENE_CATEGORY.states;

function StateCard({ index }: { index: number }) {
  const state = STATES[index];
  const isEmployee = state.key === "employe";
  return (
    <GlassSurface
      kind={isEmployee ? "material" : "read"}
      weight="structure"
      materialize={false}
      className={cn("rounded-[1.7rem] p-6 sm:p-8", isEmployee && "demo-sheen")}
    >
      {isEmployee ? <span className="demo-sheen__bar" aria-hidden="true" /> : null}
      <div className="flex items-center justify-between">
        <span className={cn("text-[0.64rem] font-bold uppercase tracking-[0.16em]", isEmployee ? "text-[var(--demo-violet-deep)]" : "text-[var(--cs-ink-4)]")}>
          État {index + 1} / 4
        </span>
        {isEmployee ? <span className="rounded-full bg-[rgba(107,99,232,0.12)] px-2.5 py-0.5 text-[0.62rem] font-bold text-[var(--demo-violet-deep)]">CloneStore</span> : null}
      </div>
      <p className="mt-2 text-[1.5rem] font-semibold tracking-tight text-[var(--cs-ink-1)]">{state.label}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {state.provides.map((p) => (
          <span key={p} className={cn(
            "rounded-full border px-2.5 py-1 text-[0.74rem] font-medium",
            isEmployee ? "border-[rgba(107,99,232,0.2)] bg-[rgba(107,99,232,0.07)] text-[var(--demo-violet-deep)]" : "border-white/65 bg-white/60 text-[var(--cs-ink-3)]",
          )}>{p}</span>
        ))}
      </div>
      <div className="mt-5 space-y-0.5">
        {state.message.map((m) => (
          <p key={m} className={cn("text-[0.92rem]", isEmployee ? "font-semibold text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-3)]")}>{m}</p>
        ))}
      </div>
    </GlassSurface>
  );
}

function CategoryStage() {
  const { step, pinned, steps } = useScene();
  const idx = Math.min(step, STATES.length - 1);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
      <div className="space-y-6">
        <h2 className="demo-title demo-title--cinematic" data-demo-title>
          <span className="block">{SCENE_CATEGORY.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_CATEGORY.title[1]}</span></span>
        </h2>
        <p className="demo-lede">{SCENE_CATEGORY.employeeFollowUp}</p>

        {step >= steps - 1 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[rgba(107,99,232,0.24)] bg-[rgba(107,99,232,0.08)] px-4 py-2">
              <UserRound className="h-4 w-4 text-[var(--demo-violet)]" aria-hidden="true" />
              <span className="text-[0.86rem] font-semibold text-[var(--demo-violet-deep)]">{SCENE_CATEGORY.pierreLabel}</span>
            </div>
            {SCENE_CATEGORY.conclusion.map((c) => <p key={c} className="text-[0.92rem] text-[var(--cs-ink-2)]">{c}</p>)}
          </motion.div>
        ) : null}

        <div className="sr-only">
          {SCENE_CATEGORY.paragraphs.map((p) => <p key={p}>{p}</p>)}
          {SCENE_CATEGORY.pierreLines.map((p) => <p key={p}>{p}</p>)}
          <p>{SCENE_CATEGORY.transition}</p>
        </div>
      </div>

      <div>
        {/* Objectif persistant */}
        <div className="mb-4 rounded-2xl border border-white/60 bg-white/45 px-5 py-3 text-center backdrop-blur-md">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Le même objectif</p>
          <p className="mt-0.5 text-[0.92rem] font-medium text-[var(--cs-ink-1)]">{SCENE_CATEGORY.sharedObjective}</p>
        </div>

        {pinned ? (
          <>
            <SceneSwap index={idx} minHeight={392} items={STATES.map((_, i) => <StateCard key={i} index={i} />)} />
            <div className="mt-4 flex justify-center gap-2">
              {STATES.map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-7 bg-[var(--demo-violet)]" : "w-1.5 bg-[var(--cs-line-strong)]")} />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {STATES.map((_, i) => <StateCard key={i} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function Scene03CategoryEvolution() {
  return (
    <PinnedScene
      id="demo-category"
      event={DEMO_EVENTS.categorySectionViewed}
      ariaLabel="Logiciel, automatisation, agent, employé IA"
      steps={4}
      decor={<SceneDecor />}
    >
      <CategoryStage />
    </PinnedScene>
  );
}
