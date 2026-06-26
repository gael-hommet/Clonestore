// CloneStory — segment /founding-partners : layout ISOLÉ.
//
// • Polices AUTO-HÉBERGÉES (Fontsource, licence SIL OFL 1.1), bundlées dans le
//   chunk de ce segment uniquement → AUCUN fetch Google Fonts (ni au build, ni
//   chez le visiteur), `font-display: swap` intégré. Les @font-face définissent
//   « Bodoni Moda Variable » / « Manrope Variable », utilisées seulement sous
//   [data-clonestory] → aucune modification de la typographie globale CloneStore.
//     - Bodoni Moda (axe poids, normal + italique) → titres, noms, numéros.
//     - Manrope (axe poids) → interface et textes.
// • Importe le CSS route-scopé clonestory.css ICI uniquement (aucune fuite globale).
// • Enveloppe tout dans ClonestoryRoot ([data-clonestory]).
// • noindex tant que l'univers n'est pas lancé publiquement.

import "@fontsource-variable/bodoni-moda/wght.css";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/manrope/wght.css";
import "./clonestory.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import ClonestoryRoot from "@/components/clonestory/ClonestoryRoot";
import ClonestoryBodyFlag from "@/components/clonestory/ClonestoryBodyFlag";
import { PROGRAM_NAME, UNIVERSE_NAME } from "@/lib/clonestory/founding-partners/vocabulary";

export const metadata: Metadata = {
  title: `${PROGRAM_NAME} — ${UNIVERSE_NAME}`,
  description:
    "CloneStory — le registre officiel des personnes ayant contribué de manière vérifiée au commencement de CloneStore.",
  robots: { index: false, follow: false },
};

export default function FoundingPartnersLayout({ children }: { children: ReactNode }) {
  return (
    <ClonestoryRoot>
      {/* Masque l'en-tête/pied commerciaux tant qu'on est dans CloneStory. */}
      <ClonestoryBodyFlag />
      <header className="csy-masthead">
        <Link href="/founding-partners" className="csy-masthead__mark">{UNIVERSE_NAME}</Link>
        <Link href="/" className="csy-masthead__back">Retour à CloneStore</Link>
      </header>
      {children}
    </ClonestoryRoot>
  );
}
