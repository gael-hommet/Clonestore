"use client";

// E2.4 — Système CloneStore : scène épinglée tentpole.
// La MÊME mission traverse les couches et devient progressivement complète.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, Check, AlertTriangle, Ban, Activity, FileCheck2 } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, Appear } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { TraceTimeline } from "../primitives/TraceTimeline";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_SYSTEM } from "@/lib/demo/presentation/content";
import { DEMO_TRACE } from "@/lib/demo/presentation/fixtures";

const LAYERS = SCENE_SYSTEM.layers;

function Chips({ items, tone = "soft" }: { items: readonly string[]; tone?: "soft" | "violet" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((f) => (
        <span
          key={f}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium",
            tone === "violet"
              ? "border-[rgba(107,99,232,0.2)] bg-[rgba(107,99,232,0.07)] text-[var(--demo-violet-deep)]"
              : "border-white/65 bg-white/60 text-[var(--cs-ink-3)]",
          )}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

function Section({ when, label, children }: { when: boolean; label: string; children: React.ReactNode }) {
  return (
    <Appear when={when} className="border-t border-[var(--cs-line-soft)] pt-3">
      <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">{label}</p>
      {children}
    </Appear>
  );
}

function SystemStage() {
  const { step } = useScene();
  const layer = LAYERS[Math.min(step, LAYERS.length - 1)];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
      {/* Couche active : phrase forte */}
      <div className="space-y-6">
        <h2 className="demo-title demo-title--compact-long" data-demo-title>
          <span className="block">{SCENE_SYSTEM.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_SYSTEM.title[1]}</span></span>
        </h2>

        {/* Rail des couches */}
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((l, i) => (
            <span
              key={l.key}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold transition-all",
                i <= step
                  ? "border-[rgba(107,99,232,0.3)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                  : "border-white/55 bg-white/40 text-[var(--cs-ink-4)]",
              )}
            >
              {l.name}
            </span>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--demo-violet-deep)]">
            {layer.name} — {layer.role}
          </p>
          <p className="mt-1.5 text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">{layer.message}</p>
          {layer.secondary ? <p className="mt-1 demo-lede">{layer.secondary}</p> : null}
        </motion.div>

        <Appear when={step >= LAYERS.length - 1}>
          <div className="space-y-0.5">
            {SCENE_SYSTEM.headline.map((h) => (
              <p key={h} className="text-[0.98rem] font-semibold text-[var(--cs-ink-1)]">{h}</p>
            ))}
          </div>
        </Appear>

        <div className="sr-only">
          {SCENE_SYSTEM.paragraphs.map((p) => <p key={p}>{p}</p>)}
          {SCENE_SYSTEM.summary.map((s) => <p key={s}>{s}</p>)}
          {SCENE_SYSTEM.brief.lines.map((l) => <p key={l}>{l}</p>)}
          <p>{SCENE_SYSTEM.brief.decisionTitle} : {SCENE_SYSTEM.brief.decision}</p>
          <p>{SCENE_SYSTEM.transition}</p>
        </div>
      </div>

      {/* La mission qui devient complète (≈60% de la scène) */}
      <GlassSurface kind="material" weight="structure" sheen className="rounded-[1.9rem] p-5 sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Mission créée</p>
            <p className="text-[1rem] font-semibold text-[var(--cs-ink-1)]">{LAYERS[0].missionTitle}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {/* CloneOS — structure */}
          <Appear when={step >= 0}>
            <Chips items={LAYERS[0].facts} />
          </Appear>

          {/* CloneADN — identité & règles */}
          <Section when={step >= 1} label="CloneADN — adapté à l'entreprise">
            <Chips items={LAYERS[1].facts} tone="violet" />
          </Section>

          {/* CloneGuard — trois trajectoires */}
          <Section when={step >= 2} label="CloneGuard — autonomie encadrée">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { t: LAYERS[2].facts[0], i: Check, c: "ok" },
                { t: LAYERS[2].facts[1], i: AlertTriangle, c: "warn" },
                { t: LAYERS[2].facts[2], i: Ban, c: "block" },
              ].map(({ t, i: Icon, c }) => (
                <div
                  key={t}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[0.72rem] font-semibold",
                    c === "ok" && "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.08)] text-[var(--demo-green)]",
                    c === "warn" && "border-[rgba(156,102,26,0.22)] bg-[rgba(156,102,26,0.08)] text-[var(--demo-amber)]",
                    c === "block" && "border-[rgba(184,74,74,0.22)] bg-[rgba(184,74,74,0.08)] text-[var(--demo-danger)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t}
                </div>
              ))}
            </div>
          </Section>

          {/* Pierre — exécution */}
          <Section when={step >= 3} label="Pierre — exécute le travail RH">
            <Chips items={LAYERS[3].facts} />
          </Section>

          {/* CloneTrace — timeline */}
          <Section when={step >= 4} label="CloneTrace — chaque étape retrouvable">
            <div className="flex items-center gap-2 text-[0.78rem] text-[var(--cs-ink-3)]">
              <Activity className="h-3.5 w-3.5 text-[#375bd8]" aria-hidden="true" />
              <TraceTimeline entries={DEMO_TRACE.slice(0, 3)} />
            </div>
          </Section>

          {/* CloneBrief — restitution */}
          <Section when={step >= 5} label="CloneBrief — l'essentiel restitué">
            <div className="flex items-start gap-2 rounded-xl border border-[rgba(107,99,232,0.18)] bg-[rgba(107,99,232,0.05)] p-3">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
              <div className="text-[0.78rem] text-[var(--cs-ink-2)]">
                <span className="font-semibold">{SCENE_SYSTEM.brief.title}</span>
                <span className="text-[var(--cs-ink-4)]"> — {SCENE_SYSTEM.brief.lines[0]}, {SCENE_SYSTEM.brief.lines[3]}.</span>
              </div>
            </div>
          </Section>
        </div>
      </GlassSurface>
    </div>
  );
}

export function Scene04CloneSystem() {
  return (
    <PinnedScene
      id="demo-system"
      event={DEMO_EVENTS.systemSectionViewed}
      ariaLabel="Système CloneStore"
      steps={6}
      align="top"
      decor={<SceneDecor />}
    >
      <SystemStage />
    </PinnedScene>
  );
}
