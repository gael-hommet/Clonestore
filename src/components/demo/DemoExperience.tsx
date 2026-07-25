"use client";

// /demo — Orchestrateur de la présentation en 7 actes + clôture.
// Acte 1 Comprendre · 2 La différence · 3 Le système · 4 Le résultat ·
// 5 La confiance · 6 Le coût de continuer comme avant · 7 Passer à Pierre ·
// FAQ · Décision (première mission, ce qui suit, trois issues réelles).
// Couches : parcours principal (lisible sans clic), micro-explications
// contextuelles, et tiroir d'approfondissement facultatif.
// framer-motion + reducedMotion="user" ; transition élément-partagé vers /demo/pierre.

import * as React from "react";
import { useRouter } from "next/navigation";
import { MotionConfig, AnimatePresence, motion } from "framer-motion";

import { DemoProgress } from "./DemoProgress";
import { DemoFaq } from "./DemoFaq";
import { DemoConversion } from "./DemoConversion";
import { MissionCard } from "./primitives/MissionCard";
import { useDemoHeaderHeightVar } from "./primitives/pinned";
import { SHARED_MISSION_LAYOUT_ID, DEMO_SCENE_NAV, type DeepDiveTopic } from "./shared";

import { ValueShock } from "./acts/ValueShock";
import { Act1Opening } from "./acts/Act1Opening";
import { ValueChapter } from "./acts/ValueChapter";
import { Act2Difference } from "./acts/Act2Difference";
import { ModesChapter } from "./acts/ModesChapter";
import { Act3System } from "./acts/Act3System";
import { Act4Result } from "./acts/Act4Result";
import { Act5Trust } from "./acts/Act5Trust";
import { Act6Cost } from "./acts/Act6Cost";
import { Act6Pierre } from "./acts/Act6Pierre";
import { DemoDeepDive } from "./DemoDeepDive";

import { emitDemoEvent, DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { emitFounderEvent } from "@/lib/founder-access/funnel-events";
import { emitConversionEvent, stableEventKey } from "@/lib/clonestore/conversion/client-emitter";
import { getCommercialPhase } from "@/lib/demo/presentation/commercial-state";
import { PIERRE_DEMO_ROUTE, SCENE_COMPLETION } from "@/lib/demo/presentation/content";
// Canonical Analytics Runtime Wiring — émissions canoniques ADDITIVES (aucune émission legacy
// retirée ; le funnel canonique lit uniquement clonestore_analytics_events_v1, jamais les
// systèmes legacy, donc aucun double comptage possible).
import { track, newDemoRunId, currentPageViewId } from "@/lib/analytics/client/track";

// Provenance canonique de la démo générale dans le funnel de conversion serveur.
const GENERAL_DEMO = "general_demo";

export function DemoExperience() {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState<string>(DEMO_SCENE_NAV[0].id);
  const [transitioning, setTransitioning] = React.useState(false);
  const [deepDive, setDeepDive] = React.useState<DeepDiveTopic | null>(null);
  const startedRef = React.useRef(false);
  const completedRef = React.useRef(false);
  const reduceRef = React.useRef(false);
  const stepSeenRef = React.useRef<Set<string>>(new Set());
  // Un demo_run_id canonique par exécution de la démo générale. Créé une seule fois au montage
  // (guard ref, insensible au double-montage React Strict Mode) — un simple re-render ne crée
  // pas de nouveau run. Un rechargement de /demo crée un nouveau run (comportement documenté).
  const demoRunIdRef = React.useRef<string | null>(null);
  if (demoRunIdRef.current === null && typeof window !== "undefined") {
    demoRunIdRef.current = newDemoRunId("demo");
  }

  // La démo générale est « terminée » dès que le visiteur atteint le bas OU part
  // vers Pierre (fiche, cockpit) ou la réservation. Émis une seule fois, avant
  // toute étape aval — le funnel cohorté reste ainsi monotone.
  const markDemoCompleted = React.useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    emitDemoEvent(DEMO_EVENTS.completed, {}, { once: true });
    emitConversionEvent("demo_completed", {
      idempotencyKey: stableEventKey("demo_completed:/demo"),
      metadata: { stage: GENERAL_DEMO },
      sourcePage: "/demo",
    });
    emitFounderEvent("demo_completed", { landingPath: "/demo" });
    // Canonique (additif) : fin de la démo générale, une seule fois par run.
    const runId = demoRunIdRef.current;
    if (runId) {
      track("demo_completed", {
        demoRunId: runId,
        pageViewId: currentPageViewId() ?? undefined,
        properties: { demoType: "demo" },
        dedupeKey: `demo_completed:${runId}`,
      });
    }
  }, []);

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
    // Funnel de conversion canonique (le même que /demo/pierre) : arrivée sur /demo.
    emitConversionEvent("landing_viewed", {
      idempotencyKey: stableEventKey("landing_viewed:/demo"),
      metadata: { stage: GENERAL_DEMO },
      sourcePage: "/demo",
    });

    function depth(): number {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, window.scrollY / max) : 0;
    }
    function onScroll() {
      if (!startedRef.current) {
        startedRef.current = true;
        emitDemoEvent(DEMO_EVENTS.started, { scrollDepth: depth() }, { once: true });
        emitConversionEvent("demo_started", {
          idempotencyKey: stableEventKey("demo_started:/demo"),
          metadata: { stage: GENERAL_DEMO },
          sourcePage: "/demo",
        });
        const runId = demoRunIdRef.current;
        if (runId) {
          track("demo_started", {
            demoRunId: runId,
            pageViewId: currentPageViewId() ?? undefined,
            properties: { demoType: "demo" },
            dedupeKey: `demo_started:${runId}`,
          });
        }
      }
      if (depth() >= 0.985) markDemoCompleted();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [markDemoCompleted]);

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
        if (visible) {
          setActiveId(visible.target.id);
          // Étapes significatives de la démo générale → funnel canonique (dédupé par scène).
          const id = visible.target.id;
          if (!stepSeenRef.current.has(id) && stepSeenRef.current.size < 12) {
            const step = stepSeenRef.current.size + 1;
            stepSeenRef.current.add(id);
            emitConversionEvent("demo_step_viewed", {
              idempotencyKey: stableEventKey(`demo_step_viewed:/demo:${id}`),
              metadata: { stage: GENERAL_DEMO, demo_step: id.replace(/^demo-act-/, "").slice(0, 40), step },
              sourcePage: "/demo",
            });
            const runId = demoRunIdRef.current;
            if (runId) {
              // stepId = identifiant de scène fermé (jamais textContent, jamais texte libre).
              track("demo_step_completed", {
                demoRunId: runId,
                stepId: id.replace(/^demo-act-/, "").replace(/[^a-zA-Z0-9_:.-]/g, "").slice(0, 64),
                properties: { demoType: "demo" },
                dedupeKey: `demo_step_completed:${runId}:${id}`,
              });
            }
          }
        }
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
      markDemoCompleted();
      // Funnel commercial : clic « Voir Pierre travailler » (accès cockpit secondaire).
      emitFounderEvent("product_demo_clicked", { source: "demo_reveal" });
      setTransitioning(true);
      const delay = reduceRef.current ? 150 : 660;
      window.setTimeout(() => router.push(PIERRE_DEMO_ROUTE), delay);
    },
    [router, markDemoCompleted],
  );

  const handleDirectPierre = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directPierreClicked, {}, { once: true });
    markDemoCompleted();
    // Funnel commercial : passage direct vers le cockpit Pierre.
    emitFounderEvent("product_demo_clicked", { source: "demo_direct" });
  }, [markDemoCompleted]);

  // Révélation Pierre : le CTA PRINCIPAL « Découvrir Pierre » mène à la fiche produit.
  const handleDiscoverPierre = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directPierreClicked, {}, { once: true });
    markDemoCompleted();
    emitFounderEvent("discover_pierre_clicked", { source: "demo_reveal" });
    // Canonique : clic sur le CTA vers Pierre.
    track("discover_pierre_clicked", {
      pageViewId: currentPageViewId() ?? undefined,
      properties: { ctaKey: "demo_reveal" },
      dedupeKey: "discover_pierre_clicked:demo_reveal",
    });
  }, [markDemoCompleted]);

  const handleRevealViewed = React.useCallback(() => {
    emitFounderEvent("demo_pierre_reveal_viewed", { landingPath: "/demo" });
    // Canonique : le CTA vers Pierre (séquence de révélation) est réellement affiché.
    track("demo_pierre_reveal_viewed", {
      pageViewId: currentPageViewId() ?? undefined,
      dedupeKey: "demo_pierre_reveal_viewed:/demo",
    });
  }, []);

  const handleDirectReservation = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directReservationClicked, {}, { once: true });
    emitDemoEvent(DEMO_EVENTS.reservationClicked, {}, { once: true });
    markDemoCompleted();
    // Funnel canonique (BLOC3) + funnel commercial (dashboard) : clic « Réserver Pierre ».
    emitConversionEvent("purchase_cta_clicked", { metadata: { cta: "general_demo_reserve", stage: GENERAL_DEMO } });
    emitFounderEvent("founder_cta_clicked", { source: "general_demo" });
  }, [markDemoCompleted]);

  // Clôture — on mesure la DÉCISION, jamais son contenu (aucune question, aucun chiffre).
  const handleCloneChat = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.cloneChatCtaClicked, { scene: "decision", source: "demo" }, { once: true });
    // Funnel canonique : sortie assistance depuis la démo générale.
    emitConversionEvent("assistance_cta_clicked", { metadata: { cta: "general_demo_clonechat", stage: GENERAL_DEMO } });
  }, []);

  const handleFirstMission = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.firstMissionSelected, { scene: "decision" }, { once: true });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="demo-root">
        <DemoProgress activeId={activeId} />

        <ValueShock />
        <Act1Opening onDirectPierre={handleDirectPierre} />
        <ValueChapter />
        <Act2Difference />
        <ModesChapter />
        <Act3System onDeepDive={setDeepDive} />
        <Act4Result />
        <Act5Trust onDeepDive={setDeepDive} />
        <Act6Cost />
        <Act6Pierre
          onTransition={handleTransition}
          onDirectReservation={handleDirectReservation}
          onDiscoverPierre={handleDiscoverPierre}
          onRevealViewed={handleRevealViewed}
          onDeepDive={setDeepDive}
        />

        <DemoFaq />
        <DemoConversion
          onReserve={handleDirectReservation}
          onPierre={handleDirectPierre}
          onCloneChat={handleCloneChat}
          onDiscover={handleDiscoverPierre}
          onFirstMission={handleFirstMission}
        />

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
