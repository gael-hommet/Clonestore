// CloneStory — Conteneur racine ISOLÉ.
//
// Pose l'attribut d'isolation `data-clonestory` (cible exclusive de tout le CSS
// route-scopé `clonestory.css`). `isolation: isolate` (dans le CSS) crée un
// contexte d'empilement propre : aucune fuite de z-index / blend vers le reste du
// site. Les familles de polices sont déclarées dans clonestory.css et chargées via
// <link> par le layout du segment. Composant serveur (aucun état).

import type { ReactNode } from "react";

export default function ClonestoryRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-clonestory="" className={["csy-root", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
