"use client";

// /demo — Moteur de scènes cinématiques épinglées (pilotées par le scroll).
//
// Hydratation-safe : `pinned` démarre false (SSR + 1er rendu = flux statique,
// composition finale visible) puis true sur desktop ≥1024 hors reduced-motion.
//
// Cadrage : la zone collante démarre SOUS le header (var --demo-header-height,
// mesurée côté client) et n'utilise que la hauteur utile.
//
// Stabilité : changement d'étape avec ZONES MORTES + hystérésis (pas de Math.floor
// brut), pour des compositions stables et sans clignotement.

import * as React from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { useSceneView } from "./useSceneView";
import type { DemoEventName } from "@/lib/demo/presentation/analytics";
import { DEMO_EASE } from "./motion";

interface SceneState {
  step: number;
  steps: number;
  pinned: boolean;
  progress: MotionValue<number>;
}

const SceneContext = React.createContext<SceneState | null>(null);

export function useScene(): SceneState {
  const ctx = React.useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used within a PinnedScene");
  return ctx;
}

/** Mesure la hauteur réelle du header public et l'expose en --demo-header-height. */
export function useDemoHeaderHeightVar() {
  React.useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector(".cs-header");
    const apply = () => {
      const h = header ? Math.round(header.getBoundingClientRect().height) : 88;
      root.style.setProperty("--demo-header-height", `${Math.max(56, h)}px`);
    };
    apply();
    let ro: ResizeObserver | null = null;
    if (header && "ResizeObserver" in window) {
      ro = new ResizeObserver(apply);
      ro.observe(header);
    }
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      ro?.disconnect();
      root.style.removeProperty("--demo-header-height");
    };
  }, []);
}

export function PinnedScene({
  id,
  event,
  ariaLabel,
  steps = 4,
  decor,
  className,
  align = "center",
  children,
}: {
  id: string;
  event?: DemoEventName;
  ariaLabel?: string;
  steps?: number;
  decor?: React.ReactNode;
  className?: string;
  /** "top" : compositions qui s'accumulent (titre ancré sous le header). */
  align?: "center" | "top";
  children: React.ReactNode;
}) {
  const ref = useSceneView<HTMLElement>(event);
  const reduce = useReducedMotion();
  const [pinned, setPinned] = React.useState(false);
  const [step, setStep] = React.useState(steps - 1);
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const stepRef = React.useRef(steps - 1);
  const stepStartRef = React.useRef(0); // progress (scrollYProgress) où l'étape courante a commencé
  const pinnedRef = React.useRef(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Enveloppe d'opacité enter/leave (déterministe, pilotée par la position réelle du
  // sticky). Deux scènes pleine hauteur consécutives se « croisent » sur une hauteur
  // de viewport : la sortante reste en haut pendant que l'entrante arrive en bas (sa
  // carte encore coupée) → superposition « bug ». On mesure l'écart entre le haut du
  // sticky et sa position épinglée (= var --demo-header-height) :
  //   • écart 0  → scène réellement épinglée → opacité 1 (pendant TOUTE la phase
  //     épinglée l'écart reste 0, donc le contenu reste 100% lisible) ;
  //   • écart > 0 → la scène entre (sticky encore plus bas) → on l'efface ;
  //   • écart < 0 → la scène se détache et remonte → on l'efface.
  // Comme deux scènes adjacentes partagent leur frontière, la sortante a disparu
  // avant que l'entrante n'apparaisse : fondu propre, sans superposition ni marge.
  const stickyRef = React.useRef<HTMLDivElement>(null);
  const safeRef = React.useRef<HTMLDivElement>(null);
  const contentOpacity = useMotionValue(1);
  const overflowRef = React.useRef(0);
  const maxOverflowRef = React.useRef(0);
  const [reservePx, setReservePx] = React.useState(0); // distance de scroll AJOUTÉE quand le contenu dépasse
  const panY = useMotionValue(0);
  const panYSmooth = useSpring(panY, { stiffness: 150, damping: 28, mass: 0.5 });
  const FADE_ENTER = 340;
  const FADE_LEAVE = 320;

  // ── Épinglage desktop — TOUJOURS animé ──────────────────────────────────────
  // Desktop / tablette large (≥1024) hors reduced-motion → scènes épinglées + animées.
  // La HAUTEUR de fenêtre ne désactive jamais l'épinglage (pas de bascule statique sur
  // fenêtre basse) : si une étape dépasse la hauteur utile, on la fait défiler
  // verticalement (pan scroll-driven, plus bas). Le flux statique reste réservé au
  // mobile / tablette portrait (<1024) et à prefers-reduced-motion.
  React.useEffect(() => {
    const evaluate = () => {
      const p = !reduce && window.matchMedia("(min-width: 1024px)").matches;
      pinnedRef.current = p;
      setPinned(p);
      // Recalcul complet de la réserve de scroll au (re)dimensionnement.
      maxOverflowRef.current = 0;
      setReservePx(0);
      if (p) {
        // Caler l'étape sur la position de scroll réelle (sinon la 1re vue afficherait
        // toute la scène au lieu de son état initial — titre seul).
        const v = scrollYProgress.get();
        const init = Math.min(steps - 1, Math.max(0, Math.floor(v * steps + 0.0001)));
        stepRef.current = init;
        stepStartRef.current = init / steps; // début nominal de l'étape initiale
        setStep(init);
      } else {
        stepRef.current = steps - 1;
        setStep(steps - 1);
      }
    };
    evaluate();
    window.addEventListener("resize", evaluate);
    window.visualViewport?.addEventListener("resize", evaluate);
    return () => {
      window.removeEventListener("resize", evaluate);
      window.visualViewport?.removeEventListener("resize", evaluate);
    };
  }, [reduce, steps, scrollYProgress]);

  // Zones mortes + hystérésis : l'étape ne change que franchement passé une marge.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!pinnedRef.current) return;
    const f = v * steps;
    const cur = stepRef.current;
    const M = 0.22; // demi-largeur de zone morte autour d'une frontière (en étapes)
    if (f >= cur + 1 + M || f < cur - M) {
      const next = Math.min(steps - 1, Math.max(0, Math.floor(f + 0.0001)));
      if (next !== cur) {
        stepRef.current = next;
        stepStartRef.current = v; // l'étape commence À la position de scroll réelle (hystérésis-aware)
        setStep(next);
      }
    }
  });

  // Pilote l'opacité du contenu selon la position réelle du sticky (voir plus haut).
  React.useEffect(() => {
    if (!pinned) {
      contentOpacity.set(1);
      return;
    }
    const el = stickyRef.current;
    if (!el) return;
    const readHeader = () =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--demo-header-height"),
      ) || 0;
    let headerH = readHeader();
    let raf = 0;
    const update = () => {
      raf = 0;
      const delta = el.getBoundingClientRect().top - headerH;
      const op =
        delta >= 0
          ? 1 - Math.min(1, delta / FADE_ENTER) // entrée : sticky encore sous la ligne d'épinglage
          : 1 - Math.min(1, -delta / FADE_LEAVE); // sortie : sticky remonté au-dessus
      contentOpacity.set(op);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      headerH = readHeader();
      onScroll();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [pinned, contentOpacity]);

  // ── Pan vertical scroll-driven : étape ACTIVE plus haute que la hauteur utile ──
  // Au lieu de couper (ou de désactiver l'animation), on déplace le contenu de l'étape
  // courante de 0 → −overflow au fil du scroll DANS l'étape : on lit le haut, on
  // descend en douceur, on lit le bas, puis sortie. On mesure l'étape réellement
  // rendue (pas le fallback statique qui empile toutes les variantes). Ressort = pas
  // de saut ; aucune scrollbar interne ; aucune animation supprimée.
  const applyPan = React.useCallback(() => {
    if (!pinnedRef.current) {
      panY.set(0);
      return;
    }
    // localProgress normalisé sur la VRAIE plage de scroll de l'étape active :
    //   local = (globalProgress − stepStart) / (stepEnd − stepStart)
    // stepEnd = frontière nominale suivante, ou 1 pour la DERNIÈRE étape — qui doit
    // pouvoir atteindre local = 1 avant la sortie (sinon l'hystérésis la plafonne ~0.78
    // et le bas reste coupé). Anchré au début réel → 0 = haut du contenu (jamais « par
    // le bas » d'emblée).
    const cur = stepRef.current;
    const start = stepStartRef.current;
    // Dernière étape : on sature local à 1 un peu AVANT la sortie (1 − 0.5/steps) pour
    // garantir un MAINTIEN bas lisible (local = 1 sur une vraie plage) avant l'enveloppe
    // de sortie — l'hystérésis ne peut plus la plafonner.
    const end = cur >= steps - 1 ? Math.max(start + 0.05, 1 - 0.5 / steps) : (cur + 1) / steps;
    const span = Math.max(0.04, end - start);
    const local = Math.min(1, Math.max(0, (scrollYProgress.get() - start) / span));
    // entrée + lecture haut [0,0.22] → descente [0.22,0.58] → MAINTIEN bas lisible [0.58,1]
    const t = local <= 0.22 ? 0 : local >= 0.58 ? 1 : (local - 0.22) / 0.36;
    panY.set(-overflowRef.current * (t * t * (3 - 2 * t)));
  }, [panY, scrollYProgress, steps]);

  React.useEffect(() => {
    if (!pinned) {
      overflowRef.current = 0;
      panY.set(0);
      setHasOverflow(false);
      return;
    }
    const safe = safeRef.current;
    const sticky = stickyRef.current;
    if (!safe || !sticky) return;
    const SAFE_BOTTOM = 18; // respiration sous le bas du contenu une fois révélé
    const HOLD_RESERVE = 150; // distance de scroll pour lire le haut PUIS maintenir le bas
    const measure = () => {
      const ov = Math.max(0, safe.scrollHeight - sticky.clientHeight + SAFE_BOTTOM);
      overflowRef.current = ov;
      setHasOverflow(ov > 1);
      // Réserve de distance de scroll = plus haut dépassement vu + maintien lisible.
      // La scène reste réellement plus longtemps disponible (pas qu'un translateY).
      if (ov > maxOverflowRef.current) {
        maxOverflowRef.current = ov;
        setReservePx(Math.round(ov + HOLD_RESERVE));
      }
      applyPan();
    };
    measure();
    let ro: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(measure);
      ro.observe(safe);
    }
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [pinned, step, applyPan, panY]);

  useMotionValueEvent(scrollYProgress, "change", applyPan);

  const effectiveStep = pinned ? step : steps - 1;

  const value = React.useMemo<SceneState>(
    () => ({ step: effectiveStep, steps, pinned, progress: scrollYProgress }),
    [effectiveStep, steps, pinned, scrollYProgress],
  );

  return (
    <section
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      className={cn("demo-pin", !pinned && "demo-pin--static", className)}
      style={
        pinned
          ? { height: reservePx > 0 ? `calc(${steps * 100}vh + ${reservePx}px)` : `${steps * 100}vh` }
          : undefined
      }
    >
      <div className="demo-pin__sticky" ref={stickyRef}>
        {decor ? <div className="demo-stage__decor">{decor}</div> : null}
        <motion.div
          ref={safeRef}
          className={cn(
            "demo-stage demo-safe",
            // contenu ancré en haut si la scène est "top" OU si elle déborde (le pan a
            // alors besoin d'un point de départ haut pour révéler le bas sans couper le titre).
            (align === "top" || hasOverflow) && "demo-safe--top",
          )}
          style={pinned ? { opacity: contentOpacity, y: panYSmooth } : undefined}
        >
          <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
        </motion.div>
      </div>
    </section>
  );
}

/** Décor de scène statique (pas d'animation infinie) : grille fine + halos. */
export function SceneDecor({ tone = "violet" }: { tone?: "violet" | "trust" }) {
  return (
    <>
      <div className="demo-grid-field" />
      <div className="demo-halo demo-halo--violet" style={{ width: 460, height: 460, left: "-8%", top: "6%" }} />
      <div
        className={cn("demo-halo", tone === "trust" ? "demo-halo--violet" : "demo-halo--champagne")}
        style={{ width: 520, height: 520, right: "-10%", top: "16%" }}
      />
      <div className="demo-halo demo-halo--white" style={{ width: 420, height: 420, left: "32%", bottom: "-14%" }} />
    </>
  );
}

/**
 * Apparition pilotée par l'étape. Montage CONDITIONNEL (AnimatePresence) : un bloc
 * masqué ne réserve pas d'espace → les compositions qui s'accumulent ne dépassent
 * jamais la hauteur utile (pas de titre sous le header, pas de carte vide).
 */
export function Appear({
  when,
  children,
  y = 14,
  className,
  durationIn = 0.5,
}: {
  when: boolean;
  children: React.ReactNode;
  y?: number;
  className?: string;
  durationIn?: number;
}) {
  return (
    <AnimatePresence initial={false}>
      {when ? (
        <motion.div
          key="a"
          className={className}
          initial={{ opacity: 0, y }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: durationIn, ease: DEMO_EASE }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ScenePhrase({ when, children, className }: { when: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Appear when={when} y={18} className={className}>
      {children}
    </Appear>
  );
}

/**
 * Échange d'état comparatif SANS carte vide : crossfade (l'ancien et le nouveau
 * se chevauchent) dans un conteneur à hauteur stable → aucun saut de layout.
 */
export function SceneSwap({
  index,
  items,
  className,
  minHeight,
}: {
  index: number;
  items: React.ReactNode[];
  className?: string;
  minHeight?: number | string;
}) {
  const i = Math.min(Math.max(index, 0), items.length - 1);
  return (
    <div className={cn("relative", className)} style={{ minHeight }}>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={i}
          className="absolute inset-x-0 top-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.45, ease: DEMO_EASE }}
        >
          {items[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
