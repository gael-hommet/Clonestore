// src/lib/clonechat/inspector/surface-registry.ts
// C1.8 BLOC C — REGISTRE OFFICIEL DES SURFACES CLONESTORE (pour CloneInspector).
//
// Le problème réel, reproduit sur une VRAIE capture : une capture de CONTENU (le navigateur
// photographie la page, pas sa barre d'adresse) ne montre AUCUNE URL. Le fournisseur décrit
// donc des boutons, jamais un chemin — et CloneInspector, faute de preuve de route, restait sur
// « je ne peux pas conclure ». La réponse en prose, elle, identifiait pourtant la page.
//
// Ce registre comble l'écart SANS rouvrir le faux-positif « Pierre » : une surface n'est
// reconnue que si PLUSIEURS signaux DISTINCTIFS (multi-mots, propres à la page) sont réellement
// présents. Un seul mot générique ne prouve jamais rien.
//
// INVARIANT DUR : chaque `route` d'une surface DOIT exister dans le registre de routes canonique.
// Une surface qui pointerait vers une route inexistante est ignorée à l'exécution — invention
// structurellement impossible. (Un test vérifie que TOUTES les surfaces sont canoniques.)
//
// HONNÊTETÉ DE COUVERTURE : on ne seed QUE des surfaces réellement OBSERVÉES (capture réelle +
// sortie fournisseur enregistrée). Inventer les signaux d'une page qu'on n'a pas vue serait
// exactement le faux état qu'on s'interdit. Le registre est extensible au fil des observations.

import { getRouteEntry } from "../../nav/route-registry";

export interface CloneStoreSurface {
  readonly route: string;
  /** Signaux DISTINCTIFS (multi-mots) réellement visibles sur cette surface. */
  readonly signals: readonly RegExp[];
  /** Nombre minimal de signaux distincts requis (≥ 2 : jamais un seul indice). */
  readonly minSignals: number;
  /** Comment cette surface a été établie (traçabilité — jamais une supposition). */
  readonly observedFrom: string;
}

/**
 * Chaque entrée est issue d'une capture RÉELLE et de la sortie RÉELLE du fournisseur.
 * Ne jamais ajouter une surface sans l'avoir observée.
 */
export const CLONESTORE_SURFACES: readonly CloneStoreSurface[] = Object.freeze([
  {
    route: "/agents/pierre",
    // Observé le 2026-07-14 sur une vraie capture rendue par le navigateur, analysée par OpenAI.
    // Signaux propres à la page de présentation de Pierre — aucun n'est un mot générique isolé.
    signals: [
      /voir la d[ée]mo pierre/i,
      /pr[ée]parer l['’ ]?acc[èe]s/i,
      /poser une question/i,
      /page de pr[ée]sentation de pierre/i,
    ],
    minSignals: 2,
    observedFrom: "capture réelle /agents/pierre + sortie fournisseur enregistrée (2026-07-14)",
  },
]);

/**
 * Cherche la surface CloneStore prouvée par le texte d'une capture (summary + éléments visibles).
 *
 * Renvoie la route UNIQUEMENT si :
 *   · au moins `minSignals` signaux distinctifs sont réellement présents, ET
 *   · la route est bien connue du registre canonique (double garde anti-invention), ET
 *   · une seule surface correspond (aucune ambiguïté).
 */
export function matchSurface(text: string): string | null {
  const hay = (text ?? "").toLowerCase();
  const hits: string[] = [];

  for (const surface of CLONESTORE_SURFACES) {
    // Garde anti-invention : une surface vers une route absente du registre canonique est ignorée.
    if (!getRouteEntry(surface.route)) continue;

    const matched = surface.signals.filter((rx) => rx.test(hay)).length;
    if (matched >= surface.minSignals) hits.push(surface.route);
  }

  const unique = Array.from(new Set(hits));
  return unique.length === 1 ? unique[0] : null; // ambiguïté ⇒ on ne tranche pas
}
