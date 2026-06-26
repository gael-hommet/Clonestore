"use client";

// E2.8 — Pierre RH : scène épinglée tentpole. Un seul dossier collaborateur
// traverse tout le cycle RH ; son contexte s'enrichit ; à la fin, Pierre vs humains.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserRound, Check } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_PIERRE_SCOPE } from "@/lib/demo/presentation/content";
import { DEMO_CONTEXT } from "@/lib/demo/presentation/fixtures";

const D = SCENE_PIERRE_SCOPE.domains;
// Domaines révélés au dossier, par étape du cycle de vie (libellés verrouillés)
const DOSSIER_STEPS: string[][] = [
  [D[0].label],                          // Recrutement
  [D[1].label, "Contrat", D[3].label],   // Onboarding · Contrat · Dossier salarié
  [D[2].label, D[4].label],              // Administration · Absences
  [D[5].label, D[6].label],              // Performance · Formation
  [D[7].label, D[8].label],              // Rémunération · Conformité
  [D[9].label, D[10].label],             // Relations · Offboarding
];
// Phrase forte par étape
const PHRASE_INDEX = [0, 1, 2, 5, 7, 10];

function asLines(m: string | readonly string[]): readonly string[] {
  return typeof m === "string" ? (m ? [m] : []) : m;
}

function ContinuumStage() {
  const { step, steps } = useScene();
  const domain = D[PHRASE_INDEX[Math.min(step, PHRASE_INDEX.length - 1)]];
  const isFinal = step >= steps - 1;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
      <div className="space-y-6">
        <h2 className="demo-title demo-title--compact-long" data-demo-title>
          <span className="block">{SCENE_PIERRE_SCOPE.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_PIERRE_SCOPE.title[1]}</span></span>
        </h2>

        <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--demo-violet-deep)]">{domain.label}</p>
          <div className="mt-1.5 space-y-0.5">
            {asLines(domain.message).map((m) => (
              <p key={m} className="text-[1.02rem] font-semibold text-[var(--cs-ink-1)]">{m}</p>
            ))}
          </div>
        </motion.div>

        <div className="sr-only">
          {SCENE_PIERRE_SCOPE.paragraphs.map((p) => <p key={p}>{p}</p>)}
          {D.flatMap((d) => asLines(d.message)).map((m, i) => <p key={i}>{m}</p>)}
          {SCENE_PIERRE_SCOPE.compression.map((c) => <p key={c}>{c}</p>)}
          {SCENE_PIERRE_SCOPE.finalView.map((v) => <span key={v}>{v} </span>)}
          <p>{SCENE_PIERRE_SCOPE.finalCenter.join(" — ")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Ligne de vie continue */}
        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,var(--cs-line-strong),transparent)]" aria-hidden="true" />
          <div className="relative grid grid-cols-6 gap-1">
            {SCENE_PIERRE_SCOPE.continuum.map((stage, i) => (
              <div key={stage} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[0.66rem] font-bold backdrop-blur-md transition-all",
                    i <= step
                      ? "border-[rgba(107,99,232,0.4)] bg-[rgba(107,99,232,0.14)] text-[var(--demo-violet)]"
                      : "border-white/60 bg-white/55 text-[var(--cs-ink-4)]",
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-[0.6rem] font-semibold leading-tight text-[var(--cs-ink-3)]">{stage}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Le même dossier qui s'enrichit (≈60%) */}
        <GlassSurface kind="material" weight="structure" sheen className="rounded-[1.9rem] p-5 sm:p-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Dossier collaborateur</p>
              <p className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">
                {DEMO_CONTEXT.collaborator} — {DEMO_CONTEXT.role} ({DEMO_CONTEXT.site})
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DOSSIER_STEPS.map((labels, s) =>
              labels.map((label) => (
                <Appear key={label} when={step >= s}>
                  <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/55 px-3 py-2 backdrop-blur-md">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--demo-green)]" aria-hidden="true" />
                    <span className="text-[0.78rem] font-medium text-[var(--cs-ink-2)]">{label}</span>
                  </div>
                </Appear>
              )),
            )}
          </div>
        </GlassSurface>

        {/* Frontière humaine */}
        <Appear when={isFinal} className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[rgba(107,99,232,0.22)] bg-[rgba(107,99,232,0.06)] p-4">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--demo-violet-deep)]">Pierre prend en charge</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {SCENE_PIERRE_SCOPE.frontierPierre.map((f) => (
                <span key={f} className="rounded-full bg-white/60 px-2 py-0.5 text-[0.64rem] font-medium text-[var(--demo-violet-deep)]">{f}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/45 p-4 backdrop-blur-md">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">{"L'entreprise conserve"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {SCENE_PIERRE_SCOPE.frontierCompany.map((f) => (
                <span key={f} className="rounded-full bg-white/60 px-2 py-0.5 text-[0.64rem] font-medium text-[var(--cs-ink-2)]">{f}</span>
              ))}
            </div>
          </div>
        </Appear>
      </div>
    </div>
  );
}

export function Scene08PierreHrContinuum() {
  return (
    <PinnedScene
      id="demo-pierre-scope"
      event={DEMO_EVENTS.pierreScopeSectionViewed}
      ariaLabel="Pierre, fonction RH complète"
      steps={6}
      align="top"
      decor={<SceneDecor />}
    >
      <ContinuumStage />
    </PinnedScene>
  );
}
