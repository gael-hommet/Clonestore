// Modes d'autonomie de Pierre — surface PUBLIQUE (démo + fiche).
//
// Adaptateur MINCE au-dessus du modèle produit CANONIQUE et TRUTH-CHECKÉ
// `src/lib/clonestore/pierre-autonomy/model.ts` (P9.5) : on NE réécrit aucun
// libellé (ils sont validés par la matrice de vérité commerciale), et la
// « distribution » affichée est DÉRIVÉE du moteur réel P8 via deriveAutonomyMatrix
// (preuve anti-cosmétique : le mode change réellement la décision). Fonctions pures,
// sûres côté client.

import {
  PRODUCT_AUTONOMY_MODES,
  deriveAutonomyMatrix,
  type ProductAutonomyModeId,
} from "@/lib/clonestore/pierre-autonomy/model";

/**
 * Les 4 niveaux publics = les 4 modes MOTEUR distincts (on écarte le 5e cadrage
 * « Dirigeant + Pierre », qui partage le même mode moteur qu'« Autonomie gouvernée »
 * et n'ajouterait que du texte). L'autonomie croît de gauche à droite.
 */
const PUBLIC_MODE_IDS: readonly ProductAutonomyModeId[] = ["draft", "validation", "controlled", "governed"];

export interface PublicAutonomyMode {
  readonly id: ProductAutonomyModeId;
  readonly engineMode: string;
  readonly level: number; // 0 → 3
  readonly name: string; // libellé canonique
  readonly tagline: string; // l'idée forte, canonique et truth-checkée
  /**
   * Répartition RÉELLE (dérivée du moteur) des actions RH représentatives, en trois
   * groupes lisibles. Visualise, sans texte, ce que le mode change vraiment.
   */
  readonly split: { readonly alone: number; readonly prepared: number; readonly human: number };
}

export const PUBLIC_AUTONOMY_MODES: readonly PublicAutonomyMode[] = PUBLIC_MODE_IDS.map((id, i) => {
  const m = PRODUCT_AUTONOMY_MODES.find((x) => x.id === id)!;
  const mx = deriveAutonomyMatrix(id);
  return {
    id,
    engineMode: m.engineMode,
    level: i,
    name: m.label,
    tagline: m.tagline,
    split: {
      alone: mx.buckets.alone.length + mx.buckets.notify.length, // Pierre le fait seul
      prepared: mx.buckets.prepare.length + mx.buckets.validation.length, // préparé / à valider
      human: mx.buckets.human_only.length + mx.buckets.blocked.length, // réservé humain
    },
  };
});

/** Mode conseillé par défaut (comme le moteur : « normal » ↔ produit « validation »). */
export const DEFAULT_AUTONOMY_MODE_ID: ProductAutonomyModeId = "validation";

/** Les trois groupes de la répartition — libellés produit canoniques (courts). */
export const SPLIT_LABELS = {
  alone: "Pierre le fait seul",
  prepared: "Préparé, vous validez",
  human: "Réservé à un humain",
} as const;

/** Plancher inviolable — reprend la copie canonique de PierreAutonomyPanel. */
export const AUTONOMY_HARD_FLOOR =
  "Les décisions sensibles — disciplinaire, licenciement, médical, juridique — restent réservées à un humain, quel que soit le niveau choisi.";

export const AUTONOMY_INTRO = {
  kicker: "Le niveau d'autonomie, à votre main",
  title: "Vous choisissez ce que Pierre fait seul.",
  lede: "Du brouillon à l'autonomie gouvernée : un curseur, quatre niveaux.",
} as const;

export function publicModeById(id: string): PublicAutonomyMode {
  return PUBLIC_AUTONOMY_MODES.find((m) => m.id === id) ?? PUBLIC_AUTONOMY_MODES[1];
}
