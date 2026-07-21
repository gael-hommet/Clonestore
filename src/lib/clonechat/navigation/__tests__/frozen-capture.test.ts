// C1.8 §1 — CAPTURE FIGÉE des 1003 messages sur le pipeline ACTUEL. ID numérique stable = index dans
// le corpus original (jamais modifié). Aucune exclusion, aucun cluster, aucun label générateur dans la
// sortie destinée aux juges. On enregistre la destination RÉELLEMENT délivrée (pub.suggestedCTA/links).
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolveNavigationIntent, type NavContext } from "../intent-taxonomy";
import { answerPublicQuestion } from "../../intelligence/c1-1/parrain-public-adapter";

const visitor: NavContext = { mode: "visitor", hasActiveCompany: false, country: null };

describe("C1.8 §1 — capture figée pour jugement indépendant", () => {
  it("capture 1003 (id, message, intention+route délivrées) — figé", async () => {
    const d = JSON.parse(readFileSync("src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json", "utf8")) as { groups: { category: string; cases: Array<Record<string, unknown>> }[] };
    const all = d.groups.flatMap((g) => g.cases.map((c) => ({ ...c, _cat: g.category })));
    const forJudges: Array<Record<string, unknown>> = [];   // ce que voient les juges (SANS label ni catégorie)
    const withMeta: Array<Record<string, unknown>> = [];     // capture complète pour agrégation (garde le label caché)
    for (let id = 0; id < all.length; id++) {
      const c = all[id];
      const msg = c.message as string;
      const nav = resolveNavigationIntent(msg, visitor);
      const pub = await answerPublicQuestion({ question: msg, at: "2026-07-18T10:00:00Z" });
      const delivered_route = pub.suggestedCTA?.route ?? pub.relevantLinks[0]?.route ?? null;
      forJudges.push({ id, message: msg, delivered_intent: nav.intent, delivered_route, answer_head: (pub.answer ?? "").slice(0, 90) });
      withMeta.push({ id, message: msg, generator_label: c.expected_intent, category: c._cat, must_refuse: c.must_refuse, delivered_intent: nav.intent, delivered_route });
    }
    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_FROZEN_CAPTURE_FOR_JUDGES.json", JSON.stringify({ total: forJudges.length, cases: forJudges }, null, 2));
    writeFileSync(".c1-8-reopened-proofs/C18_FROZEN_CAPTURE_META.json", JSON.stringify({ total: withMeta.length, cases: withMeta }, null, 2));
    // eslint-disable-next-line no-console
    console.log(`\n  ▸ FROZEN CAPTURE : ${forJudges.length} cas figés (id 0..${forJudges.length - 1})`);
    expect(forJudges.length).toBe(1003);
  });
});
