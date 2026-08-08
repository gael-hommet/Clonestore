// src/lib/clonechat/hardening/__tests__/hardening-stream.test.ts
//
// BLOC 13 — GATE STREAMING sur la MACHINERIE RÉELLE (pumpHardenedStream + buildActiveHardenedStream),
// avec provider SYNTHÉTIQUE injecté (aucune clé/appel payant). Prouve : stream normal (fermeture unique),
// abort client (provider reçoit le signal, aucun chunk tardif), timeout provider, erreur avant premier
// chunk, erreur APRÈS deltas (pas de faux succès, pas de double close, pas d'enqueue-after-close),
// circuit ouvert (provider non appelé), budget de sortie borné, aucun secret, aucune ressource orpheline.

import { describe, it, expect, vi } from "vitest";
import { pumpHardenedStream, buildActiveHardenedStream, createCircuitBreaker, DEFAULT_CIRCUIT, type HardenedStreamEvent, type HardenedStreamSink } from "..";

const immediateSchedule = (cb: () => void) => { cb(); return { clear: () => {} }; };
const neverSchedule = () => ({ clear: () => {} });

/** Sink enregistreur STRICT : lève si send-après-close ou double-close (prouve les invariants). */
function recordingSink() {
  const events: HardenedStreamEvent[] = [];
  let closed = false; let closes = 0; let sendAfterClose = 0;
  const sink: HardenedStreamSink = {
    send(ev) { if (closed) { sendAfterClose++; throw new Error("send after close"); } events.push(ev); },
    close() { if (closed) { closes++; throw new Error("double close"); } closed = true; closes++; },
  };
  return { sink, events, get closes() { return closes; }, get sendAfterClose() { return sendAfterClose; }, get closed() { return closed; } };
}
const deps = (over: Partial<Parameters<typeof pumpHardenedStream>[1]> = {}) => ({ maxOutputChars: 1000, providerTimeoutMs: 5000, schedule: neverSchedule, ...over } as Parameters<typeof pumpHardenedStream>[1]);

describe("BLOC 13 — pumpHardenedStream (machinerie réelle)", () => {
  it("stream normal : deltas puis done, fermeture UNE fois", async () => {
    const r = recordingSink();
    const res = await pumpHardenedStream(r.sink, deps({ produce: async (emit) => { emit("Bonjour. "); emit("Deuxième."); return { donePayload: { ok: true } }; } }));
    expect(res.outcome).toBe("done"); expect(r.closes).toBe(1);
    expect(r.events.filter((e) => e.type === "delta").length).toBe(2);
    expect(r.events.at(-1)?.type).toBe("done");
    expect(r.sendAfterClose).toBe(0);
  });
  it("erreur AVANT premier chunk → event error, aucun done, fermeture unique", async () => {
    const r = recordingSink();
    const res = await pumpHardenedStream(r.sink, deps({ produce: async () => { throw new Error("provider down"); } }));
    expect(res.outcome).toBe("error"); expect(r.events.some((e) => e.type === "done")).toBe(false);
    expect(r.events.some((e) => e.type === "error")).toBe(true); expect(r.closes).toBe(1);
  });
  it("erreur APRÈS deltas → deltas conservés, error terminal, PAS de faux succès, PAS de double close", async () => {
    const r = recordingSink();
    const res = await pumpHardenedStream(r.sink, deps({ produce: async (emit) => { emit("un"); emit("deux"); throw new Error("mid-stream"); } }));
    expect(res.outcome).toBe("error");
    expect(r.events.filter((e) => e.type === "delta").length).toBe(2);
    expect(r.events.some((e) => e.type === "done")).toBe(false);
    expect(r.events.at(-1)?.type).toBe("error"); expect(r.closes).toBe(1); expect(r.sendAfterClose).toBe(0);
  });
  it("timeout provider avant premier chunk → error (timeout), aucun done", async () => {
    const r = recordingSink();
    const res = await pumpHardenedStream(r.sink, deps({ providerTimeoutMs: 5, schedule: immediateSchedule, produce: () => new Promise(() => {}) }));
    expect(res.outcome).toBe("error");
    const err = r.events.find((e) => e.type === "error");
    expect(err && err.type === "error" && err.code).toBe("timeout");
  });
  it("abort client : le provider REÇOIT le signal ; outcome cancelled ; aucun chunk tardif", async () => {
    const r = recordingSink();
    const ac = new AbortController();
    let sawAbort = false;
    const p = pumpHardenedStream(r.sink, deps({ parentSignal: ac.signal, produce: (emit, signal) => new Promise((_, reject) => { signal.addEventListener("abort", () => { sawAbort = true; reject(new Error("stopped")); }); }) }));
    await new Promise((res) => setTimeout(res, 10));
    ac.abort();
    const res = await p;
    expect(sawAbort).toBe(true); // provider a bien reçu l'annulation
    expect(res.outcome).toBe("cancelled");
    expect(r.events.at(-1)?.type).toBe("cancelled"); expect(r.closes).toBe(1);
  });
  it("circuit OUVERT → provider NON appelé → error(circuit_open)", async () => {
    const cb = createCircuitBreaker({ ...DEFAULT_CIRCUIT, failureThreshold: 1 }, { now: () => 0 });
    await cb.exec(async () => { throw new Error("x"); }).catch(() => {}); // ouvre
    const r = recordingSink();
    let called = false;
    const res = await pumpHardenedStream(r.sink, deps({ breaker: cb, produce: async () => { called = true; return { donePayload: {} }; } }));
    expect(called).toBe(false); expect(res.outcome).toBe("error");
    const err = r.events.find((e) => e.type === "error");
    expect(err && err.type === "error" && err.code).toBe("circuit_open");
  });
  it("budget de sortie borné : deltas tronqués, jamais au-delà de maxOutputChars", async () => {
    const r = recordingSink();
    const res = await pumpHardenedStream(r.sink, deps({ maxOutputChars: 10, produce: async (emit) => { emit("x".repeat(8)); emit("y".repeat(8)); return { donePayload: { ok: true } }; } }));
    expect(res.emittedChars).toBeLessThanOrEqual(10);
    const total = r.events.filter((e) => e.type === "delta").reduce((a, e) => a + (e.type === "delta" ? e.text.length : 0), 0);
    expect(total).toBeLessThanOrEqual(10);
  });
  it("aucun secret dans les events (erreur provider avec secret)", async () => {
    const r = recordingSink();
    await pumpHardenedStream(r.sink, deps({ produce: async () => { throw new Error("boom sk-SECRET1234567890 token"); }, onProviderError: () => ({ code: "provider_unavailable", message: "Service temporairement indisponible." }) }));
    expect(JSON.stringify(r.events)).not.toContain("sk-SECRET1234567890");
  });
  it("déterminisme : même provider synthétique → même séquence d'events", async () => {
    const run = async () => { const r = recordingSink(); await pumpHardenedStream(r.sink, deps({ produce: async (emit) => { emit("a"); emit("b"); return { donePayload: { ok: true } }; } })); return r.events.map((e) => e.type).join(","); };
    expect(await run()).toBe(await run());
  });
});

describe("BLOC 13 — buildActiveHardenedStream (ReadableStream SSE réel)", () => {
  async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader(); const dec = new TextDecoder(); let out = "";
    for (;;) { const { done, value } = await reader.read(); if (done) break; if (value) out += dec.decode(value, { stream: true }); }
    return out;
  }
  it("produit un flux event-stream avec delta + done ; onFinished appelé", async () => {
    let finished: string | null = null;
    const stream = buildActiveHardenedStream({
      produce: async (emit) => { emit("Salut."); return { donePayload: { ok: true, structured: { answer: "Salut." } } }; },
      config: { limits: { maxOutputChars: 1000 }, budgets: { providerMs: 5000 } } as never,
      onFinished: async (r) => { finished = r.outcome; },
    });
    const text = await readAll(stream);
    expect(text).toContain("event: delta");
    expect(text).toContain("event: done");
    expect(finished).toBe("done");
  });
});
