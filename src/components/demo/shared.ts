// /demo — Constantes partagées entre l'orchestrateur et les scènes.

/** layoutId du motif de mission utilisé pour la transition élément-partagé. */
export const SHARED_MISSION_LAYOUT_ID = "demo-mission-shared";

/** Ordre + métadonnées des scènes pour le rail de progression (E2.1 → E2.10). */
export const DEMO_SCENE_NAV = [
  { id: "demo-opening", short: "1", label: "Ouverture" },
  { id: "demo-fragmentation", short: "2", label: "Fragmentation" },
  { id: "demo-category", short: "3", label: "Employé IA" },
  { id: "demo-system", short: "4", label: "Système" },
  { id: "demo-footprint", short: "5", label: "Empreinte" },
  { id: "demo-scale", short: "6", label: "Échelle" },
  { id: "demo-trust", short: "7", label: "Gouvernance" },
  { id: "demo-pierre-scope", short: "8", label: "Pierre RH" },
  { id: "demo-organization", short: "9", label: "Organisation" },
  { id: "demo-completion", short: "10", label: "La preuve" },
] as const;
