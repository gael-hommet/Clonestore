"use client";

// E2.6 — Échelle : scène comparative. La caméra recule à travers 4 organisations.
// Le sélecteur 1–49 / 50–249 / 250–999 / 1 000+ modifie réellement la scène.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PinnedScene, SceneDecor, useScene } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_SCALE } from "@/lib/demo/presentation/content";
import { DEMO_DATA_DISCLAIMER } from "@/lib/demo/presentation/fixtures";

const TIERS = SCENE_SCALE.tiers;

function asLines(m: string | readonly string[]): readonly string[] {
  return typeof m === "string" ? [m] : m;
}

function TierCard({ index }: { index: number }) {
  const tier = TIERS[index];
  const isEnterprise = tier.key === "enterprise";
  return (
    <GlassSurface kind={isEnterprise ? "material" : "floating"} weight="structure" materialize={false} className="rounded-[1.7rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[1.2rem] font-semibold text-[var(--cs-ink-1)]">{tier.label}</p>
        <span className="text-[0.74rem] font-medium text-[var(--cs-ink-4)]">{tier.detail}</span>
      </div>

      {"actions" in tier && tier.actions && tier.actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tier.actions.map((a) => (
            <span key={a} className="rounded-full border border-white/65 bg-white/60 px-2.5 py-0.5 text-[0.72rem] font-medium text-[var(--cs-ink-3)]">{a}</span>
          ))}
        </div>
      ) : null}

      {"metrics" in tier && tier.metrics ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {tier.metrics.map((m) => {
              const [value, ...rest] = m.split(" ");
              return (
                <div key={m} className="demo-scale-metric rounded-xl border border-white/60 bg-white/55 px-3 py-3 text-center">
                  <p className="text-[1.25rem] font-bold tracking-tight text-[var(--cs-ink-1)]">{value}</p>
                  <p className="text-[0.64rem] leading-tight text-[var(--cs-ink-4)]">{rest.join(" ")}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[0.66rem] text-[var(--cs-ink-4)]">{DEMO_DATA_DISCLAIMER}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-0.5">
        {asLines(tier.message).map((line) => <p key={line} className="text-[0.92rem] font-medium text-[var(--cs-ink-1)]">{line}</p>)}
        {"messageSecondary" in tier && tier.messageSecondary ? (
          <p className="pt-1 text-[0.84rem] text-[var(--cs-ink-3)]">{tier.messageSecondary}</p>
        ) : null}
      </div>
    </GlassSurface>
  );
}

function ScaleStage() {
  const { step, pinned } = useScene();
  const [manual, setManual] = React.useState<number | null>(null);

  // Le scroll reprend la main après un choix manuel
  React.useEffect(() => { setManual(null); }, [step]);

  const idx = pinned ? Math.min(manual ?? step, TIERS.length - 1) : (manual ?? -1);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        <h2 className="demo-title demo-title--cinematic" data-demo-title>
          <span className="block">{SCENE_SCALE.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_SCALE.title[1]}</span></span>
        </h2>
        <p className="demo-lede mx-auto mt-4">{SCENE_SCALE.paragraphs[5]}</p>
      </div>

      {/* Sélecteur facultatif — modifie la scène */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Sélecteur facultatif</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SCENE_SCALE.selector.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={idx === i}
              onClick={() => {
                setManual(i);
                if (!pinned) document.getElementById(`demo-tier-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold transition-all",
                idx === i
                  ? "border-[rgba(107,99,232,0.3)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                  : "border-white/65 bg-white/55 text-[var(--cs-ink-3)] hover:text-[var(--cs-ink-1)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recul de caméra (desktop) : un seul niveau, qui rétrécit en s'éloignant */}
      {pinned ? (
        <div className="demo-scale-stage relative mt-7" style={{ perspective: 1200 }}>
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 - idx * 0.035 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <TierCard index={idx} />
          </motion.div>
          <div className="mt-3.5 flex items-center justify-center gap-2 text-[0.64rem] font-semibold text-[var(--cs-ink-4)]">
            <span>Plan rapproché</span>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--cs-line)]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--demo-violet),#8b84ff)]" style={{ width: `${((idx + 1) / TIERS.length) * 100}%` }} />
            </div>
            <span>{"Vue d'ensemble"}</span>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {TIERS.map((_, i) => (
            <div key={i} id={`demo-tier-${i}`} className={cn("rounded-[1.7rem] transition-all", idx === i && "ring-2 ring-[rgba(107,99,232,0.35)] ring-offset-2 ring-offset-transparent")}>
              <TierCard index={i} />
            </div>
          ))}
        </div>
      )}

      <div className="demo-scale-outro mx-auto mt-7 max-w-2xl space-y-1 text-center">
        {SCENE_SCALE.conclusion.map((line, i) => (
          <p key={line} className={cn(i === 0 ? "text-[1.05rem] font-semibold text-[var(--cs-ink-1)]" : "text-[0.92rem] text-[var(--cs-ink-3)]")}>{line}</p>
        ))}
      </div>

      <div className="sr-only">
        {SCENE_SCALE.paragraphs.map((p) => <p key={p}>{p}</p>)}
        {SCENE_SCALE.transition.map((q) => <p key={q}>{q}</p>)}
      </div>
    </div>
  );
}

export function Scene06OrganizationScale() {
  return (
    <PinnedScene
      id="demo-scale"
      event={DEMO_EVENTS.scaleSectionViewed}
      ariaLabel="Valeur selon la taille"
      steps={4}
      align="top"
      decor={<SceneDecor />}
    >
      <ScaleStage />
    </PinnedScene>
  );
}
