// C1.8 A2 — RECAPTURE INTÉGRALE des 1003 messages sur le pipeline CORRIGÉ.
// Même fixture, mêmes IDs (index dans le corpus original), même ordre, réponses COMPLÈTES.
// Aucun réseau, aucun compte, aucune variable sensible : answerPublicQuestion déterministe.
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolveNavigationIntent, type NavContext } from "../intent-taxonomy";
import { answerPublicQuestion } from "../../intelligence/c1-1/parrain-public-adapter";
import { classifyPublicSituation } from "../../public-answer";

const visitor: NavContext = { mode: "visitor", hasActiveCompany: false, country: null };
const OUT = ".c1-8-reopened-proofs/a2/remediation";

describe("C1.8 A2 — recapture des 1003 réponses après remédiation", () => {
  it("1003 réponses complètes, 0 vide, 0 doublon d'ID, 0 erreur d'exécution", async () => {
    const d = JSON.parse(readFileSync("src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json", "utf8")) as {
      groups: { category: string; cases: Array<Record<string, unknown>> }[];
    };
    const all = d.groups.flatMap((g) => g.cases.map((c) => ({ ...c, _cat: g.category })));
    const forJudges: Array<Record<string, unknown>> = [];
    const withMeta: Array<Record<string, unknown>> = [];
    let executionErrors = 0;

    for (let id = 0; id < all.length; id++) {
      const c = all[id];
      const msg = c.message as string;
      let pub: Awaited<ReturnType<typeof answerPublicQuestion>> | null = null;
      let execError: string | null = null;
      try {
        pub = await answerPublicQuestion({ question: msg, at: "2026-07-18T10:00:00Z" });
      } catch (e) {
        execError = e instanceof Error ? e.message : String(e);
        executionErrors++;
      }
      const nav = resolveNavigationIntent(msg, visitor);
      const sit = classifyPublicSituation(msg);
      const delivered_route = pub?.suggestedCTA?.route ?? pub?.relevantLinks[0]?.route ?? null;
      const row = {
        id,
        message: msg,
        full_answer: pub?.answer ?? "",
        delivered_route,
        delivered_cta: pub?.suggestedCTA ?? null,
        relevant_links: pub?.relevantLinks ?? [],
        honesty: pub?.honesty ?? null,
        execution_error: execError,
      };
      forJudges.push(row);
      withMeta.push({
        ...row,
        generator_label: c.expected_intent,
        category: c._cat,
        must_refuse: c.must_refuse,
        situation: sit.kind,
        situation_reason: sit.reason,
        injection_flag: sit.injectionFlag,
        illicit_flag: sit.illicitFlag,
        resolved_intent: nav.intent,
        resolved_route: nav.route,
        confidence: pub?.confidence ?? null,
        needs_human_escalation: pub?.needsHumanEscalation ?? null,
        source: pub?.source ?? null,
        source_artifact: "c18-a2-remediated-recapture.test.ts",
      });
    }

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/C18_A2_REMEDIATED_BLIND_CORPUS.json`, JSON.stringify({ total: forJudges.length, cases: forJudges }, null, 2));
    writeFileSync(`${OUT}/C18_A2_REMEDIATED_FULL_RESPONSE_META.json`, JSON.stringify({
      version: "C18_A2_REMEDIATED_v1",
      total: withMeta.length,
      cases: withMeta,
    }, null, 2));

    const ids = new Set(withMeta.map((r) => r.id));
    const empties = withMeta.filter((r) => String(r.full_answer).trim().length === 0);
    // eslint-disable-next-line no-console
    console.log(`\n  ▸ RECAPTURE A2 : ${withMeta.length} cas | vides=${empties.length} | erreurs=${executionErrors} | ids uniques=${ids.size}`);
    expect(withMeta.length).toBe(1003);
    expect(ids.size).toBe(1003);
    expect(empties).toEqual([]);
    expect(executionErrors).toBe(0);
  // C1.9 — délai EXPLICITE : ce test traite ~1000 cas et prenait ~8 s contre les 5 s par
  // défaut de vitest. Il échouait donc selon la vitesse de la machine, pas selon le code —
  // un échec de cette nature finit par masquer un vrai échec.
  }, 60_000);
});
