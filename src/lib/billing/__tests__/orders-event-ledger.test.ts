// Orchestration du ledger orders (claim/finish) contre un port EN MÉMOIRE.
// Prouve : dédup, ordre monotone, conflit de payload, concurrence (2 workers), reprise crash.

import { describe, it, expect, beforeEach } from "vitest";
import {
  claimOrdersEvent,
  finishOrdersEvent,
  fingerprintEventObject,
  type OrdersEventLedgerPort,
  type OrdersEventReceipt,
} from "../orders-event-ledger";
import type { EventRank } from "../orders-event-ordering";

// Port en mémoire fidèle : unicité par stripe_event_id, ligne d'eau sur receipts « applied ».
function memoryLedger() {
  const rows = new Map<string, OrdersEventReceipt & { ignored_reason?: string | null; error_safe?: string | null; processed_at?: string | null }>();
  const port: OrdersEventLedgerPort = {
    async tryInsertReceipt(row) {
      if (rows.has(row.stripe_event_id)) {
        return { inserted: false, existing: rows.get(row.stripe_event_id)! };
      }
      rows.set(row.stripe_event_id, {
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
      return { inserted: true, existing: null };
    },
    async highWaterForObject(objectId, excludeEventId): Promise<EventRank | null> {
      let best: EventRank | null = null;
      for (const r of rows.values()) {
        if (r.object_id !== objectId) continue;
        if (r.processing_result !== "applied") continue;
        if (r.stripe_event_id === excludeEventId) continue;
        const rank = { eventCreated: r.event_created, eventId: r.stripe_event_id };
        if (!best || rank.eventCreated > best.eventCreated || (rank.eventCreated === best.eventCreated && rank.eventId > best.eventId)) best = rank;
      }
      return best;
    },
    async updateReceipt(id, patch) {
      const r = rows.get(id);
      if (r) Object.assign(r, patch);
    },
  };
  return { port, rows };
}

const T0 = new Date("2026-07-10T12:00:00Z");
const fp = (obj: unknown) => fingerprintEventObject("customer.subscription.updated", obj);

let led: ReturnType<typeof memoryLedger>;
beforeEach(() => { led = memoryLedger(); });

async function claim(id: string, created: number, obj: unknown, now = T0) {
  return claimOrdersEvent(
    led.port,
    { eventId: id, type: "customer.subscription.updated", objectId: "sub_1", eventCreated: created, livemode: false, payloadFingerprint: fp(obj) },
    { now },
  );
}

describe("ledger orders — idempotence & dédup", () => {
  it("premier event → process ; rejeu du même → duplicate (aucun retraitement)", async () => {
    const first = await claim("evt_1", 100, { status: "active" });
    expect(first.decision).toBe("process");
    await finishOrdersEvent(led.port, "evt_1", "applied", { now: T0 });

    const replay = await claim("evt_1", 100, { status: "active" });
    expect(replay.decision).toBe("duplicate");
  });
});

describe("ledger orders — ordre monotone", () => {
  it("annulation puis ANCIEN checkout rejoué → stale (pas de résurrection)", async () => {
    // cancel (récent) appliqué
    const cancel = await claim("evt_cancel", 200, { status: "canceled" });
    expect(cancel.decision).toBe("process");
    await finishOrdersEvent(led.port, "evt_cancel", "applied", { now: T0 });

    // ancien checkout (créé avant l'annulation) rejoué
    const oldCheckout = await claimOrdersEvent(
      led.port,
      { eventId: "evt_checkout_old", type: "checkout.session.completed", objectId: "sub_1", eventCreated: 150, livemode: false, payloadFingerprint: "x" },
      { now: T0 },
    );
    expect(oldCheckout.decision).toBe("stale");
    expect(led.rows.get("evt_checkout_old")?.processing_result).toBe("ignored");
  });

  it("past_due puis ANCIEN active → stale", async () => {
    await claim("evt_pastdue", 300, { status: "past_due" });
    await finishOrdersEvent(led.port, "evt_pastdue", "applied", { now: T0 });
    const oldActive = await claim("evt_active_old", 250, { status: "active" });
    expect(oldActive.decision).toBe("stale");
  });

  it("vraie réactivation ULTÉRIEURE (plus récente) → process", async () => {
    await claim("evt_cancel", 200, { status: "canceled" });
    await finishOrdersEvent(led.port, "evt_cancel", "applied", { now: T0 });
    const reactivation = await claim("evt_reactivate", 400, { status: "active" });
    expect(reactivation.decision).toBe("process");
  });
});

describe("ledger orders — conflit de payload", () => {
  it("même event_id, payload DIFFÉRENT → conflict (jamais réappliqué)", async () => {
    await claim("evt_1", 100, { status: "active" });
    await finishOrdersEvent(led.port, "evt_1", "applied", { now: T0 });
    const tampered = await claim("evt_1", 100, { status: "canceled" }); // contenu altéré
    expect(tampered.decision).toBe("conflict");
    expect(led.rows.get("evt_1")?.processing_result).toBe("conflict");
  });
});

describe("ledger orders — concurrence & reprise", () => {
  it("deux workers concurrents sur le même event → un process, un in_progress", async () => {
    const [a, b] = await Promise.all([claim("evt_x", 100, { status: "active" }), claim("evt_x", 100, { status: "active" })]);
    const decisions = [a.decision, b.decision].sort();
    expect(decisions).toEqual(["in_progress", "process"]);
  });

  it("claim pending frais (autre worker actif) → in_progress", async () => {
    await claim("evt_y", 100, { status: "active" }); // pending, pas de finish
    const second = await claim("evt_y", 100, { status: "active" }, new Date(T0.getTime() + 1000));
    expect(second.decision).toBe("in_progress");
  });

  it("claim pending PÉRIMÉ (crash) → repris en process", async () => {
    await claim("evt_z", 100, { status: "active" }); // pending, worker crashé
    const later = new Date(T0.getTime() + 6 * 60 * 1000); // > lease de 5 min
    const retry = await claim("evt_z", 100, { status: "active" }, later);
    expect(retry.decision).toBe("process");
    expect(retry.decision === "process" && retry.attempts).toBe(2);
  });

  it("receipt en échec (failed) → rejeu autorisé (process)", async () => {
    await claim("evt_f", 100, { status: "active" });
    await finishOrdersEvent(led.port, "evt_f", "failed", { now: T0, error: "db down" });
    const retry = await claim("evt_f", 100, { status: "active" }, new Date(T0.getTime() + 1000));
    expect(retry.decision).toBe("process");
  });
});
