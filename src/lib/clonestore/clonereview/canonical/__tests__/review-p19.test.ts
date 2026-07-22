// src/lib/clonestore/clonereview/canonical/__tests__/review-p19.test.ts
// P19 — CloneReview: quality gate, orthogonal to CloneGuard. Proves the two independent axes.

import { describe, it, expect } from "vitest";
import { reviewOutput } from "../review";
import { decideCanonicalGovernance } from "../../../../pierre/v1/governance/canonical-decision";

describe("P19 — CloneReview quality gate", () => {
  it("clean, complete document → pass", () => {
    const r = reviewOutput({ kind: "document", text: "Offre d'emploi pour Acme SA. Poste : développeur. Rémunération convenue. Merci de votre intérêt.", requiredMentions: ["Acme"] });
    expect(r.status).toBe("pass");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
  it("unfilled placeholders → blocked by Review", () => {
    const r = reviewOutput({ kind: "document", text: "Bonjour {{employee_name}}, bienvenue chez [Entreprise]. Nous sommes ravis de vous accueillir dans notre équipe." });
    expect(r.status).toBe("block");
    expect(r.issues.some((i) => i.code === "unfilled_placeholder")).toBe(true);
  });
  it("draft presenting itself as sent → forbidden claim", () => {
    const r = reviewOutput({ kind: "email", text: "Cet email a bien été envoyé au destinataire et le contrat est signé définitivement aujourd'hui.", forbiddenClaims: ["envoyé", "signé"] });
    expect(r.status).toBe("block");
    expect(r.issues.filter((i) => i.code === "forbidden_claim").length).toBeGreaterThanOrEqual(1);
  });
  it("empty output → block", () => {
    expect(reviewOutput({ kind: "summary", text: "   " }).status).toBe("block");
  });
});

describe("P19 — Guard and Review are independent axes (both cases proven)", () => {
  it("CASE 1 — allowed by Guard but low quality per Review", () => {
    const gov = decideCanonicalGovernance({ action: "standard_report", risk: "low", sensitivity: "normal", mode: "normal", external_side_effect: false });
    const rev = reviewOutput({ kind: "summary", text: "ok" }); // too short
    expect(gov.decision).toBe("allow_execute");     // Guard allows
    expect(rev.status).not.toBe("pass");            // Review rejects
  });
  it("CASE 2 — good quality but blocked by Guard", () => {
    const gov = decideCanonicalGovernance({ action: "termination", risk: "high", sensitivity: "restricted", mode: "enterprise_autonomous", external_side_effect: true, text: "licencier Paul" });
    const rev = reviewOutput({ kind: "document", text: "Document parfaitement rédigé, complet, clair, sans aucun placeholder et prêt à l'emploi pour l'entreprise." });
    expect(rev.status).toBe("pass");                // Review passes
    expect(gov.decision).toBe("human_only");        // Guard blocks (human-only)
  });
});
