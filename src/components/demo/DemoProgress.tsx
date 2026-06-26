"use client";

// /demo — Rail de progression des scènes + barre de progression au scroll.
// Desktop : rail latéral discret. Tous écrans : fine barre de progression en haut.

import * as React from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { DEMO_SCENE_NAV } from "./shared";
import { useDemoReducedMotion } from "./primitives/motion";

export function DemoProgress({ activeId }: { activeId: string }) {
  const { scrollYProgress } = useScroll();
  const reduce = useDemoReducedMotion();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  function goTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <>
      <motion.div
        className="demo-progressbar"
        style={{ scaleX, width: "100%" }}
        aria-hidden="true"
      />

      <nav className="demo-progress" aria-label="Progression de la présentation">
        {DEMO_SCENE_NAV.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className="demo-progress__dot"
            aria-current={activeId === scene.id}
            aria-label={`Aller à la scène ${scene.short} — ${scene.label}`}
            onClick={() => goTo(scene.id)}
          >
            <span className="demo-progress__label">{scene.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
