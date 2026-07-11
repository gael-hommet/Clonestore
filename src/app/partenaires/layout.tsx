// Cabinets Fondateurs CloneStore — segment /partenaires : layout ISOLÉ.
//
// • Polices AUTO-HÉBERGÉES (Fontsource, licence SIL OFL 1.1), bundlées dans le
//   chunk de ce segment uniquement → AUCUN fetch Google Fonts. Les @font-face
//   définissent « Bodoni Moda Variable » (titres) / « Manrope Variable »
//   (interface), utilisées seulement sous [data-partenaires] → aucune
//   modification de la typographie globale CloneStore.
// • Importe le CSS route-scopé partenaires.css ICI uniquement (aucune fuite globale).
// • Pose le flag <body> (PartenairesBodyFlag) qui masque l'en-tête/pied clairs.
//
// La <metadata> SEO vit dans page.tsx (page serveur).

import "@fontsource-variable/bodoni-moda/wght.css";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/manrope/wght.css";
import "./partenaires.css";

import type { ReactNode } from "react";
import PartenairesBodyFlag from "@/components/partenaires/PartenairesBodyFlag";

export default function PartenairesLayout({ children }: { children: ReactNode }) {
  return (
    <div data-partenaires>
      <PartenairesBodyFlag />
      {children}
    </div>
  );
}
