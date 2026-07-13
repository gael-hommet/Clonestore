// src/lib/clonechat/readiness-barrier.ts
// C1.6 — BARRIÈRE DE PRÊT BORNÉE (pure, testable).
//
// Histoire du défaut, en deux temps :
//   · C1.5 a ajouté une barrière parce qu'un message envoyé AVANT la résolution de l'identité
//     partait dans la mauvaise voie (moteur local) et n'atteignait jamais le serveur ;
//   · C1.6 a découvert que cette barrière, si l'identité ne se résout JAMAIS (Supabase lent,
//     throttlé, hors ligne), redevient une PORTE : le composer se fige pour toujours.
//
// La barrière est donc BORNÉE : on attend l'identité, mais jamais au-delà du délai. Passé ce
// délai on envoie quand même — sans RIEN fabriquer. C'est sans risque : le SERVEUR est
// l'autorité d'identité (il lit le cookie de session lui-même) ; au pire le tour part sur la
// voie PUBLIQUE, qui est une vraie conversation CloneChat.
//
// INVARIANT : `awaitReady()` se résout TOUJOURS, et ne renvoie JAMAIS d'identité.

export interface ReadinessBarrier {
  /** Signale que l'identité est résolue. Idempotent : les appels suivants sont sans effet. */
  markReady(): void;
  /** Attend l'identité — au plus `timeoutMs`. Ne rejette jamais. Ne rend aucune identité. */
  awaitReady(): Promise<void>;
  /** Vrai si `markReady()` a déjà été appelé (diagnostic ; n'autorise rien). */
  isReady(): boolean;
}

export const DEFAULT_READY_TIMEOUT_MS = 4000;

export function createReadinessBarrier(
  timeoutMs: number = DEFAULT_READY_TIMEOUT_MS,
  setTimeoutFn: (fn: () => void, ms: number) => unknown = setTimeout,
): ReadinessBarrier {
  let ready = false;
  let resolve: (() => void) | null = null;
  const settled = new Promise<void>((res) => { resolve = res; });

  return {
    markReady() {
      if (ready) return; // idempotent : une résolution tardive ne rejoue rien
      ready = true;
      resolve?.();
      resolve = null;
    },
    async awaitReady() {
      if (ready) return; // déjà prêt : aucun délai inutile
      await Promise.race([
        settled,
        new Promise<void>((res) => { setTimeoutFn(() => res(), timeoutMs); }),
      ]);
      // Volontairement : AUCUNE valeur de retour. La barrière ne fabrique ni utilisateur,
      // ni entreprise, ni jeton — elle ne fait que débloquer l'envoi.
    },
    isReady: () => ready,
  };
}
