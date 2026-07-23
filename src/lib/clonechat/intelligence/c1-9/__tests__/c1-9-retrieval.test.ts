// C1.9 — PREUVE DE RÉCUPÉRATION. Ancien moteur vs nouveau, sur le MÊME corpus réel.
// Aucun appel réseau. Le critère est comportemental, jamais « le code a changé ».
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { collectCandidateChunks } from "../../c1-1/parrain-source-adapters";
import { retrieveParrainChunks } from "../../c1-1/parrain-retrieval";
import { retrieveSemantic, tokenize } from "../semantic-retrieval";
import type { ParrainViewerContext } from "../../c1-1/parrain-types";

const PUBLIC_VIEWER: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };
const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";

/**
 * Cas de référence du cahier des charges. Aucun de ces énoncés n'apparaît dans le code
 * produit ; ils ne partagent presque aucun mot avec la source visée.
 */
const CASES: Array<{ id: string; question: string; needs: string[]; expectChunk: string }> = [
  {
    id: "paperasse",
    question: "Ça me permettrait d'éviter de recruter quelqu'un juste pour gérer la paperasse ?",
    needs: [
      "automatisation des tâches administratives RH",
      "comparaison entre le coût d'une embauche et l'abonnement",
      "gain de temps sur les tâches répétitives",
    ],
    expectChunk: "product.roi-productivity",
  },
  {
    id: "poste-admin",
    question: "Ça réduit réellement le besoin d'un poste administratif ou c'est surtout du confort ?",
    needs: ["substitution d'un poste administratif", "rentabilité et productivité RH", "limites de Pierre"],
    expectChunk: "product.roi-productivity",
  },
  {
    id: "comparer-recrutement",
    question: "J'hésite entre recruter quelqu'un ou vous prendre, comment je compare proprement ?",
    needs: ["méthode de comparaison coût interne contre abonnement", "productivité et retour sur investissement"],
    expectChunk: "product.roi-productivity",
  },
];

describe("C1.9 semantic retrieval", () => {
  it("tokenizer drops French stopwords and stems inflections", () => {
    // L'ancien moteur scorait « pour », « est », « combien ». Le nouveau ne les voit plus.
    expect(tokenize("pour de le la est combien vous")).toEqual([]);
    // Racinisation prudente : flexions rejointes, radicaux préservés.
    expect(tokenize("recrutement")).toEqual(tokenize("recruter"));
    expect(tokenize("administrative")).toEqual(tokenize("administratif"));
  });

  it("does NOT invent a match when nothing is relevant (D9)", () => {
    const candidates = collectCandidateChunks({ question: "photosynthèse chlorophylle" });
    const r = retrieveSemantic(candidates, PUBLIC_VIEWER, {
      knowledgeNeeds: ["biologie végétale photosynthèse"],
      contextTerms: [],
      rawMessage: "Explique-moi la photosynthèse.",
    });
    // L'ancien moteur renvoyait toujours quelque chose (pricing.catalog en tête).
    expect(r.sufficiency).toBe("none");
    expect(r.selected.length).toBe(0);
  });

  it("retrieves the ROI source for paraphrases that share almost no words with it", () => {
    const report: Array<Record<string, unknown>> = [];

    for (const c of CASES) {
      const candidates = collectCandidateChunks({ question: c.question });

      // ── ANCIEN moteur (comptage de sous-chaînes, mots de l'utilisateur) ──
      const before = retrieveParrainChunks(c.question, candidates, PUBLIC_VIEWER, { limit: 10, maxChars: 3400 });
      const beforeIds = before.selected.map((s) => s.chunk.id);
      const beforeRank = beforeIds.indexOf(c.expectChunk);

      // ── NOUVEAU moteur (besoins écrits par la compréhension) ──
      const after = retrieveSemantic(candidates, PUBLIC_VIEWER, {
        knowledgeNeeds: c.needs, contextTerms: [], rawMessage: c.question,
      }, { maxChunks: 10, maxChars: 3400 });
      const afterIds = after.selected.map((s) => s.chunk.id);
      const afterRank = afterIds.indexOf(c.expectChunk);

      report.push({
        id: c.id, question: c.question, expectChunk: c.expectChunk,
        before: {
          retrieved: beforeRank >= 0, rank: beforeRank,
          top3: beforeIds.slice(0, 3),
          excludedForBudget: before.excluded.filter((e) => e.reason === "char_budget").map((e) => e.chunkId),
        },
        after: {
          retrieved: afterRank >= 0, rank: afterRank,
          top3: afterIds.slice(0, 3),
          sufficiency: after.sufficiency,
          unmatchedNeeds: after.unmatchedNeeds,
        },
      });

      // Le critère de succès : la bonne source est récupérée ET bien classée.
      expect(afterRank, `${c.id}: ${c.expectChunk} absent du résultat (top3=${afterIds.slice(0, 3).join(", ")})`).toBeGreaterThanOrEqual(0);
      expect(afterRank, `${c.id}: ${c.expectChunk} mal classé (rang ${afterRank})`).toBeLessThanOrEqual(2);
      expect(after.sufficiency).not.toBe("none");
    }

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/C1_9_SEMANTIC_RETRIEVAL_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_SEMANTIC_RETRIEVAL_RESULTS",
      generatedAt: "2026-07-22",
      method: "Même corpus réel (collectCandidateChunks), même viewer public, même bornes 10 chunks / 3400 car. Seul le moteur de sélection change.",
      cases: report,
      summary: {
        beforeRetrieved: report.filter((r) => (r.before as { retrieved: boolean }).retrieved).length,
        afterRetrieved: report.filter((r) => (r.after as { retrieved: boolean }).retrieved).length,
        total: report.length,
      },
    }, null, 2));

    for (const r of report) {
      const b = r.before as { retrieved: boolean; rank: number; top3: string[] };
      const a = r.after as { retrieved: boolean; rank: number; sufficiency: string };
      console.log(`[${r.id}] AVANT retrieved=${b.retrieved} rank=${b.rank} top=${b.top3[0]} | APRÈS retrieved=${a.retrieved} rank=${a.rank} suff=${a.sufficiency}`);
    }
  }, 120_000);

  it("keeps the best chunk instead of evicting it for shorter noise (D8)", () => {
    const question = CASES[0].question;
    const candidates = collectCandidateChunks({ question });
    const after = retrieveSemantic(candidates, PUBLIC_VIEWER, {
      knowledgeNeeds: CASES[0].needs, contextTerms: [], rawMessage: question,
    }, { maxChunks: 10, maxChars: 3400 });
    // Le chunk le mieux classé ne peut jamais figurer dans les exclus.
    const topId = after.selected[0]?.chunk.id;
    expect(topId).toBeTruthy();
    expect(after.excluded.map((e) => e.chunkId)).not.toContain(topId);
  });
});
