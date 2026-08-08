// src/lib/clonechat/hardening/__tests__/hardening.test.ts
//
// BLOC 13 — GATE unitaire du runtime durci CloneChat (déterministe : temps/schedule/sleep INJECTÉS,
// dépendances SYNTHÉTIQUES ; aucune charge réelle, aucun service externe, aucun effet réel). Couvre les
// correctifs : config avec diagnostics, readiness FAIL-CLOSED par evidence, queue ABORTABLE + budget
// total qui enveloppe la file, provider-guard, limites/erreurs/body/precheck/observe.

import { describe, it, expect, vi } from "vitest";
import {
  resolveHardeningConfig, hardeningConfig, readRuntimeMode, modeEffect, DEFAULT_LIMITS,
  checkInputLimits, enforceOutputLimit,
  withTimeout, withBoundedRetry,
  createCircuitBreaker, createBreakerRegistry,
  createConcurrencyLimiter,
  evaluateReadiness, buildReadinessEvidence, isActiveAllowed, REQUIRED_GUARANTEES, DEGRADING_GUARANTEE,
  createHardenedRuntime, guardProviderCall,
  makeSafeError, toSafeError, httpStatusFor, HardeningError,
  hardeningChatPrecheck, contentLengthExceeds, readBoundedRequestText,
  correlationId, safeLogFields, CLONECHAT_HARDENING_VERSION,
  type HardeningConfig, type ReadinessFacts,
} from "..";

const cfgOf = (over: Partial<NodeJS.ProcessEnv> = {}): HardeningConfig => resolveHardeningConfig({ ...over } as NodeJS.ProcessEnv).config;
const immediateSchedule = (cb: () => void) => { cb(); return { clear: () => {} }; };
const neverSchedule = () => ({ clear: () => {} });
const noSleep = async () => {};
const ALL_TRUE: ReadinessFacts = Object.fromEntries([...REQUIRED_GUARANTEES, DEGRADING_GUARANTEE].map((g) => [g, true])) as ReadinessFacts;
const provenEvidence = (over: Partial<ReadinessFacts> = {}) => buildReadinessEvidence({ ...ALL_TRUE, ...over }, "test");

// ── Config & diagnostics (Blocker E) ─────────────────────────────────────────────
describe("BLOC 13 — config avec diagnostics (absent=default OK, présent-invalide=blocking)", () => {
  it("mode absent → off, valide, aucun diagnostic", () => {
    const r = resolveHardeningConfig({} as NodeJS.ProcessEnv);
    expect(r.config.mode).toBe("off"); expect(r.valid).toBe(true); expect(r.diagnostics).toEqual([]);
  });
  it("mode inconnu PRÉSENT → off effectif MAIS diagnostic (config invalide)", () => {
    const r = resolveHardeningConfig({ CLONECHAT_HARDENING_MODE: "turbo" } as NodeJS.ProcessEnv);
    expect(r.config.mode).toBe("off"); expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.key === "CLONECHAT_HARDENING_MODE")).toBe(true);
  });
  it("kill switch invalide présent → diagnostic", () => {
    const r = resolveHardeningConfig({ CLONECHAT_HARDENING_KILL_SWITCH: "maybe" } as NodeJS.ProcessEnv);
    expect(r.valid).toBe(false); expect(r.diagnostics.some((d) => d.key === "CLONECHAT_HARDENING_KILL_SWITCH")).toBe(true);
  });
  it("entier absent → default (valide) ; présent-invalide (abc/-5/hors-borne) → diagnostic blocking", () => {
    expect(resolveHardeningConfig({} as NodeJS.ProcessEnv).config.limits.maxMessageChars).toBe(DEFAULT_LIMITS.maxMessageChars);
    for (const bad of ["abc", "-5", "999999999", "3.5"]) {
      const r = resolveHardeningConfig({ CLONECHAT_HARDENING_MAX_MESSAGE_CHARS: bad } as NodeJS.ProcessEnv);
      expect(r.valid, `bad=${bad}`).toBe(false);
      expect(r.diagnostics.some((d) => d.key === "CLONECHAT_HARDENING_MAX_MESSAGE_CHARS")).toBe(true);
      expect(r.config.limits.maxMessageChars).toBe(DEFAULT_LIMITS.maxMessageChars); // fail-safe exécution
    }
    expect(resolveHardeningConfig({ CLONECHAT_HARDENING_MAX_MESSAGE_CHARS: "500" } as NodeJS.ProcessEnv).config.limits.maxMessageChars).toBe(500);
  });
  it("provider budget > total → diagnostic", () => {
    const r = resolveHardeningConfig({ CLONECHAT_HARDENING_TOTAL_MS: "5000", CLONECHAT_HARDENING_PROVIDER_MS: "9000" } as NodeJS.ProcessEnv);
    expect(r.valid).toBe(false); expect(r.diagnostics.some((d) => d.key === "CLONECHAT_HARDENING_PROVIDER_MS")).toBe(true);
  });
  it("config gelée ; kill switch prioritaire → passthrough même en active", () => {
    const c = cfgOf({}); expect(Object.isFrozen(c)).toBe(true); expect(Object.isFrozen(c.limits)).toBe(true);
    const e = modeEffect(cfgOf({ CLONECHAT_HARDENING_MODE: "active", CLONECHAT_HARDENING_KILL_SWITCH: "1" }));
    expect(e.passthrough).toBe(true); expect(e.enforce).toBe(false);
  });
  it("l'input utilisateur ne peut pas reconfigurer (source = env uniquement)", () => {
    expect(readRuntimeMode({ CLONECHAT_HARDENING_MODE: "active" } as NodeJS.ProcessEnv)).toBe("active");
    expect(hardeningConfig({} as NodeJS.ProcessEnv).mode).toBe("off");
  });
});

// ── Readiness FAIL-CLOSED par evidence (Blocker A) ────────────────────────────────
describe("BLOC 13 — readiness fail-closed (evidence explicite, jamais vrai par défaut)", () => {
  it("AUCUNE evidence → blocked (défaut fail-closed)", () => {
    const r = evaluateReadiness(cfgOf({}), []);
    expect(r.status).toBe("blocked"); expect(isActiveAllowed(r)).toBe(false); expect(r.productionReadyClaim).toBe(false);
  });
  it("evidence complète prouvée + config valide → ready_for_b14", () => {
    const r = evaluateReadiness(cfgOf({}), provenEvidence(), { valid: true, diagnostics: [] });
    expect(r.status).toBe("ready_for_b14"); expect(isActiveAllowed(r)).toBe(true); expect(r.productionReadyClaim).toBe(false);
  });
  it("une evidence MANQUANTE → blocked (unknown)", () => {
    const partial = buildReadinessEvidence({ ...ALL_TRUE, tenant_isolation: undefined }, "test");
    const r = evaluateReadiness(cfgOf({}), partial, { valid: true, diagnostics: [] });
    expect(r.status).toBe("blocked"); expect(r.reasons.join(" ")).toContain("tenant_isolation");
  });
  it("une evidence FAILED → blocked", () => {
    const r = evaluateReadiness(cfgOf({}), provenEvidence({ secrets_server_only: false }), { valid: true, diagnostics: [] });
    expect(r.status).toBe("blocked"); expect(r.reasons.join(" ")).toContain("secrets_server_only");
  });
  it("config invalide (résolution) → config_valid failed → blocked", () => {
    const r = evaluateReadiness(cfgOf({}), provenEvidence(), { valid: false, diagnostics: [{ key: "X", severity: "blocking", reason: "bad" }] });
    expect(r.status).toBe("blocked"); expect(r.reasons.join(" ")).toContain("config_valid");
  });
  it("provider unhealthy seul → degraded (active refusé)", () => {
    const r = evaluateReadiness(cfgOf({}), provenEvidence({ provider_healthy: false }), { valid: true, diagnostics: [] });
    expect(r.status).toBe("degraded"); expect(isActiveAllowed(r)).toBe(false);
  });
});

// ── Limites / erreurs ─────────────────────────────────────────────────────────────
describe("BLOC 13 — limites & erreurs sûres", () => {
  const L = DEFAULT_LIMITS;
  it("message/body/history/attachments oversized → codes structurés", () => {
    expect(checkInputLimits({ message: "x".repeat(L.maxMessageChars + 1) }, L)?.code).toBe("message_too_long");
    expect(checkInputLimits({ bodyBytes: L.maxBodyBytes + 1 }, L)?.code).toBe("payload_too_large");
    expect(checkInputLimits({ history: Array.from({ length: L.maxHistoryMessages + 1 }, () => ({ text: "h" })) }, L)?.code).toBe("history_too_long");
    expect(checkInputLimits({ attachments: [{ bytes: L.maxAttachmentBytes + 1 }] }, L)?.code).toBe("attachment_too_large");
    expect(checkInputLimits({ attachments: Array.from({ length: L.maxAttachments + 1 }, () => ({ bytes: 1 })) }, L)?.code).toBe("too_many_attachments");
  });
  it("sortie bornée (troncature honnête)", () => {
    const r = enforceOutputLimit("y".repeat(L.maxOutputChars + 5), L); expect(r.truncated).toBe(true); expect(r.text.length).toBe(L.maxOutputChars);
  });
  it("codes HTTP cohérents + toSafeError ne fuit jamais", () => {
    expect(httpStatusFor("timeout")).toBe(504); expect(httpStatusFor("circuit_open")).toBe(503); expect(httpStatusFor("concurrency_limited")).toBe(429);
    const s = toSafeError(new Error("secret sk-LEAK1234567890 at /srv/x.ts:1"));
    expect(s.code).toBe("internal_safe_error"); expect(JSON.stringify(s)).not.toContain("sk-LEAK1234567890");
    expect(toSafeError(new HardeningError("timeout", "detail")).code).toBe("timeout");
  });
});

// ── Timeout / annulation / retry ─────────────────────────────────────────────────
describe("BLOC 13 — timeout, annulation, retry borné", () => {
  it("résout rapide ; timeout → HardeningError('timeout') ; parent avorté → cancelled", async () => {
    expect(await withTimeout(async () => "ok", 1000, { schedule: neverSchedule })).toBe("ok");
    await expect(withTimeout(() => new Promise(() => {}), 10, { schedule: immediateSchedule })).rejects.toMatchObject({ code: "timeout" });
    const ac = new AbortController(); ac.abort();
    await expect(withTimeout(async () => "x", 1000, { parentSignal: ac.signal, schedule: neverSchedule })).rejects.toMatchObject({ code: "cancelled" });
  });
  it("retry : non idempotent jamais relancé ; idempotent borné jusqu'à maxRetries", async () => {
    let a = 0; await expect(withBoundedRetry(async () => { a++; throw new Error("x"); }, { maxRetries: 3, baseDelayMs: 1, isRetryable: () => true, idempotent: false, sleep: noSleep })).rejects.toBeTruthy();
    expect(a).toBe(1);
    let b = 0; await expect(withBoundedRetry(async () => { b++; throw new Error("x"); }, { maxRetries: 2, baseDelayMs: 1, isRetryable: () => true, idempotent: true, sleep: noSleep })).rejects.toBeTruthy();
    expect(b).toBe(3);
  });
});

// ── Circuit breaker + provider-guard ──────────────────────────────────────────────
describe("BLOC 13 — circuit breaker (isolé) & provider-guard", () => {
  const policy = { failureThreshold: 3, cooldownMs: 1000, halfOpenMaxProbes: 1 };
  it("cycle complet + refus rapide + isolation providers", async () => {
    let t = 0; const cb = createCircuitBreaker(policy, { now: () => t });
    for (let i = 0; i < 3; i++) await cb.exec(async () => { throw new Error("x"); }).catch(() => {});
    expect(cb.state()).toBe("open");
    let ran = false; await expect(cb.exec(async () => { ran = true; return 1; })).rejects.toMatchObject({ code: "circuit_open" }); expect(ran).toBe(false);
    t += 1000; expect(cb.state()).toBe("half_open");
    expect(await cb.exec(async () => "ok")).toBe("ok"); expect(cb.state()).toBe("closed");
    const reg = createBreakerRegistry(policy, { now: () => 0 });
    for (let i = 0; i < 3; i++) await reg.for("a").exec(async () => { throw new Error("x"); }).catch(() => {});
    expect(reg.for("a").state()).toBe("open"); expect(reg.for("b").state()).toBe("closed");
  });
  it("guardProviderCall : circuit ouvert → circuit_open sans appeler fn ; timeout borné", async () => {
    const t = 0; const cb = createCircuitBreaker(policy, { now: () => t });
    for (let i = 0; i < 3; i++) await guardProviderCall(async () => { throw new Error("x"); }, { breaker: cb, timeoutMs: 1000, schedule: neverSchedule }).catch(() => {});
    let called = false;
    await expect(guardProviderCall(async () => { called = true; return 1; }, { breaker: cb, timeoutMs: 1000, schedule: neverSchedule })).rejects.toMatchObject({ code: "circuit_open" });
    expect(called).toBe(false);
    await expect(guardProviderCall(() => new Promise(() => {}), { timeoutMs: 5, schedule: immediateSchedule })).rejects.toMatchObject({ code: "timeout" });
  });
});

// ── Concurrence / backpressure / ABORT (Blocker D) ───────────────────────────────
describe("BLOC 13 — concurrence abortable & bornée", () => {
  it("maxConcurrent respecté + nettoyage complet", async () => {
    const lim = createConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 10, perTenantMaxConcurrent: 10 });
    let running = 0, maxSeen = 0; let open!: () => void; const gate = new Promise<void>((r) => { open = r; });
    const tasks = Array.from({ length: 5 }, () => lim.run("t", async () => { running++; maxSeen = Math.max(maxSeen, running); await gate; running--; }));
    await Promise.resolve(); // laisse les microtâches démarrer les 2 slots (acquire synchrone)
    expect(maxSeen).toBeLessThanOrEqual(2); expect(lim.snapshot().active).toBeLessThanOrEqual(2);
    open(); await Promise.all(tasks); expect(lim.snapshot().active).toBe(0); expect(lim.snapshot().queued).toBe(0);
  });
  it("file pleine → concurrency_limited (jamais infini)", async () => {
    const lim = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 0, perTenantMaxConcurrent: 1 });
    let rel!: () => void; const first = lim.run("t", () => new Promise<void>((r) => { rel = r; }));
    await expect(lim.run("t", async () => {})).rejects.toMatchObject({ code: "concurrency_limited" });
    rel(); await first;
  });
  it("abort AVANT enqueue → cancelled, jamais démarré", async () => {
    const lim = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 5, perTenantMaxConcurrent: 1 });
    let rel!: () => void; const first = lim.run("t", () => new Promise<void>((r) => { rel = r; }));
    const ac = new AbortController(); ac.abort();
    let started = false;
    await expect(lim.run("t", async () => { started = true; }, { signal: ac.signal })).rejects.toMatchObject({ code: "cancelled" });
    expect(started).toBe(false); rel(); await first;
  });
  it("abort PENDANT l'attente en file → waiter retiré, handler jamais exécuté", async () => {
    const lim = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 5, perTenantMaxConcurrent: 1 });
    let rel!: () => void; const first = lim.run("t", () => new Promise<void>((r) => { rel = r; }));
    const ac = new AbortController();
    let started = false;
    // acquire (1er) et enqueue (2e) sont SYNCHRONES : le waiter est en file immédiatement (aucun wall-clock).
    const queued = lim.run("t", async () => { started = true; }, { signal: ac.signal });
    expect(lim.snapshot().queued).toBe(1);
    ac.abort();
    await expect(queued).rejects.toMatchObject({ code: "cancelled" });
    expect(started).toBe(false); expect(lim.snapshot().queued).toBe(0);
    rel(); await first; expect(lim.snapshot().active).toBe(0);
  });
  it("plafond par tenant + isolation ; slot rendu après throw", async () => {
    const lim = createConcurrencyLimiter({ maxConcurrent: 10, maxQueue: 0, perTenantMaxConcurrent: 1 });
    let relA!: () => void; const a = lim.run("A", () => new Promise<void>((r) => { relA = r; }));
    await expect(lim.run("A", async () => {})).rejects.toMatchObject({ code: "concurrency_limited" });
    expect(await lim.run("B", async () => "b")).toBe("b");
    relA(); await a;
    await lim.run("A", async () => { throw new Error("x"); }).catch(() => {});
    expect(lim.snapshot().active).toBe(0);
  });
});

// ── Runtime : budget total enveloppe la file (Blocker D) + active fail-closed ─────
describe("BLOC 13 — runtime guard", () => {
  it("off → passthrough (aucune limite) ; shadow → observe (handler inchangé même oversized)", async () => {
    const off = createHardenedRuntime(cfgOf({}));
    const h1 = vi.fn(async () => "served"); const r1 = await off.guard({ input: { message: "x".repeat(999999) } }, h1);
    expect(r1.ok).toBe(true); expect(h1).toHaveBeenCalledTimes(1);
    const shadow = createHardenedRuntime(cfgOf({ CLONECHAT_HARDENING_MODE: "shadow" }));
    const h2 = vi.fn(async () => "stable"); const r2 = await shadow.guard({ input: { message: "x".repeat(999999) } }, h2);
    expect(r2.ok).toBe(true); if (r2.ok) expect(r2.value).toBe("stable"); expect(h2).toHaveBeenCalledTimes(1);
  });
  it("active SANS evidence → runtime_disabled (fail-closed), handler jamais appelé", async () => {
    const rt = createHardenedRuntime(cfgOf({ CLONECHAT_HARDENING_MODE: "active" })); // aucune evidence
    const h = vi.fn(async () => "x"); const r = await rt.guard({ input: { message: "ok" } }, h);
    expect(r.ok).toBe(false); if (!r.ok) expect(r.error.code).toBe("runtime_disabled"); expect(h).not.toHaveBeenCalled();
  });
  it("active + evidence verte + input valide → exécute", async () => {
    const rt = createHardenedRuntime(cfgOf({ CLONECHAT_HARDENING_MODE: "active" }), { readinessEvidence: provenEvidence(), configResolution: { valid: true, diagnostics: [] }, schedule: neverSchedule });
    const r = await rt.guard({ input: { message: "ok" }, tenantKey: "co1" }, async () => "ok-active");
    expect(r.ok).toBe(true); if (r.ok) expect(r.value).toBe("ok-active");
  });
  it("active + oversized → bloqué avant handler", async () => {
    const rt = createHardenedRuntime(cfgOf({ CLONECHAT_HARDENING_MODE: "active" }), { readinessEvidence: provenEvidence(), configResolution: { valid: true, diagnostics: [] }, schedule: neverSchedule });
    const h = vi.fn(async () => "x"); const r = await rt.guard({ input: { message: "x".repeat(DEFAULT_LIMITS.maxMessageChars + 1) } }, h);
    expect(r.ok).toBe(false); if (!r.ok) expect(r.error.code).toBe("message_too_long"); expect(h).not.toHaveBeenCalled();
  });
  it("budget TOTAL enveloppe la FILE : un waiter en file expire (timeout) et ne démarre jamais", async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 5, perTenantMaxConcurrent: 1 });
    const rt = createHardenedRuntime(cfgOf({ CLONECHAT_HARDENING_MODE: "active" }), { readinessEvidence: provenEvidence(), configResolution: { valid: true, diagnostics: [] }, schedule: immediateSchedule, limiter });
    // Occupe le slot unique (handler jamais résolu).
    const busy = rt.guard({ tenantKey: "t", input: { message: "a" } }, () => new Promise(() => {}));
    await new Promise((r) => setTimeout(r, 5));
    // Deuxième requête : mise en file, budget total (schedule immédiat) → timeout AVANT exécution.
    const started = vi.fn();
    const r2 = await rt.guard({ tenantKey: "t", input: { message: "b" } }, async () => { started(); return "late"; });
    expect(r2.ok).toBe(false); if (!r2.ok) expect(["timeout", "cancelled"]).toContain(r2.error.code);
    expect(started).not.toHaveBeenCalled(); // le client parti ne lance jamais le handler plus tard
    void busy;
  });
});

// ── Body-guard (Blocker H) ────────────────────────────────────────────────────────
describe("BLOC 13 — body-guard (transport borné avant parsing)", () => {
  const makeReq = (bodyStr: string, headers: Record<string, string> = {}) => new Request("http://x/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: bodyStr });
  it("Content-Length > limite → détecté tôt", () => {
    expect(contentLengthExceeds(makeReq("{}", { "content-length": "9999" }), 100)).toBe(true);
    expect(contentLengthExceeds(makeReq("{}", { "content-length": "10" }), 100)).toBe(false);
    expect(contentLengthExceeds(makeReq("{}"), 100)).toBe(false); // absent
  });
  it("lecture bornée : corps sous la limite OK", async () => {
    const r = await readBoundedRequestText(makeReq(JSON.stringify({ message: "hi" })), 1024);
    expect(r.tooLarge).toBe(false); if (!r.tooLarge) expect(JSON.parse(r.text).message).toBe("hi");
  });
  it("lecture bornée : corps au-dessus de la limite → tooLarge (cumul réel, pas seulement Content-Length)", async () => {
    const big = JSON.stringify({ message: "z".repeat(5000) });
    const r = await readBoundedRequestText(makeReq(big), 500);
    expect(r.tooLarge).toBe(true);
  });
});

// ── chat-precheck (raw count avant slice) ─────────────────────────────────────────
describe("BLOC 13 — hardeningChatPrecheck (off passthrough ; active enforce raw count)", () => {
  it("off → jamais bloquant (même oversized)", () => {
    expect(hardeningChatPrecheck({ message: "x".repeat(999999) }, cfgOf({})).blocked).toBe(false);
  });
  it("active → nombre BRUT de pièces jointes > max → too_many_attachments (avant slice)", () => {
    const r = hardeningChatPrecheck({ rawAttachmentCount: 9 }, cfgOf({ CLONECHAT_HARDENING_MODE: "active" }));
    expect(r.blocked).toBe(true); if (r.blocked) expect(r.payload.code).toBe("too_many_attachments");
  });
  it("active + valide → non bloquant", () => {
    expect(hardeningChatPrecheck({ message: "ok", rawAttachmentCount: 1 }, cfgOf({ CLONECHAT_HARDENING_MODE: "active" })).blocked).toBe(false);
  });
});

// ── Observabilité & déterminisme ─────────────────────────────────────────────────
describe("BLOC 13 — observabilité sûre", () => {
  it("corrélation opaque déterministe sans id brut", () => {
    const a = correlationId({ viewerKey: "user:u1", tenantKey: "co:c1", nowMs: 1 });
    expect(a).toBe(correlationId({ viewerKey: "user:u1", tenantKey: "co:c1", nowMs: 1 }));
    expect(a).toMatch(/^hz_/); expect(a).not.toContain("u1");
  });
  it("champs de log sûrs (aucune donnée sensible)", () => {
    const blob = JSON.stringify(safeLogFields({ mode: "active", outcome: "blocked", code: "timeout", correlationId: "hz_x", durationMs: 3 }));
    for (const f of ["token", "cookie", "authorization", "prompt", "@"]) expect(blob.toLowerCase()).not.toContain(f);
  });
  it("version canonique stable", () => { expect(CLONECHAT_HARDENING_VERSION).toBe("hardening-1"); expect(cfgOf({}).version).toBe("hardening-1"); });
});
