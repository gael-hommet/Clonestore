"use client";

// /demo — CH.9 : LA RÉVÉLATION (dernier acte du scroll principal).
//
// Refonte cinématographique : UNE idée / UNE preuve / UNE action, plein cadre,
// beaucoup de respiration. La démo générale a vendu CloneStore ; ici on révèle,
// très calmement, Pierre comme sa première incarnation réelle et disponible.
// Hiérarchie forte à 3 niveaux (eyebrow → phrase géante → rôle) puis UN CTA
// dominant. Tout le détail secondaire (promesse, tags, réservation, périmètre,
// boutique) est rangé derrière une <Disclosure> — jamais tout affiché en même temps.
//
// Deux sorties, sans en casser aucune :
//   • CTA PRINCIPAL « Découvrir Pierre » → /agents/pierre (la fiche produit) — le
//     bon premier pas du funnel (démo → fiche → cockpit → réservation).
//   • CTA « Voir Pierre travailler » → /demo/pierre — CONSERVE la transition
//     cinématique élément-partagé (onTransition + voile). Ne pas retirer ce libellé
//     ni PIERRE_DEMO_ROUTE : la démo en dépend (tests + transition partagée). La
//     MissionCard (SHARED_MISSION_LAYOUT_ID) reste la source du morphing vers le voile.

import * as React from "react";
import Link from "next/link";
import { Network, Store, Plus } from "lucide-react";
import { Reveal } from "../primitives/motion";
import { MissionCard } from "../primitives/MissionCard";
import { DemoCTALink } from "../primitives/DemoCTA";
import { FounderAccessStatus } from "../primitives/FounderAccessStatus";
import { useSceneView } from "../primitives/useSceneView";
import { CineScene, CineEyebrow, CineTitle, Disclosure } from "../primitives/cine";
import { DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { SCENE_COMPLETION, SCENE_REVEAL, PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";
import { SHARED_MISSION_LAYOUT_ID } from "../shared";
import type { DeepDiveTopic } from "../shared";

const FICHE_ROUTE = "/agents/pierre";
const BOUTIQUE_ROUTE = "/agents";

export function Act6Pierre({
  onTransition,
  onDirectReservation,
  onDiscoverPierre,
  onRevealViewed,
  onDeepDive,
}: {
  onTransition: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onDirectReservation: () => void;
  onDiscoverPierre: () => void;
  onRevealViewed: () => void;
  onDeepDive: (t: DeepDiveTopic) => void;
}) {
  const ref = useSceneView<HTMLElement>(DEMO_EVENTS.completionViewed);

  // Mesure funnel : la séquence de révélation Pierre est réellement affichée (une fois).
  const revealRef = React.useRef<HTMLDivElement>(null);
  const seenRef = React.useRef(false);
  React.useEffect(() => {
    const el = revealRef.current;
    if (!el || seenRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !seenRef.current) {
          seenRef.current = true;
          onRevealViewed();
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onRevealViewed]);

  return (
    <section
      ref={ref}
      id="demo-act-pierre"
      className="demo-section demo-scene-flow"
      aria-label="Pierre, le premier employé IA disponible"
    >
      <CineScene>
        {/* ── NIVEAU 1 — la phrase géante : Pierre est disponible ─────────────── */}
        <Reveal className="flex w-full flex-col items-center gap-4">
          <CineEyebrow n="10">{SCENE_REVEAL.kicker}</CineEyebrow>
          <CineTitle as="h2">{SCENE_REVEAL.availableLine}</CineTitle>
        </Reveal>

        {/* ── NIVEAU 2 — l'état + le rôle. Le climax d'identité. ──────────────── */}
        <Reveal delay={0.06} className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--cs-line)] bg-white/60 px-3.5 py-1.5 text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-[var(--cs-ink-2)]">
            <span className="h-2 w-2 rounded-full bg-[var(--demo-violet)]" aria-hidden="true" />
            {SCENE_REVEAL.employee.availableLabel}
          </span>
          <p className="text-[clamp(1.15rem,2.2vw,1.6rem)] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">
            {SCENE_REVEAL.employee.role}
          </p>
        </Reveal>

        {/* ── L'objet focal : la MissionCard partagée (source du morphing) ────── */}
        <Reveal delay={0.12} className="w-full">
          <div ref={revealRef} className="mx-auto w-full max-w-md">
            <MissionCard
              layoutId={SHARED_MISSION_LAYOUT_ID}
              showTasks
              taskCount={4}
              compact
              title={SCENE_COMPLETION.recapCard}
              footnote={false}
            />
          </div>
        </Reveal>

        {/* ── L'ACTION dominante : la fiche produit. Cockpit en secondaire. ───── */}
        <Reveal delay={0.16} className="flex flex-col items-center gap-3">
          <DemoCTALink href={FICHE_ROUTE} variant="primary" hero withArrow onClick={onDiscoverPierre}>
            {SCENE_REVEAL.primaryCta}
          </DemoCTALink>
          <p className="max-w-md text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
            {SCENE_REVEAL.primaryCtaSubtext}
          </p>
          {/* Secondaire clairement subordonné — conserve la transition élément-partagé. */}
          <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="secondary" withArrow onClick={onTransition}>
            {SCENE_REVEAL.secondaryCta}
          </DemoCTALink>
        </Reveal>

        {/* ── Le détail secondaire, rangé : promesse, tags, réservation, périmètre. ─ */}
        <Reveal delay={0.2} className="w-full">
          <Disclosure summary="Détails, réservation et périmètre">
            <p className="text-[0.95rem] leading-relaxed text-[var(--cs-ink-2)]">
              {SCENE_REVEAL.employee.promise}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SCENE_REVEAL.employee.tags.map((t) => (
                <li key={t}>
                  <span className="demo-chip">
                    <span className="demo-chip__dot" aria-hidden="true" />
                    {t}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.86rem] leading-relaxed text-[var(--cs-ink-3)]">
              {SCENE_REVEAL.scopeNote}
            </p>
            <div className="mt-4">
              <FounderAccessStatus variant="full" onReserve={onDirectReservation} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDeepDive("organization")}
                className="demo-btn demo-btn-ghost"
                style={{ minHeight: 36, fontSize: "0.86rem", padding: "0 14px" }}
              >
                <Network className="h-3.5 w-3.5" aria-hidden="true" /> Pierre / CloneStore : la suite
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <Link
                href={BOUTIQUE_ROUTE}
                className="demo-btn demo-btn-ghost"
                style={{ minHeight: 36, fontSize: "0.86rem", padding: "0 14px" }}
              >
                <Store className="h-3.5 w-3.5" aria-hidden="true" /> {SCENE_REVEAL.boutiqueCta}
              </Link>
            </div>
          </Disclosure>
        </Reveal>
      </CineScene>
    </section>
  );
}
