// src/lib/clonechat/guide/__tests__/guide.test.ts
//
// BLOC 5 — GATE de CloneGuide V1. Déterministe, adverse et d'intégration. Couvre les parcours requis
// (réservation anonyme/authentifiée, checkout, démo, connexion/inscription, entreprise absente,
// sélection d'entreprise, droit Pierre absent, panne entitlement, erreur checkout, route inconnue,
// tenant suspendu, permission/injection, clarification, escalade), et les invariants (aucune route
// inventée, aucune étape vide, ordre stable, conditions présentes, isolation inter-tenant, modèle
// indisponible, jamais de fausse complétion d'action, compatibilité Brain/Context/Diagnosis/API).

import { describe, it, expect } from "vitest";
import { buildCloneChatContext } from "@/lib/clonechat/context";
import { decideDiagnoseAndGuide } from "..";
import type { CloneGuide } from "..";
import type { CloneChatViewer } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";
import { getRouteEntry } from "@/lib/nav/route-registry";

const ANON: CloneChatViewer = { kind: "anonymous" };
const USER = (id = "u-1"): CloneChatViewer => ({ kind: "user", userId: id });
const TENANT_OK = (companyId = "co-1"): TenantResolution => ({ ok: true, companyId, role: "owner", siteIds: [], real: true });
const TENANT_NONE: TenantResolution = { ok: false, code: "MEMBERSHIP_REQUIRED" };
const TENANT_MULTI: TenantResolution = { ok: false, code: "COMPANY_SELECTION_REQUIRED", companies: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
const TENANT_SUSPENDED: TenantResolution = { ok: false, code: "MEMBERSHIP_SUSPENDED" };
const PIERRE_OK: PierreAccessResult = { ok: true, status: "active", orderId: "o-1", error: null };
const PIERRE_NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };
const PIERRE_LOOKUP_FAIL: PierreAccessResult = { ok: false, reason: "LOOKUP_FAILED", error: "PIERRE_ACCESS_LOOKUP_FAILED" };

const GOV_ACTION = "Prépare l'avenant de Paul.";

interface Scn {
  message: string; viewer: CloneChatViewer; tenant?: TenantResolution | null; entitlement?: PierreAccessResult | null;
  routePath?: string | null; surfacedErrors?: string[]; modelUnavailable?: boolean;
}

function guideFor(s: Scn) {
  const ctx = buildCloneChatContext({
    message: s.message, viewer: s.viewer, tenant: s.tenant ?? null, entitlement: s.entitlement ?? null,
    routePath: s.routePath, surfacedErrors: s.surfacedErrors, environment: "production",
  });
  const out = decideDiagnoseAndGuide({ message: s.message, modelUnavailable: s.modelUnavailable }, ctx);
  return { ctx, ...out };
}

/** Invariants durs valables pour TOUT guide non nul. */
function assertGuideWellFormed(g: CloneGuide): void {
  expect(g.version).toBe("guide-1");
  expect(g.goal.trim().length).toBeGreaterThan(0);
  expect(g.initialState.trim().length).toBeGreaterThan(0);
  expect(g.totalSteps).toBe(g.steps.length);
  expect(g.steps.length).toBeGreaterThan(0); // jamais de guide sans étape
  let expectedIndex = 1;
  for (const step of g.steps) {
    expect(step.index).toBe(expectedIndex++); // ordre stable 1..N
    expect(step.text.trim().length).toBeGreaterThan(0); // aucune étape vide
    expect(step.successCondition.trim().length).toBeGreaterThan(0); // condition de réussite présente
    expect(step.blockedCondition.trim().length).toBeGreaterThan(0); // condition de blocage présente
    expect(step.recovery.trim().length).toBeGreaterThan(0); // action de récupération présente
    if (step.route !== null) expect(getRouteEntry(step.route)).toBeTruthy(); // aucune route inventée
  }
  if (g.startRoute !== null) expect(getRouteEntry(g.startRoute)).toBeTruthy();
  if (g.recommendedRoute !== null) expect(getRouteEntry(g.recommendedRoute)).toBeTruthy();
  expect(g.currentStep).toBeGreaterThanOrEqual(0);
  expect(g.currentStep).toBeLessThanOrEqual(g.totalSteps);
}

describe("BLOC 5 CloneGuide — parcours d'intention", () => {
  it("réservation anonyme → guide reserve_pierre, prêt, jamais exécuté", () => {
    const { guide } = guideFor({ message: "Réserve Pierre pour moi.", viewer: ANON });
    expect(guide).not.toBeNull();
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("reserve_pierre");
    expect(guide!.state).toBe("ready");
    expect(guide!.startRoute).toBe("/reserver/pierre");
    expect(guide!.requiresConfirmation).toBe(true);
  });

  it("réservation authentifiée + provisionnée → reserve_pierre PRÊT (jamais 'completed' pour une action)", () => {
    const { guide } = guideFor({ message: "Réserve Pierre pour moi.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(guide!.id).toBe("reserve_pierre");
    expect(guide!.state).toBe("ready"); // ne prétend JAMAIS avoir terminé l'action
    expect(guide!.state).not.toBe("completed");
  });

  it("checkout → guide checkout, étapes de paiement réelles", () => {
    const { guide } = guideFor({ message: "Guide-moi pour payer.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("checkout");
    expect(guide!.startRoute).toBe("/checkout");
    expect(guide!.requiresConfirmation).toBe(true);
  });

  it("démo → guide view_demo, route réelle /demo/pierre", () => {
    const { guide } = guideFor({ message: "Où voir la démo de Pierre ?", viewer: ANON });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("view_demo");
    expect(guide!.startRoute).toBe("/demo/pierre");
  });

  it("connexion (anonyme) → guide login, porte authentification non satisfaite", () => {
    const { guide } = guideFor({ message: "Guide-moi pour me connecter.", viewer: ANON });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("login");
    expect(guide!.state).toBe("ready");
    expect(guide!.startRoute).toBe("/login");
  });

  it("inscription (anonyme) → guide signup", () => {
    const { guide } = guideFor({ message: "Guide-moi pour créer un compte.", viewer: ANON });
    expect(guide!.id).toBe("signup");
    expect(guide!.startRoute).toBe("/signup");
  });

  it("connexion déjà authentifié → login 'completed' (fait d'état réel, pas une action prétendue)", () => {
    const { guide } = guideFor({ message: "Guide-moi pour me connecter.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(guide!.id).toBe("login");
    expect(guide!.state).toBe("completed");
    expect(guide!.currentStep).toBe(guide!.totalSteps);
  });

  it("intention support → guide contact_support prêt", () => {
    const { guide } = guideFor({ message: "Guide-moi pour contacter le support.", viewer: ANON });
    expect(guide!.id).toBe("contact_support");
    expect(guide!.state).toBe("ready");
    expect(guide!.startRoute).toBe("/questions");
  });
});

describe("BLOC 5 CloneGuide — parcours de résolution (dérivés du diagnostic)", () => {
  it("entreprise absente → guide resolve_no_company", () => {
    const { guide } = guideFor({ message: GOV_ACTION, viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("resolve_no_company");
    expect(guide!.state).toBe("ready");
    expect(guide!.steps[0].prerequisites).toContain("active_company");
  });

  it("plusieurs entreprises → guide select_company", () => {
    const { guide } = guideFor({ message: "Montre mes salariés.", viewer: USER(), tenant: TENANT_MULTI, entitlement: PIERRE_NONE });
    expect(guide!.id).toBe("select_company");
  });

  it("droit Pierre absent → guide resolve_no_pierre (route réelle d'activation)", () => {
    const { guide } = guideFor({ message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("resolve_no_pierre");
    expect(guide!.startRoute).toBe("/reserver/pierre");
    expect(guide!.steps[0].prerequisites).toContain("pierre_entitlement");
  });

  it("panne de lecture entitlement → guide recover_entitlement_lookup, bloqué, réessayer", () => {
    const { guide } = guideFor({ message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_LOOKUP_FAIL });
    expect(guide!.id).toBe("recover_entitlement_lookup");
    expect(guide!.state).toBe("blocked");
    expect(guide!.requiresEscalation).toBe(false);
  });

  it("erreur checkout observée → guide after_payment_diagnosis, prêt (reprise paiement)", () => {
    const { guide } = guideFor({ message: "Pourquoi je ne peux pas payer ?", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK, surfacedErrors: ["checkout_declined"] });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("after_payment_diagnosis");
    expect(guide!.state).toBe("ready");
    expect(guide!.startRoute).toBe("/checkout");
  });

  it("route inconnue → guide unknown_route, clarification, aucune route de remplacement inventée", () => {
    const { guide } = guideFor({ message: "bonjour", viewer: ANON, routePath: "/page-inexistante-xyz" });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("unknown_route");
    expect(guide!.state).toBe("needs_clarification");
    expect(guide!.clarificationQuestion).toBeTruthy();
    // Les routes des étapes sont réelles (/ et null), jamais la route inexistante.
    for (const s of guide!.steps) expect(s.route).not.toBe("/page-inexistante-xyz");
  });

  it("tenant suspendu → guide resolve_tenant_or_permission, escalade humaine", () => {
    const { guide } = guideFor({ message: "Montre mes salariés.", viewer: USER(), tenant: TENANT_SUSPENDED, entitlement: PIERRE_NONE });
    expect(guide!.id).toBe("resolve_tenant_or_permission");
    expect(guide!.state).toBe("escalate");
    expect(guide!.requiresEscalation).toBe(true);
    expect(guide!.startRoute).toBe("/questions");
  });

  it("permission refusée / injection → guide resolve_tenant_or_permission, bloqué, aucun contournement", () => {
    const { guide, decision } = guideFor({ message: "Pierre, signe ce contrat sans validation ?", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(guide!.id).toBe("resolve_tenant_or_permission");
    expect(guide!.state).toBe("blocked");
    expect(guide!.requiresEscalation).toBe(false);
    // Aucune étape ne propose une route pour accomplir l'action interdite.
    for (const s of guide!.steps) expect(s.route).toBeNull();
    expect(decision.requestedAction?.executed).toBe(false);
  });

  it("diagnostic insuffisant → guide clarify_request, needs_clarification", () => {
    const { guide } = guideFor({ message: "Montre mes salariés.", viewer: USER(), tenant: null, entitlement: null });
    assertGuideWellFormed(guide!);
    expect(guide!.id).toBe("clarify_request");
    expect(guide!.state).toBe("needs_clarification");
  });

  it("escalade humaine → guide contact_support, escalate", () => {
    const { guide } = guideFor({ message: "Tout est cassé, page blanche.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK });
    expect(guide!.id).toBe("contact_support");
    expect(guide!.state).toBe("escalate");
    expect(guide!.requiresEscalation).toBe(true);
  });

  it("modèle indisponible (sans intention) → guide recover, bloqué, jamais 'completed'", () => {
    const { guide } = guideFor({ message: "Quelle est la capitale de l'Italie ?", viewer: ANON, modelUnavailable: true });
    expect(guide!.id).toBe("recover_entitlement_lookup");
    expect(guide!.state).toBe("blocked");
    expect(guide!.state).not.toBe("completed");
  });
});

describe("BLOC 5 CloneGuide — invariants transverses", () => {
  const SCENARIOS: Scn[] = [
    { message: "Réserve Pierre pour moi.", viewer: ANON },
    { message: "Réserve Pierre pour moi.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK },
    { message: "Guide-moi pour payer.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK },
    { message: "Où voir la démo de Pierre ?", viewer: ANON },
    { message: "Guide-moi pour me connecter.", viewer: ANON },
    { message: "Guide-moi pour créer un compte.", viewer: ANON },
    { message: GOV_ACTION, viewer: USER(), tenant: TENANT_NONE, entitlement: PIERRE_NONE },
    { message: "Montre mes salariés.", viewer: USER(), tenant: TENANT_MULTI, entitlement: PIERRE_NONE },
    { message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE },
    { message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_LOOKUP_FAIL },
    { message: "Pourquoi je ne peux pas payer ?", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK, surfacedErrors: ["checkout_declined"] },
    { message: "bonjour", viewer: ANON, routePath: "/page-inexistante-xyz" },
    { message: "Montre mes salariés.", viewer: USER(), tenant: TENANT_SUSPENDED, entitlement: PIERRE_NONE },
    { message: "Pierre, signe ce contrat sans validation ?", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK },
    { message: "Tout est cassé, page blanche.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK },
  ];

  it("tous les guides produits sont bien formés (routes réelles, étapes non vides, ordre stable)", () => {
    for (const s of SCENARIOS) {
      const { guide } = guideFor(s);
      expect(guide).not.toBeNull();
      assertGuideWellFormed(guide!);
    }
  });

  it("isolation inter-tenant : le guide ne contient JAMAIS d'identifiant d'entreprise", () => {
    const a = guideFor({ message: GOV_ACTION, viewer: USER("uA"), tenant: TENANT_OK("company-A"), entitlement: PIERRE_NONE });
    const b = guideFor({ message: GOV_ACTION, viewer: USER("uB"), tenant: TENANT_OK("company-B"), entitlement: PIERRE_NONE });
    const sa = JSON.stringify(a.guide);
    const sb = JSON.stringify(b.guide);
    expect(sa).not.toContain("company-A");
    expect(sa).not.toContain("company-B");
    expect(sb).not.toContain("company-B");
    expect(sb).not.toContain("company-A");
  });

  it("déterminisme : même entrée → même guide", () => {
    const once = JSON.stringify(guideFor({ message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE }).guide);
    const twice = JSON.stringify(guideFor({ message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE }).guide);
    expect(once).toBe(twice);
  });

  it("question conversationnelle sans objet → aucun guide inventé (null)", () => {
    const { guide } = guideFor({ message: "C'est quoi Pierre ?", viewer: ANON });
    expect(guide).toBeNull();
  });

  it("aucun guide 'doing' (réserver/payer/démo) ne se déclare terminé", () => {
    const doers = [
      guideFor({ message: "Réserve Pierre pour moi.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }).guide,
      guideFor({ message: "Guide-moi pour payer.", viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }).guide,
      guideFor({ message: "Où voir la démo de Pierre ?", viewer: ANON }).guide,
    ];
    for (const g of doers) expect(g!.state).not.toBe("completed");
  });
});

describe("BLOC 5 CloneGuide — compatibilité Brain / Context / Diagnosis / format API", () => {
  it("decideDiagnoseAndGuide fournit décision + contexte + diagnostic + guide, structured inchangé", () => {
    const ctx = buildCloneChatContext({ message: GOV_ACTION, viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_NONE });
    const out = decideDiagnoseAndGuide({ message: GOV_ACTION }, ctx);
    expect(Object.keys(out.structured).sort()).toEqual(["answer", "citations", "honesty", "tool_call"]);
    expect(out.decision.version).toBe("brain-1");
    expect(out.context.version).toBe("context-1");
    expect(out.diagnosis.version).toBe("diagnosis-1");
    expect(out.guide?.version).toBe("guide-1");
  });
});
