"use client";

// E2.7 — Confiance : scène comparative. Une action réelle entre dans un système
// de décision, bifurque vers exécuter / préparer / valider / bloquer.

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ShieldCheck, ListChecks, Ban, FileSignature } from "lucide-react";
import { PinnedScene, SceneDecor, useScene, SceneSwap } from "../primitives/pinned";
import { GlassSurface } from "../primitives/GlassSurface";
import { ValidationCard } from "../primitives/ValidationCard";
import { StatusBadge } from "../primitives/status";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_TRUST } from "@/lib/demo/presentation/content";

const OUTCOME_TONES = ["ok", "info", "warn", "block"] as const;
const OUTCOME_ICONS = [ShieldCheck, ListChecks, FileSignature, Ban] as const;

function ContextBlock() {
  return (
    <div>
      <div className="rounded-2xl border border-white/60 bg-white/50 px-5 py-3.5 text-center backdrop-blur-md">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">Demande</p>
        <p className="mt-1 text-[0.95rem] font-medium text-[var(--cs-ink-1)]">{SCENE_TRUST.exampleMission}</p>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {SCENE_TRUST.context.map((c) => <span key={c} className="demo-chip">{c}</span>)}
      </div>
      <p className="mt-3 text-center demo-lede mx-auto">{SCENE_TRUST.contextMessage}</p>
    </div>
  );
}

function PermissionsBlock() {
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {SCENE_TRUST.permissions.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/55 p-4 backdrop-blur-md">
            <span className="text-[0.86rem] font-semibold text-[var(--cs-ink-1)]">{p.label}</span>
            <StatusBadge tone={p.tone}>{p.verdict}</StatusBadge>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-0.5 text-center">
        {SCENE_TRUST.permissionMessage.map((m) => <p key={m} className="demo-lede mx-auto">{m}</p>)}
      </div>
    </div>
  );
}

function OutcomesBlock() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {SCENE_TRUST.outcomes.map((o, i) => {
          const tone = OUTCOME_TONES[i];
          const Icon = OUTCOME_ICONS[i];
          return (
            <div key={o} className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center",
              tone === "ok" && "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.07)] text-[var(--demo-green)]",
              tone === "info" && "border-[rgba(84,119,255,0.22)] bg-[rgba(84,119,255,0.07)] text-[#375bd8]",
              tone === "warn" && "border-[rgba(156,102,26,0.22)] bg-[rgba(156,102,26,0.07)] text-[var(--demo-amber)]",
              tone === "block" && "border-[rgba(184,74,74,0.22)] bg-[rgba(184,74,74,0.07)] text-[var(--demo-danger)]",
            )}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[0.78rem] font-semibold">{o}</span>
            </div>
          );
        })}
      </div>
      {/* La validation arrive au premier plan */}
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
        <ValidationCard action="Envoyer l'avenant préparé pour Clara Martin." fields={SCENE_TRUST.validationCard} />
      </motion.div>
    </div>
  );
}

function RefusalBlock() {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-[rgba(184,74,74,0.24)] bg-[rgba(184,74,74,0.05)] p-5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[var(--demo-danger)]">Demande refusée</p>
        <p className="mt-2 text-[0.86rem] italic text-[var(--cs-ink-2)]">&ldquo;{SCENE_TRUST.refusalRequest}&rdquo;</p>
        <div className="mt-3 space-y-1.5">
          {SCENE_TRUST.refusalResponse.map((line, i) => (
            <p key={line} className={cn("text-[0.84rem] leading-relaxed", i === 0 ? "font-semibold text-[var(--demo-danger)]" : "text-[var(--cs-ink-2)]")}>{line}</p>
          ))}
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {["Entreprise A", "Entreprise B", "Entreprise C"].map((n) => (
          <div key={n} className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/45 p-3.5 backdrop-blur-md">
            <ShieldCheck className="h-4 w-4 text-[#375bd8]" aria-hidden="true" />
            <span className="text-[0.8rem] font-semibold text-[var(--cs-ink-1)]">{n}</span>
          </div>
        ))}
      </div>
      <p className="text-center demo-lede mx-auto">{SCENE_TRUST.isolation}</p>
    </div>
  );
}

const STEP_PHRASES = [
  SCENE_TRUST.contextMessage,
  SCENE_TRUST.permissionMessage[0],
  SCENE_TRUST.outcomeMessage[0],
  SCENE_TRUST.conclusion[0],
];

function TrustStage() {
  const { step, pinned } = useScene();
  const blocks = [<ContextBlock key="c" />, <PermissionsBlock key="p" />, <OutcomesBlock key="o" />, <RefusalBlock key="r" />];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
      <div className="space-y-6">
        <h2 className="demo-title demo-title--cinematic" data-demo-title>
          <span className="block">{SCENE_TRUST.title[0]}</span>
          <span className="block"><span className="demo-accent">{SCENE_TRUST.title[1]}</span></span>
        </h2>
        <motion.p key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="demo-statement !text-[1.4rem]">
          {STEP_PHRASES[Math.min(step, 3)]}
        </motion.p>
        <div className="sr-only">
          {SCENE_TRUST.paragraphs.map((p) => <p key={p}>{p}</p>)}
          {SCENE_TRUST.policyRules.map((p) => <p key={p}>{p}</p>)}
          <p>{SCENE_TRUST.policyMessage}</p>
          {SCENE_TRUST.trustLevels.map((p) => <p key={p}>{p}</p>)}
          <p>{SCENE_TRUST.trustMessage}</p>
          {SCENE_TRUST.outcomeMessage.map((p) => <p key={p}>{p}</p>)}
          {SCENE_TRUST.validationMessage.map((p) => <p key={p}>{p}</p>)}
          {SCENE_TRUST.conclusion.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>

      <GlassSurface kind="material" weight="structure" className="rounded-[1.9rem] p-5 sm:p-7">
        {pinned ? (
          <SceneSwap index={Math.min(step, 3)} minHeight={384} items={blocks} />
        ) : (
          <div className="space-y-8">{blocks}</div>
        )}
      </GlassSurface>
    </div>
  );
}

export function Scene07TrustArchitecture() {
  return (
    <PinnedScene
      id="demo-trust"
      event={DEMO_EVENTS.trustSectionViewed}
      ariaLabel="Confiance et gouvernance"
      steps={4}
      decor={<SceneDecor tone="trust" />}
    >
      <TrustStage />
    </PinnedScene>
  );
}
