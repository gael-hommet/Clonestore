"use client";

// /demo — ACTE 5 / CH.6 : CloneGuard en DEUX SECONDES.
// UNE idée, UN contraste : action normale → Pierre exécute ; action sensible →
// Pierre s'arrête et demande une validation humaine. RE-SÉQUENCÉ EN FLUX : les deux
// états sont deux SOUS-SCÈNES successives (jamais concurrents à l'écran). Tout le
// détail — permissions, ValidationCard complète, raison du refus, contexte, règles,
// traçabilité — est rangé derrière une <Disclosure>, jamais affiché en même temps
// que la preuve. Aucune copie inventée : chaque mot vient de SCENE_TRUST.

import * as React from "react";
import { type LucideIcon, Check, ShieldAlert, Plus, ArrowRight, ScrollText, Building2, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { PinnedScene, SceneDecor, Appear } from "../primitives/pinned";
import { CineEyebrow, CineTitle, CineLede, Disclosure } from "../primitives/cine";
import { ValidationCard } from "../primitives/ValidationCard";
import { StatusBadge } from "../primitives/status";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_TRUST } from "@/lib/demo/presentation/content";
import type { DeepDiveTopic } from "../shared";

const TRUST_ID = "demo-act-trust";

// ── Un état de la bascule : l'action, le verdict de Pierre, la conséquence ──────
function ActionState({
  kind,
  action,
  Icon,
  verdict,
  badge,
  badgeTone,
  lede,
  color,
  tint,
  border,
}: {
  kind: string;
  action: string;
  Icon: LucideIcon;
  verdict: string;
  badge: string;
  badgeTone: "ok" | "warn";
  lede: string;
  color: string;
  tint: string;
  border: string;
}) {
  return (
    <div
      className="mx-auto w-full max-w-xl rounded-[1.6rem] border bg-white/70 p-6 text-left shadow-[var(--cs-shadow-soft)] backdrop-blur"
      style={{ borderColor: border }}
    >
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em]" style={{ color }}>
        {kind}
      </p>
      <p className="mt-3 text-[1.12rem] font-semibold leading-snug text-[var(--cs-ink-1)]">
        «&nbsp;{action}&nbsp;»
      </p>
      <div className="mt-4 flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tint, color }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">{verdict}</span>
        <span className="ml-auto">
          <StatusBadge tone={badgeTone}>{badge}</StatusBadge>
        </span>
      </div>
      <p className="mt-3.5 text-[0.95rem] leading-relaxed text-[var(--cs-ink-2)]">{lede}</p>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--cs-line)] bg-white/50 p-4">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">{title}</p>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </section>
  );
}

// ── Le corps : deux MOMENTS successifs (jamais concurrents) → 4 chemins → détail ──
function TrustInner({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  // Re-séquencé en flux : l'action normale (Pierre exécute) puis l'action sensible
  // (Pierre s'arrête) sont deux sous-scènes qui se SUCCÈDENT au scroll — le contraste
  // reste lisible en deux secondes, sans empiler les deux états dans le même cadre.
  const activeOutcome = 2; // au terme du moment sensible : « Demander une validation »

  const cardExecute = (
    <ActionState
      kind="Action normale"
      action={SCENE_TRUST.policyRules[1]}
      Icon={Check}
      verdict="Pierre exécute"
      badge="Exécuté"
      badgeTone="ok"
      lede={SCENE_TRUST.paragraphs[1]}
      color="var(--demo-green)"
      tint="rgba(21, 130, 96, 0.12)"
      border="rgba(21, 130, 96, 0.30)"
    />
  );

  const cardValidate = (
    <ActionState
      kind="Action sensible"
      action={SCENE_TRUST.refusalRequest}
      Icon={ShieldAlert}
      verdict={"Pierre s'arrête"}
      badge="Validation humaine"
      badgeTone="warn"
      lede={SCENE_TRUST.paragraphs[2]}
      color="var(--demo-amber)"
      tint="rgba(156, 102, 26, 0.12)"
      border="rgba(156, 102, 26, 0.32)"
    />
  );

  return (
    <div className="demo-shell">
      {/* ── Sous-scène d'ouverture : l'idée du chapitre ── */}
      <div className="cine-sub">
        <CineEyebrow n="09">CloneGuard</CineEyebrow>
        <CineTitle>
          {SCENE_TRUST.title[0]}{" "}
          <span className="cine-accent">{SCENE_TRUST.title[1]}</span>
        </CineTitle>
        <CineLede>{SCENE_TRUST.paragraphs[7]}</CineLede>
      </div>

      {/* ── MOMENT 1 : l'action normale — Pierre exécute ── */}
      <Appear when className="w-full">
        <div className="cine-sub">{cardExecute}</div>
      </Appear>

      {/* ── MOMENT 2 : l'action sensible — Pierre s'arrête ── */}
      <Appear when className="w-full">
        <div className="cine-sub">{cardValidate}</div>
      </Appear>

      <div className="cine-sub" style={{ minHeight: "clamp(220px, 34svh, 420px)" }}>
      {/* Les 4 chemins possibles d'une action — celui du moment sensible s'allume. */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {SCENE_TRUST.outcomes.map((o, i) => {
          const on = i === activeOutcome;
          return (
            <span
              key={o}
              className={cn(
                "rounded-full border px-3 py-1 text-[0.8rem] font-semibold transition-colors",
                on
                  ? "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                  : "border-[var(--cs-line)] bg-white/40 text-[var(--cs-ink-4)]",
              )}
            >
              {o}
            </span>
          );
        })}
      </div>
      <p className="max-w-xl text-[0.9rem] leading-relaxed text-[var(--cs-ink-3)]">
        {SCENE_TRUST.outcomeMessage[0]} {SCENE_TRUST.outcomeMessage[1]}
      </p>

      {/* Un seul CTA principal. */}
      <button
        type="button"
        onClick={() => onDeepDive("cloneguard")}
        className="demo-btn demo-btn-ghost"
        style={{ minHeight: 40 }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Détailler CloneGuard
      </button>

      {/* DÉTAIL SECONDAIRE — permissions, ValidationCard complète, raison du refus. */}
      <Disclosure summary="Voir le détail — permissions, validation, refus">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailBlock title="Permissions">
            <div className="grid gap-1.5">
              {SCENE_TRUST.permissions.map((p) => (
                <div key={p.label} className="flex items-center gap-2 rounded-lg border border-white/65 bg-white/55 px-2.5 py-1.5">
                  <StatusBadge tone={p.tone}>{p.verdict}</StatusBadge>
                  <span className="text-[0.82rem] text-[var(--cs-ink-2)]">{p.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[0.84rem] leading-relaxed text-[var(--cs-ink-3)]">
              {SCENE_TRUST.permissionMessage[0]} {SCENE_TRUST.permissionMessage[1]}
            </p>
          </DetailBlock>

          <DetailBlock title="Refus">
            <div className="rounded-xl border border-[rgba(184,74,74,0.22)] bg-[rgba(184,74,74,0.06)] p-3">
              <p className="text-[0.82rem] font-medium text-[var(--cs-ink-1)]">«&nbsp;{SCENE_TRUST.refusalRequest}&nbsp;»</p>
              <p className="mt-1.5 text-[0.82rem] font-semibold text-[var(--demo-danger)]">{SCENE_TRUST.refusalResponse[0]}</p>
              <p className="mt-1 text-[0.82rem] text-[var(--cs-ink-2)]">{SCENE_TRUST.refusalResponse[1]}</p>
              <p className="mt-1 text-[0.82rem] text-[var(--cs-ink-2)]">{SCENE_TRUST.refusalResponse[2]}</p>
            </div>
            <p className="text-[0.84rem] leading-relaxed text-[var(--cs-ink-3)]">{SCENE_TRUST.paragraphs[3]}</p>
          </DetailBlock>
        </div>

        {/* La ValidationCard complète : ce que Pierre prépare quand il s'arrête. */}
        <div className="mt-3">
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
            Ce que Pierre prépare — validation humaine attendue
          </p>
          <ValidationCard action={SCENE_TRUST.exampleMission} fields={SCENE_TRUST.validationCard} />
          <p className="mt-2.5 text-[0.84rem] leading-relaxed text-[var(--cs-ink-3)]">
            {SCENE_TRUST.validationMessage[0]} {SCENE_TRUST.validationMessage[1]}
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <DetailBlock title="Contexte">
            <p className="text-[0.84rem] leading-relaxed text-[var(--cs-ink-3)]">{SCENE_TRUST.paragraphs[0]}</p>
            <p className="text-[0.84rem] text-[var(--cs-ink-3)]">{SCENE_TRUST.contextMessage}</p>
            <div className="flex flex-wrap gap-1.5">
              {SCENE_TRUST.context.map((c) => (
                <span key={c} className="demo-chip">{c}</span>
              ))}
            </div>
          </DetailBlock>

          <DetailBlock title="Règles">
            <p className="text-[0.84rem] text-[var(--cs-ink-3)]">{SCENE_TRUST.policyMessage}</p>
            <ul className="space-y-1.5">
              {SCENE_TRUST.policyRules.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[0.82rem] text-[var(--cs-ink-2)]">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--demo-violet)]" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
            <p className="text-[0.84rem] font-medium text-[var(--cs-ink-2)]">
              {SCENE_TRUST.paragraphs[4]} {SCENE_TRUST.paragraphs[5]}
            </p>
          </DetailBlock>

          <DetailBlock title="Autonomie">
            <p className="text-[0.84rem] text-[var(--cs-ink-3)]">{SCENE_TRUST.trustMessage}</p>
            <div className="flex flex-wrap gap-1.5">
              {SCENE_TRUST.trustLevels.map((t) => (
                <span key={t} className="demo-chip">{t}</span>
              ))}
            </div>
          </DetailBlock>

          <DetailBlock title="Traçabilité">
            <p className="text-[0.84rem] text-[var(--cs-ink-3)]">{SCENE_TRUST.paragraphs[6]}</p>
            <div className="flex flex-wrap gap-1.5">
              {SCENE_TRUST.traceSteps.map((t) => (
                <span key={t} className="demo-chip">{t}</span>
              ))}
            </div>
          </DetailBlock>
        </div>

        <p className="mt-3 text-[0.84rem] leading-relaxed text-[var(--cs-ink-3)]">{SCENE_TRUST.isolation}</p>

        {/* Approfondir ailleurs — liens secondaires, hors du CTA principal. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDeepDive("clonetrace")}
            className="demo-btn demo-btn-ghost"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
          >
            <ScrollText className="h-3.5 w-3.5" aria-hidden /> Détailler CloneTrace
          </button>
          <button
            type="button"
            onClick={() => onDeepDive("sizing")}
            className="demo-btn demo-btn-ghost"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden /> Adaptation à la taille
          </button>
          <button
            type="button"
            onClick={() => onDeepDive("frontier")}
            className="demo-btn demo-btn-ghost"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
          >
            <Scale className="h-3.5 w-3.5" aria-hidden /> {"Pierre / vous : la frontière"}
          </button>
        </div>
      </Disclosure>

      {/* Conclusion — la promesse tenue par l'architecture. */}
      <CineLede className="font-medium text-[var(--cs-ink-2)]">
        {SCENE_TRUST.conclusion[0]} {SCENE_TRUST.conclusion[1]}
      </CineLede>
      </div>
    </div>
  );
}

export function Act5Trust({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  return (
    <PinnedScene
      id={TRUST_ID}
      event={DEMO_EVENTS.trustSectionViewed}
      ariaLabel="La confiance : action exécutée ou validation humaine"
      steps={4}
      align="top"
      decor={<SceneDecor tone="trust" />}
    >
      <TrustInner onDeepDive={onDeepDive} />
    </PinnedScene>
  );
}
