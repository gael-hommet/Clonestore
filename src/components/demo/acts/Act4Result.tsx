"use client";

// /demo — CH.5 (résultat) : « Un vrai résultat, pas du texte généré. »
//
// RE-SÉQUENCÉ EN FLUX : une preuve à la fois, en SOUS-SCÈNES SUCCESSIVES — d'abord
// le document réellement produit (DocumentPreview), puis, plus bas, le brief qui le
// restitue (CloneBriefCard), puis la preuve honnête (l'information manquante,
// signalée, jamais inventée). Jamais deux livrables concurrents à l'écran. Tout le
// détail secondaire — mission, message à la manager, historique CloneTrace, énoncé
// long — reste rangé derrière une <Disclosure>.
//
// Aucune copie inventée : les livrables viennent de SCENE_SYSTEM.brief et des
// fixtures ; les phrases visibles sont celles, existantes, de cet acte.

import * as React from "react";
import { Lock, Mail, AlertTriangle } from "lucide-react";
import { PinnedScene, SceneDecor, Appear } from "../primitives/pinned";
import { CineEyebrow, CineTitle, CineLede, Disclosure } from "../primitives/cine";
import { GlassSurface } from "../primitives/GlassSurface";
import { MissionCard } from "../primitives/MissionCard";
import { DocumentPreview } from "../primitives/DocumentPreview";
import { CloneBriefCard } from "../primitives/CloneBriefCard";
import { TraceTimeline } from "../primitives/TraceTimeline";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_SYSTEM } from "@/lib/demo/presentation/content";
import { DEMO_DOCUMENT, DEMO_TRACE, DEMO_DATA_DISCLAIMER } from "@/lib/demo/presentation/fixtures";

const RESULT_STEPS = 4;

function ResultScene() {
  const { brief } = SCENE_SYSTEM;

  return (
    <div className="demo-shell">
      {/* ── Sous-scène d'ouverture : l'idée ── */}
      <div className="cine-sub">
        <CineEyebrow n="08">Le résultat</CineEyebrow>
        <CineTitle>
          Pierre n&apos;a pas seulement produit des documents.{" "}
          <span className="cine-accent">Il a pris en charge une partie de la semaine RH.</span>
        </CineTitle>
        <CineLede>Un vrai résultat, réellement produit et suivi — pas du texte généré.</CineLede>
      </div>

      {/* ── Sous-scène 1 : LE DOCUMENT — un seul livrable au centre ── */}
      <Appear when className="w-full">
        <div className="cine-sub">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--demo-violet)]">
            Le document — prêt, selon vos modèles
          </p>
          <DocumentPreview
            title={DEMO_DOCUMENT.title}
            meta={DEMO_DOCUMENT.meta}
            body={DEMO_DOCUMENT.body}
            disclaimer={DEMO_DOCUMENT.disclaimer}
            className="mx-auto w-full max-w-xl text-left"
          />
        </div>
      </Appear>

      {/* ── Sous-scène 2 : LE BRIEF — la restitution, seule à l'écran ── */}
      <Appear when className="w-full">
        <div className="cine-sub">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--demo-violet)]">
            Le brief — l&apos;essentiel, restitué
          </p>
          <CloneBriefCard
            title={brief.title}
            lines={brief.lines}
            decisionTitle={brief.decisionTitle}
            decision={brief.decision}
            className="mx-auto w-full max-w-xl text-left"
          />
        </div>
      </Appear>

      {/* ── Sous-scène 3 : l'honnêteté — l'information manquante, jamais inventée ── */}
      <Appear when className="w-full">
        <div className="cine-sub" style={{ minHeight: "clamp(220px, 32svh, 380px)" }}>
          <div className="mx-auto flex w-full max-w-xl items-start gap-2.5 rounded-[1.4rem] border border-[rgba(184,74,74,0.22)] bg-[rgba(184,74,74,0.06)] p-4 text-left">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--demo-danger)]" aria-hidden="true" />
            <p className="text-[0.86rem] leading-relaxed text-[var(--cs-ink-2)]">
              <strong className="text-[var(--cs-ink-1)]">Information manquante&nbsp;:</strong> matériel attribué.
              Pierre la signale et bloque la tâche — il ne l&apos;invente jamais.
            </p>
          </div>

          {/* Le détail complet — rangé, jamais affiché à plat. */}
          <Disclosure summary="Voir la mission, le message et l'historique complet" className="mt-4">
            <div className="grid gap-4">
              <p className="text-[0.95rem] leading-relaxed text-[var(--cs-ink-2)]">
                Une seule demande — et Pierre a organisé plusieurs missions en parallèle, coordonné leurs dépendances,
                préparé les documents et les communications, signalé ce qui manquait et gardé chaque mission active.
              </p>

              <MissionCard showTasks taskCount={4} footnote={false} />

              <GlassSurface kind="read" weight="card" className="rounded-[1.4rem] p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[var(--demo-violet)]" aria-hidden="true" />
                  <p className="text-[0.82rem] font-semibold text-[var(--cs-ink-1)]">Message à la manager — prêt</p>
                </div>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--cs-ink-2)]">
                  « Bonjour Hélène, tout est prêt pour l&apos;arrivée de Clara lundi. Voici le récapitulatif et les
                  points qui attendent votre validation. »
                </p>
                <p className="mt-2 text-[0.7rem] font-medium text-[var(--demo-amber)]">Brouillon — envoyé après validation.</p>
              </GlassSurface>

              <GlassSurface kind="material" weight="card" className="rounded-[1.4rem] p-4">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-ink-4)]">
                  CloneTrace — l&apos;historique
                </p>
                <div className="mt-3">
                  <TraceTimeline entries={DEMO_TRACE} />
                </div>
              </GlassSurface>

              <p className="demo-statement text-left">
                Vous ne voyez pas une tâche isolée : vous voyez le modèle d&apos;une fonction RH prise en charge —
                plusieurs missions absorbées en parallèle, dans la durée, ce qui mobiliserait autrement plusieurs
                collaborateurs.
              </p>

              <p className="flex items-center gap-2 text-[0.72rem] text-[var(--cs-ink-4)]">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {DEMO_DATA_DISCLAIMER}
              </p>
            </div>
          </Disclosure>
        </div>
      </Appear>
    </div>
  );
}

export function Act4Result() {
  return (
    <PinnedScene
      id="demo-act-result"
      event={DEMO_EVENTS.footprintSectionViewed}
      ariaLabel="Le résultat : le travail réellement produit"
      steps={RESULT_STEPS}
      align="top"
      decor={<SceneDecor tone="trust" />}
    >
      <ResultScene />
    </PinnedScene>
  );
}
