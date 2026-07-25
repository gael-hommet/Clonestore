"use client";

// /demo — Moteur de scènes ROBUSTE (refonte d'affichage, urgence).
//
// Le moteur épinglé précédent (sticky + enveloppe d'opacité pilotée au scroll +
// pan translateY) produisait, sur écrans courts et en cours de scroll : scène
// active quasi transparente, titre coupé sous le header, scènes superposées en
// fantôme. Conformément à la règle « stabilité avant animation », il est remplacé
// par un modèle EN FLUX :
//   • chaque scène est une section normale, haute d'un viewport utile (moins le
//     header), contenu centré, JAMAIS coupée (aucun overflow:clip, aucune hauteur
//     fixe) ;
//   • le conteneur reste TOUJOURS pleinement opaque (aucune enveloppe d'opacité) ;
//   • seuls les ÉLÉMENTS INTERNES s'animent, à l'entrée dans le viewport, UNE fois,
//     puis restent lisibles (jamais de fondu de sortie) ;
//   • plus aucun sticky, plus aucun pan, plus aucun IntersectionObserver de step.
//
// L'API publique est INCHANGÉE (PinnedScene / Appear / ScenePhrase / SceneSwap /
// useScene / SceneDecor / useDemoHeaderHeightVar) : les 9 chapitres ne sont pas
// modifiés. `useScene` fige step = steps-1 et pinned = false ⇒ chaque acte révèle
// l'intégralité de sa substance (les gardes sont toutes en `step >= …` / `!pinned`).

import * as React from "react";
import { motion, AnimatePresence, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
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
      const h = header ? Math.round(header.getBoundingClientRect().height) : 72;
      root.style.setProperty("--demo-header-height", `${Math.max(52, h)}px`);
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

/**
 * Scène en flux : plein viewport utile, contenu centré, toujours opaque, jamais
 * coupée. `steps` est conservé pour l'API mais le contenu est intégralement révélé
 * (step = steps-1). Les éléments internes s'animent via <Appear> à l'entrée.
 */
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
  align?: "center" | "top";
  children: React.ReactNode;
}) {
  const ref = useSceneView<HTMLElement>(event);
  const progress = useMotionValue(1);

  const value = React.useMemo<SceneState>(
    () => ({ step: steps - 1, steps, pinned: false, progress }),
    [steps, progress],
  );

  return (
    <section ref={ref} id={id} aria-label={ariaLabel} className={cn("demo-pin demo-pin--static demo-scene-flow", className)}>
      <div className="demo-pin__sticky">
        {decor ? <div className="demo-stage__decor">{decor}</div> : null}
        <div className={cn("demo-stage demo-safe", align === "top" && "demo-safe--top")}>
          <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
        </div>
      </div>
    </section>
  );
}

/** Décor de scène statique : grille fine + halos. */
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
 * Apparition d'un élément INTERNE à l'entrée dans le viewport, UNE seule fois,
 * puis il reste pleinement opaque (aucun fondu de sortie ⇒ jamais de texte
 * essentiel transparent). `when=false` ⇒ non rendu (garde conditionnelle des actes).
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
  const reduce = useReducedMotion();
  if (!when) return null;
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      // "some" : un ratio proportionnel ne serait jamais atteint par un bloc très
      // haut ⇒ invisibilité permanente. Un pixel visible suffit à déclencher.
      viewport={{ once: true, amount: "some", margin: "0px 0px -6% 0px" }}
      transition={{ duration: durationIn, ease: DEMO_EASE }}
    >
      {children}
    </motion.div>
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
 * Échange d'état comparatif. Dans le modèle en flux, `useScene` fige le step ⇒ les
 * actes empruntent leur branche « non épinglée » (rendu empilé) et n'appellent plus
 * SceneSwap. Conservé pour compat : rend l'item courant en fondu croisé stable.
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
