"use client";

// E2.9 — Organisation : scène épinglée. CloneOS coordonne plusieurs domaines,
// Pierre est le seul actif, les résultats convergent vers une seule mission.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Network, Sparkles, Lock } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_ORGANIZATION } from "@/lib/demo/presentation/content";

const BRANCHES = SCENE_ORGANIZATION.decomposition.map((label, i) => {
  const angle = (-90 + i * (360 / 5)) * (Math.PI / 180);
  return { label, active: i === 0, x: 50 + 38 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
});

function OrgDiagram() {
  const { step } = useScene();
  const decomposed = step >= 1;
  const consolidated = step >= 3;

  return (
    <div className="relative mx-auto hidden sm:block" style={{ width: 560, height: 460 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {BRANCHES.map((b) => (
          <motion.line key={b.label} x1={50} y1={50} x2={b.x} y2={b.y}
            className={cn("demo-flow", !b.active && "demo-flow--soft")}
            initial={false} animate={{ opacity: decomposed && !consolidated ? 1 : 0 }} transition={{ duration: 0.5 }} />
        ))}
      </svg>

      {/* CloneOS : centré pendant la décomposition ; quand la mission se consolide, il
          remonte au-dessus de la carte (orchestrateur), plus compact, sans la recouvrir. */}
      <motion.div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: consolidated ? 0.82 : 1, y: consolidated ? -150 : 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(84,119,255,0.28)] bg-[linear-gradient(135deg,rgba(35,43,58,0.96),rgba(64,82,121,0.92))] px-4 py-2.5 text-white shadow-[0_22px_50px_rgba(38,32,22,0.2)]">
          <Network className="h-4 w-4 text-[#9db4ff]" aria-hidden="true" />
          <span className="text-[0.76rem] font-bold">CloneOS</span>
        </span>
      </motion.div>

      {/* Branches : chaque carte est positionnée par un wrapper absolu ancré au point du
          cercle (left/top % relatifs au diagramme) ; l'apparition/disparition se fait À
          l'intérieur → plus d'empilement ni de doublon. */}
      {BRANCHES.map((b) => (
        <div
          key={b.label}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${b.x}%`, top: `${b.y}%` }}
        >
          <Appear when={decomposed && !consolidated}>
            <div
              className={cn(
                "rounded-2xl border px-3 py-2 backdrop-blur-md",
                b.active
                  ? "border-[rgba(107,99,232,0.3)] bg-white/80 shadow-[0_16px_40px_rgba(38,32,22,0.12)]"
                  : "border-white/45 bg-white/30 opacity-55 [filter:blur(0.3px)]",
              )}
            >
              <div className="flex items-center gap-1.5">
                {b.active
                  ? <Sparkles className="h-3.5 w-3.5 text-[var(--demo-violet)]" aria-hidden="true" />
                  : <Lock className="h-3 w-3 text-[var(--cs-ink-4)]" aria-hidden="true" />}
                <span className={cn("text-[0.74rem] font-bold", b.active ? "text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-4)]")}>{b.label}</span>
              </div>
              {b.active ? <p className="mt-0.5 text-[0.6rem] font-semibold text-[var(--demo-green)]">{SCENE_ORGANIZATION.availableLabel}</p> : null}
            </div>
          </Appear>
        </div>
      ))}

      {/* Mission consolidée — focale centrale (sous CloneOS remonté) */}
      <Appear when={consolidated} className="absolute left-1/2 top-1/2 z-10 w-[min(100%,420px)] -translate-x-1/2 -translate-y-1/2">
        <GlassSurface kind="floating" weight="structure" className="rounded-[1.6rem] p-5 text-center">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Une seule mission</p>
          <p className="mt-1 text-[1.2rem] font-semibold text-[var(--cs-ink-1)]">{SCENE_ORGANIZATION.resultMission}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {SCENE_ORGANIZATION.pillars.map((p) => (
              <span key={p} className="rounded-full border border-white/60 bg-white/55 px-2 py-0.5 text-[0.62rem] font-medium text-[var(--cs-ink-3)]">{p}</span>
            ))}
          </div>
        </GlassSurface>
      </Appear>
    </div>
  );
}

function OrgListMobile() {
  return (
    <div className="grid gap-2.5 sm:hidden">
      {BRANCHES.map((b) => (
        <div key={b.label} className={cn("flex items-center gap-2 rounded-2xl border p-3.5 backdrop-blur-md", b.active ? "border-[rgba(107,99,232,0.3)] bg-white/70" : "border-white/45 bg-white/30 opacity-60")}>
          {b.active ? <Sparkles className="h-4 w-4 text-[var(--demo-violet)]" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5 text-[var(--cs-ink-4)]" aria-hidden="true" />}
          <span className={cn("text-[0.82rem] font-semibold", b.active ? "text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-4)]")}>{b.label}</span>
          {b.active ? <span className="ml-auto rounded-full bg-[rgba(21,130,96,0.12)] px-2 py-0.5 text-[0.6rem] font-bold text-[var(--demo-green)]">{SCENE_ORGANIZATION.availableLabel}</span> : null}
        </div>
      ))}
    </div>
  );
}

function OrgStage() {
  const { step } = useScene();
  const msg =
    step === 0 ? [SCENE_ORGANIZATION.paragraphs[2], SCENE_ORGANIZATION.paragraphs[3]]
    : step === 1 ? SCENE_ORGANIZATION.orchestrationMessage
    : step === 2 ? SCENE_ORGANIZATION.consolidationMessage
    : SCENE_ORGANIZATION.conclusion;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      <div className="space-y-6">
        <h2 className="demo-title demo-title--cinematic" data-demo-title>
          <span className="block">{SCENE_ORGANIZATION.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_ORGANIZATION.title[1]}</span></span>
        </h2>

        <Appear when={step >= 0}>
          <div className="rounded-2xl border border-white/60 bg-white/45 px-4 py-3 backdrop-blur-md">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Demande transversale</p>
            <p className="mt-1 text-[0.92rem] font-medium text-[var(--cs-ink-1)]">{SCENE_ORGANIZATION.crossMission}</p>
          </div>
        </Appear>

        <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-0.5">
          {msg.map((m) => <p key={m} className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">{m}</p>)}
        </motion.div>

        <div className="sr-only">
          {SCENE_ORGANIZATION.paragraphs.map((p) => <p key={p}>{p}</p>)}
          {SCENE_ORGANIZATION.pillars.map((p) => <p key={p}>{p}</p>)}
          {SCENE_ORGANIZATION.evolution.map((p) => <p key={p}>{p}</p>)}
          {SCENE_ORGANIZATION.conclusionLong.map((p) => <p key={p}>{p}</p>)}
          <p>{SCENE_ORGANIZATION.earlyValue}</p>
          <p>{SCENE_ORGANIZATION.governanceMessage}</p>
          {SCENE_ORGANIZATION.footprintMessage.map((p) => <p key={p}>{p}</p>)}
          {SCENE_ORGANIZATION.futureDomains.map((d) => <span key={d}>{d} </span>)}
        </div>
      </div>

      <div>
        <OrgDiagram />
        <OrgListMobile />
      </div>
    </div>
  );
}

export function Scene09CloneOrganization() {
  return (
    <PinnedScene
      id="demo-organization"
      event={DEMO_EVENTS.organizationSectionViewed}
      ariaLabel="Organisation multi-employés"
      steps={4}
      decor={<SceneDecor />}
    >
      <OrgStage />
    </PinnedScene>
  );
}
