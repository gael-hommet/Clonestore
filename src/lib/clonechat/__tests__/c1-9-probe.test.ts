// C1.9 — PROBE (temporaire, artefact d'audit). Boîte noire sur le moteur public RÉEL.
// A) SANS responder : voie « provider absent ». Mesure la diversité des réponses.
// B) AVEC un responder INSTRUMENTÉ (aucun appel réseau, aucun coût) : mesure si le modèle
//    est RÉELLEMENT sollicité, ou si une voie déterministe court-circuite avant lui.
import { describe, it } from "vitest";
import { writeFileSync } from "fs";
import { answerPublicQuestion } from "@/lib/clonechat/intelligence/c1-1/parrain-public-adapter";

type PublicInput = Parameters<typeof answerPublicQuestion>[0];

// Formulations INÉDITES (aucune ne doit exister littéralement dans le code produit).
const PROBES: Array<{ id: string; q: string; expect: string }> = [
  { id: "roi-recrutement", q: "J'hésite entre recruter quelqu'un ou vous prendre, comment je compare proprement ?", expect: "comparaison coût interne vs abonnement" },
  { id: "paperasse-volume", q: "Chez nous la paperasse bouffe presque deux journées chaque semaine.", expect: "reconnaître un volume et proposer une estimation" },
  { id: "poste-admin", q: "Ça réduit réellement le besoin d'un poste administratif ou c'est surtout du confort ?", expect: "réponse nuancée sur la substitution de poste" },
  { id: "equipe-20", q: "Pour une équipe de vingt personnes, je récupère quoi concrètement ?", expect: "bénéfice concret dimensionné à 20 salariés" },
  { id: "suite-estimation", q: "Et avec ce que je viens de te dire, tu l'estimes à combien ?", expect: "utiliser le contexte précédent" },
  { id: "correction", q: "Non, je parlais du temps gagné, pas de votre abonnement.", expect: "corriger la cible de la réponse" },
  { id: "rappel-exemple", q: "On revient à mon exemple avec les deux personnes RH.", expect: "reprendre le fil" },
  { id: "aide-estimer", q: "Je ne connais pas mes heures exactes, aide-moi à les estimer.", expect: "poser une clarification / guider un calcul" },
  { id: "multi-intent", q: "Vous coûtez combien, ça marche en Belgique, et est-ce que ça gère les congés payés ?", expect: "TROIS réponses distinctes" },
  { id: "familier", q: "franchement c'est rentable ou pas pour une boite de 15 ?", expect: "estimation dimensionnée" },
  { id: "faute", q: "es ce que pier peu fair les contra de travail ?", expect: "comprendre malgré les fautes" },
  { id: "hors-sujet", q: "Quelle est la capitale de l'Australie ?", expect: "honnêteté / hors périmètre, pas un pitch commercial" },
];

const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";

describe("C1.9 probe — dictionary detection on the real public engine", () => {
  it("A) deterministic lane: measures answer diversity for unseen paraphrases", async () => {
    const at = new Date("2026-07-22T10:00:00.000Z").toISOString();
    const out: Array<Record<string, unknown>> = [];

    for (const p of PROBES) {
      try {
        const r = await answerPublicQuestion({ question: p.q, at } as PublicInput);
        out.push({
          id: p.id, question: p.q, expectation: p.expect,
          answer: r.answer, answerLength: r.answer?.length ?? 0, honesty: r.honesty,
          source: (r as { source?: string }).source ?? null,
          citations: r.citations ?? [],
          suggestedCTA: (r as { suggestedCTA?: unknown }).suggestedCTA ?? null,
        });
      } catch (e) {
        out.push({ id: p.id, question: p.q, expectation: p.expect, error: String(e) });
      }
    }

    const answers = out.map((o) => String(o.answer ?? "")).filter(Boolean);
    const distinct = new Set(answers);
    const prefixes = new Map<string, string[]>();
    for (const o of out) {
      const a = String(o.answer ?? "");
      if (!a) continue;
      prefixes.set(a, [...(prefixes.get(a) ?? []), String(o.id)]);
    }
    const sharedGroups = [...prefixes.entries()].filter(([, ids]) => ids.length > 1)
      .map(([text, ids]) => ({ ids, chars: text.length, head: text.slice(0, 100) }));

    writeFileSync(`${OUT}/_probe_deterministic.json`, JSON.stringify({
      generatedAt: at, probeCount: PROBES.length, answersProduced: answers.length,
      distinctAnswers: distinct.size, distinctRatio: answers.length ? distinct.size / answers.length : 0,
      sharedGroups, results: out,
    }, null, 2));
    console.log(`A) ${answers.length} answers → ${distinct.size} distinct (${(distinct.size / answers.length * 100).toFixed(0)}%)`);
  }, 120_000);

  it("B) instrumented responder: measures whether the model is actually reached", async () => {
    const at = new Date("2026-07-22T10:00:00.000Z").toISOString();
    const records: Array<Record<string, unknown>> = [];

    for (const p of PROBES) {
      const calls: Array<{ model: string; systemChars: number; userText: string; systemHead: string }> = [];
      // Responder INSTRUMENTÉ : n'appelle RIEN, enregistre juste qu'on l'a sollicité.
      const responder = {
        async respond(r: { model: string; system: string; userText: string; maxOutputTokens: number }) {
          calls.push({
            model: r.model, systemChars: (r.system ?? "").length,
            userText: r.userText, systemHead: (r.system ?? "").slice(0, 400),
          });
          return {
            ok: true as const,
            structured: {
              answer: "__MODEL_WAS_REACHED__",
              honesty: "answered" as const,
              tool_call: null,
              citations: [] as string[],
            },
            usage: { model: r.model, inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 },
          };
        },
      };

      try {
        const r = await answerPublicQuestion({
          question: p.q, history: [], responder, model: "probe-model",
          maxOutputTokens: 500, attachments: [], imageDataUrls: [], at,
        } as unknown as PublicInput);
        records.push({
          id: p.id, question: p.q,
          modelCalled: calls.length > 0,
          callCount: calls.length,
          modelTextSurvived: String(r.answer ?? "").includes("__MODEL_WAS_REACHED__"),
          answer: r.answer, answerLength: r.answer?.length ?? 0,
          honesty: r.honesty, source: (r as { source?: string }).source ?? null,
          systemPromptChars: calls[0]?.systemChars ?? 0,
          userTextSentToModel: calls[0]?.userText ?? null,
          systemPromptHead: calls[0]?.systemHead ?? null,
        });
      } catch (e) {
        records.push({ id: p.id, question: p.q, error: String(e), modelCalled: calls.length > 0 });
      }
    }

    const reached = records.filter((r) => r.modelCalled).length;
    const survived = records.filter((r) => r.modelTextSurvived).length;
    writeFileSync(`${OUT}/_probe_instrumented.json`, JSON.stringify({
      generatedAt: at, probeCount: PROBES.length,
      modelReachedCount: reached, modelTextSurvivedCount: survived, records,
    }, null, 2));

    console.log(`B) model reached ${reached}/${PROBES.length}; model text survived to user ${survived}/${PROBES.length}`);
    for (const r of records) {
      console.log(`  [${r.id}] called=${r.modelCalled} survived=${r.modelTextSurvived} src=${r.source} len=${r.answerLength}`);
    }
  }, 120_000);
});
