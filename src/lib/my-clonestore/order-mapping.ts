// My CloneStore — mapping order → accès (P9.2, cœur PUR).
//
// Traduit le statut RÉEL d'une commande (table `orders`, chemin V0 session) en
// état opérationnel + possession, pour alimenter `resolveCockpitAccess` côté
// client sans dupliquer la logique serveur. Aligné sur `hasPierreAccess`
// (active/trialing = accès) et sur `OperationalAccessState`. Déterministe.

import type { OperationalState } from "./types";

export interface OwnedEmployee {
  readonly slug: string;
  readonly operationalState: OperationalState;
  readonly ownsEmployee: boolean;
  readonly rawStatus: string;
}

const ACTIVE = new Set(["active", "trialing"]);
const PENDING = new Set(["incomplete", "unpaid"]);
const SUSPENDED = new Set(["past_due", "paused"]);
const ENDED = new Set(["canceled", "cancelled", "incomplete_expired", "ended"]);

/** Statut de commande → état opérationnel (aligné sur resolveOperationalAccess). */
export function mapOrderStatusToOperationalState(status: string | null | undefined): OperationalState {
  const s = (status ?? "").toLowerCase().trim();
  if (!s || s === "none") return "authenticated_without_employee";
  if (ACTIVE.has(s)) return "employee_active";
  if (PENDING.has(s)) return "payment_pending";
  if (SUSPENDED.has(s)) return "subscription_suspended";
  if (ENDED.has(s)) return "subscription_ended";
  // Statut inconnu → prudence : ni actif, ni possédé.
  return "authenticated_without_employee";
}

export function ownsFromStatus(status: string | null | undefined): boolean {
  return ACTIVE.has((status ?? "").toLowerCase().trim());
}

export interface OrderLike {
  readonly agent_slug: string;
  readonly status: string | null;
}

/**
 * Réduit la liste des commandes du client à l'employé le plus « fort » par slug
 * (active > pending > suspended > ended). Ne fabrique aucun employé.
 */
export function summarizeOwnedEmployee(
  orders: readonly OrderLike[],
  slug: string,
): OwnedEmployee {
  const rank = (s: OperationalState): number =>
    s === "employee_active"
      ? 4
      : s === "payment_pending"
        ? 3
        : s === "subscription_suspended"
          ? 2
          : s === "subscription_ended"
            ? 1
            : 0;

  let best: OwnedEmployee = {
    slug,
    operationalState: "authenticated_without_employee",
    ownsEmployee: false,
    rawStatus: "none",
  };
  for (const order of orders) {
    if (order.agent_slug !== slug) continue;
    const state = mapOrderStatusToOperationalState(order.status);
    if (rank(state) > rank(best.operationalState)) {
      best = {
        slug,
        operationalState: state,
        ownsEmployee: ownsFromStatus(order.status),
        rawStatus: order.status ?? "none",
      };
    }
  }
  return best;
}
