// src/lib/clonechat/onboarding/__tests__/onboarding.test.ts
//
// BLOC 11 (A) — GATE unitaire de l'onboarding contextuel (déterministe, temps injecté). Couvre les
// états réels, la persistance/reprise, l'isolation inter-tenant, l'expiration, la migration de
// version, l'abandon, le fallback, et l'absence de donnée sensible persistée.

import { describe, it, expect } from "vitest";
import { buildCloneChatContext } from "@/lib/clonechat/context";
import {
  resolveOnboarding, createInMemoryOnboardingStore, createUnavailableOnboardingStore, onboardingKey,
  type OnboardingStore,
} from "..";
import type { CloneChatViewer } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";

const NOW = 1_700_000_000_000;
const ANON: CloneChatViewer = { kind: "anonymous" };
const USER = (id = "u-1"): CloneChatViewer => ({ kind: "user", userId: id });
const TENANT_OK = (companyId = "co-1"): TenantResolution => ({ ok: true, companyId, role: "owner", siteIds: [], real: true });
const TENANT_NONE: TenantResolution = { ok: false, code: "MEMBERSHIP_REQUIRED" };
const TENANT_MULTI: TenantResolution = { ok: false, code: "COMPANY_SELECTION_REQUIRED", companies: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
const TENANT_SUSPENDED: TenantResolution = { ok: false, code: "MEMBERSHIP_SUSPENDED" };
const PIERRE_OK: PierreAccessResult = { ok: true, status: "active", orderId: "o-1", error: null };
const PIERRE_NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };
const PIERRE_LOOKUP_FAIL: PierreAccessResult = { ok: false, reason: "LOOKUP_FAILED", error: "PIERRE_ACCESS_LOOKUP_FAILED" };

function ctxOf(o: { viewer: CloneChatViewer; tenant?: TenantResolution | null; entitlement?: PierreAccessResult | null; routePath?: string | null }) {
  return buildCloneChatContext({ message: "x", viewer: o.viewer, tenant: o.tenant ?? null, entitlement: o.entitlement ?? null, routePath: o.routePath, environment: "production" });
}
const ob = (o: Parameters<typeof ctxOf>[0], extra: Partial<Parameters<typeof resolveOnboarding>[0]> = {}) =>
  resolveOnboarding({ context: ctxOf(o), nowMs: NOW, ...extra });

describe("BLOC 11 A — sélection de parcours selon l'état réel", () => {
  it("visiteur anonyme → public_discovery, cible visuelle vérifiée", () => {
    const s = ob({ viewer: ANON });
    expect(s.journeyId).toBe("public_discovery");
    expect(s.steps[0].visualTargetId).toBe("vt_home");
    expect(["ready", "in_progress"]).toContain(s.status);
  });
  it("objectif inscription (anonyme) → signup, prérequis authentication manquant", () => {
    const s = ob({ viewer: ANON }, { goal: "signup" });
    expect(s.journeyId).toBe("signup");
    expect(s.status).toBe("in_progress");
    expect(s.missingPrerequisites).toContain("authentication");
  });
  it("objectif connexion (anonyme) → login", () => {
    expect(ob({ viewer: ANON }, { goal: "login" }).journeyId).toBe("login");
  });
  it("connecté sans entreprise → resolve_company", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE });
    expect(s.journeyId).toBe("resolve_company");
    expect(s.status).toBe("in_progress");
    expect(s.missingPrerequisites).toContain("active_company");
  });
  it("plusieurs entreprises sans sélection → select_company", () => {
    expect(ob({ viewer: USER(), tenant: TENANT_MULTI, entitlement: PIERRE_NONE }).journeyId).toBe("select_company");
  });
  it("tenant suspendu → contact_support, escalate, étape bloquée", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_SUSPENDED, entitlement: PIERRE_NONE });
    expect(s.journeyId).toBe("contact_support");
    expect(s.status).toBe("escalate");
    expect(s.blockedStepIds.length).toBeGreaterThan(0);
  });
  it("entitlement Pierre absent → understand_pierre_access, prérequis pierre_entitlement", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE });
    expect(s.journeyId).toBe("understand_pierre_access");
    expect(s.missingPrerequisites).toContain("pierre_entitlement");
  });
  it("vérification Pierre indisponible → recover_entitlement, blocked", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_LOOKUP_FAIL });
    expect(s.journeyId).toBe("recover_entitlement");
    expect(s.status).toBe("blocked");
  });
  it("accès Pierre actif → enter_pierre_space, ready", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(s.journeyId).toBe("enter_pierre_space");
    expect(s.status).toBe("ready");
  });
  it("accès actif + objectif mission → start_mission_prep, awaiting_input (objectif demandé)", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }, { goal: "mission" });
    expect(s.journeyId).toBe("start_mission_prep");
    expect(s.status).toBe("awaiting_input");
    expect(s.requestedInfo).toContain("objectif");
  });
});

describe("BLOC 11 A — étapes, portes, fallback", () => {
  it("étape déjà réalisée non répétée : un utilisateur authentifié ne repasse jamais par login/signup", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }, { goal: "login" });
    // L'échelle SAUTE les prérequis déjà satisfaits (auth) : jamais de retour à login/signup.
    expect(s.journeyId).not.toBe("login");
    expect(s.journeyId).not.toBe("signup");
    expect(s.journeyId).toBe("enter_pierre_space");
    expect(s.status).toBe("ready");
  });
  it("guide visuel disponible sur une étape publique", () => {
    const s = ob({ viewer: ANON });
    expect(s.visualTargetId).toBe("vt_home");
  });
  it("fallback textuel (recover_entitlement : aucune cible visuelle, route null)", () => {
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_LOOKUP_FAIL });
    expect(s.visualTargetId).toBeNull();
    expect(s.steps[0].text.trim().length).toBeGreaterThan(0);
  });
  it("abandon volontaire → skipped", () => {
    expect(ob({ viewer: ANON }, { cancelled: true }).status).toBe("skipped");
  });
  it("déjà onboardé → completed", () => {
    expect(ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }, { alreadyOnboarded: true }).status).toBe("completed");
  });
});

describe("BLOC 11 A — persistance, reprise, isolation, expiration, migration", () => {
  it("reprise après rafraîchissement → resumeState resumed, même id", () => {
    const store = createInMemoryOnboardingStore();
    const c = { viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE };
    const first = ob(c, { store });
    expect(first.resumeState).toBe("fresh");
    const second = ob(c, { store });
    expect(second.resumeState).toBe("resumed");
    expect(second.id).toBe(first.id);
  });
  it("stockage indisponible → pas de plantage, reprise fraîche honnête", () => {
    const store: OnboardingStore = createUnavailableOnboardingStore();
    const s = ob({ viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE }, { store });
    expect(s.resumeState).toBe("fresh");
    expect(s.version).toBe("onboarding-1");
  });
  it("état expiré → écarté (reprise fraîche)", () => {
    const store = createInMemoryOnboardingStore();
    const c = { viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE };
    resolveOnboarding({ context: ctxOf(c), nowMs: NOW, store, ttlMs: 1000 });
    const later = resolveOnboarding({ context: ctxOf(c), nowMs: NOW + 5000, store });
    expect(later.resumeState).toBe("fresh");
  });
  it("version d'état ancienne → écartée", () => {
    const store = createInMemoryOnboardingStore();
    const key = onboardingKey("user:u-1", "none");
    store.save(key, { version: "onboarding-0" as unknown as "onboarding-1", id: "old", viewerKey: "user:u-1", tenantKey: "none", journeyId: "resolve_company", completedStepIds: [], providedInfo: {}, createdAtMs: NOW, updatedAtMs: NOW, expiresAtMs: null, status: "in_progress", interruptionReason: null });
    const s = resolveOnboarding({ context: ctxOf({ viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE }), nowMs: NOW, store });
    expect(s.resumeState).toBe("fresh");
  });
  it("changement de viewer → prior non repris (isolation)", () => {
    const store = createInMemoryOnboardingStore();
    resolveOnboarding({ context: ctxOf({ viewer: USER("uA"), tenant: TENANT_NONE, entitlement: PIERRE_NONE }), nowMs: NOW, store });
    const other = resolveOnboarding({ context: ctxOf({ viewer: USER("uB"), tenant: TENANT_NONE, entitlement: PIERRE_NONE }), nowMs: NOW, store });
    expect(other.resumeState).toBe("fresh");
  });
  it("mismatch inter-tenant : l'état ne contient jamais l'identifiant d'un autre tenant", () => {
    const store = createInMemoryOnboardingStore();
    const a = resolveOnboarding({ context: ctxOf({ viewer: USER("uA"), tenant: TENANT_OK("company-A"), entitlement: PIERRE_OK }), nowMs: NOW, store });
    const b = resolveOnboarding({ context: ctxOf({ viewer: USER("uB"), tenant: TENANT_OK("company-B"), entitlement: PIERRE_OK }), nowMs: NOW, store });
    expect(JSON.stringify(a)).not.toContain("company-B");
    expect(JSON.stringify(b)).not.toContain("company-A");
  });
  it("aucune donnée sensible persistée (clé token ignorée)", () => {
    const store = createInMemoryOnboardingStore();
    const s = ob({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }, { goal: "mission", store, providedInfo: { token: "sk-secret", objectif: "préparer un onboarding" } });
    expect(JSON.stringify(s)).not.toContain("sk-secret");
    expect(s.providedInfo.token).toBeUndefined();
    expect(s.providedInfo.objectif).toBe("préparer un onboarding");
  });
  it("reprise déterministe : même entrée → même état", () => {
    const a = JSON.stringify(ob({ viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE }));
    const b = JSON.stringify(ob({ viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE }));
    expect(a).toBe(b);
  });
});
