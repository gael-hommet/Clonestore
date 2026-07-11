// Ordonnancement monotone des events orders — décisions pures.

import { describe, it, expect } from "vitest";
import { decideOrdersEventOrdering, compareEventRank, canonicalize } from "../orders-event-ordering";

describe("compareEventRank", () => {
  it("ordonne par event_created puis par event_id", () => {
    expect(compareEventRank({ eventCreated: 1, eventId: "a" }, { eventCreated: 2, eventId: "a" })).toBeLessThan(0);
    expect(compareEventRank({ eventCreated: 2, eventId: "a" }, { eventCreated: 1, eventId: "z" })).toBeGreaterThan(0);
    expect(compareEventRank({ eventCreated: 5, eventId: "a" }, { eventCreated: 5, eventId: "b" })).toBeLessThan(0);
    expect(compareEventRank({ eventCreated: 5, eventId: "x" }, { eventCreated: 5, eventId: "x" })).toBe(0);
  });
});

describe("decideOrdersEventOrdering", () => {
  it("premier event (pas de ligne d'eau) → apply", () => {
    expect(decideOrdersEventOrdering({ incoming: { eventCreated: 10, eventId: "e1" }, highWater: null }).action).toBe("apply");
  });

  it("event plus récent → apply (vraie réactivation ultérieure)", () => {
    expect(decideOrdersEventOrdering({ incoming: { eventCreated: 20, eventId: "e2" }, highWater: { eventCreated: 10, eventId: "e1" } }).action).toBe("apply");
  });

  it("event plus ancien → stale (ancien checkout rejoué / hors-ordre)", () => {
    const d = decideOrdersEventOrdering({ incoming: { eventCreated: 5, eventId: "e0" }, highWater: { eventCreated: 10, eventId: "e1" } });
    expect(d.action).toBe("stale");
  });

  it("event de même rang → stale (déjà appliqué)", () => {
    expect(decideOrdersEventOrdering({ incoming: { eventCreated: 10, eventId: "e1" }, highWater: { eventCreated: 10, eventId: "e1" } }).action).toBe("stale");
  });
});

describe("canonicalize", () => {
  it("est stable quel que soit l'ordre des clés", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });
  it("distingue des contenus différents", () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 2 }));
  });
  it("gère imbrication et tableaux", () => {
    expect(canonicalize({ x: [1, { z: 3, y: 2 }] })).toBe('{"x":[1,{"y":2,"z":3}]}');
  });
});
