// C1.8 REOUVERT §9 — DIAGNOSTIC (non bloquant) : 240 formulations générées INDÉPENDAMMENT par 8
// agents adverses (sans accès aux regex du routeur) passées au vrai résolveur. Ce test NE FORCE
// aucune assertion : il MESURE le taux de routage correct par intention attendue et écrit la liste
// exacte des échecs pour triage (vraie faille routeur vs ambiguïté légitime).
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolveNavigationIntent, type NavContext } from "../intent-taxonomy";

type Case = { message: string; expected_intent: string; note: string };
type Cat = { category: string; cases: Case[] };
const fixture = JSON.parse(readFileSync("src/lib/clonechat/navigation/__tests__/fixtures/adversarial-240.json", "utf8")) as { total: number; categories: Cat[] };

const visitor: NavContext = { mode: "visitor", hasActiveCompany: false, country: null };

// Route(s) acceptable(s) par intention attendue déclarée par l'agent adverse.
function accepts(expected: string, route: string | null, intent: string): boolean {
  switch (expected) {
    case "purchase": return route === "/reserver/pierre";
    case "pricing": return route === "/reserver/pierre" && (intent === "pierre_pricing" || intent === "purchase_pierre");
    case "demo": return route === "/demo/pierre";
    case "discover": return route === "/agents/pierre" || route === "/comprendre-clonestore";
    case "support": return route === "/questions";
    case "cancel": return route === "/profile";
    case "navigate": return route !== null;
    case "none_of_pierre": return route !== "/reserver/pierre"; // ne doit PAS forcer l'achat
    case "ambiguous": return true; // soft : tout sauf route inventée (garanti par la garde anti-invention)
    default: return route !== null;
  }
}

describe("C1.8 REOUVERT §9 — DIAGNOSTIC 240 formulations adverses indépendantes", () => {
  it("mesure le taux de routage correct et écrit la liste des échecs (non bloquant)", () => {
    const perIntent: Record<string, { total: number; ok: number }> = {};
    const failures: Array<Record<string, unknown>> = [];
    let total = 0, ok = 0;
    for (const cat of fixture.categories) {
      for (const c of cat.cases) {
        const r = resolveNavigationIntent(c.message, visitor);
        const good = accepts(c.expected_intent, r.route, r.intent);
        perIntent[c.expected_intent] ??= { total: 0, ok: 0 };
        perIntent[c.expected_intent].total++;
        total++;
        if (good) { perIntent[c.expected_intent].ok++; ok++; }
        else failures.push({ message: c.message, expected: c.expected_intent, got_intent: r.intent, got_route: r.route, clarify: r.clarification_required, note: c.note });
      }
    }
    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_ADVERSARIAL_240_DIAGNOSTIC.json", JSON.stringify({
      note: "Formulations générées par 8 agents adverses indépendants (sans accès au routeur). DIAGNOSTIC, non bloquant.",
      total, ok, rate: +(ok / total).toFixed(3), perIntent, failures,
    }, null, 2));
    // eslint-disable-next-line no-console
    console.log(`\n  ▸ Adverse 240 : ${ok}/${total} (${((ok / total) * 100).toFixed(1)}%)`);
    for (const k of Object.keys(perIntent)) console.log(`    ${k}: ${perIntent[k].ok}/${perIntent[k].total}`);
    expect(total).toBe(240);
  });
});
