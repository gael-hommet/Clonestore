// src/lib/clonestore/ultimate/__tests__/p16-proof-generator.test.ts
// P16.0 — génère les preuves JSON DEPUIS le module réel. Écrit si P16_WRITE_PROOFS=1.
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  P16_MASTER_SPLIT, getPierreUltimateItems, getTechnologyItems, getIntegrationItems,
  getExternalBlockedItems, getMustNotClaimItems, summarizeP16Split,
} from "../p16-master-split";

const summary = summarizeP16Split();

describe("P16.0 — proof generation", () => {
  it("split cohérent + recommandation deux sessions", () => {
    expect(summary.total).toBe(P16_MASTER_SPLIT.length);
    expect(summary.sessionRecommendation).toBe("two_sessions_plus_integration_gate");
  });
  it("écrit les preuves si P16_WRITE_PROOFS=1", () => {
    if (process.env.P16_WRITE_PROOFS !== "1") { expect(true).toBe(true); return; }
    const dir = resolve(process.cwd(), ".p16-proofs", "p16-0-master-split");
    mkdirSync(dir, { recursive: true });
    const w = (name: string, obj: unknown) => writeFileSync(resolve(dir, name), JSON.stringify(obj, null, 2));

    w("master-split.json", { runId: "p16-0-master-split", summary, items: P16_MASTER_SPLIT });
    w("pierre-plan.json", { runId: "p16-0-master-split", plan: "P16A_PIERRE_ULTIMATE_COMPLETION_PLAN.md", items: getPierreUltimateItems() });
    w("technology-plan.json", { runId: "p16-0-master-split", plan: "T1_CLONESTORE_TECHNOLOGIES_LAYER_PLAN.md", technologies: getTechnologyItems() });
    w("integration-plan.json", { runId: "p16-0-master-split", plan: "P16C_PIERRE_TECHNOLOGIES_INTEGRATION_PLAN.md", adapters: getIntegrationItems() });
    w("session-strategy.json", {
      runId: "p16-0-master-split",
      recommendation: summary.sessionRecommendation, rationale: summary.sessionRationale,
      buildableBeforeStripe: summary.buildableBeforeStripe, byNextPhase: summary.byNextPhase,
      externalBlocked: getExternalBlockedItems().map((i) => i.id), mustNotClaim: getMustNotClaimItems().map((i) => i.id),
      exactNextPrompts: [
        "Session A → « START P16A — PIERRE ULTIMATE COMPLETION » (profondeur RH, flags sûrs, non-prod).",
        "Session B → « START T1 — CLONESTORE TECHNOLOGIES LAYER » (technos réutilisables + TechnologyBus).",
        "Session C (porte) → « START P16C — PIERRE x TECHNOLOGIES INTEGRATION » (adaptateurs Pierre→Techno, dégradation sûre).",
      ],
    });
    expect(true).toBe(true);
  });
});
