// src/lib/pierre/v1/__integration__/p16e-f19-reconcile-authz.itest.ts
// P16E §17 (F19) — la réconciliation de signatures exige une PERMISSION, pas seulement un droit produit.
//
// DÉFAUT CORRIGÉ (HIGH) — `reconcileSignatureRequests` n'appelait aucun `requirePermission` : la
// route /api/pierre/v1/signatures/reconcile vérifiait l'ENTITLEMENT (withProductAccess) mais
// AUCUNE permission RBAC. Or la réconciliation FINALISE des contrats signés
// (finalizeSignedContract). Un lecteur (viewer) entitled pouvait donc piloter une finalisation
// de signature. Correctif : requirePermission(ctx, "document.approve") en tête, fail-closed.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHarness, type Harness } from "./harness";
import { resolveTenantContext, type TenantContext } from "../tenant-context";
import { reconcileSignatureRequests } from "../signatures";
import { FakeSignatureProvider } from "../signature-provider";
import { newUuid } from "../sql";

let h: Harness; let owner: TenantContext;
beforeEach(async () => {
  h = await createHarness();
  // Owner résolu depuis la VRAIE base (permissions RBAC réelles, dont document.approve).
  owner = await resolveTenantContext(h.db, { user_id: h.userA, company_id: h.companyA });
});
afterEach(async () => { await h.close(); });

const deps = () => ({ provider: new FakeSignatureProvider({ providerKey: "fake_provider" }) });

/** Sème un membre viewer réel (rôle système VIEWER) et résout son contexte. */
async function viewerCtx(): Promise<TenantContext> {
  const userId = newUuid(); const mid = newUuid();
  await h.db.query(`insert into pierre_rt_members (id, company_id, user_id, role, status) values ($1,$2,$3,'viewer','active')`, [mid, h.companyA, userId]);
  await h.db.query(`insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values ($1,$2,'VIEWER') on conflict do nothing`, [h.companyA, mid]);
  return resolveTenantContext(h.db, { user_id: userId, company_id: h.companyA });
}

describe("P16E §17 — réconciliation de signatures : permission requise", () => {
  it("un viewer (lecture seule) est REFUSÉ AVANT tout accès fournisseur (fail-closed sur la permission)", async () => {
    const viewer = await viewerCtx();
    expect(viewer.permissions).not.toContain("document.approve"); // précondition
    await expect(reconcileSignatureRequests(h.db, viewer, {}, deps())).rejects.toThrow(/permission|forbidden|document\.approve/i);
  });

  it("un owner réel (document.approve) est autorisé (aucune signature ouverte ⇒ 0 scanné)", async () => {
    expect(owner.permissions).toContain("document.approve"); // précondition
    const r = await reconcileSignatureRequests(h.db, owner, {}, deps());
    expect(r.scanned).toBe(0);
    expect(r.finalized).toBe(0);
  });
});
