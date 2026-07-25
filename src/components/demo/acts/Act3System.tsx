"use client";

// /demo — SECTION TECHNOLOGIES : « Tout ce qu'il faut pour travailler vraiment. »
//
// Quinze technologies transversales CloneStore (CloneOS, CloneADN, CloneContinuum,
// ClonePolicy, CloneSignals, CloneGuard, CloneTrace, CloneTrust, CloneReview,
// CloneBrief, CloneLearn, CloneChat, CloneVoice, CloneCall, CloneRoom) en trois
// familles, UNE fiche visible à la fois. Hiérarchie inversée : grand titre HUMAIN
// d'abord, nom propriétaire en sous-titre — le visiteur comprend chaque technologie
// en moins de deux secondes (« Organise / Adapte / Encadre / Prouve… »).
// Pierre n'est PAS un onglet : il est l'employé IA qui mobilise ces technologies
// (le fil de preuve reste la mission de Clara). Statuts honnêtes depuis le registre
// canonique (runtime-technology-registry). Module compact (~1,5 viewport), sans
// sticky, sans dépendance au scroll. Contenu : ./technologies-catalog.ts.

import * as React from "react";
import {
  Boxes, Fingerprint, RefreshCw, Scale, BellRing, ShieldCheck, ScrollText,
  BadgeCheck, FileSearch, ClipboardCheck, GraduationCap, MessagesSquare,
  Mic, Phone, Users, Check, AlertTriangle, Ban, Plus, Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PinnedScene, SceneDecor } from "../primitives/pinned";
import { CineEyebrow, CineTitle, CineLede, Disclosure } from "../primitives/cine";
import { TraceTimeline } from "../primitives/TraceTimeline";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_SYSTEM } from "@/lib/demo/presentation/content";
import { DEMO_TRACE } from "@/lib/demo/presentation/fixtures";
import type { DeepDiveTopic } from "../shared";
import {
  TECH_FAMILIES, TECH_CATALOG, FEATURED_TECH_IDS, TECH_SECTION_HEADER,
  CLONECALL_USAGE_1, CLONECALL_USAGE_2, CLONECALL_GUARDRAIL,
  CLONEOS_COORDINATION, CLONEROOM_SALON,
  type TechEntry, type TechStatus,
} from "./technologies-catalog";

const TECH_ICON: Record<string, LucideIcon> = {
  cloneos: Boxes, cloneadn: Fingerprint, clonecontinuum: RefreshCw, clonepolicy: Scale,
  clonesignals: BellRing, cloneguard: ShieldCheck, clonetrace: ScrollText, clonetrust: BadgeCheck,
  clonereview: FileSearch, clonebrief: ClipboardCheck, clonelearn: GraduationCap,
  clonechat: MessagesSquare, clonevoice: Mic, clonecall: Phone, cloneroom: Users,
};

// Deux statuts publics — la vérité commerciale validée du lancement.
const STATUS_TONE: Record<TechStatus, string> = {
  "Disponible": "border-[rgba(21,130,96,0.35)] bg-[rgba(21,130,96,0.1)] text-[var(--demo-green)]",
  "À venir": "border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]",
};

const CHIP_TONE: Record<string, string> = {
  ok: "border-[rgba(21,130,96,0.3)] bg-[rgba(21,130,96,0.08)] text-[var(--demo-green)]",
  warn: "border-[rgba(156,102,26,0.3)] bg-[rgba(156,102,26,0.08)] text-[var(--demo-amber)]",
  block: "border-[rgba(184,74,74,0.3)] bg-[rgba(184,74,74,0.08)] text-[var(--demo-danger)]",
  neutral: "border-[var(--cs-line)] bg-white/60 text-[var(--cs-ink-2)]",
};

function StatusChip({ status }: { status: TechStatus }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[0.72rem] font-bold", STATUS_TONE[status])}>
      {status}
    </span>
  );
}

/** Preuve principale — UNE preuve concrète par fiche. */
function TechProof({ entry }: { entry: TechEntry }) {
  // Preuves riches (mission Clara, timeline, brief, deux usages CloneCall).
  if (entry.id === "cloneos") {
    // L'ORGANISATION GLOBALE — pas une mission isolée : objectifs, priorités,
    // employés IA, technologies, contexte, dépendances, validations, résultats.
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-[var(--cs-line)] bg-white/60 p-3 text-left">
        <div className="flex flex-wrap gap-1.5">
          {CLONEOS_COORDINATION.chips.map((c) => (
            <span key={c} className="rounded-full border border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.07)] px-2.5 py-0.5 text-[0.73rem] font-medium text-[var(--demo-violet-deep)]">{c}</span>
          ))}
        </div>
        <p className="mt-2 text-[0.76rem] italic leading-snug text-[var(--cs-ink-3)]">{CLONEOS_COORDINATION.example}</p>
        <p className="mt-1.5 text-[0.8rem] font-semibold leading-snug text-[var(--cs-ink-1)]">{CLONEOS_COORDINATION.tagline}</p>
      </div>
    );
  }
  if (entry.id === "cloneroom") {
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-[var(--cs-line)] bg-white/60 p-3 text-left">
        <div className="flex flex-wrap gap-1.5">
          {CLONEROOM_SALON.chips.map((c) => (
            <span key={c} className="rounded-full border border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.07)] px-2.5 py-0.5 text-[0.74rem] font-medium text-[var(--demo-violet-deep)]">{c}</span>
          ))}
        </div>
        <p className="mt-2 text-[0.76rem] italic leading-snug text-[var(--cs-ink-3)]">{CLONEROOM_SALON.exampleTransmission}</p>
        <p className="mt-1.5 text-[0.76rem] leading-snug text-[var(--cs-ink-3)]">{CLONEROOM_SALON.exampleUseCases}</p>
        <p className="mt-1.5 text-[0.7rem] text-[var(--cs-ink-4)]">{CLONEROOM_SALON.futureNote}</p>
      </div>
    );
  }
  if (entry.id === "clonetrace") {
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-[var(--cs-line)] bg-white/60 p-3 text-left">
        <TraceTimeline entries={DEMO_TRACE.slice(0, 4)} />
      </div>
    );
  }
  if (entry.id === "clonebrief") {
    const b = SCENE_SYSTEM.brief;
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-[var(--cs-line)] bg-white/60 p-3 text-left">
        <p className="text-[0.8rem] font-semibold text-[var(--cs-ink-1)]">{b.title}</p>
        <ul className="mt-1.5 space-y-1">
          {[b.lines[0], b.lines[4], b.lines[5]].map((x) => (
            <li key={x} className="flex items-center gap-1.5 text-[0.78rem] text-[var(--cs-ink-2)]">
              <Check className="h-3 w-3 shrink-0 text-[var(--demo-green)]" aria-hidden /> {x}
            </li>
          ))}
        </ul>
        <p className="mt-2 rounded-lg border border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.07)] px-2.5 py-1.5 text-[0.76rem] font-medium text-[var(--demo-violet-deep)]">
          {b.decisionTitle} : {b.decision}
        </p>
      </div>
    );
  }
  if (entry.id === "clonecall") {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-2.5 text-left sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--cs-line)] bg-white/60 p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--demo-violet)]">{CLONECALL_USAGE_1.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {CLONECALL_USAGE_1.items.slice(0, 5).map((x) => (
              <li key={x} className="text-[0.76rem] text-[var(--cs-ink-2)]">· {x}</li>
            ))}
          </ul>
          <p className="mt-2 text-[0.74rem] italic leading-snug text-[var(--cs-ink-3)]">{CLONECALL_USAGE_1.example}</p>
        </div>
        <div className="rounded-xl border border-[var(--cs-line)] bg-white/60 p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--demo-violet)]">{CLONECALL_USAGE_2.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {CLONECALL_USAGE_2.items.slice(0, 5).map((x) => (
              <li key={x} className="text-[0.76rem] text-[var(--cs-ink-2)]">· {x}</li>
            ))}
          </ul>
          <p className="mt-2 text-[0.74rem] italic leading-snug text-[var(--cs-ink-3)]">{CLONECALL_USAGE_2.example}</p>
        </div>
        <p className="flex items-start gap-1.5 rounded-lg border border-[rgba(156,102,26,0.3)] bg-[rgba(156,102,26,0.07)] px-3 py-2 text-[0.76rem] leading-snug text-[var(--cs-ink-2)] sm:col-span-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--demo-amber)]" aria-hidden />
          {CLONECALL_GUARDRAIL}
        </p>
      </div>
    );
  }
  if (entry.id === "cloneguard") {
    const marks = [Check, AlertTriangle, Ban];
    return (
      <div className="mx-auto flex w-full max-w-lg flex-wrap justify-center gap-2">
        {entry.proofChips?.map((c, i) => {
          const M = marks[i] ?? Check;
          return (
            <span key={c.text} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold", CHIP_TONE[c.tone ?? "neutral"])}>
              <M className="h-3.5 w-3.5" aria-hidden /> {c.text}
            </span>
          );
        })}
      </div>
    );
  }
  // Preuves génériques : chips et/ou citation.
  return (
    <div className="mx-auto w-full max-w-lg">
      {entry.proofQuote ? (
        <p className="rounded-xl border border-[var(--cs-line)] bg-white/60 px-3.5 py-2.5 text-[0.86rem] font-medium italic leading-snug text-[var(--cs-ink-1)]">
          {entry.proofQuote}
        </p>
      ) : null}
      {entry.proofChips ? (
        <div className={cn("flex flex-wrap justify-center gap-1.5", entry.proofQuote && "mt-2")}>
          {entry.proofChips.map((c) => (
            <span key={c.text} className={cn("rounded-full border px-2.5 py-1 text-[0.76rem] font-medium", CHIP_TONE[c.tone ?? "neutral"])}>
              {c.text}
            </span>
          ))}
        </div>
      ) : null}
      {entry.proofNote ? <p className="mt-1.5 text-[0.72rem] text-[var(--cs-ink-4)]">{entry.proofNote}</p> : null}
    </div>
  );
}

function SysInner({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  const [index, setIndex] = React.useState(0); // index GLOBAL 0..14
  const entry = TECH_CATALOG[index];
  const Icon = TECH_ICON[entry.id] ?? Boxes;
  const family = TECH_FAMILIES.find((f) => f.id === entry.family)!;
  const familyEntries = TECH_CATALOG.filter((t) => t.family === entry.family);
  const goto = (id: string) => {
    const i = TECH_CATALOG.findIndex((t) => t.id === id);
    if (i >= 0) setIndex(i);
  };

  return (
    <div className="demo-shell">
      {/* ── En-tête de la section ── */}
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <CineEyebrow n="07">Les technologies CloneStore</CineEyebrow>
        <CineTitle size="sm">
          {TECH_SECTION_HEADER.title[0]} <span className="cine-accent">{TECH_SECTION_HEADER.title[1]}</span>
        </CineTitle>
        <CineLede>{TECH_SECTION_HEADER.subtitle}</CineLede>
        <p className="text-[0.86rem] font-medium text-[var(--cs-ink-2)]">{TECH_SECTION_HEADER.pierreLine}</p>
      </div>

      {/* ── Mise en avant : huit technologies (titres humains d'abord) ── */}
      <div className="mx-auto mt-4 grid w-full max-w-3xl grid-cols-2 gap-1.5 sm:grid-cols-4">
        {FEATURED_TECH_IDS.map((id) => {
          const t = TECH_CATALOG.find((x) => x.id === id)!;
          const on = entry.id === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => goto(id)}
              className={cn(
                "rounded-xl border px-2.5 py-2 text-left transition-colors",
                on ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.08)]" : "border-[var(--cs-line)] bg-white/45 hover:border-[var(--cs-ink-4)]",
              )}
            >
              <span className="block text-[0.74rem] font-semibold leading-tight text-[var(--cs-ink-1)]">{t.humanTitle}</span>
              <span className="mt-0.5 block text-[0.64rem] font-medium text-[var(--cs-ink-4)]">{t.name}</span>
            </button>
          );
        })}
      </div>

      {/* ── Navigation : trois familles ── */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Familles de technologies">
        {TECH_FAMILIES.map((f) => {
          const on = f.id === entry.family;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => goto(TECH_CATALOG.find((t) => t.family === f.id)!.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[0.84rem] font-semibold transition-colors",
                on
                  ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                  : "border-[var(--cs-line)] bg-white/45 text-[var(--cs-ink-3)] hover:border-[var(--cs-ink-4)]",
              )}
            >
              {f.nav}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-center text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
        {family.label}
      </p>

      {/* ── Onglets humains de la famille (scroll horizontal mobile) ── */}
      <div
        className="mx-auto mt-2.5 flex max-w-full justify-start gap-1.5 overflow-x-auto pb-1 sm:justify-center"
        role="tablist"
        aria-label={family.label}
        style={{ scrollbarWidth: "thin" }}
      >
        {familyEntries.map((t) => {
          const on = t.id === entry.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => goto(t.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
                on
                  ? "border-[var(--demo-violet)] bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet-deep)]"
                  : "border-[var(--cs-line)] bg-white/45 text-[var(--cs-ink-3)] hover:border-[var(--cs-ink-4)]",
              )}
            >
              {t.tabLabel} <span className="font-medium text-[var(--cs-ink-4)]">· {t.name}</span>
            </button>
          );
        })}
      </div>

      {/* ── LA FICHE — une seule technologie visible ── */}
      <div
        key={entry.id}
        role="tabpanel"
        className="mx-auto mt-3 flex w-full max-w-2xl flex-col items-center gap-2.5 rounded-[1.6rem] border border-[var(--cs-line)] bg-white/55 p-5 text-center backdrop-blur sm:p-6"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(107,99,232,0.12)] text-[var(--demo-violet)]">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--demo-violet)]">{entry.verb}</p>
        <h3 className="text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--cs-ink-1)] sm:text-[1.8rem]">
          {entry.humanTitle}
        </h3>
        <p className="text-[0.8rem] font-semibold text-[var(--cs-ink-4)]">{entry.name} — technologie CloneStore</p>
        <p className="max-w-md text-[0.92rem] leading-snug text-[var(--cs-ink-2)]">{entry.explanation}</p>

        <TechProof entry={entry} />

        <StatusChip status={entry.status} />

        {entry.topic ? (
          <button
            type="button"
            onClick={() => onDeepDive(entry.topic!)}
            className="demo-btn demo-btn-ghost"
            style={{ minHeight: 34, fontSize: "0.8rem", padding: "0 14px" }}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> Voir comment ça fonctionne
          </button>
        ) : null}

        {/* Précédent / Suivant + compteur global */}
        <div className="mt-1 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="demo-btn demo-btn-ghost disabled:opacity-40"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
            aria-label="Technologie précédente"
          >
            ← Précédent
          </button>
          <span className="text-[0.76rem] font-semibold tabular-nums text-[var(--cs-ink-4)]">
            {index + 1} / {TECH_CATALOG.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(TECH_CATALOG.length - 1, i + 1))}
            disabled={index === TECH_CATALOG.length - 1}
            className="demo-btn demo-btn-ghost disabled:opacity-40"
            style={{ minHeight: 34, fontSize: "0.78rem", padding: "0 12px" }}
            aria-label="Technologie suivante"
          >
            Suivant →
          </button>
        </div>
      </div>

      {/* ── Le catalogue complet, sans quinze chapitres verticaux ── */}
      <div className="mx-auto mt-4 max-w-2xl pb-4">
        <Disclosure summary="Découvrir toutes les technologies">
          {TECH_FAMILIES.map((f) => (
            <div key={f.id} className="mb-3">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">{f.label}</p>
              <ul className="mt-1.5 grid gap-1">
                {TECH_CATALOG.filter((t) => t.family === f.id).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--cs-line)] bg-white/50 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => goto(t.id)}
                      className="text-left text-[0.84rem] font-semibold text-[var(--cs-ink-1)] hover:text-[var(--demo-violet-deep)]"
                    >
                      {t.humanTitle}
                    </button>
                    <span className="text-[0.72rem] text-[var(--cs-ink-4)]">{t.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <StatusChip status={t.status} />
                      {t.topic ? (
                        <button
                          type="button"
                          onClick={() => onDeepDive(t.topic!)}
                          className="demo-btn demo-btn-ghost"
                          style={{ minHeight: 26, fontSize: "0.7rem", padding: "0 8px" }}
                        >
                          <Plus className="h-3 w-3" aria-hidden /> Détailler {t.name}
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Disclosure>
      </div>
    </div>
  );
}

export function Act3System({ onDeepDive }: { onDeepDive: (t: DeepDiveTopic) => void }) {
  return (
    <PinnedScene
      id="demo-act-system"
      event={DEMO_EVENTS.systemSectionViewed}
      ariaLabel="Les technologies CloneStore — tout ce qu'il faut pour travailler vraiment"
      steps={6}
      align="top"
      decor={<SceneDecor />}
    >
      <SysInner onDeepDive={onDeepDive} />
    </PinnedScene>
  );
}
