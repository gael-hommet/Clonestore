// §2 — Coûts IA : agrégation Founder au-dessus du ledger gouverné existant (réutilisé).
// Aucune nouvelle source ; on enregistre de vrais événements d'usage (in-memory) et on
// agrège. Aucun prompt/réponse n'est jamais exposé.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let breakLedger = false;
vi.mock("@/lib/cloneos/ai/cost-ledger/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cloneos/ai/cost-ledger/runtime")>();
  return {
    ...actual,
    getAiCostLedger: () => breakLedger
      ? ({ summarize: async () => { throw new Error("ledger down"); }, listEvents: async () => { throw new Error("ledger down"); } } as unknown as ReturnType<typeof actual.getAiCostLedger>)
      : actual.getAiCostLedger(),
  };
});

import { getAiCostLedger, resetAiCostLedger } from "@/lib/cloneos/ai/cost-ledger/runtime";
import { founderAiCostSummary, aiCostHealth } from "../ai-cost";

const KEY = "AI_COST_LEDGER_PROVIDER";
const saved = process.env[KEY];
beforeEach(() => { breakLedger = false; process.env[KEY] = "memory"; resetAiCostLedger(); });
afterEach(() => { breakLedger = false; if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved; resetAiCostLedger(); });

async function seed() {
  const l = getAiCostLedger();
  const base = { company_id: null, user_id: null, agent_slug: "pierre", use_case: "hr_draft", access_level: "internal" } as const;
  await l.recordActual({ ...base, provider: "openai", model: "gpt-4o-mini", input_tokens: 1000, output_tokens: 500, estimated_cost_cents: 12, actual_cost_cents: 12 });
  await l.recordActual({ ...base, provider: "anthropic", model: "claude-haiku", input_tokens: 800, output_tokens: 400, estimated_cost_cents: 9, actual_cost_cents: 9 });
  await l.recordActual({ ...base, provider: "openai", model: "gpt-4o-mini", input_tokens: 500, output_tokens: 200, estimated_cost_cents: 6, actual_cost_cents: 6 });
}

describe("founderAiCostSummary + aiCostHealth", () => {
  it("usage OpenAI + Anthropic → agrégé (24h/7j/30j) avec coûts réels", async () => {
    await seed();
    const s = await founderAiCostSummary();
    expect(s).not.toBeNull();
    expect(s!.calls_30d).toBe(3);
    expect(s!.cost_30d_cents).toBe(27);
    expect(s!.cost_7d_cents).toBe(27);
    expect(s!.cost_today_cents).toBe(27);
  });
  it("provider et modèle dominants calculés (openai / gpt-4o-mini)", async () => {
    await seed();
    const s = await founderAiCostSummary();
    expect(s!.top_provider).toBe("openai");
    expect(s!.top_model).toBe("gpt-4o-mini");
  });
  it("aucun champ prompt/réponse exposé", async () => {
    await seed();
    const s = await founderAiCostSummary();
    expect(JSON.stringify(s)).not.toMatch(/prompt|completion|"messages"/i);
  });
  it("aucun usage → source connectée mais zéro consommation", async () => {
    const h = await aiCostHealth();
    expect(h.state).toBe("connected");
    expect(h.detail).toMatch(/aucune consommation/i);
  });
  it("usage présent → source connectée avec compteur", async () => {
    await seed();
    const h = await aiCostHealth();
    expect(h.state).toBe("connected");
    expect(h.detail).toMatch(/3 appels/);
  });
  it("ledger désactivé → not_configured + résumé null", async () => {
    process.env[KEY] = "disabled"; resetAiCostLedger();
    expect(await founderAiCostSummary()).toBeNull();
    expect((await aiCostHealth()).state).toBe("not_configured");
  });
  it("ledger inaccessible (agrégation échoue) → unavailable + résumé null", async () => {
    breakLedger = true;
    expect(await founderAiCostSummary()).toBeNull();
    expect((await aiCostHealth()).state).toBe("unavailable");
  });
});
