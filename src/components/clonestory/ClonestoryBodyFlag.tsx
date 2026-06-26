"use client";

// CloneStory — marque le <body> pendant la présence sur /founding-partners/**.
// Pose data-clonestory-active="true" au montage, le retire au démontage (retour
// vers CloneStore). Les styles CloneStory (clonestory.css) masquent alors l'en-tête
// et le pied commerciaux UNIQUEMENT tant que cet attribut existe — aucune autre
// route n'est affectée, aucune contamination de globals.css.

import { useEffect } from "react";

export default function ClonestoryBodyFlag() {
  useEffect(() => {
    const prev = document.body.getAttribute("data-clonestory-active");
    document.body.setAttribute("data-clonestory-active", "true");
    return () => {
      if (prev === null) document.body.removeAttribute("data-clonestory-active");
      else document.body.setAttribute("data-clonestory-active", prev);
    };
  }, []);
  return null;
}
