"use client";

// Hook public du guided tour (P9.1).
// Permet à n'importe quel composant client (page, aide, menu) de démarrer,
// reprendre ou piloter un tour. Réutilisable au-delà de la découverte publique.

import { useContext } from "react";
import { GuidedTourContext, type GuidedTourApi } from "./guided-tour-context";

export function useGuidedTour(): GuidedTourApi {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) {
    throw new Error("useGuidedTour doit être utilisé dans <GuidedTourProvider>.");
  }
  return ctx;
}

/** Variante non-jetante : retourne null hors provider (usage optionnel). */
export function useOptionalGuidedTour(): GuidedTourApi | null {
  return useContext(GuidedTourContext);
}
