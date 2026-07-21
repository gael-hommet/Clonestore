// src/lib/clonechat/care/__tests__/context-resolver-c1-8.test.ts
// C1.8 §4 — CloneContext serveur.
//
// Le cœur de ces tests tient en une phrase du bloc :
//   « un état de compte INCONNU n'est pas un état de compte SAIN ».
// Le piège symétrique est tout aussi grave : un état inconnu n'est pas non plus un état MALADE.
// Une panne de vérification ne doit PAS faire dire à CloneChat « Pierre n'est pas activé »
// à un client qui a payé.

import { describe, it, expect } from "vitest";
import { resolveAccountContext } from "../context-resolver";
import { authorizeAction } from "../actions";
import { diagnose } from "../diagnosis";
import type { PierreAccessResult } from "@/lib/pierre/access";
import type { CloneChatPlan } from "../../server/universal-access";

const plan = (over: Partial<CloneChatPlan> = {}): CloneChatPlan => ({
  lane: "COMPANY", requestClass: "PRIVATE_CONTEXT_REQUIRED", chatAvailable: true,
  missingPrerequisites: [], privateContextAvailable: true, governedActionAvailable: true,
  tenantSecurityFailure: false, entitlementLookupFailed: false, ...over,
} as CloneChatPlan);

const GRANTED: PierreAccessResult = { ok: true, status: "active", orderId: "o1", error: null };
const NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };
const FAILED: PierreAccessResult = { ok: false, reason: "LOOKUP_FAILED", error: "PIERRE_ACCESS_LOOKUP_FAILED" };

const OK_TENANT = { ok: true as const, companyId: "c1", role: "member", siteIds: [], real: true };
const AT = "2026-07-13T10:00:00Z";

describe("C1.8 — CloneContext : le serveur résout l'identité", () => {
  it("un client actif est reconnu, et lui seul obtient le droit d'agir", () => {
    const ctx = resolveAccountContext({ viewer: { kind: "user", userId: "u1" }, entitlement: GRANTED, tenant: OK_TENANT, plan: plan(), at: AT });
    expect(ctx.viewer_kind).toBe("company_member");
    expect(ctx.company_id).toBe("c1");
    expect(ctx.employee_access_states.pierre).toBe("active");
    expect(ctx.permissions).toContain("mission.create");
    expect(ctx.known_account_blockers).toEqual([]);
  });

  it("un droit RÉELLEMENT absent devient un blocage prouvé, avec sa source", () => {
    const ctx = resolveAccountContext({ viewer: { kind: "user", userId: "u1" }, entitlement: NONE, tenant: OK_TENANT, plan: plan({ governedActionAvailable: false }), at: AT });
    expect(ctx.employee_access_states.pierre).toBe("not_active");
    const b = ctx.known_account_blockers.find((x) => x.code === "pierre_not_active");
    expect(b).toBeDefined();
    expect(b!.evidence_source).toBe("server:entitlement"); // un blocage SANS source serait une supposition
    expect(ctx.permissions).not.toContain("mission.create");
  });

  // ═══ LE TEST QUI COMPTE LE PLUS ═══
  it("une PANNE de vérification ne dit NI « actif » NI « pas activé » — elle dit « je ne sais pas »", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: FAILED, tenant: OK_TENANT,
      plan: plan({ entitlementLookupFailed: true, governedActionAvailable: false }), at: AT,
    });

    expect(ctx.employee_access_states.pierre).toBe("unknown");
    expect(ctx.subscription_state).toBe("unknown");

    // Elle n'accuse PAS le client de ne pas avoir activé Pierre…
    expect(ctx.known_account_blockers.some((b) => b.code === "pierre_not_active")).toBe(false);
    // …elle avoue son ignorance.
    const unknownBlocker = ctx.known_account_blockers.find((b) => b.code === "entitlement_unknown");
    expect(unknownBlocker).toBeDefined();
    expect(unknownBlocker!.message).toMatch(/je ne vais donc rien affirmer/i);

    // …et surtout : elle n'accorde AUCUN droit d'agir.
    expect(ctx.permissions).not.toContain("mission.create");
    expect(ctx.active_employee_slugs).toEqual([]);
  });

  it("une panne d'entreprise n'est pas « aucune entreprise » (ce serait accuser à tort)", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: FAILED,
      tenant: { ok: false, code: "COMPANY_UNAVAILABLE" }, plan: plan(), at: AT,
    });
    expect(ctx.viewer_kind).toBe("unknown"); // ni membre, ni « sans entreprise »
    expect(ctx.known_account_blockers.some((b) => b.code === "no_active_company")).toBe(false);
  });

  it("un compte sans entreprise est dit tel quel, sans fermer la conversation", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: NONE,
      tenant: { ok: false, code: "MEMBERSHIP_REQUIRED" },
      plan: plan({ privateContextAvailable: false, governedActionAvailable: false }), at: AT,
    });
    expect(ctx.viewer_kind).toBe("authenticated_without_company");
    const b = ctx.known_account_blockers.find((x) => x.code === "no_active_company");
    expect(b!.message).toMatch(/questions générales.*restent ouvertes/i); // C1.6 non régressé
    expect(b!.requires_human_support).toBe(false);
  });

  // Ce cas n'existait pas dans ma première version : je disais « aucune entreprise » à quelqu'un
  // qui en a trois. C'est tsc (switch exhaustif) qui a rendu l'oubli visible.
  it("plusieurs entreprises actives ⇒ « choisissez », PAS « vous n'avez pas d'entreprise »", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: GRANTED,
      tenant: { ok: false, code: "COMPANY_SELECTION_REQUIRED", companies: [{ id: "a", name: "A" }, { id: "b", name: "B" }] },
      plan: plan({ privateContextAvailable: false }), at: AT,
    });
    const codes = ctx.known_account_blockers.map((b) => b.code);
    expect(codes).toContain("company_selection_required");
    expect(codes).not.toContain("no_active_company"); // ne PAS accuser à tort
    expect(ctx.known_account_blockers[0].next_step_label).toBe("Choisir l'entreprise");
  });

  it("un accès SUSPENDU est critique, exige un humain, et écrase le reste", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: NONE,
      tenant: { ok: false, code: "MEMBERSHIP_SUSPENDED" }, plan: plan(), at: AT,
    });
    expect(ctx.viewer_kind).toBe("suspended");
    expect(ctx.known_account_blockers).toHaveLength(1);
    expect(ctx.known_account_blockers[0].severity).toBe("critical");
    expect(ctx.known_account_blockers[0].requires_human_support).toBe(true);
  });

  it("un anonyme n'a ni entreprise, ni permission, et AUCUNE table tenant n'est interrogée", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "anonymous" }, entitlement: null, tenant: null,
      plan: plan({ lane: "PUBLIC", privateContextAvailable: false, governedActionAvailable: false }), at: AT,
    });
    expect(ctx.viewer_kind).toBe("anonymous");
    expect(ctx.user_id).toBeNull();     // on ne FABRIQUE jamais un identifiant
    expect(ctx.company_id).toBeNull();
    expect(ctx.permissions).toEqual([]);
    expect(ctx.employee_access_states.pierre).toBe("unknown"); // jamais interrogé ⇒ inconnu
  });
});

describe("C1.8 — l'ignorance se propage jusqu'à l'action (fail-closed de bout en bout)", () => {
  it("sur un état inconnu, aucune action à effet n'est autorisée", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: FAILED,
      tenant: { ok: false, code: "COMPANY_UNAVAILABLE" },
      plan: plan({ entitlementLookupFailed: true }), at: AT,
    });
    const d = diagnose({ message: "je ne peux pas payer en ligne", page: null, account: ctx });
    const r = authorizeAction({ kind: "prefill_mission", account: ctx, diagnosis: d, confirmed: true, idempotencyKey: "k" });
    expect(r.state).toBe("BLOCKED_CONFIGURATION");
    expect(r.reason).toMatch(/plutôt que d'agir sur une supposition/i);
  });

  it("la version de contexte change dès qu'une AUTORITÉ change (anti-obsolescence)", () => {
    const base = { viewer: { kind: "user" as const, userId: "u1" }, tenant: OK_TENANT, at: AT };
    const active = resolveAccountContext({ ...base, entitlement: GRANTED, plan: plan() });
    const revoked = resolveAccountContext({ ...base, entitlement: NONE, plan: plan({ governedActionAvailable: false }) });
    expect(active.context_version).not.toBe(revoked.context_version);

    // Une action proposée quand Pierre était actif ne survit PAS à la perte du droit.
    const d = diagnose({ message: "je ne peux pas payer en ligne", page: null, account: revoked });
    const r = authorizeAction({
      kind: "prefill_mission", account: revoked, diagnosis: d,
      confirmed: true, idempotencyKey: "k", proposedAtContextVersion: active.context_version,
    });
    expect(r.state).not.toBe("AUTHORIZED");
  });

  it("le blocage serveur PROUVÉ donne un diagnostic certain et une étape concrète", () => {
    const ctx = resolveAccountContext({
      viewer: { kind: "user", userId: "u1" }, entitlement: NONE, tenant: OK_TENANT,
      plan: plan({ governedActionAvailable: false }), at: AT,
    });
    const d = diagnose({ message: "je ne peux pas créer de mission", page: null, account: ctx });
    expect(d.confidence).toBe("certain");
    expect(d.status).toBe("blocked");
    expect(d.recommended_action).toBe("Activer Pierre");
  });
});
