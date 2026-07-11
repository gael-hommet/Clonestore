"use client";

// Cabinets Fondateurs CloneStore — marque le <body> pendant la présence sur
// /partenaires. Pose data-partenaires-active="true" au montage, le retire au
// démontage. Les styles route-scopés (partenaires.css) masquent alors l'en-tête
// et le pied commerciaux clairs UNIQUEMENT tant que cet attribut existe — filet
// de sécurité côté client en complément de la garde :has([data-partenaires])
// qui, elle, agit dès le premier rendu serveur (aucun flash du chrome clair).

import { useEffect } from "react";

export default function PartenairesBodyFlag() {
  useEffect(() => {
    const prev = document.body.getAttribute("data-partenaires-active");
    document.body.setAttribute("data-partenaires-active", "true");
    return () => {
      if (prev === null) document.body.removeAttribute("data-partenaires-active");
      else document.body.setAttribute("data-partenaires-active", prev);
    };
  }, []);
  return null;
}
