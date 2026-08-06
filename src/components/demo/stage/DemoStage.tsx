"use client";

// /demo — STAGE IMMERSIF (refonte premium, remplace l'ancien DemoExperience à 12 sections).
// Exactement SIX scènes, une seule visible à la fois, dans un stage 100dvh sans scroll de page.
// Navigation : CTA de scène · flèches latérales · clavier ←/→ · six points de progression.
// Ordre = contrat produit : ValueShock → Act1Opening → Objectif → Exécution → Validation → Résultat.
// Réduction de mouvement gérée par <MotionConfig reducedMotion="user"> (SSR-safe).

import * as React from "react";
import { useRouter } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DemoShellHeader } from "./DemoShellHeader";
import { ValueShock } from "../acts/ValueShock";
import { Act1Opening } from "../acts/Act1Opening";
import { SceneObjective, SceneExecution, SceneValidation, SceneResult } from "./scenes";
import { SceneCategory, SceneDepartments, SceneBusinessValue, SceneHowItWorks } from "./ch2-scenes";
import { SceneTimeComparator, SceneFinancialComparator } from "./ch3-value-scenes";
import { SceneTechArchitecture, SceneTechExplorer } from "./ch3-tech-scenes";

import { emitDemoEvent, DEMO_EVENTS } from "@/lib/demo/presentation/analytics";
import { emitFounderEvent } from "@/lib/founder-access/funnel-events";
import { emitConversionEvent, stableEventKey } from "@/lib/clonestore/conversion/client-emitter";
import { track, newDemoRunId, currentPageViewId } from "@/lib/analytics/client/track";
import { PIERRE_DEMO_ROUTE } from "@/lib/demo/presentation/content";

const RESERVE_ROUTE = "/reserver/pierre";
const GENERAL_DEMO = "general_demo";

// Registre des QUATORZE scènes — l'ordre EST le contrat (verrouillé par test). Les id sont stables
// et servent d'identifiant d'étape analytics (jamais du texte libre).
// CHAPITRE 1 (le « wow », 1-6) · CHAPITRE 2 (l'explication, 7-10) · CHAPITRE 3 (valeur & technologie, 11-14).
export const DEMO_STAGE_SCENES = [
  { id: "value", label: "La preuve", chapter: 1 },
  { id: "clonestore", label: "CloneStore", chapter: 1 },
  { id: "objective", label: "L'objectif", chapter: 1 },
  { id: "execution", label: "L'exécution", chapter: 1 },
  { id: "validation", label: "La validation", chapter: 1 },
  { id: "result", label: "Le résultat", chapter: 1 },
  { id: "category", label: "Nouvelle catégorie", chapter: 2 },
  { id: "departments", label: "Départements", chapter: 2 },
  { id: "value-business", label: "Valeur", chapter: 2 },
  { id: "how", label: "Fonctionnement", chapter: 2 },
  { id: "time-value", label: "Comparateur de temps", chapter: 3 },
  { id: "money-value", label: "Impact financier", chapter: 3 },
  { id: "tech-architecture", label: "Architecture", chapter: 3 },
  { id: "tech-explorer", label: "Explorateur des technologies", chapter: 3 },
] as const;

// Chapitres pour la progression (nom + compteur, jamais 14 points minuscules sur mobile).
const CHAPTERS: Readonly<Record<number, string>> = { 1: "La démonstration", 2: "L'explication", 3: "Valeur & technologie" };
// Débuts de chapitre → séparateurs de groupe entre les points (desktop).
const CHAPTER_STARTS = new Set([6, 10]);

const LAST = DEMO_STAGE_SCENES.length - 1;

export function DemoStage() {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [dir, setDir] = React.useState(1);

  const runIdRef = React.useRef<string | null>(null);
  if (runIdRef.current === null && typeof window !== "undefined") {
    runIdRef.current = newDemoRunId("demo");
  }
  const startedRef = React.useRef(false);
  const completedRef = React.useRef(false);
  const stepSeenRef = React.useRef<Set<string>>(new Set());

  const markStarted = React.useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      emitDemoEvent(DEMO_EVENTS.started, {}, { once: true });
      emitConversionEvent("demo_started", {
        idempotencyKey: stableEventKey("demo_started:/demo"),
        metadata: { stage: GENERAL_DEMO },
        sourcePage: "/demo",
      });
      const runId = runIdRef.current;
      if (runId) {
        track("demo_started", {
          demoRunId: runId,
          pageViewId: currentPageViewId() ?? undefined,
          properties: { demoType: "demo" },
          dedupeKey: `demo_started:${runId}`,
        });
      }
    } catch { /* l'instrumentation ne doit JAMAIS casser la navigation */ }
  }, []);

  const markCompleted = React.useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      emitDemoEvent(DEMO_EVENTS.completed, {}, { once: true });
      emitConversionEvent("demo_completed", {
        idempotencyKey: stableEventKey("demo_completed:/demo"),
        metadata: { stage: GENERAL_DEMO },
        sourcePage: "/demo",
      });
      emitFounderEvent("demo_completed", { landingPath: "/demo" });
      const runId = runIdRef.current;
      if (runId) {
        track("demo_completed", {
          demoRunId: runId,
          pageViewId: currentPageViewId() ?? undefined,
          properties: { demoType: "demo" },
          dedupeKey: `demo_completed:${runId}`,
        });
      }
    } catch { /* l'instrumentation ne doit JAMAIS casser la navigation */ }
  }, []);

  // Étape franchie → événement canonique (dédupé par scène). Scène finale → complétion.
  React.useEffect(() => {
    const scene = DEMO_STAGE_SCENES[index];
    if (!scene) return;
    try {
      if (!stepSeenRef.current.has(scene.id)) {
        stepSeenRef.current.add(scene.id);
        const runId = runIdRef.current;
        if (runId) {
          track("demo_step_completed", {
            demoRunId: runId,
            stepId: scene.id,
            properties: { demoType: "demo" },
            dedupeKey: `demo_step_completed:${runId}:${scene.id}`,
          });
        }
        emitConversionEvent("demo_step_viewed", {
          idempotencyKey: stableEventKey(`demo_step_viewed:/demo:${scene.id}`),
          metadata: { stage: GENERAL_DEMO, demo_step: scene.id, step: index + 1 },
          sourcePage: "/demo",
        });
      }
    } catch { /* instrumentation non bloquante */ }
    if (index === LAST) markCompleted();
  }, [index, markCompleted]);

  // Navigation DÉTERMINISTE : `setIndex` en forme fonctionnelle (`c => …`) voit toujours l'état
  // COURANT committé — jamais un `index` figé par une closure. Un clic / une touche = une avance
  // exacte, y compris en cliquant pendant une transition. `dir` est connu à l'appel (avant/arrière) ;
  // pour un saut de point, on lit l'index committé via une ref mise à jour en effet (post-commit).
  const markStartedRef = React.useRef(markStarted);
  markStartedRef.current = markStarted;
  const indexRef = React.useRef(0);
  React.useEffect(() => { indexRef.current = index; }, [index]);

  // La mise à jour d'état vient TOUJOURS avant l'analytics : une erreur d'instrumentation ne peut
  // jamais bloquer la navigation. (markStartedRef appelle une fonction déjà protégée.)
  const goNext = React.useCallback(() => {
    setDir(1);
    setIndex((c) => Math.min(LAST, c + 1));
    markStartedRef.current();
  }, []);
  const goPrev = React.useCallback(() => {
    setDir(-1);
    setIndex((c) => Math.max(0, c - 1));
  }, []);
  const goTo = React.useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(LAST, i));
    setDir(clamped >= indexRef.current ? 1 : -1);
    setIndex(clamped);
    if (clamped > indexRef.current) markStartedRef.current();
  }, []);

  // Navigation clavier gauche/droite (une touche = une scène).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const handleDirectPierre = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directPierreClicked, {}, { once: true });
    emitFounderEvent("product_demo_clicked", { source: "demo_direct" });
    markCompleted();
  }, [markCompleted]);

  const handleDiscoverPierre = React.useCallback(() => {
    emitDemoEvent(DEMO_EVENTS.directPierreClicked, {}, { once: true });
    emitFounderEvent("discover_pierre_clicked", { source: "demo_reveal" });
    track("discover_pierre_clicked", {
      pageViewId: currentPageViewId() ?? undefined,
      properties: { ctaKey: "demo_reveal" },
      dedupeKey: "discover_pierre_clicked:demo_reveal",
    });
    markCompleted();
    router.push(PIERRE_DEMO_ROUTE);
  }, [markCompleted, router]);

  const handleReserve = React.useCallback(() => {
    emitConversionEvent("purchase_cta_clicked", { metadata: { cta: "general_demo_reserve", stage: GENERAL_DEMO } });
    emitFounderEvent("founder_cta_clicked", { source: "general_demo" });
    markCompleted();
  }, [markCompleted]);

  const handleReserveFromScene = React.useCallback(() => {
    handleReserve();
    router.push(RESERVE_ROUTE);
  }, [handleReserve, router]);

  function renderScene(i: number): React.ReactNode {
    switch (i) {
      case 0: return <ValueShock onAdvance={goNext} />;
      case 1: return <Act1Opening onAdvance={goNext} onDirectPierre={handleDirectPierre} />;
      case 2: return <SceneObjective onAdvance={goNext} />;
      case 3: return <SceneExecution onAdvance={goNext} />;
      case 4: return <SceneValidation onAdvance={goNext} />;
      case 5: return <SceneResult onUnderstand={goNext} onDiscoverPierre={handleDiscoverPierre} onReserve={handleReserveFromScene} />;
      case 6: return <SceneCategory onAdvance={goNext} />;
      case 7: return <SceneDepartments onAdvance={goNext} />;
      case 8: return <SceneBusinessValue onAdvance={goNext} />;
      case 9: return <SceneHowItWorks onAdvance={goNext} onReserve={handleReserveFromScene} />;
      case 10: return <SceneTimeComparator onAdvance={goNext} />;
      case 11: return <SceneFinancialComparator onAdvance={goNext} onReserve={handleReserveFromScene} />;
      case 12: return <SceneTechArchitecture onAdvance={goNext} />;
      case 13: return <SceneTechExplorer onDiscoverPierre={handleDiscoverPierre} onReserve={handleReserveFromScene} onRestart={() => goTo(0)} />;
      default: return null;
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="demo-stage-root" data-demo-scene={DEMO_STAGE_SCENES[index].id}>
        <DemoShellHeader onReserve={handleReserve} />

        <main className="demo-stage">
          <button
            type="button"
            className="demo-nav-arrow demo-nav-arrow--prev"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="Scène précédente"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="demo-stage-view">
            {/* Scène montée par CLÉ : à chaque changement d'index, l'ancienne est retirée
                immédiatement et la nouvelle apparaît (fondu + glissement). Pas de mode="wait" :
                la scène visible reflète TOUJOURS l'index courant → navigation déterministe, un
                clic = une avance, robuste au clic pendant une transition. */}
            <motion.section
              key={DEMO_STAGE_SCENES[index].id}
              className="demo-scene-frame"
              initial={{ opacity: 0, x: dir >= 0 ? 34 : -34 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              aria-label={`Scène ${index + 1} sur ${DEMO_STAGE_SCENES.length} — ${DEMO_STAGE_SCENES[index].label}`}
            >
              {renderScene(index)}
            </motion.section>
          </div>

          <button
            type="button"
            className="demo-nav-arrow demo-nav-arrow--next"
            onClick={goNext}
            disabled={index === LAST}
            aria-label="Scène suivante"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </main>

        {/* Progression sur TROIS chapitres : nom du chapitre + compteur (mobile-first, jamais 14
            points minuscules), barre de progression fine, et points groupés par chapitre (desktop). */}
        <nav className="demo-stage-progress" aria-label="Progression de la démonstration">
          <div className="demo-progress-chap">
            <span className="demo-progress-chap__name">
              Chapitre {DEMO_STAGE_SCENES[index].chapter} · {CHAPTERS[DEMO_STAGE_SCENES[index].chapter]}
            </span>
            <span className="demo-progress-chap__count">{index + 1} / {DEMO_STAGE_SCENES.length}</span>
          </div>
          <div className="demo-progress-track" aria-hidden="true">
            <div className="demo-progress-track__fill" style={{ width: `${((index + 1) / DEMO_STAGE_SCENES.length) * 100}%` }} />
          </div>
          <div className="demo-progress-dots">
            {DEMO_STAGE_SCENES.map((s, i) => (
              <React.Fragment key={s.id}>
                {/* Séparateurs de groupe aux frontières de chapitre (2 → 3 groupes : 6 · 4 · 4). */}
                {CHAPTER_STARTS.has(i) ? <span className="demo-progress-sep" aria-hidden="true" /> : null}
                <button
                  type="button"
                  className={`demo-dot${i === index ? " demo-dot--active" : ""}${i < index ? " demo-dot--done" : ""}`}
                  onClick={() => goTo(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Scène ${i + 1} sur ${DEMO_STAGE_SCENES.length} — chapitre ${s.chapter} : ${s.label}`}
                />
              </React.Fragment>
            ))}
          </div>
        </nav>
      </div>
    </MotionConfig>
  );
}
