// src/lib/clonestore/founder-acceptance/__tests__/pierre-ultimate-vision.test.ts
// P14 §7 — Tests de la matrice de vérité : catalogue complet, évaluateur honnête, claims interdits
// bloqués, prix pays, ROI prudent, jamais de surpromesse légale/paie/décision finale.
import { describe, it, expect } from "vitest";
import {
  PIERRE_ULTIMATE_VISION_REQUIREMENTS, PIERRE_ULTIMATE_GROUPS, CLAIM_LEVELS, COVERAGE_STATUSES,
  requirementById, requirementsByGroup, catalogComplete,
} from "../pierre-ultimate-vision-catalog";
import {
  evaluatePierreUltimateCoverage, summarizePierreCoverage, statusForRequirement,
  computeCommercialTruthMatrix, computeLaunchClaimMatrix,
} from "../pierre-ultimate-coverage-evaluator";
import {
  ALLOWED_STRONG_CLAIMS, ALLOWED_CAUTION_CLAIMS, FORBIDDEN_CLAIMS,
  evaluateClaimSafety, generateWebsiteSafeCopy, generatedCopyIsSafe,
} from "../pierre-commercial-truth-matrix";
import {
  PIERRE_PRICE_EUR_MONTHLY, PIERRE_PRICE_CHF_MONTHLY,
  monthlySavingsEstimate, roiBreakEvenHours, generateSafeRoiCopy,
} from "../pierre-economic-value-matrix";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

describe("P14 — Ultimate vision catalog", () => {
  it("≥ 50 exigences, 50 groupes, ids uniques, complet", () => {
    expect(catalogComplete()).toBe(true);
    expect(PIERRE_ULTIMATE_VISION_REQUIREMENTS.length).toBeGreaterThanOrEqual(50);
    expect(PIERRE_ULTIMATE_GROUPS.length).toBe(50);
    expect(new Set(PIERRE_ULTIMATE_VISION_REQUIREMENTS.map((r) => r.id)).size).toBe(PIERRE_ULTIMATE_VISION_REQUIREMENTS.length);
  });
  it("chaque exigence a claim_level + launch_importance valides", () => {
    for (const r of PIERRE_ULTIMATE_VISION_REQUIREMENTS) {
      expect(CLAIM_LEVELS).toContain(r.claim_level);
      expect(["launch_critical", "important", "roadmap", "future_enterprise"]).toContain(r.launch_importance);
    }
  });
  it("la grande majorité des 50 groupes est représentée", () => {
    const groups = new Set(PIERRE_ULTIMATE_VISION_REQUIREMENTS.map((r) => r.group));
    expect(groups.size).toBeGreaterThanOrEqual(45);
  });
  it("accès requirementById / requirementsByGroup", () => {
    expect(requirementById("mission.engine")?.group).toBe("mission_engine");
    expect(requirementsByGroup("legal_responsibility_doctrine").length).toBeGreaterThanOrEqual(3);
  });
});

describe("P14 — Coverage evaluator (honnête)", () => {
  const results = evaluatePierreUltimateCoverage();
  it("retourne un statut valide pour CHAQUE exigence", () => {
    expect(results.length).toBe(PIERRE_ULTIMATE_VISION_REQUIREMENTS.length);
    for (const r of results) expect(COVERAGE_STATUSES).toContain(r.status);
  });
  it("les piliers de lancement sont VERIFIED (identité, mission, autonomie, mémoire, trace, source-vérité)", () => {
    for (const id of ["identity.employee_not_assistant", "mission.engine", "autonomy.controlled", "memory.durable", "trace.audit", "truth.source_of_truth"]) {
      expect(statusForRequirement(requirementById(id)!).status).toBe("VERIFIED");
    }
  });
  it("la validité juridique des contrats reste LEGAL_BLOCKED sans preuve externe", () => {
    expect(statusForRequirement(requirementById("contracts.legal_validity")!).status).toBe("LEGAL_BLOCKED");
    // même avec un override légal, on ne MARQUE pas VERIFIED (pas de test/report/browser) — jamais faussement conforme
    expect(statusForRequirement(requirementById("contracts.legal_validity")!, { legalProof: true }).status).not.toBe("VERIFIED");
  });
  it("la signature électronique reste PROVIDER_BLOCKED (Yousign non live)", () => {
    expect(statusForRequirement(requirementById("signature.esign")!).status).toBe("PROVIDER_BLOCKED");
  });
  it("un item legal-gated code-seul ne devient PAS VERIFIED même avec un flag légal (review B1a)", () => {
    // sector.adaptation : evidence_required [code, legal], evidence {code} → défaut LEGAL_BLOCKED.
    expect(statusForRequirement(requirementById("sector.adaptation")!).status).toBe("LEGAL_BLOCKED");
    // avec preuve légale, le code SEUL ne suffit pas → ARCHITECTURE_READY, jamais VERIFIED.
    const withLegal = statusForRequirement(requirementById("sector.adaptation")!, { legalProof: true });
    expect(withLegal.status).not.toBe("VERIFIED");
    expect(withLegal.status).toBe("ARCHITECTURE_READY");
  });
  it("la conformité pays garantie est MUST_NOT_CLAIM", () => {
    expect(statusForRequirement(requirementById("compliance.country_guarantee")!).status).toBe("MUST_NOT_CLAIM");
  });
  it("le moteur de paie complet est MUST_NOT_CLAIM", () => {
    expect(statusForRequirement(requirementById("prepayroll.full_engine")!).status).toBe("MUST_NOT_CLAIM");
  });
  it("les décisions disciplinaires/salariales finales sont MUST_NOT_CLAIM", () => {
    expect(statusForRequirement(requirementById("relations.decisions")!).status).toBe("MUST_NOT_CLAIM");
    expect(statusForRequirement(requirementById("compensation.decisions")!).status).toBe("MUST_NOT_CLAIM");
  });
  it("le remplacement total de la RH / DRH autonome sont MUST_NOT_CLAIM", () => {
    expect(statusForRequirement(requirementById("doctrine.no_full_hr_replacement")!).status).toBe("MUST_NOT_CLAIM");
    expect(statusForRequirement(requirementById("doctrine.no_autonomous_drh")!).status).toBe("MUST_NOT_CLAIM");
  });
  it("voix / intégrations / ROI-report / 7-day pack ne sont PAS marqués launch-verified", () => {
    const lc = computeLaunchClaimMatrix(results);
    for (const id of ["voice.clonevoice", "integrations.external", "roi.value_report", "value.seven_day_pack"]) {
      expect(lc.launchVerified).not.toContain(requirementById(id)!.title);
    }
    // et leurs statuts sont roadmap/blocked, jamais VERIFIED
    for (const id of ["voice.clonevoice", "integrations.external"]) {
      expect(["FUTURE_ROADMAP", "ARCHITECTURE_READY", "EXTERNAL_BLOCKED"]).toContain(statusForRequirement(requirementById(id)!).status);
    }
  });
  it("summarize : pas de couverture VERIFIED sur legal/provider bloqués", () => {
    const s = summarizePierreCoverage(results);
    expect(s.byStatus.LEGAL_BLOCKED ?? 0).toBeGreaterThan(0);
    expect(s.byStatus.PROVIDER_BLOCKED ?? 0).toBeGreaterThan(0);
    expect(s.byStatus.MUST_NOT_CLAIM ?? 0).toBeGreaterThanOrEqual(4);
    expect(s.byStatus.VERIFIED ?? 0).toBeGreaterThan(0);
  });
});

describe("P14 — Commercial truth matrix", () => {
  it("claims forts autorisés passent", () => {
    for (const c of ALLOWED_STRONG_CLAIMS) expect(["allowed_strong", "allowed_caution"]).toContain(evaluateClaimSafety(c).safety);
  });
  it("claims prudents autorisés passent", () => {
    for (const c of ALLOWED_CAUTION_CLAIMS) expect(evaluateClaimSafety(c).safety).toBe("allowed_caution");
  });
  it("chaque claim interdit est bloqué", () => {
    for (const c of FORBIDDEN_CLAIMS) expect(evaluateClaimSafety(c).safety).toBe("forbidden");
  });
  it("interdits spécifiques : assistant / conformité garantie / paie / DRH autonome / décision finale / remplacement total", () => {
    for (const c of [
      "Pierre est un assistant RH intelligent",
      "Pierre garantit la conformité légale de vos documents",
      "Pierre est conforme au droit suisse",
      "Pierre remplace votre logiciel de paie",
      "Pierre est un DRH autonome",
      "Pierre décide seul des licenciements",
      "Pierre remplace toute la RH",
      "Pierre est en production live",
      "Pierre est parfait et sans erreur",
    ]) expect(evaluateClaimSafety(c).safety).toBe("forbidden");
  });
  it("claims INTERDITS REFORMULÉS (synonymes) ne sont JAMAIS approuvés (review P14 REFUTED fix)", () => {
    // Aucune de ces reformulations ne doit renvoyer allowed_strong/allowed_caution.
    const reworded = [
      "Pierre assure la conformité juridique et prépare vos documents",
      "Pierre prépare et tranche seul les licenciements",
      "Pierre calcule la paie et prépare vos documents",
      "Pierre garantit votre conformité RGPD et vous aide au quotidien",
      "Pierre remplace vos ressources humaines et prépare vos documents",
      "Pierre gère la paie et prépare vos bulletins de salaire",
      "Pierre remplace votre DRH et structure tout le RH",
      "Pierre remplace votre équipe RH complète mais vous aide à garder le contrôle",
      "Pierre statue seul sur les sanctions disciplinaires",
    ];
    for (const c of reworded) {
      const s = evaluateClaimSafety(c).safety;
      expect(["forbidden", "unknown_review"]).toContain(s); // jamais allowed_*
      expect(s).not.toBe("allowed_strong");
      expect(s).not.toBe("allowed_caution");
    }
  });
  it("un claim opérationnel bénin reste allowed_caution (pas de sur-blocage)", () => {
    expect(["allowed_caution", "allowed_strong"]).toContain(evaluateClaimSafety("Pierre aide à structurer vos relances et à préparer vos documents RH").safety);
  });
  it("la copie site générée est sûre + porte un disclaimer de validation humaine", () => {
    expect(generatedCopyIsSafe()).toBe(true);
    const c = generateWebsiteSafeCopy();
    expect(c.disclaimer).toMatch(/validation humaine|ne remplace pas|ne garantit pas/i);
    expect(evaluateClaimSafety(c.headline).safety).not.toBe("forbidden");
  });
});

describe("P14 — Economic value matrix", () => {
  it("prix : FR/BE/LU = 449 EUR, CH = 499 CHF (cohérent avec P10)", () => {
    expect(PIERRE_PRICE_EUR_MONTHLY).toBe(449);
    expect(PIERRE_PRICE_CHF_MONTHLY).toBe(499);
    const ch = pricingForCountry("CH"); expect(ch.status).toBe("ok"); if (ch.status === "ok") { expect(ch.pricing.amount).toBe(499); expect(ch.pricing.currency).toBe("CHF"); }
    const fr = pricingForCountry("FR"); if (fr.status === "ok") { expect(fr.pricing.amount).toBe(449); expect(fr.pricing.currency).toBe("EUR"); }
  });
  it("estimation : toujours marquée estimate + disclaimer, jamais garantie ; pas de montant sans coût horaire", () => {
    const noHourly = monthlySavingsEstimate({ pierrePrice: 449, estimatedHoursSaved: 12 });
    expect(noHourly.isEstimate).toBe(true);
    expect(noHourly.grossValueOfHours).toBeNull();          // aucun montant inventé sans coût horaire
    expect(noHourly.disclaimer).toMatch(/non garantie|ne remplace pas/i);
    const withHourly = monthlySavingsEstimate({ pierrePrice: 449, estimatedHoursSaved: 12, hourlyCost: 40 });
    expect(withHourly.grossValueOfHours).toBe(480);
    expect(withHourly.netMonthlyEstimate).toBe(31);
    expect(withHourly.breakEvenReached).toBe(true);
  });
  it("break-even : heures = prix / coût horaire (estimation)", () => {
    expect(roiBreakEvenHours({ pierrePrice: 449, hourlyCost: 40 }).breakEvenHours).toBeCloseTo(11.23, 1);
    expect(roiBreakEvenHours({ pierrePrice: 449, hourlyCost: 0 }).breakEvenHours).toBeNull();
  });
  it("copie ROI prudente (positionnement charge RH, 10–15h, disclaimer non garanti)", () => {
    const c = generateSafeRoiCopy();
    expect(c.positioning).toMatch(/charge RH opérationnelle/i);
    expect(c.threshold).toMatch(/10 à 15 heures/i);
    expect(c.disclaimer).toMatch(/non garanti/i);
    expect(c.forbidden.length).toBeGreaterThanOrEqual(3);
  });
});

describe("P14 — Guardrails (production off, no launch overclaim)", () => {
  it("PRODUCTION_AUTHORIZED reste false", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
  });
  it("launch claim matrix ne marque JAMAIS un roadmap comme launch verified", () => {
    const lc = computeLaunchClaimMatrix(evaluatePierreUltimateCoverage());
    // aucun titre de launchVerified ne correspond à un statut roadmap
    const roadmapTitles = evaluatePierreUltimateCoverage().filter((r) => r.status === "FUTURE_ROADMAP" || r.status === "ARCHITECTURE_READY").map((r) => r.title);
    for (const t of lc.launchVerified) expect(roadmapTitles).not.toContain(t);
    expect(lc.forbiddenAtLaunch.length).toBeGreaterThanOrEqual(4);
  });
});
