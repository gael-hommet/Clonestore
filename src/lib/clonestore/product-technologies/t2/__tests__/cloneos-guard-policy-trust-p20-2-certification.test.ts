// P20.2 — CloneOS / CloneGuard / ClonePolicy / CloneTrust: real certification via live execution
// of the actual T2 contracts. No claim stronger than the assertion that proves it.

import { describe, it, expect } from "vitest";
import { cloneOSProductTech } from "../cloneos-product-tech";
import { cloneGuardProductTech } from "../cloneguard-product-tech";
import { clonePolicyProductTech } from "../clonepolicy-product-tech";
import { cloneTrustProductTech } from "../clonetrust-product-tech";
import type { ProductTechnologyContext } from "../product-technology-types";

const ctxA: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-A" };
const ctxB: ProductTechnologyContext = { employeeId: "pierre", companyId: "company-B" };

describe("P20.2 — CloneOS certification", () => {
  it("nominal : demande valide → plan de mission, jamais exécuté", async () => {
    const r = await cloneOSProductTech.prepare({ request: "prépare une synthèse ; puis relance le manager" }, ctxA);
    expect(r.kind).toBe("needs_validation");
    expect(r.artifact!.tasks.length).toBe(2);
    expect(r.artifact!.executed).toBe(false);
    expect(r.artifact!.decidesHrOutcomes).toBe(false);
  });
  it("demande vide → blocked, jamais un plan fantôme", async () => {
    const r = await cloneOSProductTech.prepare({ request: "" }, ctxA);
    expect(r.kind).toBe("blocked");
  });
  it("contexte manquant → blocked (wrapper commun)", async () => {
    const r = await cloneOSProductTech.prepare({ request: "x" }, { employeeId: "", companyId: "" });
    expect(r.kind).toBe("blocked");
  });
  it("effet live détecté dans l'input → blocked", async () => {
    const r = await cloneOSProductTech.prepare({ request: "x", live: true } as never, ctxA);
    expect(r.kind).toBe("blocked");
  });
  it("propagation companyId/employeeId réelle dans le résultat", async () => {
    const rA = await cloneOSProductTech.prepare({ request: "x" }, ctxA);
    const rB = await cloneOSProductTech.prepare({ request: "y" }, ctxB);
    expect(rA.companyId).toBe("company-A");
    expect(rB.companyId).toBe("company-B");
  });
  it("idempotence structurelle : même entrée → même plan", async () => {
    const input = { request: "prépare un rapport" };
    const r1 = await cloneOSProductTech.prepare(input, ctxA);
    const r2 = await cloneOSProductTech.prepare(input, ctxA);
    expect(r1.artifact!.tasks).toEqual(r2.artifact!.tasks);
  });
  it("artefact forgé → validate() le détecte", () => {
    const forged = { kind: "ok" as const, productTechnologyId: "cloneos" as const, employeeId: "pierre", companyId: "company-A", live: false as const, requiresHumanValidation: false, artifact: { artifactKind: "clonesignals_candidates" } as never };
    expect(cloneOSProductTech.validate(forged, ctxA).structurallyValid).toBe(false);
  });
});

describe("P20.2 — CloneGuard certification", () => {
  it("nominal : action normale → allow_prepare, risque normal, décision PRÉCISE (pas juste non-null)", async () => {
    const r = await cloneGuardProductTech.prepare({ action: { kind: "prepare_document", description: "note interne", channel: "internal" } }, ctxA);
    expect(r.artifact!.decision).toBe("allow_prepare");
    expect(r.artifact!.riskLevel).toBe("normal");
    expect(r.artifact!.reasons.length).toBeGreaterThan(0);
  });
  it("terme critique dans le texte → decision precise = require_validation (pas refuse tant que non finalisé)", async () => {
    const r = await cloneGuardProductTech.prepare({ action: { kind: "prepare_document", description: "préparer un avenant sur le salaire", channel: "internal" } }, ctxA);
    expect(r.artifact!.riskLevel).toBe("critical");
    expect(r.artifact!.decision).toBe("require_validation");
  });
  it("finalité de décision explicite (kind=execute_live) → refuse, jamais exécuté", async () => {
    const r = await cloneGuardProductTech.prepare({ action: { kind: "execute_live", description: "licenciement", channel: "external_email" } }, ctxA);
    expect(r.artifact!.decision).toBe("refuse");
    expect(r.artifact!.executed).toBe(false);
    expect(r.artifact!.finalLegalDecision).toBe(false);
  });
  it("canal externe + langage RH sensible → sensitive, require_validation (contenu précis vérifié)", async () => {
    const r = await cloneGuardProductTech.prepare({ action: { kind: "draft_email", description: "convocation entretien disciplinaire", channel: "external_email" } }, ctxA);
    expect(r.artifact!.riskLevel).toBe("sensitive");
    expect(r.artifact!.decision).toBe("require_validation");
    expect(r.artifact!.humanEscalation).not.toBeNull();
  });
  it("contexte manquant → blocked", async () => {
    const r = await cloneGuardProductTech.prepare({ action: {} }, { employeeId: "", companyId: "" });
    expect(r.kind).toBe("blocked");
  });
});

describe("P20.2 — ClonePolicy certification", () => {
  it("aucune règle → défauts sûrs (autonomyCap execute_with_validation, canaux internal/cockpit)", async () => {
    const r = await clonePolicyProductTech.prepare({ action: { taskType: "note" } }, ctxA);
    expect(r.artifact!.autonomyCap).toBe("execute_with_validation");
    expect(r.artifact!.allowedChannels).toEqual(["internal", "cockpit"]);
    expect(r.artifact!.decision).toBe("allow_prepare");
  });
  it("canal externe → validation TOUJOURS obligatoire (non désactivable, contenu précis vérifié)", async () => {
    const r = await clonePolicyProductTech.prepare({ action: { channel: "signature" } }, ctxA);
    expect(r.artifact!.requiresValidation).toBe(true);
    expect(r.artifact!.reasons.some((x) => x.includes("validation humaine obligatoire"))).toBe(true);
  });
  it("règle horaire présente mais heure inconnue → validation forcée fail-closed (pas un contournement silencieux)", async () => {
    const r = await clonePolicyProductTech.prepare(
      { rules: [{ ruleId: "r1", appliesTo: {}, timeWindow: { notBeforeHour: 9, notAfterHour: 18 } }], action: {} },
      ctxA,
    );
    expect(r.artifact!.decision).toBe("require_validation");
  });
  it("allowlist de canal explicite exclut un canal → block (pas juste validation)", async () => {
    const r = await clonePolicyProductTech.prepare(
      { rules: [{ ruleId: "r1", appliesTo: {}, allowedChannels: ["internal"] }], action: { channel: "signature" } },
      ctxA,
    );
    expect(r.artifact!.decision).toBe("block");
  });
  it("contexte manquant → blocked (wrapper)", async () => {
    const r = await clonePolicyProductTech.prepare({ action: {} }, { employeeId: "", companyId: "" });
    expect(r.kind).toBe("blocked");
  });
});

describe("P20.2 — CloneTrust certification", () => {
  it("risque critique → human_only INCONDITIONNEL (même avec historique parfait)", async () => {
    const r = await cloneTrustProductTech.prepare({ riskLevel: "critical", history: { approvals: 100, rejections: 0 } }, ctxA);
    expect(r.artifact!.autonomyLevel).toBe("human_only");
    expect(r.artifact!.autonomyScore).toBe(0);
    expect(r.artifact!.criticalAlwaysHumanOnly).toBe(true);
  });
  it("risque forgé hors vocabulaire → traité sensible (fail-closed), pas normal", async () => {
    const r = await cloneTrustProductTech.prepare({ riskLevel: "forged-level" as never }, ctxA);
    expect(r.artifact!.autonomyLevel).toBe("prepare_only"); // sensitive path
  });
  it("cap politique plafonne toujours (le plus restrictif gagne, vérifié précisément)", async () => {
    const r = await cloneTrustProductTech.prepare({ riskLevel: "normal", history: { approvals: 20, rejections: 0 }, policyCap: "prepare_only" }, ctxA);
    expect(r.artifact!.autonomyLevel).toBe("prepare_only");
    expect(r.artifact!.reason).toContain("Plafonné");
  });
  it("ne contourne jamais CloneGuard (invariant déclaré vrai à chaque décision)", async () => {
    const r = await cloneTrustProductTech.prepare({ riskLevel: "normal" }, ctxA);
    expect(r.artifact!.overridesCloneGuard).toBe(false);
    expect(r.artifact!.executed).toBe(false);
  });
});
