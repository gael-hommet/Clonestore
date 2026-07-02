"use client";

// Overlay du guided tour (P9.1).
// Trois couches :
//  - .csgt-block : plein écran transparent, capte les clics (empêche toute
//    interaction/navigation accidentelle avec la page pendant le tour) ;
//  - .csgt-scrim : voile flouté + teinté ; quand une cible existe, un « trou »
//    doux (mask radial) laisse la cible NETTE et lisible ;
//  - .csgt-ring : liseré premium autour de la cible (focus).
// Réutilise les tokens CloneStore (couleurs, rayons, ombres). Aucune nouvelle
// direction artistique.

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { Rect } from "@/lib/guided-tour";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function GuidedTourOverlay({
  spotlight,
  reduced,
  stepKey,
}: {
  spotlight: Rect | null;
  reduced: boolean;
  /** Change à chaque étape → le liseré se re-anime (« pop » de focus). */
  stepKey?: string;
}) {
  const hasHole = !!spotlight;

  const scrimStyle: CSSProperties | undefined = hasHole
    ? ({
        "--csgt-x": `${spotlight.left + spotlight.width / 2}px`,
        "--csgt-y": `${spotlight.top + spotlight.height / 2}px`,
        "--csgt-rx": `${Math.max(spotlight.width / 2, 40)}px`,
        "--csgt-ry": `${Math.max(spotlight.height / 2, 40)}px`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <div className="csgt-block" aria-hidden="true" />

      <motion.div
        className={cn("csgt-scrim", hasHole && "csgt-scrim--hole")}
        style={scrimStyle}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.32, ease: EASE }}
        aria-hidden="true"
      />

      <AnimatePresence mode="wait">
        {hasHole ? (
          <motion.div
            key={stepKey}
            className="csgt-ring"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
            initial={reduced ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
