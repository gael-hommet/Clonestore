// Guided Tour — restauration de focus (P9.1 correction).
//
// Sélection PURE de la cible de restauration du focus à la fermeture du tour :
//  - l'élément d'origine s'il est encore CONNECTÉ au DOM ;
//  - sinon un repli déterministe (marque de marque / main de la route courante).
// Aucune dépendance DOM directe : on ne manipule que la propriété `isConnected`
// et une fonction de repli fournie par l'appelant → testable en environnement
// `node`.

export interface FocusableLike {
  readonly isConnected: boolean;
  focus?: () => void;
}

/**
 * Retourne l'élément à re-focuser. Jamais un nœud détaché : si `previous` a
 * disparu (ex. changement de route), on renvoie le repli fourni.
 */
export function selectFocusRestoreTarget<T extends FocusableLike>(
  previous: T | null | undefined,
  fallback: T | null | undefined,
): T | null {
  if (previous && previous.isConnected) return previous;
  return fallback ?? null;
}
