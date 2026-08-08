// src/app/api/assistant/chat/__tests__/hardening-route-concurrency.test.ts
//
// BLOC 13 — CONCURRENCE + BACKPRESSURE réellement appliquées par le CHEMIN ACTIF SERVI de
// /api/assistant/chat (pas seulement par createConcurrencyLimiter isolé). Provider synthétique bloquant
// (seam fail-closed) pour tenir un slot ; introspection du VRAI limiteur servi via
// activeConcurrencySnapshotForTests. Prouve : maxConcurrent GLOBAL, perTenantMax, file utilisée, file
// pleine → concurrency_limited, attente d'un slot puis démarrage à la libération, abort PENDANT l'attente
// → provider JAMAIS appelé, libération du slot (erreur/abort de stream), deux tenants indépendants,
// snapshot final 0/0. (Le budget TOTAL qui enveloppe l'attente-file et son timeout sont prouvés de façon
// DÉTERMINISTE au niveau adaptateur servi dans hardening-served.test.ts — planificateur injecté.)
// NB : la config doit rester SAINE (perTenantMax ≤ maxConcurrent), sinon la route fail-close (config_invalid).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.setConfig({ testTimeout: 30_000 });

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: vi.fn(async () => ({ ok: false, reason: "NO_ENTITLEMENT", error: null })) }));
vi.mock("@/lib/clonechat/server/company", () => ({ resolveCloneChatCompany: vi.fn(async () => ({ ok: false, code: "MEMBERSHIP_REQUIRED" })) }));
vi.mock("@/lib/clonechat/server/runtime", () => ({ getCloneChatStores: vi.fn() }));
vi.mock("@/lib/pierre/v1/e2e-test-identity", () => ({ isE2EModeEnabled: () => true, readE2EIdentityFromRequest: () => null }));
vi.mock("openai", () => ({ default: class { responses = { create: async () => ({ output_text: "x", output: [], usage: {}, model: "m" }) }; } }));
vi.mock("@/lib/clonechat/core/responder", () => ({
  respondUnified: vi.fn(async () => ({ ok: true, answer: "HISTORICAL", webSources: [], suggestCard: false, usedWebSearch: false })),
  loadResponderConfig: () => ({}),
  readOpenAIKeyLazy: () => "sk-lazy-" + "x".repeat(32),
}));

import { getCloneChatStores } from "@/lib/clonechat/server/runtime";
import { respondUnified } from "@/lib/clonechat/core/responder";
import { __resetAnonymousRateLimit } from "@/lib/clonechat/server/anonymous-rate-limit";
import { __setActiveStreamProduceForTests, __resetActiveHardeningForTests, activeConcurrencySnapshotForTests } from "@/lib/clonechat/hardening";
import { POST } from "@/app/api/assistant/chat/route";

function stores() {
  return {
    durable: false,
    budget: { reserve: vi.fn(async () => ({ granted: true, reason: null, scopes: ["g:day"], reservedTokens: 500, maxOutputTokens: 500 })), commit: vi.fn(async () => {}), release: vi.fn(async () => {}), recordUsage: vi.fn(async () => {}), snapshot: vi.fn(async () => ({})) },
    conversations: { appendMessage: vi.fn(async () => {}) },
    support: { findReusable: vi.fn(async () => ({ matched: false })), report: vi.fn(async () => {}) },
    proposals: { create: vi.fn(async () => {}) },
  };
}

// Seam de streaming CONTRÔLABLE : la Nième invocation signale son démarrage et bloque jusqu'à release[N].
let seamCalls = 0;
const started: Array<() => void> = [];
const startedP: Array<Promise<void>> = [];
const release: Array<() => void> = [];
const releaseP: Array<Promise<void>> = [];
function prepare(n: number) {
  seamCalls = 0; started.length = 0; startedP.length = 0; release.length = 0; releaseP.length = 0;
  for (let i = 0; i < n; i++) {
    let s!: () => void; startedP.push(new Promise<void>((r) => (s = r))); started.push(s);
    let rr!: () => void; releaseP.push(new Promise<void>((r) => (rr = r))); release.push(rr);
  }
}
const gatedSeam = async (emit: (d: string) => void) => {
  const idx = seamCalls++;
  emit("x");
  started[idx]?.();
  await (releaseP[idx] ?? Promise.resolve());
  return { donePayload: { ok: true, hardened: true, structured: { answer: "x", honesty: "answered", tool_call: null, citations: [] } } };
};

const snap = () => activeConcurrencySnapshotForTests();
async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) { if (Date.now() - start > ms) throw new Error("waitFor timeout"); await new Promise((r) => setTimeout(r, 5)); }
}
const CONC = ["CLONECHAT_HARDENING_MAX_CONCURRENT", "CLONECHAT_HARDENING_MAX_QUEUE", "CLONECHAT_HARDENING_PER_TENANT_MAX"];
function setConc(o: { max: number; queue: number; perTenant: number }) {
  process.env.CLONECHAT_HARDENING_MAX_CONCURRENT = String(o.max);
  process.env.CLONECHAT_HARDENING_MAX_QUEUE = String(o.queue);
  process.env.CLONECHAT_HARDENING_PER_TENANT_MAX = String(o.perTenant); // DOIT rester ≤ max (config saine)
}
const ENV_KEY = process.env.OPENAI_API_KEY;

beforeEach(() => {
  __resetAnonymousRateLimit();
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(gatedSeam);
  vi.mocked(respondUnified).mockClear();
  process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(32);
  process.env.CLONECHAT_HARDENING_MODE = "active";
  delete process.env.CLONECHAT_HARDENING_KILL_SWITCH;
  for (const k of CONC) delete process.env[k];
  vi.mocked(getCloneChatStores).mockResolvedValue(stores() as never);
});
afterEach(() => {
  for (const r of release) r?.(); // débloque tout seam encore en attente
  if (ENV_KEY === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = ENV_KEY;
  delete process.env.CLONECHAT_HARDENING_MODE;
  for (const k of CONC) delete process.env[k];
  __resetActiveHardeningForTests();
  __setActiveStreamProduceForTests(null);
});

const askStream = (message: string, headers: Record<string, string> = {}, signal?: AbortSignal) =>
  POST(new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ message, stream: true }), ...(signal ? { signal } : {}) }));
const T1 = { "x-forwarded-for": "10.0.0.1" };
const T2 = { "x-forwarded-for": "10.0.0.2" };

describe("BLOC 13 — concurrence/backpressure sur le chemin ACTIF servi", () => {
  it("maxConcurrent GLOBAL=1 : 2 tenants distincts → la 2e ATTEND, puis démarre à la libération de la 1re", async () => {
    setConc({ max: 1, queue: 8, perTenant: 1 });
    prepare(2);
    const rA = await askStream("A", T1);
    await waitFor(() => seamCalls >= 1);          // seam A démarré, bloqué (slot global tenu)
    const pB = askStream("B", T2);                // tenant DISTINCT : seul le cap GLOBAL peut le mettre en file
    await waitFor(() => snap().queued === 1);
    expect(snap().active).toBe(1);
    expect(seamCalls).toBe(1);                     // B n'a pas appelé le provider
    release[0]();
    const rB = await pB;
    await waitFor(() => seamCalls >= 2);           // B démarre seulement à la libération
    expect(snap().active).toBe(1);
    expect(snap().queued).toBe(0);
    release[1]();
    await rA.text(); await rB.text();
    await waitFor(() => snap().active === 0 && snap().queued === 0);
    expect(snap()).toEqual({ active: 0, queued: 0, perTenantActive: {} });
  });

  it("perTenantMax=1 : même tenant → la 2e attend même si le GLOBAL a de la place (max=5)", async () => {
    setConc({ max: 5, queue: 8, perTenant: 1 });
    prepare(2);
    const rA = await askStream("A", T1);
    await waitFor(() => seamCalls >= 1);
    const pB = askStream("B", T1);                 // même tenant → cap PER-TENANT
    await waitFor(() => snap().queued === 1);
    expect(snap().active).toBe(1);                 // global libre (max 5) mais perTenant=1 → file
    release[0]();
    const rB = await pB;
    await waitFor(() => seamCalls >= 2);
    release[1]();
    await rA.text(); await rB.text();
    await waitFor(() => snap().active === 0);
  });

  it("deux tenants INDÉPENDANTS (perTenant=1, global=5) → chacun obtient un slot → active=2", async () => {
    setConc({ max: 5, queue: 8, perTenant: 1 });
    prepare(2);
    const rA = await askStream("A", T1);
    await waitFor(() => seamCalls >= 1);
    const rB = await askStream("B", T2);          // tenant distinct → acquiert immédiatement
    await waitFor(() => seamCalls >= 2);
    expect(snap().active).toBe(2);
    release[0](); release[1]();
    await rA.text(); await rB.text();
    await waitFor(() => snap().active === 0);
  });

  it("file PLEINE (maxQueue=0) → concurrency_limited (429), provider NON appelé pour la requête refusée", async () => {
    setConc({ max: 1, queue: 0, perTenant: 1 });
    prepare(2);
    const rA = await askStream("A", T1);
    await waitFor(() => seamCalls >= 1);
    const rB = await askStream("B", T2);          // file pleine → refus immédiat
    expect(rB.status).toBe(429);
    const d = await rB.json();
    expect(d.code).toBe("concurrency_limited");
    expect(seamCalls).toBe(1);                     // provider jamais appelé pour B
    release[0]();
    await rA.text();
  });

  it("ABORT pendant l'attente → waiter retiré, provider JAMAIS appelé, code cancelled (499)", async () => {
    setConc({ max: 1, queue: 8, perTenant: 1 });
    prepare(2);
    const rA = await askStream("A", T1);
    await waitFor(() => seamCalls >= 1);
    const ac = new AbortController();
    const pB = askStream("B", T2, ac.signal);
    await waitFor(() => snap().queued === 1);
    ac.abort();                                    // annulation client PENDANT l'attente
    const rB = await pB;
    expect(rB.status).toBe(499);
    const d = await rB.json();
    expect(d.code).toBe("cancelled");
    expect(seamCalls).toBe(1);                     // B n'a jamais démarré le provider
    await waitFor(() => snap().queued === 0);
    release[0]();
    await rA.text();
  });

  it("ERREUR de stream → slot RENDU (active revient à 0)", async () => {
    setConc({ max: 1, queue: 8, perTenant: 1 });
    __setActiveStreamProduceForTests(async () => { throw new Error("provider boom"); });
    const rA = await askStream("A", T1);
    await rA.text();                               // stream A termine en erreur → onFinished → slot rendu
    await waitFor(() => snap().active === 0);
    expect(snap().active).toBe(0);
  });

  it("ABORT de stream (après démarrage) → slot RENDU", async () => {
    setConc({ max: 1, queue: 8, perTenant: 1 });
    prepare(1);
    const ac = new AbortController();
    const rA = await askStream("A", T1, ac.signal);
    await waitFor(() => seamCalls >= 1);
    expect(snap().active).toBe(1);
    ac.abort();                                    // annulation PENDANT le stream
    await rA.text();
    await waitFor(() => snap().active === 0);
    expect(snap().active).toBe(0);
  });
});
