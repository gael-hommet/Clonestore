// /demo — Constantes partagées entre l'orchestrateur et les actes.

/** layoutId du motif de mission utilisé pour la transition élément-partagé. */
export const SHARED_MISSION_LAYOUT_ID = "demo-mission-shared";

/** Ordre + métadonnées des 7 actes pour le rail de progression. */
export const DEMO_SCENE_NAV = [
  { id: "demo-act-open", short: "1", label: "CloneStore" },
  { id: "demo-act-difference", short: "2", label: "La différence" },
  { id: "demo-act-system", short: "3", label: "Le système" },
  { id: "demo-act-result", short: "4", label: "Le résultat" },
  { id: "demo-act-trust", short: "5", label: "La confiance" },
  { id: "demo-act-cost", short: "6", label: "Le coût" },
  { id: "demo-act-pierre", short: "7", label: "Pierre" },
] as const;

/** Sujets d'approfondissement facultatifs (couche 3 — le tiroir de détail). */
export type DeepDiveTopic =
  | "cloneos"
  | "empreinte"
  | "cloneguard"
  | "clonecontinuum"
  | "clonetrace"
  | "sizing"
  | "frontier"
  | "organization";
