// src/lib/clonechat/server/resilient-budget.ts
// C1.8 FINAL — RÉSILIENCE DU BUDGET, ET SURTOUT : OBSERVABILITÉ.
//
// ═══ LE DÉFAUT QUI RENDAIT LE PRODUIT MUET EN PRODUCTION ═══
//
// La route écrivait ceci :
//
//     try { reservation = await stores.budget.reserve(...); }
//     catch { reservation = NO_RESERVATION; }          // ← et rien d'autre
//
// Or, sans réservation, aucun appel modèle n'est permis (garde de coût, parfaitement légitime).
// Conséquence : la base durable CloneChat n'ayant JAMAIS reçu la migration P9.4.1 en production,
// **chaque** `reserve()` levait une erreur, **chaque** appel OpenAI était refusé, et **chaque**
// réponse retombait sur le moteur déterministe — sans UNE SEULE ligne de log. Le produit
// paraissait bête, et rien nulle part ne disait pourquoi.
//
// ═══ LA DISTINCTION QUI MANQUAIT ═══
//
//   · budget REFUSÉ    → un plafond est atteint. C'est une décision MÉTIER, elle doit tenir.
//   · budget INDISPONIBLE → l'infrastructure est en panne. Ce n'est PAS une décision.
//
// Les deux s'effondraient sur le même « pas de réservation ». On les sépare :
// une panne de comptabilité bascule sur le compteur EN MÉMOIRE (les plafonds continuent donc de
// s'appliquer — le coût reste borné), le produit continue de fonctionner, et la dégradation est
// EXPLICITE (log + drapeau exposé dans la preuve runtime de la réponse).
//
// On ne dépense pas sans compter. On refuse simplement de rendre le produit muet parce qu'une
// table manque.

import type { DurableBudget } from "../durable/budget-store";

export type BudgetHealth = "healthy" | "degraded_in_memory";

interface Degradation {
  health: BudgetHealth;
  reason: string | null;
  since: string | null;
}

const g = globalThis as unknown as { __ccBudgetHealth?: Degradation };
function state(): Degradation {
  return (g.__ccBudgetHealth ??= { health: "healthy", reason: null, since: null });
}

/** Santé courante du sous-système budget (exposée dans la preuve runtime — jamais un secret). */
export function budgetHealth(): BudgetHealth { return state().health; }
export function budgetDegradationReason(): string | null { return state().reason; }

/** Tests uniquement : remet la santé à zéro. */
export function __resetBudgetHealth(): void {
  g.__ccBudgetHealth = { health: "healthy", reason: null, since: null };
}

function degrade(err: unknown, at: string): void {
  const s = state();
  if (s.health === "degraded_in_memory") return; // on ne hurle qu'une fois
  s.health = "degraded_in_memory";
  s.reason = (err as { message?: string })?.message ?? String(err);
  s.since = at;
  try {
    // BRUYANT ET DÉLIBÉRÉ. Le silence est précisément ce qui a coûté ce défaut.
    console.error(
      "[clonechat] BUDGET DURABLE INDISPONIBLE → bascule sur le compteur en mémoire. " +
      "Les plafonds s'appliquent toujours, mais la comptabilité n'est plus durable. " +
      "Cause : " + s.reason,
    );
  } catch { /* jamais faire échouer un tour pour un log */ }
}

/**
 * Enveloppe le budget DURABLE d'un filet de sécurité EN MÉMOIRE.
 *
 * Règle : une ERREUR (panne) bascule en mémoire. Un REFUS (plafond atteint) est respecté tel quel
 * — on ne contourne JAMAIS un plafond en prétendant que la base est en panne.
 *
 * La bascule est COLLANTE par processus : une fois la base jugée indisponible, on cesse de la
 * marteler à chaque tour.
 */
export function createResilientBudget(durable: DurableBudget, memory: DurableBudget): DurableBudget {
  const isMemoryFallbackActive = () => state().health === "degraded_in_memory";

  return {
    async reserve(cfg, scope, estimatedInputTokens, at) {
      if (isMemoryFallbackActive()) return memory.reserve(cfg, scope, estimatedInputTokens, at);
      try {
        return await durable.reserve(cfg, scope, estimatedInputTokens, at);
      } catch (e) {
        // PANNE — pas un refus. Le plafond continue de s'appliquer, en mémoire.
        degrade(e, at);
        return memory.reserve(cfg, scope, estimatedInputTokens, at);
      }
    },

    async commit(reservation, actualTokens) {
      if (isMemoryFallbackActive()) return memory.commit(reservation, actualTokens);
      try { return await durable.commit(reservation, actualTokens); }
      catch (e) { degrade(e, new Date().toISOString()); return memory.commit(reservation, actualTokens); }
    },

    async release(reservation) {
      if (isMemoryFallbackActive()) return memory.release(reservation);
      try { return await durable.release(reservation); }
      catch (e) { degrade(e, new Date().toISOString()); return memory.release(reservation); }
    },

    async recordUsage(record) {
      if (isMemoryFallbackActive()) return memory.recordUsage(record);
      try { return await durable.recordUsage(record); }
      catch (e) { degrade(e, new Date().toISOString()); return memory.recordUsage(record); }
    },

    async snapshot(scope, at) {
      if (isMemoryFallbackActive()) return memory.snapshot(scope, at);
      try { return await durable.snapshot(scope, at); }
      catch (e) { degrade(e, new Date().toISOString()); return memory.snapshot(scope, at); }
    },
  } as DurableBudget;
}
