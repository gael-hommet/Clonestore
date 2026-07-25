"use client";

// /demo — CH.3 (refonte cinématographique) : « Une demande. Pierre en fait une mission. »
//
// UNE idée pleine cadre : une demande RH libre (le fil conducteur Clara) devient une
// MISSION STRUCTURÉE (objectif → tâches → dépendances → personnes → validations →
// échéances) — un schéma qui se CONSTRUIT au scroll (PinnedScene + Appear).
//
// Le comparatif logiciel / assistant · agent IA / employé IA (jadis trois colonnes
// concurrentes) descend en <Disclosure> : UNE approche visible dans le fil, le détail
// des quatre approches replié. Tout le texte reste tiré de SCENE_CATEGORY (le contraste
// « fournir des fonctions » vs « prendre en charge un périmètre ») et de la mission
// structurée de SCENE_SYSTEM.layers[0]. Aucune copie inventée, aucune substance retirée.

import * as React from "react";
import {
  Target,
  ArrowRight,
  Sparkles,
  ListChecks,
  GitBranch,
  Users,
  ShieldCheck,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { PinnedScene, SceneDecor, Appear, useScene } from "../primitives/pinned";
import { CineScene, CineEyebrow, CineTitle, CineLede, Disclosure } from "../primitives/cine";
import { SCENE_CATEGORY, SCENE_SYSTEM, SCENE_FRAGMENTATION } from "@/lib/demo/presentation/content";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";

// ── CH.3 — LE PROBLÈME : le travail se disperse, puis se réunit ────────────────
// (déplacé depuis Act1 : l'ordre devient hero → valeur → problème → différence).
function DispersedScene() {
  return (
    <CineScene>
      <CineEyebrow n="04">Le travail dispersé</CineEyebrow>
      <CineTitle>
        Le travail ne manque pas. <span className="cine-accent">Il se disperse.</span>
      </CineTitle>

      {/* Nuage de fragments — dispersés sur plusieurs outils, tous lisibles. */}
      <ul className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
        {SCENE_FRAGMENTATION.fragments.map((frag, i) => (
          <li
            key={frag}
            className="rounded-full border border-[var(--cs-line)] bg-white/60 px-3 py-1.5 text-[0.82rem] text-[var(--cs-ink-2)]"
            style={{ transform: `rotate(${((i % 5) - 2) * 1.4}deg)` }}
          >
            {frag}
            <span className="ml-1.5 text-[0.7rem] text-[var(--cs-ink-4)]">
              · {SCENE_FRAGMENTATION.zones[i % SCENE_FRAGMENTATION.zones.length]}
            </span>
          </li>
        ))}
      </ul>

      {/* Réunion : tous ces éclats deviennent UNE mission suivie. */}
      <Appear when className="w-full">
        <div className="cine-focus">
          <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--demo-violet)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Réuni dans une mission claire
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SCENE_FRAGMENTATION.consolidated.map((c) => (
              <li key={c} className="rounded-lg border border-white/70 bg-white/70 px-3 py-1.5 text-[0.84rem] font-medium text-[var(--cs-ink-1)]">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Appear>

      <CineLede>{SCENE_FRAGMENTATION.keyPhrase}</CineLede>
    </CineScene>
  );
}

// Le fil conducteur : la MÊME demande RH libre traverse toute la scène.
const SHARED_REQUEST = "« Clara rejoint l'équipe commerciale lundi. Préparez son arrivée. »";

// Rôle de chaque fait de la mission structurée (schéma « objectif → … → échéances »).
// Les LIBELLÉS de valeur restent tirés du constant SCENE_SYSTEM.layers[0].facts ;
// seule la catégorie + l'icône (structure du schéma) est ajoutée ici.
const MISSION_META: { kind: string; Icon: LucideIcon }[] = [
  { kind: "Tâches", Icon: ListChecks },
  { kind: "Dépendances", Icon: GitBranch },
  { kind: "Personnes", Icon: Users },
  { kind: "Validations", Icon: ShieldCheck },
  { kind: "Échéances", Icon: CalendarClock },
];

const MISSION_FACTS = SCENE_SYSTEM.layers[0].facts.map((text, i) => {
  const meta = MISSION_META[i] ?? MISSION_META[MISSION_META.length - 1];
  return { text, kind: meta.kind, Icon: meta.Icon };
});

// ── La scène : la demande se transforme en mission, un fait après l'autre ──────
function DifferenceScene() {
  const { step, steps } = useScene();
  // Combien de morceaux de la mission ont « claqué » en place (révélation au scroll).
  const shown = Math.max(1, Math.round(((step + 1) / steps) * MISSION_FACTS.length));
  const built = step >= steps - 1;

  return (
    <CineScene>
      <CineEyebrow n="05">La différence</CineEyebrow>

      <CineTitle>
        {SCENE_CATEGORY.title[0]}
        <br />
        <span className="cine-accent">{SCENE_CATEGORY.title[1]}</span>
      </CineTitle>

      {/* Le fil conducteur — la même demande, toujours visible. */}
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-1.5 rounded-2xl border border-[var(--cs-line)] bg-white/60 px-4 py-2.5 text-center sm:flex-row sm:justify-center sm:gap-3">
        <span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
          La même demande
        </span>
        <span className="text-[0.9rem] font-medium text-[var(--cs-ink-1)]">{SHARED_REQUEST}</span>
      </div>

      {/* HÉRO — la demande devient une mission structurée qui se construit au scroll. */}
      <div className="cine-focus">
        <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
          <Target className="h-3.5 w-3.5 text-[var(--demo-violet)]" aria-hidden="true" />
          Objectif confié
        </p>
        <p className="mt-2 text-[1.05rem] font-semibold leading-snug text-[var(--cs-ink-1)]">
          {SCENE_CATEGORY.sharedObjective}
        </p>

        <p className="mt-3 flex items-center gap-2 text-[0.86rem] font-medium text-[var(--demo-violet-deep)]">
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
          {SCENE_CATEGORY.states[3].message[0]}
        </p>

        <p className="mt-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--demo-violet)]">
          {SCENE_SYSTEM.layers[0].missionTitle}
        </p>

        <div className="mt-2.5 flex flex-col gap-1.5">
          {MISSION_FACTS.map((f, i) => (
            <Appear key={f.text} when={i < shown} y={8} durationIn={0.4}>
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--cs-line)] bg-white/70 px-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(107,99,232,0.1)] text-[var(--demo-violet)]">
                  <f.Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">
                  {f.kind}
                </span>
                <span className="ml-auto text-[0.9rem] font-semibold text-[var(--cs-ink-1)]">{f.text}</span>
              </div>
            </Appear>
          ))}
        </div>
      </div>

      {/* Une fois la mission bâtie : ce que cela change, en une phrase (constant). */}
      <Appear when={built} className="w-full">
        <div className="mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-[var(--demo-violet-soft)] bg-[rgba(107,99,232,0.06)] px-4 py-3 text-left">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
          <span className="text-[0.9rem] leading-snug text-[var(--cs-ink-1)]">
            {SCENE_SYSTEM.layers[0].message}
          </span>
        </div>
      </Appear>

      <CineLede>{SCENE_CATEGORY.employeeFollowUp}</CineLede>

      {/* Le comparatif des approches — détail secondaire, replié : UNE seule idée à l'écran.
          On garde le contraste « fournir des fonctions » vs « prendre en charge un périmètre ». */}
      <Disclosure summary="Comparer les approches — logiciel, assistant, agent IA, employé IA">
        <p className="text-[0.95rem] leading-relaxed text-[var(--cs-ink-2)]">
          Un logiciel fournit des fonctions. Un assistant, un agent IA : il produit une réponse ou
          exécute une action. Il ne prend pas en charge la mission. Un employé IA reçoit un objectif
          et prend en charge un périmètre de travail entier.
        </p>
        <ol className="mt-3 space-y-2">
          {SCENE_CATEGORY.paragraphs.map((line) => (
            <li
              key={line}
              className="flex items-start gap-2 rounded-lg border border-[var(--cs-line)] bg-white/50 px-3 py-2 text-[0.88rem] leading-snug text-[var(--cs-ink-2)]"
            >
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--demo-violet)]" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </Disclosure>
    </CineScene>
  );
}

export function Act2Difference() {
  return (
    <>
      {/* CH.3 — le problème : le travail dispersé (avant la différence). */}
      <PinnedScene
        id="demo-act-dispersed"
        steps={4}
        ariaLabel="Le travail se disperse, puis se réunit"
        decor={<SceneDecor />}
      >
        <DispersedScene />
      </PinnedScene>

      {/* CH.4 — la différence : la demande devient une mission prise en charge. */}
      <PinnedScene
        id="demo-act-difference"
        event={DEMO_EVENTS.categorySectionViewed}
        ariaLabel="La différence — une demande devient une mission prise en charge"
        steps={5}
        decor={<SceneDecor />}
      >
        <DifferenceScene />
      </PinnedScene>
    </>
  );
}
