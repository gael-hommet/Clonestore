"use client";

// /demo — ACTE 3 : le système dans l'action.
// Une même mission (Clara) s'enrichit à mesure que chaque technologie agit.
// Chaque technologie : signature distincte, rôle en une phrase, preuve immédiate
// sur la carte, et un détail facultatif (tiroir).

import * as React from "react";
import { motion } from "framer-motion";
import { Boxes, Fingerprint, ShieldCheck, ScrollText, Check, AlertTriangle, Ban, Plus, RefreshCw } from "lucide-react";
import { PinnedScene, useScene, Appear, SceneDecor } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { TraceTimeline } from "../primitives/TraceTimeline";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_SYSTEM } from "@/lib/demo/presentation/content";
import { DEMO_TRACE } from "@/lib/demo/presentation/fixtures";
import type { DeepDiveTopic } from "../shared";

const STEPS = [
  { tech: "CloneOS", Icon: Boxes, topic: "cloneos" as DeepDiveTopic, role: "Organise le travail", line: "Votre objectif devient des missions, des tâches, des dépendances, des responsables et des échéances." },
  { tech: "CloneADN", Icon: Fingerprint, topic: "empreinte" as DeepDiveTopic, role: "Adapte à votre entreprise", line: "Pierre a déjà les compétences RH. L'Empreinte lui apprend comment votre entreprise veut qu'elles soient appliquées." },
  { tech: "CloneGuard", Icon: ShieldCheck, topic: "cloneguard" as DeepDiveTopic, role: "Encadre l'autonomie", line: "Jamais aveugle : chaque action est exécutée, préparée, soumise à validation ou bloquée, selon vos règles." },
  { tech: "CloneTrace", Icon: ScrollText, topic: "clonetrace" as DeepDiveTopic, role: "Suit et trace", line: "Pierre garde la mission active, reprend et relance ; chaque action et décision reste vérifiable." },
];

function SysInner({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  const { step } = useScene();
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const osFacts = SCENE_SYSTEM.layers[0].facts;
  const adnFacts = SCENE_SYSTEM.layers[1].facts;

  return (
    <div className="demo-shell grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
      {/* Left — narration + current technology signature */}
      <div>
        <h2 className="demo-title demo-title--cinematic">
          {SCENE_SYSTEM.headline[0]}
          <br />
          <span className="demo-accent">{SCENE_SYSTEM.headline[1]}</span>
        </h2>
        <p className="demo-lede mt-3 max-w-md">
          Un agent exécute une action. Ces systèmes en font un employé IA qui prend en charge la mission.
        </p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {STEPS.map((t, i) => (
            <span
              key={t.tech}
              className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors ${
                i <= step
                  ? "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                  : "border-[var(--cs-line)] bg-white/40 text-[var(--cs-ink-4)]"
              }`}
            >
              {t.tech}
            </span>
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 rounded-2xl border border-[var(--cs-line)] bg-white/60 p-4"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
              <s.Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.92rem] font-semibold text-[var(--cs-ink-1)]">{s.tech}</p>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--demo-violet)]">{s.role}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[0.84rem] leading-snug text-[var(--cs-ink-2)]">{s.line}</p>
          <button
            type="button"
            onClick={() => onDeepDive(s.topic)}
            className="demo-btn demo-btn-ghost mt-3"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Détailler {s.tech}
          </button>
        </motion.div>
      </div>

      {/* Right — the mission accumulates as each technology acts */}
      <GlassSurface kind="material" weight="structure" sheen className="overflow-hidden rounded-[1.7rem]">
        <div className="border-b border-[var(--cs-line-soft)] bg-white/45 px-5 py-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">Mission</p>
          <p className="text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{SCENE_SYSTEM.layers[0].missionTitle}</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          {/* CloneOS — organise */}
          <Appear when={step >= 0}>
            <SectionRow label="CloneOS · organise" chips={osFacts} tone="os" />
          </Appear>
          {/* CloneADN — adapte */}
          <Appear when={step >= 1}>
            <SectionRow label="CloneADN · adapte à votre entreprise" chips={adnFacts} tone="adn" />
          </Appear>
          {/* Pierre + CloneGuard — exécute / encadre */}
          <Appear when={step >= 2}>
            <div className="rounded-xl border border-white/65 bg-white/50 p-3">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">
                Pierre exécute · CloneGuard encadre
              </p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                <Outcome Icon={Check} tone="ok" label="Exécution autorisée" />
                <Outcome Icon={AlertTriangle} tone="warn" label="Validation requise" />
                <Outcome Icon={Ban} tone="block" label="Action bloquée" />
              </div>
            </div>
          </Appear>
          {/* CloneContinuum + CloneTrace */}
          <Appear when={step >= 3}>
            <div className="rounded-xl border border-white/65 bg-white/50 p-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-[var(--demo-violet)]" aria-hidden="true" />
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">
                  CloneContinuum · la mission reste active — CloneTrace · tout est tracé
                </p>
              </div>
              <div className="mt-2">
                <TraceTimeline entries={DEMO_TRACE.slice(0, 4)} />
              </div>
            </div>
          </Appear>
        </div>
      </GlassSurface>
    </div>
  );
}

function SectionRow({ label, chips, tone }: { label: string; chips: readonly string[]; tone: "os" | "adn" }) {
  const violet = tone === "adn";
  return (
    <div className="rounded-xl border border-white/65 bg-white/50 p-3">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c}
            className={`rounded-full border px-2.5 py-0.5 text-[0.68rem] font-medium ${
              violet
                ? "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.08)] text-[var(--demo-violet-deep)]"
                : "border-white/70 bg-white/60 text-[var(--cs-ink-3)]"
            }`}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function Outcome({ Icon, tone, label }: { Icon: typeof Check; tone: "ok" | "warn" | "block"; label: string }) {
  const color =
    tone === "ok" ? "var(--demo-green)" : tone === "warn" ? "var(--demo-amber)" : "var(--demo-danger)";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/65 bg-white/60 px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden="true" />
      <span className="text-[0.72rem] font-medium text-[var(--cs-ink-2)]">{label}</span>
    </div>
  );
}

export function Act3System({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  return (
    <PinnedScene
      id="demo-act-system"
      event={DEMO_EVENTS.systemSectionViewed}
      ariaLabel="Le système CloneStore au travail"
      steps={4}
      align="top"
      decor={<SceneDecor />}
    >
      <SysInner onDeepDive={onDeepDive} />
    </PinnedScene>
  );
}
