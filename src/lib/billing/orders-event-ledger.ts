// src/lib/billing/orders-event-ledger.ts
// Ledger d'idempotence + anti-replay des événements Stripe du flux `orders`.
//
// Le flux `orders` vit dans Supabase (supabase-js, service-role) — distinct des runtimes
// Founder Access et CloneStory qui possèdent DÉJÀ leur propre ledger. On ne duplique donc
// pas ces moteurs : on ajoute un ledger dédié à CE flux, avec le même esprit (unicité par
// stripe_event_id, append-oriented, ordre monotone), au bon endroit (Supabase).
//
// GARANTIES
//   • un stripe_event_id ne produit qu'une seule conséquence (unicité + claim insert-first) ;
//   • deux workers concurrents : un seul obtient le claim, l'autre voit « in_progress » ;
//   • crash en cours de traitement : le claim « pending » périmé (> lease) est repris ;
//   • même id + payload différent → « conflict » (jamais réappliqué) ;
//   • event périmé (hors-ordre / rejeu ancien) → « stale » (jamais d'effet).

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideOrdersEventOrdering,
  canonicalize,
  type EventRank,
} from "./orders-event-ordering";

export const ORDERS_EVENTS_TABLE = "clonestore_orders_stripe_events";
const DEFAULT_LEASE_MS = 5 * 60 * 1000; // reprise d'un claim pending abandonné

/**
 * Levée quand la table du ledger n'existe pas encore dans l'environnement (migration non
 * appliquée). Permet au webhook de se replier sur le comportement legacy sans régression,
 * plutôt que de renvoyer 500 en boucle.
 */
export class OrdersLedgerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrdersLedgerUnavailableError";
  }
}

/** Codes signalant une table/relation absente (PostgREST + Postgres). */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table") || m.includes("schema cache");
}

export type OrdersProcessingResult = "pending" | "applied" | "ignored" | "duplicate" | "failed" | "conflict";

export type OrdersEventReceipt = {
  stripe_event_id: string;
  event_type: string;
  object_id: string | null;
  event_created: number;
  livemode: boolean;
  payload_fingerprint: string;
  processing_result: OrdersProcessingResult;
  attempts: number;
  claimed_at: string | null;
};

/** Empreinte déterministe d'un objet d'événement Stripe (SHA-256 canonique). */
export function fingerprintEventObject(type: string, object: unknown): string {
  return createHash("sha256").update(`${type}\n${canonicalize(object)}`).digest("hex");
}

// ── Port injectable (permet des tests sans Supabase réel) ────────────────────
export interface OrdersEventLedgerPort {
  /** Insère un receipt « pending ». inserted=false si le stripe_event_id existe déjà. */
  tryInsertReceipt(row: {
    stripe_event_id: string;
    event_type: string;
    object_id: string | null;
    event_created: number;
    livemode: boolean;
    payload_fingerprint: string;
    claimed_at: string;
  }): Promise<{ inserted: boolean; existing: OrdersEventReceipt | null }>;

  /** Rang le plus élevé DÉJÀ appliqué pour cet objet, hors event courant (ligne d'eau). */
  highWaterForObject(objectId: string, excludeEventId: string): Promise<EventRank | null>;

  /** Met à jour l'état d'un receipt (résultat, tentatives, horodatages, raison sûre). */
  updateReceipt(
    stripeEventId: string,
    patch: Partial<{
      processing_result: OrdersProcessingResult;
      ignored_reason: string | null;
      error_safe: string | null;
      claimed_at: string | null;
      attempts: number;
      processed_at: string | null;
    }>,
  ): Promise<void>;
}

export type ClaimOutcome =
  | { decision: "process"; attempts: number } // claim obtenu → traiter puis finish
  | { decision: "stale"; reason: string } // event périmé (hors-ordre) → déjà finalisé « ignored »
  | { decision: "duplicate" } // déjà appliqué/ignoré, même payload
  | { decision: "conflict" } // même id, payload différent → déjà finalisé « conflict »
  | { decision: "in_progress" }; // un autre worker détient un claim frais

/**
 * Réclame l'exclusivité de traitement d'un event du flux orders et applique l'ordre monotone.
 * Retourne « process » si l'appelant doit exécuter la mutation orders, puis appeler
 * finishOrdersEvent. Toute autre décision signifie qu'aucune mutation ne doit avoir lieu.
 */
export async function claimOrdersEvent(
  port: OrdersEventLedgerPort,
  input: {
    eventId: string;
    type: string;
    objectId: string | null;
    eventCreated: number;
    livemode: boolean;
    payloadFingerprint: string;
  },
  opts: { now: Date; leaseMs?: number },
): Promise<ClaimOutcome> {
  const lease = opts.leaseMs ?? DEFAULT_LEASE_MS;
  const nowIso = opts.now.toISOString();

  const { inserted, existing } = await port.tryInsertReceipt({
    stripe_event_id: input.eventId,
    event_type: input.type,
    object_id: input.objectId,
    event_created: input.eventCreated,
    livemode: input.livemode,
    payload_fingerprint: input.payloadFingerprint,
    claimed_at: nowIso,
  });

  // Nombre de tentatives figé AVANT toute mutation de receipt (évite toute relecture
  // d'un `existing` potentiellement muté par updateReceipt sur un même objet en mémoire).
  let claimAttempts = 1;

  if (!inserted) {
    // Un receipt existe déjà : décider selon son état.
    if (!existing) return { decision: "in_progress" }; // course rarissime : traiter comme occupé
    if (existing.payload_fingerprint !== input.payloadFingerprint) {
      await port.updateReceipt(input.eventId, {
        processing_result: "conflict",
        error_safe: "payload_fingerprint_mismatch",
      });
      return { decision: "conflict" };
    }
    if (existing.processing_result === "applied" || existing.processing_result === "ignored" || existing.processing_result === "duplicate") {
      return { decision: "duplicate" };
    }
    if (existing.processing_result === "conflict") {
      return { decision: "conflict" };
    }
    // pending ou failed : reprise si le claim est périmé (crash) ou en échec (retry Stripe).
    const claimedMs = existing.claimed_at ? Date.parse(existing.claimed_at) : 0;
    const stale = existing.processing_result === "failed" || !existing.claimed_at || opts.now.getTime() - claimedMs > lease;
    if (!stale) return { decision: "in_progress" };
    claimAttempts = existing.attempts + 1;
    await port.updateReceipt(input.eventId, { processing_result: "pending", claimed_at: nowIso, attempts: claimAttempts });
  }

  // Ordre monotone : l'event doit être strictement plus récent que la ligne d'eau de l'objet.
  if (input.objectId) {
    const highWater = await port.highWaterForObject(input.objectId, input.eventId);
    const ordering = decideOrdersEventOrdering({
      incoming: { eventCreated: input.eventCreated, eventId: input.eventId },
      highWater,
    });
    if (ordering.action === "stale") {
      await port.updateReceipt(input.eventId, { processing_result: "ignored", ignored_reason: ordering.reason, processed_at: nowIso });
      return { decision: "stale", reason: ordering.reason };
    }
  }

  return { decision: "process", attempts: claimAttempts };
}

/** Finalise un receipt après traitement (applied/failed). */
export async function finishOrdersEvent(
  port: OrdersEventLedgerPort,
  eventId: string,
  result: "applied" | "failed",
  opts: { now: Date; error?: string },
): Promise<void> {
  await port.updateReceipt(eventId, {
    processing_result: result,
    error_safe: result === "failed" ? (opts.error ?? "error").slice(0, 300) : null,
    processed_at: opts.now.toISOString(),
    claimed_at: null,
  });
}

// ── Implémentation Supabase (service-role) ───────────────────────────────────

/** SQLSTATE 23505 = violation d'unicité (le stripe_event_id existe déjà). */
function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/**
 * Ledger adossé à Supabase (service-role). Accepte un client OU une fabrique paresseuse :
 * la fabrique n'est appelée qu'au premier accès réel au ledger, afin qu'un environnement
 * sans Supabase configuré (ou un event non concerné) ne déclenche aucune instanciation.
 */
export function createSupabaseOrdersEventLedger(source: SupabaseClient | (() => SupabaseClient)): OrdersEventLedgerPort {
  let client: SupabaseClient | null = typeof source === "function" ? null : source;
  const supabaseOf = (): SupabaseClient => {
    if (!client) client = (source as () => SupabaseClient)();
    return client;
  };
  return {
    async tryInsertReceipt(row) {
      const supabase = supabaseOf();
      const { error } = await supabase.from(ORDERS_EVENTS_TABLE).insert({
        stripe_event_id: row.stripe_event_id,
        event_type: row.event_type,
        object_id: row.object_id,
        event_created: row.event_created,
        livemode: row.livemode,
        payload_fingerprint: row.payload_fingerprint,
        processing_result: "pending",
        attempts: 1,
        claimed_at: row.claimed_at,
      });
      if (!error) return { inserted: true, existing: null };
      if (isMissingRelation(error)) throw new OrdersLedgerUnavailableError(error.message);
      if (!isUniqueViolation(error)) throw new Error(error.message);
      const { data } = await supabase
        .from(ORDERS_EVENTS_TABLE)
        .select("stripe_event_id,event_type,object_id,event_created,livemode,payload_fingerprint,processing_result,attempts,claimed_at")
        .eq("stripe_event_id", row.stripe_event_id)
        .maybeSingle();
      return { inserted: false, existing: (data as OrdersEventReceipt | null) ?? null };
    },

    async highWaterForObject(objectId, excludeEventId) {
      const { data } = await supabaseOf()
        .from(ORDERS_EVENTS_TABLE)
        .select("stripe_event_id,event_created")
        .eq("object_id", objectId)
        .eq("processing_result", "applied")
        .neq("stripe_event_id", excludeEventId)
        .order("event_created", { ascending: false })
        .order("stripe_event_id", { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (!row) return null;
      return { eventCreated: row.event_created as number, eventId: row.stripe_event_id as string };
    },

    async updateReceipt(stripeEventId, patch) {
      const { error } = await supabaseOf().from(ORDERS_EVENTS_TABLE).update(patch).eq("stripe_event_id", stripeEventId);
      if (error) throw new Error(error.message);
    },
  };
}
