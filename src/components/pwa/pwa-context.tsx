"use client";

import { createContext, useContext } from "react";
import type { UsePwa } from "./use-pwa";

/**
 * Contexte PWA : `PwaProvider` appelle `usePwa()` UNE fois et diffuse l'état.
 * Les surfaces (ex. /installer) consomment via `usePwaContext()` sans réenregistrer
 * de service worker ni dupliquer les écouteurs.
 */
export const PwaContext = createContext<UsePwa | null>(null);

export function usePwaContext(): UsePwa | null {
  return useContext(PwaContext);
}
