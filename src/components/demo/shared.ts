// /demo — Constantes partagées entre l'orchestrateur et les actes.

/** layoutId du motif de mission utilisé pour la transition élément-partagé. */
export const SHARED_MISSION_LAYOUT_ID = "demo-mission-shared";

/** Ordre + métadonnées des 7 actes pour le rail de progression. */
export const DEMO_SCENE_NAV = [
  { id: "demo-act-choc", short: "1", label: "La preuve" },
  { id: "demo-act-open", short: "2", label: "CloneStore" },
  { id: "demo-act-value", short: "3", label: "L'échelle" },
  { id: "demo-act-difference", short: "4", label: "La différence" },
  { id: "demo-act-system", short: "5", label: "Le système" },
  { id: "demo-act-result", short: "6", label: "Le résultat" },
  { id: "demo-act-trust", short: "7", label: "La confiance" },
  { id: "demo-act-cost", short: "8", label: "Le coût" },
  { id: "demo-act-pierre", short: "9", label: "Pierre" },
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
