"use client";

// /demo — Orchestrateur de la présentation en 6 actes.
// Acte 1 Comprendre · 2 La différence · 3 Le système · 4 Le résultat ·
// 5 La confiance · 6 Passer à Pierre. Couches : parcours principal (lisible sans
// clic), micro-explications contextuelles, et tiroir d'approfondissement facultatif.
// framer-motion + reducedMotion="user" ; transition élément-partagé vers /demo/pierre.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig, AnimatePresence, motion } from "framer-motion";

import { DemoProgress } from "./DemoProgress";
import { DemoFaq } from "./DemoFaq";
import { MissionCard } from "./primitives/MissionCard";
import { DemoCTALink } from "./primitives/DemoCTA";
import { Reveal } from "./primitives/motion";
import { useDemoHeaderHeightVar } from "./primitives/pinned";
import { SHARED_MISSION_LAYOUT_ID, DEMO_SCENE_NAV, type DeepDiveTopic } from "./shared";

import { Act1Opening } from "./acts/Act1Opening";
import { Act2Difference } from "./acts/Act2Difference";
import { Act3System } from "./acts/Act3System";
import { Act4Result } from "./acts/Act4Result";
import { Act5Trust } from "./acts/Act5Trust";
import { Act6Pierre } from "./acts/Act6Pierre";
import { DemoDeepDive } from "./DemoDeepDive";

import { emitDemoEvent, DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { getCommercialPhase } from "@/lib/demo/presentation/commercial-state";
import { PIERRE_DEMO_ROUTE, SCENE_COMPLETION } from "@/lib/demo/presentation/content";

/** Bloc de conversion final (après la FAQ) : routes réelles uniquement. */
function DemoConversion({ onReserve, onPierre }: { onReserve: () => void; onPierre: () => void }) {
  return (
    <section className="demo-section demo-cv" aria-label="Passer à l'action avec CloneStore">
      <div className="demo-shell">
        <Reveal className="mx-auto max-w-2xl">
          <div className="demo-glass demo-glass--material rounded-[1.8rem] p-7 text-center sm:p-9">
            <p className="demo-kicker">Prochaine étape</p>
            <h2 className="demo-title demo-title--section mt-3 mx-auto max-w-[20ch]">
              Prêt à voir Pierre travailler pour votre entreprise ?
            </h2>
            <p className="demo-lede mx-auto mt-3 max-w-xl text-center">
              Découvrez son fonctionnement réel ou réservez votre accès à CloneStore.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <DemoCTALink href="/reserver/pierre" variant="primary" withArrow onClick={onReserve}>
                Réserver Pierre
              </DemoCTALink>
              <DemoCTALink href={PIERRE_DEMO_ROUTE} variant="secondary" onClick={onPierre}>
                Voir Pierre en action
              </DemoCTALink>
            </div>
            <Link href="/agents/pierre" className="demo-btn demo-btn-ghost mt-4 inline-flex">
              Découvrir Pierre
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function DemoExperience() {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState<string>(DEMO_SCENE_NAV[0].id);
  const [transitioning, setTransitioning] = React.useState(false);
  const [deepDive, setDeepDive] = React.useState<DeepDiveTopic | null>(null);
  const startedRef = React.useRef(false);
  const completedRef = React.useRef(false);
  const reduceRef = React.useRef(false);

  // Mesure la hauteur du header → --demo-header-height (viewport utile sous le header).
  useDemoHeaderHeightVar();

  // Restaure position:sticky sur /demo uniquement (voir demo.css .demo-pin-root).
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add("demo-pin-root");
    return () => root.classList.remove("demo-pin-root");
  }, []);

  React.useEffect(() => {
    reduceRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    emitDemoEvent(DEMO_EVENTS.viewed, { commercialPhase: getCommercialPhase() }, { once: true });

    function depth(): number {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, window.scrollY / max) : 0;
    }
    function onScroll() {
      if (!startedRef.current) {
        startedRef.current = true;
        emitDemoEvent(DEMO_EVENTS.started, { scrollDepth: depth() }, { once: true });
      }
      if (!completedRef.current && depth() >= 0.985) {
        completedRef.current = true;
        emitDemoEvent(DEMO_EVENTS.completed, { scrollDepth: 1 }, { once: true });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    const sections = DEMO_SCENE_NAV.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const handleTransition = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      emitDemoEvent(DEMO_EVENTS.pierreCtaClicked, {}, { once: true });
      emitDemoEvent(DEMO_EVENTS.completed, {}, { once: true });
      completedRef.current = true;
      setTransitioning(true);
      const delay = reduceRef.current ? 150 : 660;
      window.setTimeout(() => router.push(PIERRE_DEMO_ROUTE), delay);
    },
    [router],
  );

  const handleDirectPierre = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directPierreClicked, {}, { once: true });
  }, []);

  const handleDirectReservation = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directReservationClicked, {}, { once: true });
    emitDemoEvent(DEMO_EVENTS.reservationClicked, {}, { once: true });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="demo-root">
        <DemoProgress activeId={activeId} />

        <Act1Opening onDirectPierre={handleDirectPierre} />
        <Act2Difference />
        <Act3System onDeepDive={setDeepDive} />
        <Act4Result />
        <Act5Trust onDeepDive={setDeepDive} />
        <Act6Pierre
          onTransition={handleTransition}
          onDirectReservation={handleDirectReservation}
          onDeepDive={setDeepDive}
        />

        <DemoFaq />
        <DemoConversion onReserve={handleDirectReservation} onPierre={handleDirectPierre} />

        <DemoDeepDive topic={deepDive} onClose={() => setDeepDive(null)} />

        <AnimatePresence>
          {transitioning ? (
            <motion.div
              className="demo-veil"
              style={{ pointerEvents: "all" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceRef.current ? 0 : 0.45 }}
              aria-hidden="true"
            >
              <motion.div
                className="demo-shell"
                style={{ maxWidth: 520 }}
                initial={{ scale: reduceRef.current ? 1 : 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduceRef.current ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <MissionCard
                  layoutId={SHARED_MISSION_LAYOUT_ID}
                  showTasks
                  taskCount={4}
                  compact
                  title={SCENE_COMPLETION.recapCard}
                  footnote={false}
                />
                <p className="mt-4 text-center text-[0.8rem] font-medium text-[var(--cs-ink-3)]">
                  Ouverture de la démonstration de Pierre…
                </p>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
