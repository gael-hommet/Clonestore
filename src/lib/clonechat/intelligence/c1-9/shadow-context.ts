// C1.9 — CONTEXTE SHADOW EXPLICITEMENT EN LECTURE SEULE.
//
// Le shadow observe ; il n'agit jamais. Ce type rend l'interdiction STRUCTURELLE plutôt
// que conventionnelle : un contexte shadow ne peut pas porter `toolsEnabled: true`, et
// tout point d'effet du runtime exige la preuve du contraire.
//
// Les garanties, énoncées une fois pour toutes :
//   — aucun outil exécuté (même en lecture) ;
//   — aucune proposition persistée ;
//   — aucune mission, aucune action Pierre ;
//   — aucune écriture d'historique ;
//   — aucun CTA affiché ;
//   — la réponse montrée à l'utilisateur n'est jamais modifiée ;
//   — le coût est plafonné par un budget de processus.

/** Marque nominale : impossible à fabriquer par erreur depuis un objet littéral. */
declare const READ_ONLY_BRAND: unique symbol;

export interface ShadowContext {
  readonly [READ_ONLY_BRAND]: true;
  readonly readOnly: true;
  readonly toolsEnabled: false;
  readonly mayPersist: false;
  readonly mayMutateResponse: false;
  readonly requestId: string;
}

export function createShadowContext(requestId: string): ShadowContext {
  return Object.freeze({
    readOnly: true,
    toolsEnabled: false,
    mayPersist: false,
    mayMutateResponse: false,
    requestId,
  }) as ShadowContext;
}

/**
 * Garde d'exécution. Tout code qui s'apprête à produire un effet doit passer par ici ;
 * sous contexte shadow, il échoue au lieu d'agir silencieusement.
 */
export function assertNoEffect(ctx: ShadowContext | null, effect: string): void {
  if (ctx) {
    throw new Error(`C1.9 shadow: effet interdit tenté sous contexte lecture seule (${effect})`);
  }
}
