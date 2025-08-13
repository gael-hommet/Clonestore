"use client";

// PIERRE ZERO-SCROLL DEMO PLAYER — the scene holder. Renders exactly ONE scene at a
// time (keyed by scene id so React remounts it) with a fast slide/fade transition
// that is fully skipped under prefers-reduced-motion. It never stacks scenes and
// never scrolls: it is `flex:1; min-height:0; overflow:hidden`.

import type { ReactNode } from "react";
import type { SceneId } from "./player-machine";

export function SceneViewport({
  sceneId,
  direction,
  reducedMotion,
  children,
}: {
  sceneId: SceneId;
  direction: 1 | -1;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const anim = reducedMotion ? "" : direction === 1 ? " pdp-scene--enter-fwd" : " pdp-scene--enter-back";
  return (
    <div className="pdp-stage">
      <section
        key={sceneId}
        className={`pdp-scene${anim}`}
        data-scene-id={sceneId}
        aria-live="polite"
      >
        {children}
      </section>
    </div>
  );
}
