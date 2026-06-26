"use client";

// E2.5 — Empreinte Entreprise : scène épinglée. La cartographie occupe le centre,
// les dimensions apparaissent en vagues, puis l'Empreinte transforme un livrable.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, FileText, Check } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_FOOTPRINT } from "@/lib/demo/presentation/content";

const BRANCHES = [
  { label: "Structure", x: 24, y: 24, wave: 0, dims: ["Identité", "Sites", "Équipes", "Rôles", "Responsables"] },
  { label: "Règles", x: 76, y: 24, wave: 1, dims: ["Politiques", "Validations", "Autonomie"] },
  { label: "Documents", x: 24, y: 78, wave: 1, dims: ["Documents", "Chartes"] },
  { label: "Habitudes", x: 76, y: 78, wave: 2, dims: ["Ton", "Outils", "Préférences", "Habitudes"] },
] as const;

function EmpreinteMap() {
  const { step } = useScene();
  return (
    <div className="demo-footprint hidden sm:block">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {BRANCHES.map((b) => (
          <motion.line
            key={b.label}
            x1={50} y1={50} x2={b.x} y2={b.y}
            className="demo-flow"
            initial={false}
            animate={{ opacity: step >= b.wave ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-[rgba(107,99,232,0.28)] bg-[linear-gradient(135deg,rgba(35,43,58,0.96),rgba(64,82,121,0.92))] px-4 py-2.5 text-white shadow-[0_22px_50px_rgba(38,32,22,0.2)]">
        <Sparkles className="h-4 w-4 text-[#b5afff]" aria-hidden="true" />
        <span className="text-[0.76rem] font-bold">Empreinte Entreprise</span>
      </div>

      {BRANCHES.map((b) => (
        <Appear key={b.label} when={step >= b.wave}>
          <div className="demo-footprint__node demo-float" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            <span className="demo-chip__dot" aria-hidden="true" />
            {b.label}
          </div>
        </Appear>
      ))}

      {/* Dimensions en vagues, regroupées par branche */}
      <Appear when={step >= 0} className="absolute inset-x-2 bottom-1 flex flex-wrap justify-center gap-1">
        {BRANCHES.flatMap((b) =>
          b.dims.map((d) => (
            <span
              key={d}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[0.6rem] font-medium transition-all duration-500",
                step >= b.wave
                  ? "border-white/60 bg-white/60 text-[var(--cs-ink-3)] opacity-100"
                  : "border-transparent bg-transparent text-transparent opacity-0",
              )}
            >
              {d}
            </span>
          )),
        )}
      </Appear>
    </div>
  );
}

function EmpreinteList() {
  return (
    <div className="grid gap-2.5 sm:hidden">
      {BRANCHES.map((b) => (
        <div key={b.label} className="rounded-2xl border border-white/60 bg-white/55 p-3.5 backdrop-blur-md">
          <p className="text-[0.78rem] font-bold text-[var(--cs-ink-1)]">{b.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {b.dims.map((d) => (
              <span key={d} className="rounded-full border border-white/65 bg-white/60 px-2 py-0.5 text-[0.64rem] text-[var(--cs-ink-3)]">{d}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FootprintStage() {
  const { step } = useScene();
  const transformed = step >= 3;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      <div className="space-y-6">
        <h2 className="demo-title demo-title--cinematic" data-demo-title>{SCENE_FOOTPRINT.title[0]}</h2>
        <Appear when={step >= 0}>
          <p className="demo-lede">{SCENE_FOOTPRINT.paragraphs[1]}</p>
        </Appear>
        <Appear when={step >= 3} className="space-y-3">
          <p className="demo-statement">{SCENE_FOOTPRINT.conclusion[1]}</p>
          <p className="demo-lede">{SCENE_FOOTPRINT.conclusion[2]}</p>
        </Appear>
        <div className="sr-only">
          {SCENE_FOOTPRINT.paragraphs.map((p) => <p key={p}>{p}</p>)}
          {SCENE_FOOTPRINT.genericMessage.map((m) => <p key={m}>{m}</p>)}
          {SCENE_FOOTPRINT.timeline.map((t) => <p key={t}>{t}</p>)}
          <p>{SCENE_FOOTPRINT.learningMessage}</p>
          <p>{SCENE_FOOTPRINT.documentMessage}</p>
          {SCENE_FOOTPRINT.privacy.map((p) => <p key={p}>{p}</p>)}
          {SCENE_FOOTPRINT.dimensions.map((d) => <span key={d}>{d} </span>)}
        </div>
      </div>

      <div className="space-y-4">
        <GlassSurface kind="material" weight="structure" sheen className="rounded-[1.9rem] p-5 sm:p-7">
          <EmpreinteMap />
          <EmpreinteList />
        </GlassSurface>

        {/* Document générique → document de l'entreprise */}
        <GlassSurface kind={transformed ? "floating" : "read"} weight="card" materialize={false} className="rounded-[1.5rem] p-4">
          <div className="flex items-center gap-2">
            <FileText className={cn("h-4 w-4", transformed ? "text-[var(--demo-violet)]" : "text-[var(--cs-ink-4)]")} aria-hidden="true" />
            <p className="text-[0.8rem] font-semibold text-[var(--cs-ink-1)]">
              {transformed ? "Document de votre entreprise" : "Document générique"}
            </p>
          </div>
          <Appear when={!transformed} className={transformed ? "hidden" : "mt-3 space-y-1.5"}>
            <div className="h-1.5 w-full rounded-full bg-[var(--cs-line)]" />
            <div className="h-1.5 w-4/5 rounded-full bg-[var(--cs-line)]" />
            <div className="h-1.5 w-3/5 rounded-full bg-[var(--cs-line)]" />
          </Appear>
          <Appear when={transformed} className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {SCENE_FOOTPRINT.documentDims.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full border border-[rgba(107,99,232,0.2)] bg-[rgba(107,99,232,0.07)] px-2 py-0.5 text-[0.66rem] font-medium text-[var(--demo-violet-deep)]">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {d}
                </span>
              ))}
            </div>
          </Appear>
        </GlassSurface>
      </div>
    </div>
  );
}

export function Scene05EnterpriseFootprint() {
  return (
    <PinnedScene
      id="demo-footprint"
      event={DEMO_EVENTS.footprintSectionViewed}
      ariaLabel="Empreinte Entreprise"
      steps={4}
      align="top"
      decor={<SceneDecor />}
    >
      <FootprintStage />
    </PinnedScene>
  );
}
