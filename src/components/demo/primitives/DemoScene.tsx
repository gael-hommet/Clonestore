"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useSceneView } from "./useSceneView";
import type { DemoEventName } from "@/lib/demo/presentation/analytics";

/**
 * Enveloppe de scène : <section> sémantique + déclenchement analytics à la vue.
 * Le contenu des scènes reste centré sur la narration ; la mécanique (section,
 * id d'ancre, mesure) est mutualisée ici.
 */
export function DemoScene({
  id,
  event,
  hero = false,
  seam = true,
  ariaLabel,
  className,
  children,
}: {
  id: string;
  event?: DemoEventName;
  hero?: boolean;
  seam?: boolean;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useSceneView<HTMLElement>(event);

  return (
    <section
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      className={cn("demo-section", hero && "demo-section--hero", className)}
    >
      {seam && !hero ? <div className="demo-seam" aria-hidden="true" /> : null}
      <div className="demo-shell">{children}</div>
    </section>
  );
}
