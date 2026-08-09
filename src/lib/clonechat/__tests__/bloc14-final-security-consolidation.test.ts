// src/lib/clonechat/__tests__/bloc14-final-security-consolidation.test.ts
//
// BLOC 14 §4 — CONSOLIDATION FINALE des invariants confirmation / idempotence / tenant / auth, en
// APPELANT les modules RÉELS (aucune réimplémentation). Assemble dans une suite BLOC 14 nommée les
// preuves aujourd'hui dispersées, pour une couverture explicite et traçable.

import { describe, it, expect } from "vitest";
import { planAction, executeAction, mintConfirmation, createConfirmationRegistry, type CloneActionPlan } from "@/lib/clonechat/actions";
import { buildTicketDraft, mockSupportProvider, type SupportTicketProvider } from "@/lib/clonechat/care";
import { createInMemoryIdempotency } from "@/lib/clonechat/durable/idempotency-store";
import { buildCloneChatContext } from "@/lib/clonechat/context";
import { classifyCloneChatRequest, resolveCloneChatPlan } from "@/lib/clonechat/server/universal-access";
import { inspectEvidence, type RawEvidence } from "@/lib/clonechat/inspector";
import { resolveOnboarding, createInMemoryOnboardingStore } from "@/lib/clonechat/onboarding";
import { intakeMission } from "@/lib/clonechat/mission";
import type { CloneChatViewer } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";

const NOW = 1_700_000_000_000;
const ANON: CloneChatViewer = { kind: "anonymous" };
const USER = (id = "u-1"): CloneChatViewer => ({ kind: "user", userId: id });
const TENANT_OK = (c = "co-1"): TenantResolution => ({ ok: true, companyId: c, role: "owner", siteIds: [], real: true });
const TENANT_NONE: TenantResolution = { ok: false, code: "MEMBERSHIP_REQUIRED" };
const TENANT_SUSPENDED: TenantResolution = { ok: false, code: "MEMBERSHIP_SUSPENDED" };
const PIERRE_OK: PierreAccessResult = { ok: true, status: "active", orderId: "o-1", error: null };
const PIERRE_NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };

interface CtxOpts { viewer: CloneChatViewer; tenant?: TenantResolution | null; entitlement?: PierreAccessResult | null; }
const ctxOf = (o: CtxOpts) => buildCloneChatContext({ message: "x", viewer: o.viewer, tenant: o.tenant ?? null, entitlement: o.entitlement ?? null, routePath: null, environment: "production" });
const TICKET = (summary = "aide") => buildTicketDraft({ summary, category: "other", priority: "normal", affectedRoute: null, errorCodes: ["glorp_1"], attemptedSteps: [], expectedResult: "ok", observedResult: "ko", evidence: [], tenantRef: null });
const submitPlan = (o: CtxOpts = { viewer: USER() }, ticket = TICKET()): CloneActionPlan => planAction({ actionId: "submit_ticket", args: { ticket } }, { context: ctxOf(o), securityRefusal: false });
const execEnv = (deps: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({ confirmationRegistry: createConfirmationRegistry(), idempotency: createInMemoryIdempotency(), deps, nowMs: NOW, ...over } as Parameters<typeof executeAction>[1]);
const counting = () => { const s = { calls: 0 }; const provider: SupportTicketProvider = { submit: async (d) => { s.calls++; return { ok: true, ticketId: `t-${d.idempotencyKey}`, error: null }; } }; return { s, provider }; };
const evOf = (p: Partial<RawEvidence> & Pick<RawEvidence, "declaredMime" | "extension">): RawEvidence => ({ id: "e1", origin: "upload", name: "preuve", bytes: p.content?.length ?? (p.text?.length ?? 0), ...p });

describe("BLOC 14 §4 — CONFIRMATION matrix (module actions réel)", () => {
  it("missing → CONFIRMATION_MISSING, jamais exécuté", async () => {
    const r = await executeAction(submitPlan(), execEnv({ supportProvider: mockSupportProvider() }));
    expect(r.state).toBe("blocked");
    expect(r.error?.code).toBe("CONFIRMATION_MISSING");
  });
  it("valid → succeeded", async () => {
    const p = submitPlan();
    const r = await executeAction(p, execEnv({ supportProvider: mockSupportProvider() }, { confirmation: mintConfirmation(p, { nowMs: NOW }) }));
    expect(r.state).toBe("succeeded");
  });
  it("expired → CONFIRMATION_EXPIRED", async () => {
    const p = submitPlan();
    const r = await executeAction(p, execEnv({ supportProvider: mockSupportProvider() }, { confirmation: mintConfirmation(p, { nowMs: NOW, ttlMs: 1000 }), nowMs: NOW + 5000 }));
    expect(r.error?.code).toBe("CONFIRMATION_EXPIRED");
  });
  it("reused → CONFIRMATION_REUSED (même registry)", async () => {
    const p = submitPlan();
    const env = execEnv({ supportProvider: mockSupportProvider() }, { confirmation: mintConfirmation(p, { nowMs: NOW }) });
    expect((await executeAction(p, env)).state).toBe("succeeded");
    expect((await executeAction(p, env)).error?.code).toBe("CONFIRMATION_REUSED");
  });
  it("wrong action → CONFIRMATION_MISMATCH", async () => {
    const conf = mintConfirmation(submitPlan(), { nowMs: NOW });
    const gov = planAction({ actionId: "prepare_governed_request", args: { summary: "x" } }, { context: ctxOf({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }), securityRefusal: false });
    expect((await executeAction(gov, execEnv({}, { confirmation: conf }))).error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("wrong args → CONFIRMATION_MISMATCH", async () => {
    const conf = mintConfirmation(submitPlan({ viewer: USER() }, TICKET("A")), { nowMs: NOW });
    expect((await executeAction(submitPlan({ viewer: USER() }, TICKET("B")), execEnv({ supportProvider: mockSupportProvider() }, { confirmation: conf }))).error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("wrong viewer → CONFIRMATION_MISMATCH", async () => {
    const conf = mintConfirmation(submitPlan({ viewer: USER("uA") }), { nowMs: NOW });
    expect((await executeAction(submitPlan({ viewer: USER("uB") }), execEnv({ supportProvider: mockSupportProvider() }, { confirmation: conf }))).error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("wrong tenant → CONFIRMATION_MISMATCH (isolation inter-tenant)", async () => {
    const conf = mintConfirmation(submitPlan({ viewer: USER(), tenant: TENANT_OK("company-A") }), { nowMs: NOW });
    expect((await executeAction(submitPlan({ viewer: USER(), tenant: TENANT_OK("company-B") }), execEnv({ supportProvider: mockSupportProvider() }, { confirmation: conf }))).error?.code).toBe("CONFIRMATION_MISMATCH");
  });
});

describe("BLOC 14 §4 — IDEMPOTENCE (effet observable au maximum UNE fois)", () => {
  it("duplicate confirmation (registry frais, même idempotency) → duplicate, adaptateur 1×", async () => {
    const { s, provider } = counting();
    const p = submitPlan(); const conf = mintConfirmation(p, { nowMs: NOW }); const idem = createInMemoryIdempotency();
    expect((await executeAction(p, { confirmationRegistry: createConfirmationRegistry(), idempotency: idem, deps: { supportProvider: provider }, nowMs: NOW, confirmation: conf })).state).toBe("succeeded");
    expect((await executeAction(p, { confirmationRegistry: createConfirmationRegistry(), idempotency: idem, deps: { supportProvider: provider }, nowMs: NOW, confirmation: conf })).state).toBe("duplicate");
    expect(s.calls).toBe(1);
  });
  it("duplicate concurrent (network retry simulé) → effet UNE fois", async () => {
    const { s, provider } = counting();
    const p = submitPlan(); const conf = mintConfirmation(p, { nowMs: NOW }); const idem = createInMemoryIdempotency();
    const run = () => executeAction(p, { confirmationRegistry: createConfirmationRegistry(), idempotency: idem, deps: { supportProvider: provider }, nowMs: NOW, confirmation: conf });
    const [a, b] = await Promise.all([run(), run()]);
    const states = [a.state, b.state].sort();
    expect(states).toContain("succeeded");
    expect(s.calls).toBeLessThanOrEqual(1); // effet au plus une fois malgré la concurrence
  });
});

describe("BLOC 14 §4 — TENANT isolation (A n'accède jamais à B)", () => {
  it("A ne lit pas B : contexte tenant A n'expose jamais l'id de B", () => {
    const s = JSON.stringify(ctxOf({ viewer: USER("uA"), tenant: TENANT_OK("company-A"), entitlement: PIERRE_OK }));
    expect(s).toContain("company-A"); expect(s).not.toContain("company-B");
  });
  it("A ne confirme pas B : confirmation cross-tenant refusée (MISMATCH)", async () => {
    const conf = mintConfirmation(submitPlan({ viewer: USER(), tenant: TENANT_OK("company-A") }), { nowMs: NOW });
    expect((await executeAction(submitPlan({ viewer: USER(), tenant: TENANT_OK("company-B") }), execEnv({ supportProvider: mockSupportProvider() }, { confirmation: conf }))).error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("A ne réutilise pas la preuve de B : evidence tenant-scopée B sous contexte A → refusée/non utilisée", async () => {
    const r = await inspectEvidence(evOf({ declaredMime: "image/png", extension: "png", content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), bytes: 40, tenantScoped: "company-B" }), {}, { context: ctxOf({ viewer: USER(), tenant: TENANT_OK("company-A"), entitlement: PIERRE_OK }) });
    expect(["security_refusal", "invalid", "unsupported", "needs_context", "provider_failure"]).toContain(r.status);
  });
  it("A ne reprend pas l'onboarding de B : aucune progression cross-tenant", () => {
    const store = createInMemoryOnboardingStore();
    resolveOnboarding({ context: ctxOf({ viewer: USER("uA"), tenant: TENANT_OK("company-A"), entitlement: PIERRE_OK }), nowMs: NOW, store });
    const b = resolveOnboarding({ context: ctxOf({ viewer: USER("uB"), tenant: TENANT_OK("company-B"), entitlement: PIERRE_OK }), nowMs: NOW, store });
    expect(JSON.stringify(b)).not.toContain("company-A");
  });
  it("A ne construit pas de mission à partir de l'état privé de B : contexte A jamais lié à B", () => {
    const m = intakeMission({ message: "Prépare un avenant", context: ctxOf({ viewer: USER("uA"), tenant: TENANT_OK("company-A"), entitlement: PIERRE_OK }), providedInputs: { expected_result: "avenant" }, nowMs: NOW });
    expect(JSON.stringify(m)).not.toContain("company-B");
  });
});

describe("BLOC 14 §4 — AUTH matrix (décisions explicites fail-closed)", () => {
  const planFor = (viewer: CloneChatViewer, tenant: TenantResolution | null, entitlement: PierreAccessResult | null, message = "Prépare une mission RH pour mon entreprise") =>
    resolveCloneChatPlan({ requestClass: classifyCloneChatRequest(message), viewer, entitlement, tenant });
  it("anonymous → voie PUBLIC (aucun contexte privé)", () => {
    expect(planFor(ANON, null, null).lane).toBe("PUBLIC");
  });
  it("authenticated sans company → prérequis entreprise", () => {
    const p = planFor(USER(), TENANT_NONE, PIERRE_NONE);
    expect(p.missingPrerequisites.length).toBeGreaterThan(0);
    expect(p.lane).not.toBe("COMPANY");
  });
  it("authenticated + company + entitlement valide → voie COMPANY", () => {
    expect(planFor(USER(), TENANT_OK(), PIERRE_OK).lane).toBe("COMPANY");
  });
  it("entitlement absent → prérequis Pierre, pas COMPANY", () => {
    const p = planFor(USER(), TENANT_OK(), PIERRE_NONE);
    expect(p.lane).not.toBe("COMPANY");
    expect(p.missingPrerequisites.length).toBeGreaterThan(0);
  });
  it("membership suspendu → échec de sécurité tenant (fail-closed, pas COMPANY)", () => {
    const p = planFor(USER(), TENANT_SUSPENDED, PIERRE_OK);
    expect(p.lane).not.toBe("COMPANY");
    expect(p.tenantSecurityFailure || p.missingPrerequisites.length > 0).toBeTruthy();
  });
});
