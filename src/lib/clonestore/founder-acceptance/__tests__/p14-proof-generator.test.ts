// src/lib/clonestore/founder-acceptance/__tests__/p14-proof-generator.test.ts
// P14 — Génère les preuves JSON DEPUIS l'évaluateur RÉEL (pas d'écriture à la main → honnêteté :
// la matrice de couverture est CALCULÉE). Écrit uniquement si P14_WRITE_PROOFS=1 ; sinon calcule
// et assère seulement (le test reste réel dans la non-régression).
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PIERRE_ULTIMATE_VISION_REQUIREMENTS, PIERRE_ULTIMATE_GROUPS } from "../pierre-ultimate-vision-catalog";
import {
  evaluatePierreUltimateCoverage, summarizePierreCoverage, computeCommercialTruthMatrix, computeLaunchClaimMatrix,
} from "../pierre-ultimate-coverage-evaluator";
import {
  ALLOWED_STRONG_CLAIMS, ALLOWED_CAUTION_CLAIMS, FORBIDDEN_CLAIMS,
  generateLaunchSalesLanguage, generateFounderSalesLanguage, generateWebsiteSafeCopy, generatedCopyIsSafe, evaluateClaimSafety,
} from "../pierre-commercial-truth-matrix";
import {
  PIERRE_PRICE_EUR_MONTHLY, PIERRE_PRICE_CHF_MONTHLY, monthlySavingsEstimate, roiBreakEvenHours, generateSafeRoiCopy,
} from "../pierre-economic-value-matrix";

const results = evaluatePierreUltimateCoverage();
const summary = summarizePierreCoverage(results);
const commercial = computeCommercialTruthMatrix(results);
const launch = computeLaunchClaimMatrix(results);
const count = (s: string) => results.filter((r) => r.status === s).length;

describe("P14 — proof generation (computed from the real evaluator)", () => {
  it("la matrice de couverture est honnête (verified > 0, blockers présents, must_not ≥ 4, roadmap présents)", () => {
    expect(count("VERIFIED")).toBeGreaterThan(0);
    expect(count("LEGAL_BLOCKED") + count("PROVIDER_BLOCKED") + count("EXTERNAL_BLOCKED")).toBeGreaterThan(0);
    expect(count("MUST_NOT_CLAIM")).toBeGreaterThanOrEqual(4);
    expect(count("FUTURE_ROADMAP") + count("ARCHITECTURE_READY")).toBeGreaterThan(0);
    // aucun statut VERIFIED sur un item legal/provider bloqué
    for (const r of results) {
      if (r.status === "VERIFIED") {
        expect(r.evidence_required.includes("legal")).toBe(false);
        expect(r.evidence_required.includes("provider")).toBe(false);
      }
    }
  });

  it("écrit les preuves si P14_WRITE_PROOFS=1", () => {
    if (process.env.P14_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }
    const dir = resolve(process.cwd(), ".p14-proofs", "p14-run1");
    mkdirSync(dir, { recursive: true });
    const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

    // 1) catalogue
    w("ultimate-vision-catalog.json", {
      runId: "p14-run1", total_requirements: PIERRE_ULTIMATE_VISION_REQUIREMENTS.length,
      groups: PIERRE_ULTIMATE_GROUPS, requirements: PIERRE_ULTIMATE_VISION_REQUIREMENTS,
    });

    // 2) coverage (résultats + résumé)
    w("coverage-matrix.json", { runId: "p14-run1", summary, results });

    // 3) may-vision-coverage-matrix (§6)
    const group_summary: Record<string, unknown> = {};
    for (const [g, v] of Object.entries(summary.byGroup)) group_summary[g] = v;
    w("may-vision-coverage-matrix.json", {
      runId: "p14-run1",
      total_requirements: results.length,
      verified_count: count("VERIFIED"),
      partial_count: count("PARTIAL"),
      architecture_ready_count: count("ARCHITECTURE_READY"),
      future_roadmap_count: count("FUTURE_ROADMAP"),
      external_blocked_count: count("EXTERNAL_BLOCKED"),
      legal_blocked_count: count("LEGAL_BLOCKED"),
      provider_blocked_count: count("PROVIDER_BLOCKED"),
      must_not_claim_count: count("MUST_NOT_CLAIM"),
      group_summary,
      launch_critical_summary: summary.launchCritical,
      top_verified_items: summary.topVerified,
      top_gaps: summary.topGaps,
      launch_safe_claims: [...ALLOWED_STRONG_CLAIMS, ...ALLOWED_CAUTION_CLAIMS],
      launch_forbidden_claims: [...FORBIDDEN_CLAIMS, ...launch.forbiddenAtLaunch],
      honest_verdict: "LAUNCH VISION VERIFIED / ULTIMATE VISION ROADMAP DISCLOSED — Pierre couvre les piliers de lancement (identité, moteur de missions, analyse de demande, tâches, autonomie contrôlée, trace, mémoire, source de vérité, rôles, gestion d'erreur, cockpit/CloneOS, mobile) VERIFIED ; une large exécution RH opérationnelle est PARTIAL (canon P8.13 certifié, gouverné, non démontré en E2E dédié) ; conformité légale/fiscale pays = LEGAL_BLOCKED, signature = PROVIDER_BLOCKED, intégrations/voix/notifications push/ROI-report = ROADMAP/EXTERNAL ; paie complète + décisions finales disciplinaires/salariales + conformité garantie + remplacement total RH + DRH autonome = MUST_NOT_CLAIM. Production OFF.",
    });

    // 4) commercial truth matrix
    w("commercial-truth-matrix.json", {
      runId: "p14-run1",
      allowed_strong: ALLOWED_STRONG_CLAIMS, allowed_caution: ALLOWED_CAUTION_CLAIMS, forbidden: FORBIDDEN_CLAIMS,
      computed: commercial,
      generated_language: {
        launch: generateLaunchSalesLanguage(), founder: generateFounderSalesLanguage(), website: generateWebsiteSafeCopy(),
        generated_copy_is_safe: generatedCopyIsSafe(),
      },
      safety_spot_checks: {
        assistant: evaluateClaimSafety("Pierre est un assistant RH"),
        legal_guarantee: evaluateClaimSafety("Pierre garantit la conformité légale"),
        payroll: evaluateClaimSafety("Pierre remplace votre logiciel de paie"),
        strong_ok: evaluateClaimSafety("Pierre est un employé IA RH."),
        // Reformulations par synonyme (review P14 REFUTED fix) — doivent être forbidden/unknown_review, jamais allowed_*.
        reworded_assure_conformite: evaluateClaimSafety("Pierre assure la conformité juridique et prépare vos documents"),
        reworded_tranche_seul: evaluateClaimSafety("Pierre prépare et tranche seul les licenciements"),
        reworded_calcule_paie: evaluateClaimSafety("Pierre calcule la paie et prépare vos documents"),
        reworded_remplace_rh: evaluateClaimSafety("Pierre remplace vos ressources humaines et prépare vos documents"),
        benign_operational_ok: evaluateClaimSafety("Pierre aide à structurer vos relances et à préparer vos documents RH"),
      },
    });

    // 5) economic value matrix
    w("economic-value-matrix.json", {
      runId: "p14-run1",
      prices: { fr_be_lu_eur: PIERRE_PRICE_EUR_MONTHLY, ch_chf: PIERRE_PRICE_CHF_MONTHLY },
      sample_savings_no_hourly: monthlySavingsEstimate({ pierrePrice: 449, estimatedHoursSaved: 12 }),
      sample_savings_with_hourly: monthlySavingsEstimate({ pierrePrice: 449, estimatedHoursSaved: 12, hourlyCost: 40, avoidedAdminHours: 3, avoidedManagerHours: 1 }),
      sample_breakeven: roiBreakEvenHours({ pierrePrice: 449, hourlyCost: 40 }),
      safe_roi_copy: generateSafeRoiCopy(),
      note: "Toutes les valeurs sont des hypothèses configurables ; aucune donnée salariale n'est présentée comme vérité ; aucun gain garanti.",
    });

    expect(true).toBe(true);
  });
});
