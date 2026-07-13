"use client";

// /demo — Acte 6 : accumulation séquentielle des étapes.
//
// Le compteur de temps de la séquence n'est PAS une animation décorative : il est
// la somme des étapes réellement révélées. Le temps monte parce que les étapes
// s'accumulent — ce que l'on voit est exactement ce que l'on additionne.
//
// SSR / hydratation : l'état initial est « tout révélé ». Le rendu serveur et le
// premier rendu client sont donc identiques (aucun écart d'hydratation), et la
// séquence reste entièrement lisible sans JavaScript. L'accumulation ne démarre
// qu'une fois la scène visible, côté client.
//
// prefers-reduced-motion : aucune accumulation, tout est affiché immédiatement.

import * as React from "react";

export function useSequentialReveal(
  total: number,
  options: { active: boolean; reduce: boolean; intervalMs?: number; resetKey?: string },
): number {
  const { active, reduce, intervalMs = 220, resetKey = "" } = options;
  const [revealed, setRevealed] = React.useState(total);

  React.useEffect(() => {
    if (!active || reduce || total <= 0) {
      setRevealed(total);
      return;
    }

    setRevealed(0);
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      setRevealed(current);
      if (current >= total) window.clearInterval(id);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [active, reduce, total, intervalMs, resetKey]);

  return revealed;
}
