"use client";

import * as React from "react";
import { useDemoReducedMotion } from "./motion";

export { useDemoReducedMotion };

/**
 * Rend une version statique du contenu si l'utilisateur préfère réduire les
 * animations, sinon la version animée. Utile pour les illustrations qui ont une
 * variante non animée plus lisible.
 */
export function ReducedMotionFallback({
  animated,
  fallback,
}: {
  animated: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const reduce = useDemoReducedMotion();
  return <>{reduce ? fallback : animated}</>;
}
