"use client";

// Portail du guided tour (P9.1).
// Monte le contenu du tour dans <body> — hors de `.cs-main` (contexte
// d'empilement z-index:2) — exactement comme FoundingIntro, afin de recouvrir la
// page (header inclus) SANS toucher au layout. Le wrapper est en display:contents
// (aucune boîte ajoutée). Rien n'est monté avant l'hydratation.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function GuidedTourPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div data-guided-tour="" style={{ display: "contents" }}>
      {children}
    </div>,
    document.body,
  );
}
