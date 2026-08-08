// src/lib/clonechat/hardening/__tests__/hardening-served.test.ts
//
// BLOC 13 — ADAPTATEUR SERVI (runServedActiveStream / runServedActiveUnary) testé de façon DÉTERMINISTE
// avec un planificateur INJECTÉ (aucun vrai timer) et un limiteur réel. Prouve précisément ce que le
// chemin servi de /api/assistant/chat compose : budget TOTAL démarré AVANT l'attente de file et
// l'enveloppant (timeout PENDANT l'attente → provider JAMAIS appelé), abort pendant l'attente, file
// pleine, slot rendu EXACTEMENT une fois (done/erreur), et pour l'unaire : budget total + retry BORNÉ.

import { describe, it, expect } from "vitest";
import {
  runServedActiveStream, runServedActiveUnary, createConcurrencyLimiter, hardeningConfig, HardeningError,
  type ConcurrencyLimiter,
} from "..";
import type { HardeningConfig } from "..";

function cfgWith(over: { totalMs?: number; providerMs?: number; maxConcurrent?: number; maxQueue?: number; perTenant?: number; maxRetries?: number }): HardeningConfig {
  const base = hardeningConfig({} as NodeJS.ProcessEnv);
  return {
    ...base,
    budgets: { ...base.budgets, totalMs: over.totalMs ?? base.budgets.totalMs, providerMs: over.providerMs ?? base.budgets.providerMs },
    concurrency: { maxConcurrent: over.maxConcurrent ?? 1, maxQueue: over.maxQueue ?? 8, perTenantMaxConcurrent: over.perTenant ?? 1 },
    retry: { ...base.retry, maxRetries: over.maxRetries ?? base.retry.maxRetries },
  };
}
async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) { if (Date.now() - start > ms) throw new Error("waitFor timeout"); await new Promise((r) => setTimeout(r, 2)); }
}
/** Occupe l'unique slot du limiteur (tenant "t") jusqu'à `release()`. */
function occupy(limiter: ConcurrencyLimiter, key = "t"): { release: () => void; done: Promise<unknown> } {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const done = limiter.run(key, async () => { await held; }, {});
  return { release, done };
}
const drain = (s: ReadableStream<Uint8Array>) => new Response(s).text();

describe("BLOC 13 — adaptateur servi : budget total, file, abort, slot (stream)", () => {
  it("TIMEOUT total PENDANT l'attente de file → provider JAMAIS appelé, code timeout", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 8, perTenantMaxConcurrent: 1 });
    const hold = occupy(limiter);
    await waitFor(() => limiter.snapshot().active === 1);
    let produceCalled = 0;
    const timers: Array<() => void> = [];
    const p = runServedActiveStream({
      limiter, tenantKey: "t", config: cfgWith({ totalMs: 1000 }),
      produce: async (emit) => { produceCalled++; emit("x"); return { donePayload: {} }; },
      schedule: (cb) => { timers.push(cb); return { clear: () => {} }; },
    });
    await waitFor(() => limiter.snapshot().queued === 1 && timers.length >= 1); // en file + timer total armé
    timers[0]();                                   // simule le dépassement du budget TOTAL pendant l'attente
    const r = await p;
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("timeout");
    expect(produceCalled).toBe(0);                 // le provider n'a JAMAIS été appelé
    expect(limiter.snapshot().queued).toBe(0);     // waiter retiré
    hold.release(); await hold.done;
  });

  it("ABORT parent PENDANT l'attente → provider JAMAIS appelé, code cancelled", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 8, perTenantMaxConcurrent: 1 });
    const hold = occupy(limiter);
    await waitFor(() => limiter.snapshot().active === 1);
    let produceCalled = 0;
    const ac = new AbortController();
    const p = runServedActiveStream({
      limiter, tenantKey: "t", config: cfgWith({}), parentSignal: ac.signal,
      produce: async () => { produceCalled++; return { donePayload: {} }; },
      schedule: () => ({ clear: () => {} }),
    });
    await waitFor(() => limiter.snapshot().queued === 1);
    ac.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("cancelled");
    expect(produceCalled).toBe(0);
    hold.release(); await hold.done;
  });

  it("file PLEINE → concurrency_limited, provider jamais appelé", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 0, perTenantMaxConcurrent: 1 });
    const hold = occupy(limiter);
    await waitFor(() => limiter.snapshot().active === 1);
    let produceCalled = 0;
    const r = await runServedActiveStream({
      limiter, tenantKey: "t", config: cfgWith({ maxQueue: 0 }),
      produce: async () => { produceCalled++; return { donePayload: {} }; },
      schedule: () => ({ clear: () => {} }),
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("concurrency_limited");
    expect(produceCalled).toBe(0);
    hold.release(); await hold.done;
  });

  it("stream DONE → slot rendu EXACTEMENT une fois (onSettled 1×), un nouvel appel peut acquérir", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 8, perTenantMaxConcurrent: 1 });
    let settled = 0;
    const r = await runServedActiveStream({
      limiter, tenantKey: "t", config: cfgWith({}),
      produce: async (emit) => { emit("hello"); return { donePayload: { ok: true } }; },
      onSettled: () => { settled++; },
      schedule: () => ({ clear: () => {} }),
    });
    expect(r.ok).toBe(true);
    await drain(r.stream!);
    await waitFor(() => limiter.snapshot().active === 0);
    expect(settled).toBe(1);                        // rendu/finalisé exactement une fois
    // Un nouvel appel acquiert immédiatement (le slot n'a pas fui).
    const r2 = await runServedActiveStream({ limiter, tenantKey: "t", config: cfgWith({}), produce: async () => ({ donePayload: {} }), schedule: () => ({ clear: () => {} }) });
    expect(r2.ok).toBe(true);
    await drain(r2.stream!);
    await waitFor(() => limiter.snapshot().active === 0);
    expect(settled).toBe(1);                        // pas de double release du 1er
  });

  it("stream ERREUR provider → slot rendu, onSettled(error) 1×", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 8, perTenantMaxConcurrent: 1 });
    let outcome = "";
    const r = await runServedActiveStream({
      limiter, tenantKey: "t", config: cfgWith({}),
      produce: async () => { throw new Error("boom"); },
      onSettled: (res) => { outcome = res.outcome; },
      schedule: () => ({ clear: () => {} }),
    });
    expect(r.ok).toBe(true);
    const text = await drain(r.stream!);
    expect(text).toContain("event: error");
    await waitFor(() => limiter.snapshot().active === 0);
    expect(outcome).toBe("error");
  });
});

describe("BLOC 13 — adaptateur servi : unaire (budget total + retry borné)", () => {
  it("TIMEOUT total PENDANT l'attente → provider unaire JAMAIS appelé, code timeout", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 8, perTenantMaxConcurrent: 1 });
    const hold = occupy(limiter);
    await waitFor(() => limiter.snapshot().active === 1);
    let called = 0;
    const timers: Array<() => void> = [];
    const p = runServedActiveUnary<string>({
      limiter, tenantKey: "t", config: cfgWith({ totalMs: 1000 }),
      call: async () => { called++; return "answer"; },
      schedule: (cb) => { timers.push(cb); return { clear: () => {} }; },
    });
    await waitFor(() => limiter.snapshot().queued === 1 && timers.length >= 1);
    timers[0]();
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("timeout");
    expect(called).toBe(0);
    hold.release(); await hold.done;
  });

  it("RETRY borné réel : échec transitoire (retryable) puis succès → 2 tentatives", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 4, maxQueue: 8, perTenantMaxConcurrent: 4 });
    let n = 0;
    const r = await runServedActiveUnary<string>({
      limiter, tenantKey: "t", config: cfgWith({ maxRetries: 1 }),
      call: async () => { n++; if (n === 1) throw new HardeningError("provider_unavailable", "transient"); return "ok"; },
      retryable: (e) => e instanceof HardeningError && e.code === "provider_unavailable",
      sleep: async () => {}, // pas de vrai backoff dans le test
      schedule: () => ({ clear: () => {} }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("ok");
    expect(n).toBe(2);
  });

  it("erreur NON-retryable → une SEULE tentative, code exact propagé", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 4, maxQueue: 8, perTenantMaxConcurrent: 4 });
    let n = 0;
    const r = await runServedActiveUnary<string>({
      limiter, tenantKey: "t", config: cfgWith({ maxRetries: 1 }),
      call: async () => { n++; throw new HardeningError("invalid_request", "permanent"); },
      retryable: (e) => e instanceof HardeningError && e.code === "provider_unavailable",
      sleep: async () => {},
      schedule: () => ({ clear: () => {} }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_request");
    expect(n).toBe(1);
  });
});
