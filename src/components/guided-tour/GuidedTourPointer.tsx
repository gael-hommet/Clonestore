"use client";

// Pointeur premium (P9.1).
// Curseur stylisé en SVG (graphite CloneStore + accent violet), avec un halo qui
// « respire » et un petit tap. Aucune émoji, aucune main cartoon. Positionné en
// coordonnées viewport (position:fixed) sur l'ancre calculée par la géométrie
// pure. En mouvement réduit : pas d'animation, halo statique discret.

import { motion } from "framer-motion";
import type { PointerAnchor } from "@/lib/guided-tour";

const EASE = [0.22, 1, 0.36, 1] as const;

export function GuidedTourPointer({
  anchor,
  reduced,
}: {
  anchor: PointerAnchor;
  reduced: boolean;
}) {
  return (
    <motion.div
      className="csgt-pointer"
      style={{ top: anchor.y, left: anchor.x }}
      initial={reduced ? false : { opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      transition={{ duration: reduced ? 0 : 0.28, ease: EASE }}
      aria-hidden="true"
    >
      <span
        className={reduced ? "csgt-pointer__halo csgt-pointer__halo--static" : "csgt-pointer__halo"}
      />
      <svg
        className="csgt-pointer__cursor"
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 5.4 L8 25.8 L13.1 20.9 L16.4 28.4 L19.7 27 L16.4 19.7 L23.4 19.2 Z"
          fill="#151922"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="5.4" r="2.4" fill="#6b63e8" stroke="#ffffff" strokeWidth="1.1" />
      </svg>
    </motion.div>
  );
}
