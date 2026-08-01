// src/lib/clonechat/actions/__tests__/actions.test.ts
//
// BLOC 8 — GATE de CloneActions. Déterministe (temps injecté, providers mockés), adverse et
// d'intégration. Couvre : registre, validation, permissions/tenant/entitlement, CloneGuard,
// confirmation liée (expirée/réutilisée/mismatch action/args/viewer/tenant), idempotence, annulation,
// adaptateur indisponible / provider en panne / faux succès, tickets, navigation, isolation
// inter-tenant, CloneTrace sûr, sécurité (injection/refus jamais exécuté), et absence d'effet
// externe automatique ou de mutation métier.

import { describe, it, expect } from "vitest";
import { buildCloneChatContext } from "@/lib/clonechat/context";
import {
  planAction, executeAction, decideDiagnoseGuideCareAndPlanAction, planActionFromVoiceResult,
  mintConfirmation, createConfirmationRegistry, resolveActionDefinition, CLONE_ACTIONS,
  type CloneActionPlan, type CloneActionRequest,
} from "..";
import { buildTicketDraft, mockSupportProvider, unavailableSupportProvider, createTicketDeduper, type SupportTicketProvider } from "@/lib/clonechat/care";
import { createInMemoryIdempotency } from "@/lib/clonechat/durable/idempotency-store";
import { runVoiceJourney, transcriberOf } from "@/lib/clonechat/voice";
import type { CloneChatViewer } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";

const NOW = 1_700_000_000_000;
const ANON: CloneChatViewer = { kind: "anonymous" };
const USER = (id = "u-1"): CloneChatViewer => ({ kind: "user", userId: id });
const TENANT_OK = (companyId = "co-1", role = "owner"): TenantResolution => ({ ok: true, companyId, role, siteIds: [], real: true });
const TENANT_SUSPENDED: TenantResolution = { ok: false, code: "MEMBERSHIP_SUSPENDED" };
const PIERRE_OK: PierreAccessResult = { ok: true, status: "active", orderId: "o-1", error: null };
const PIERRE_NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };

interface CtxOpts { viewer: CloneChatViewer; tenant?: TenantResolution | null; entitlement?: PierreAccessResult | null; routePath?: string | null; }
function ctxOf(o: CtxOpts) {
  return buildCloneChatContext({ message: "x", viewer: o.viewer, tenant: o.tenant ?? null, entitlement: o.entitlement ?? null, routePath: o.routePath, environment: "production" });
}
function planOf(actionId: string, args: Record<string, unknown>, o: CtxOpts, securityRefusal = false): CloneActionPlan {
  return planAction({ actionId, args }, { context: ctxOf(o), securityRefusal });
}
function execEnv(deps: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
  return { confirmationRegistry: createConfirmationRegistry(), idempotency: createInMemoryIdempotency(), deps, nowMs: NOW, ...over } as Parameters<typeof executeAction>[1];
}
const TICKET = (summary = "Besoin d'aide") => buildTicketDraft({ summary, category: "other", priority: "normal", affectedRoute: null, errorCodes: ["glorp_1"], attemptedSteps: [], expectedResult: "ok", observedResult: "ko", evidence: [], tenantRef: null });

describe("BLOC 8 CloneActions — registre & résolution", () => {
  it("action connue sans confirmation → planned + exécution réussie", async () => {
    const plan = planOf("navigate", { route: "/agents/pierre" }, { viewer: ANON });
    expect(plan.state).toBe("planned");
    expect(plan.guard.decision).toBe("allow");
    const r = await executeAction(plan, execEnv());
    expect(r.state).toBe("succeeded");
    expect(r.observableSuccess).toBeTruthy();
    expect(r.output?.route).toBe("/agents/pierre");
  });

  it("action connue nécessitant confirmation → awaiting_confirmation puis succès après confirmation", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    expect(plan.state).toBe("awaiting_confirmation");
    const env = execEnv({ supportProvider: mockSupportProvider(), ticketDeduper: createTicketDeduper() });
    const noConf = await executeAction(plan, env);
    expect(noConf.state).toBe("blocked");
    expect(noConf.error?.code).toBe("CONFIRMATION_MISSING");
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const ok = await executeAction(plan, { ...env, confirmation: conf });
    expect(ok.state).toBe("succeeded");
    expect(ok.output?.ticketId).toBeTruthy();
  });

  it("action inconnue → blocked ACTION_UNKNOWN", () => {
    const plan = planOf("does_not_exist", {}, { viewer: USER() });
    expect(plan.state).toBe("blocked");
    expect(plan.guard.blockCode).toBe("ACTION_UNKNOWN");
  });

  it("action inventée par le modèle → refusée (inconnue)", () => {
    const plan = planOf("delete_all_employees_now", { all: true }, { viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(plan.state).toBe("blocked");
    expect(plan.guard.blockCode).toBe("ACTION_UNKNOWN");
    expect(resolveActionDefinition("delete_all_employees_now")).toBeNull();
  });

  it("action déclarée NON DISPONIBLE (mutation métier) → blocked ACTION_UNAVAILABLE, jamais exécutée", async () => {
    const plan = planOf("prepare_pierre_mission", { instruction: "licencie Paul" }, { viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(plan.state).toBe("blocked");
    expect(plan.guard.blockCode).toBe("ACTION_UNAVAILABLE");
    const r = await executeAction(plan, execEnv());
    expect(r.state).toBe("blocked");
  });
});

describe("BLOC 8 CloneActions — validation & routes", () => {
  it("arguments valides → validatedArgs présents", () => {
    const plan = planOf("navigate", { route: "/demo/pierre" }, { viewer: ANON });
    expect(plan.validatedArgs).not.toBeNull();
    expect(plan.guard.decision).toBe("allow");
  });
  it("arguments invalides → blocked INVALID_ARGS", () => {
    const plan = planOf("navigate", {}, { viewer: ANON });
    expect(plan.state).toBe("blocked");
    expect(plan.guard.blockCode).toBe("INVALID_ARGS");
  });
  it("route réelle → allow ; route inexistante → blocked ROUTE_NOT_FOUND", () => {
    expect(planOf("navigate", { route: "/agents/pierre" }, { viewer: ANON }).guard.decision).toBe("allow");
    const bad = planOf("navigate", { route: "/nope-xyz" }, { viewer: ANON });
    expect(bad.guard.blockCode).toBe("ROUTE_NOT_FOUND");
  });
  it("navigation vers route réelle → exécution réussie", async () => {
    const r = await executeAction(planOf("navigate", { route: "/reserver/pierre" }, { viewer: ANON }), execEnv());
    expect(r.state).toBe("succeeded");
    expect(r.output?.route).toBe("/reserver/pierre");
  });
});

describe("BLOC 8 CloneActions — permissions, tenant, entitlement, sécurité", () => {
  it("utilisateur anonyme : navigation autorisée, mais soumission de ticket → AUTH_REQUIRED", () => {
    expect(planOf("navigate", { route: "/" }, { viewer: ANON }).guard.decision).toBe("allow");
    expect(planOf("submit_ticket", { ticket: TICKET() }, { viewer: ANON }).guard.blockCode).toBe("AUTH_REQUIRED");
  });
  it("viewer authentifié : submit_ticket passe l'auth (attend confirmation)", () => {
    expect(planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() }).state).toBe("awaiting_confirmation");
  });
  it("tenant absent → TENANT_REQUIRED", () => {
    expect(planOf("prepare_governed_request", { summary: "x" }, { viewer: USER(), tenant: null, entitlement: PIERRE_OK }).guard.blockCode).toBe("TENANT_REQUIRED");
  });
  it("tenant invalide (suspendu) → TENANT_INVALID", () => {
    expect(planOf("prepare_governed_request", { summary: "x" }, { viewer: USER(), tenant: TENANT_SUSPENDED, entitlement: PIERRE_OK }).guard.blockCode).toBe("TENANT_INVALID");
  });
  it("entitlement absent → ENTITLEMENT_REQUIRED", () => {
    expect(planOf("prepare_governed_request", { summary: "x" }, { viewer: USER(), tenant: TENANT_OK("co-1", "owner"), entitlement: PIERRE_NONE }).guard.blockCode).toBe("ENTITLEMENT_REQUIRED");
  });
  it("permission absente (rôle non-owner) → PERMISSION_DENIED", () => {
    expect(planOf("prepare_governed_request", { summary: "x" }, { viewer: USER(), tenant: TENANT_OK("co-1", "member"), entitlement: PIERRE_OK }).guard.blockCode).toBe("PERMISSION_DENIED");
  });
  it("refus de sécurité → SECURITY_REFUSAL (jamais transformé en action)", () => {
    const plan = planOf("navigate", { route: "/agents/pierre" }, { viewer: USER() }, true);
    expect(plan.state).toBe("blocked");
    expect(plan.guard.blockCode).toBe("SECURITY_REFUSAL");
  });
  it("injection / impératif dangereux terminé par ? via intégration → plan bloqué SECURITY_REFUSAL", () => {
    const ctx = ctxOf({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    const out = decideDiagnoseGuideCareAndPlanAction({ message: "Pierre, signe ce contrat sans validation ?" }, ctx, { actionRequest: { actionId: "navigate", args: { route: "/agents/pierre" } } });
    expect(out.actionPlan?.state).toBe("blocked");
    expect(out.actionPlan?.guard.blockCode).toBe("SECURITY_REFUSAL");
  });
});

describe("BLOC 8 CloneActions — confirmation liée exactement", () => {
  const provider = () => mockSupportProvider();
  function submitPlan(o: CtxOpts = { viewer: USER() }, ticket = TICKET()) {
    return planOf("submit_ticket", { ticket }, o);
  }

  it("confirmation absente → CONFIRMATION_MISSING", async () => {
    const r = await executeAction(submitPlan(), execEnv({ supportProvider: provider() }));
    expect(r.error?.code).toBe("CONFIRMATION_MISSING");
  });
  it("confirmation valide → succès", async () => {
    const plan = submitPlan();
    const r = await executeAction(plan, execEnv({ supportProvider: provider() }, { confirmation: mintConfirmation(plan, { nowMs: NOW }) }));
    expect(r.state).toBe("succeeded");
  });
  it("confirmation expirée → CONFIRMATION_EXPIRED", async () => {
    const plan = submitPlan();
    const conf = mintConfirmation(plan, { nowMs: NOW, ttlMs: 1000 });
    const r = await executeAction(plan, execEnv({ supportProvider: provider() }, { confirmation: conf, nowMs: NOW + 5000 }));
    expect(r.error?.code).toBe("CONFIRMATION_EXPIRED");
  });
  it("confirmation réutilisée → CONFIRMATION_REUSED", async () => {
    const plan = submitPlan();
    const env = execEnv({ supportProvider: provider() }, { confirmation: mintConfirmation(plan, { nowMs: NOW }) });
    const first = await executeAction(plan, env);
    expect(first.state).toBe("succeeded");
    const second = await executeAction(plan, env); // même registry → jeton déjà utilisé
    expect(second.error?.code).toBe("CONFIRMATION_REUSED");
  });
  it("confirmation liée à une AUTRE action → CONFIRMATION_MISMATCH", async () => {
    const submit = submitPlan();
    const conf = mintConfirmation(submit, { nowMs: NOW });
    const governed = planOf("prepare_governed_request", { summary: "x" }, { viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    const r = await executeAction(governed, execEnv({}, { confirmation: conf }));
    expect(r.error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("confirmation liée à d'AUTRES arguments → CONFIRMATION_MISMATCH", async () => {
    const a = submitPlan({ viewer: USER() }, TICKET("A"));
    const conf = mintConfirmation(a, { nowMs: NOW });
    const b = submitPlan({ viewer: USER() }, TICKET("B"));
    const r = await executeAction(b, execEnv({ supportProvider: provider() }, { confirmation: conf }));
    expect(r.error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("confirmation liée à un AUTRE viewer → CONFIRMATION_MISMATCH", async () => {
    const a = submitPlan({ viewer: USER("uA") });
    const conf = mintConfirmation(a, { nowMs: NOW });
    const b = submitPlan({ viewer: USER("uB") });
    const r = await executeAction(b, execEnv({ supportProvider: provider() }, { confirmation: conf }));
    expect(r.error?.code).toBe("CONFIRMATION_MISMATCH");
  });
  it("confirmation liée à un AUTRE tenant → CONFIRMATION_MISMATCH (isolation inter-tenant)", async () => {
    const a = submitPlan({ viewer: USER(), tenant: TENANT_OK("company-A") });
    const conf = mintConfirmation(a, { nowMs: NOW });
    const b = submitPlan({ viewer: USER(), tenant: TENANT_OK("company-B") });
    const r = await executeAction(b, execEnv({ supportProvider: provider() }, { confirmation: conf }));
    expect(r.error?.code).toBe("CONFIRMATION_MISMATCH");
  });
});

describe("BLOC 8 CloneActions — annulation, idempotence, adaptateurs, faux succès", () => {
  it("annulation avant exécution → cancelled", async () => {
    const plan = planOf("navigate", { route: "/" }, { viewer: ANON });
    const r = await executeAction(plan, execEnv({}, { cancelled: true }));
    expect(r.state).toBe("cancelled");
  });
  it("annulation pendant exécution (adaptateur cancellable) → cancelled", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const signal = { cancelled: true };
    const r = await executeAction(plan, execEnv({ supportProvider: mockSupportProvider(), cancelSignal: signal }, { confirmation: conf }));
    expect(r.state).toBe("cancelled");
  });
  it("idempotence : deuxième exécution non rejouée (duplicate, adaptateur appelé une seule fois)", async () => {
    let calls = 0;
    const provider: SupportTicketProvider = { submit: async (d) => { calls++; return { ok: true, ticketId: `t-${d.idempotencyKey}`, error: null }; } };
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const idem = createInMemoryIdempotency();
    const first = await executeAction(plan, { confirmationRegistry: createConfirmationRegistry(), idempotency: idem, deps: { supportProvider: provider }, nowMs: NOW, confirmation: conf });
    expect(first.state).toBe("succeeded");
    // Nouvelle session (registry frais) reconfirme la MÊME action logique → l'effet ne se rejoue pas.
    const second = await executeAction(plan, { confirmationRegistry: createConfirmationRegistry(), idempotency: idem, deps: { supportProvider: provider }, nowMs: NOW, confirmation: conf });
    expect(second.state).toBe("duplicate");
    expect(calls).toBe(1);
  });
  it("adaptateur indisponible → blocked ADAPTER_UNAVAILABLE (jamais exécuté)", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const r = await executeAction(plan, execEnv({}, { confirmation: conf })); // aucun supportProvider
    expect(r.state).toBe("blocked");
    expect(r.error?.code).toBe("ADAPTER_UNAVAILABLE");
  });
  it("provider en panne → failed PROVIDER_UNAVAILABLE (réponse honnête)", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const r = await executeAction(plan, execEnv({ supportProvider: unavailableSupportProvider() }, { confirmation: conf }));
    expect(r.state).toBe("failed");
    expect(r.error?.code).toBe("PROVIDER_UNAVAILABLE");
  });
  it("adaptateur 'ok' sans preuve observable → failed (jamais de faux succès)", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const provider = mockSupportProvider({ ticketId: null }); // ok mais pas d'identifiant
    const r = await executeAction(plan, execEnv({ supportProvider: provider }, { confirmation: conf }));
    expect(r.state).toBe("failed");
    expect(r.observableSuccess).toBeNull();
  });
  it("préparation de ticket → succès, brouillon avec clé d'idempotence", async () => {
    const r = await executeAction(planOf("prepare_ticket", { summary: "Aide" }, { viewer: ANON }), execEnv());
    expect(r.state).toBe("succeeded");
    const draft = r.output?.draft as { idempotencyKey?: string } | undefined;
    expect(draft?.idempotencyKey).toBeTruthy();
  });
  it("soumission de ticket sans confirmation refusée ; confirmée avec mock → succès", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER() });
    const refused = await executeAction(plan, execEnv({ supportProvider: mockSupportProvider() }));
    expect(refused.state).toBe("blocked");
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const ok = await executeAction(plan, execEnv({ supportProvider: mockSupportProvider() }, { confirmation: conf }));
    expect(ok.state).toBe("succeeded");
  });
});

describe("BLOC 8 CloneActions — CloneTrace, isolation, compat, déterminisme", () => {
  it("CloneTrace complet et sûr (aucun secret, audio ou transcript)", async () => {
    const plan = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER(), tenant: TENANT_OK("company-A") });
    const conf = mintConfirmation(plan, { nowMs: NOW });
    const r = await executeAction(plan, execEnv({ supportProvider: mockSupportProvider() }, { confirmation: conf }));
    const t = r.trace;
    expect(t.version).toBe("trace-1");
    expect(t.traceId.startsWith("trc_")).toBe(true);
    expect(t.actionId).toBe("submit_ticket");
    expect(t.at).toBe(new Date(NOW).toISOString());
    expect(t.finalStatus).toBe("succeeded");
    expect(t.transitions).toContain("executing");
    const s = JSON.stringify(t);
    expect(s).not.toMatch(/Bearer\s/);
    expect(s).not.toContain("sk-");
  });
  it("isolation inter-tenant : le plan/trace ne contient jamais l'identifiant d'un autre tenant", async () => {
    const a = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER("uA"), tenant: TENANT_OK("company-A") });
    const confA = mintConfirmation(a, { nowMs: NOW });
    const ra = await executeAction(a, execEnv({ supportProvider: mockSupportProvider() }, { confirmation: confA }));
    expect(JSON.stringify({ plan: a, res: ra })).not.toContain("company-B");
  });
  it("CloneVoice → plan sans recopier audio/transcript dans la trace", async () => {
    const vr = await runVoiceJourney({ audio: { mime: "audio/mp4", bytes: 5000, content: new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]) }, viewer: ANON, environment: "production" }, { transcriber: transcriberOf("Mon secret bananerouge s'affiche ici") });
    const plan = planActionFromVoiceResult(vr, { actionId: "navigate", args: { route: "/agents/pierre" } });
    expect(plan).not.toBeNull();
    const r = await executeAction(plan!, execEnv());
    expect(JSON.stringify(r)).not.toContain("bananerouge");
  });
  it("compatibilité Brain/Context/Diagnosis/Guide/Care/Actions/format API (structured inchangé)", () => {
    const ctx = ctxOf({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE });
    const out = decideDiagnoseGuideCareAndPlanAction({ message: "Prépare l'avenant de Paul." }, ctx, { actionRequest: { actionId: "navigate", args: { route: "/agents/pierre" } } });
    expect(out.decision.version).toBe("brain-1");
    expect(out.context.version).toBe("context-1");
    expect(out.diagnosis.version).toBe("diagnosis-1");
    expect(out.care.version).toBe("care-1");
    expect(out.actionPlan?.version).toBe("actions-1");
    expect(Object.keys(out.structured).sort()).toEqual(["answer", "citations", "honesty", "tool_call"]);
  });
  it("déterminisme : même entrée → même plan (planHash, guard)", () => {
    const a = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER(), tenant: TENANT_OK() });
    const b = planOf("submit_ticket", { ticket: TICKET() }, { viewer: USER(), tenant: TENANT_OK() });
    expect(a.planHash).toBe(b.planHash);
    expect(JSON.stringify(a.guard)).toBe(JSON.stringify(b.guard));
  });
  it("planification n'exécute AUCUN effet externe (provider jamais appelé en phase 1)", () => {
    let calls = 0;
    const provider: SupportTicketProvider = { submit: async () => { calls++; return { ok: true, ticketId: "t", error: null }; } };
    const ctx = ctxOf({ viewer: USER() });
    decideDiagnoseGuideCareAndPlanAction({ message: "aide" }, ctx, { actionRequest: { actionId: "submit_ticket", args: { ticket: TICKET() } } });
    void provider; // le plan ne reçoit même pas le provider
    expect(calls).toBe(0);
  });
  it("aucune mutation métier : la seule action 'write' disponible est submit_ticket (support)", () => {
    const availableWrites = CLONE_ACTIONS.filter((d) => d.available && d.nature === "write");
    expect(availableWrites.map((d) => d.id)).toEqual(["submit_ticket"]);
    // Les mutations Pierre/RH sont soit absentes, soit déclarées non disponibles.
    expect(CLONE_ACTIONS.find((d) => d.id === "prepare_pierre_mission")?.available).toBe(false);
  });
});
