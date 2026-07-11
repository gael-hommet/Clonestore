// src/lib/billing/orders-event-ordering.ts
// Ordonnancement monotone des événements Stripe du flux `orders` — décisions PURES.
//
// PROBLÈME RÉSOLU
// Le flux `orders` reposait sur un simple upsert idempotent (onConflict user_id,agent_slug).
// Rien n'empêchait :
//   • un même event Stripe rejoué de ré-appliquer son effet ;
//   • un ANCIEN `checkout.session.completed` rejoué de ressusciter une commande annulée
//     (upsert réécrivait status=active, ended_at=null, started_at=now) ;
//   • un event plus vieux de faire reculer un état terminal.
//
// PRINCIPE : ordre total (event_created, puis stripe_event_id lexicographique) par objet
// (subscription). On maintient une « ligne d'eau » = l'event le plus récent DÉJÀ appliqué
// pour cet objet. Un event dont le rang est ≤ la ligne d'eau est périmé (stale) → ignoré.
// Un event strictement plus récent est appliqué (y compris une vraie réactivation ultérieure).

export type EventRank = { eventCreated: number; eventId: string };

/** Compare deux rangs (ordre total, déterministe). <0 si a précède b. */
export function compareEventRank(a: EventRank, b: EventRank): number {
  if (a.eventCreated !== b.eventCreated) return a.eventCreated - b.eventCreated;
  if (a.eventId < b.eventId) return -1;
  if (a.eventId > b.eventId) return 1;
  return 0;
}

export type OrderingDecision =
  | { action: "apply" }
  | { action: "stale"; reason: string };

/**
 * Décide si un event du flux orders doit être appliqué, compte tenu du dernier event
 * déjà appliqué pour le même objet (subscription).
 *
 *   pas de ligne d'eau (premier event)   → apply
 *   rang > ligne d'eau                    → apply (plus récent, y c. réactivation)
 *   rang ≤ ligne d'eau                    → stale (rejeu ou hors-ordre plus ancien)
 *
 * L'égalité de rang compte comme stale : c'est le MÊME event déjà appliqué (le rejeu exact
 * est de toute façon intercepté en amont par l'unicité du stripe_event_id).
 */
export function decideOrdersEventOrdering(input: {
  incoming: EventRank;
  highWater: EventRank | null;
}): OrderingDecision {
  if (!input.highWater) return { action: "apply" };
  const cmp = compareEventRank(input.incoming, input.highWater);
  if (cmp > 0) return { action: "apply" };
  return {
    action: "stale",
    reason: `event ${input.incoming.eventId}@${input.incoming.eventCreated} <= ligne d'eau ${input.highWater.eventId}@${input.highWater.eventCreated}`,
  };
}

// ── Empreinte de payload (détection de conflit « même ID, contenu différent ») ──
//
// Stripe rejoue un event à l'IDENTIQUE. Deux receipts partageant le même stripe_event_id
// mais des empreintes différentes signalent une anomalie (falsification, corruption) : on
// ne réapplique pas, on signale.

/** Sérialisation canonique déterministe (clés triées récursivement). */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}
