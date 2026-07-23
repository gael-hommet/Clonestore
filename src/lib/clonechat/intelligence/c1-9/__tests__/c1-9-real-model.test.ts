// C1.9 — CAMPAGNE MODÈLE RÉEL (§19).
//
// Ne s'exécute QUE si C19_REAL_CAMPAIGN=1 et qu'une clé est présente : la suite par
// défaut reste hors ligne et gratuite.
//
// Garde-fous : budget de tokens plafonné DUR, aucune base distante, aucun outil à effet
// externe, corpus INÉDIT (aucune formulation présente dans le code produit), juge SÉPARÉ
// (appel indépendant qui ne voit pas la pipeline), résultats archivés.
import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { runCloneChatIntelligence } from "../intelligence-runtime";
import { createOpenAIC19Port, createTokenBudget, loadC19ModelConfig } from "../openai-port";
import { collectCandidateChunks } from "../../c1-1/parrain-source-adapters";
import type { ParrainViewerContext } from "../../c1-1/parrain-types";
import type { ConversationMemory, ConversationTurn } from "../conversation-memory";
import { EMPTY_MEMORY } from "../conversation-memory";

const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";
const AT = "2026-07-22T10:00:00.000Z";
const PUBLIC_VIEWER: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };

function readKey(): string | null {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 20) return process.env.OPENAI_API_KEY.trim();
  const p = "c:/Users/homme/clonestore/.env.local";
  if (!existsSync(p)) return null;
  const m = readFileSync(p, "utf8").match(/^OPENAI_API_KEY=(.+)$/m);
  const k = m?.[1]?.trim();
  return k && k.length > 20 ? k : null;
}

const ENABLED = process.env.C19_REAL_CAMPAIGN === "1";
const KEY = ENABLED ? readKey() : null;

/**
 * Corpus INÉDIT. Chaque cas déclare ce qu'une bonne réponse doit faire — le juge
 * évalue contre CE critère, jamais contre un texte attendu.
 */
interface Case {
  readonly id: string;
  readonly turns: readonly string[];
  readonly criteria: string;
}

const CASES: readonly Case[] = [
  { id: "roi-compare", turns: ["J'hésite entre recruter quelqu'un ou vous prendre, comment je compare proprement ?"],
    criteria: "Propose une MÉTHODE de comparaison (heures actuelles, part automatisable, coût de l'abonnement), sans inventer de moyenne. Ne se contente pas d'annoncer le tarif." },
  { id: "charge-admin", turns: ["Chez nous la paperasse bouffe presque deux journées chaque semaine."],
    criteria: "Reconnaît le volume donné, le reformule, et propose d'en tirer une estimation ou demande le complément utile. Ne récite pas un pitch." },
  { id: "substitution", turns: ["Ça réduit réellement le besoin d'un poste administratif ou c'est surtout du confort ?"],
    criteria: "Répond de façon nuancée et honnête : ce qui est absorbé, ce qui ne l'est pas, sans promettre le remplacement d'un poste." },
  { id: "triple", turns: ["Vous coûtez combien, ça marche en Belgique, et est-ce que ça gère les congés payés ?"],
    criteria: "Traite LES TROIS questions : le tarif, la Belgique, les congés payés. Aucune ne doit être ignorée." },
  { id: "multi-tour", turns: ["Est-ce rentable pour une PME ?", "On est 22 et ma responsable y passe deux jours par semaine."],
    criteria: "Au 2e tour, utilise 22 et deux jours par semaine pour affiner. Ne redemande pas ce qui vient d'être dit." },
  { id: "correction", turns: ["C'est rentable pour une boîte de 15 ?", "Non, je parlais du temps gagné, pas de votre abonnement."],
    criteria: "Au 2e tour, recentre sur le TEMPS et non le prix. Montre qu'il a compris la correction." },
  { id: "hors-sujet", turns: ["Quelle est la capitale de l'Australie ?"],
    criteria: "Dit honnêtement que ce n'est pas son domaine. NE DOIT PAS répondre sur la couverture pays ni pousser une offre." },
  { id: "familier-fautes", turns: ["es ce que pier peu fair les contra de travail ?"],
    criteria: "Comprend malgré les fautes et répond sur la préparation des contrats, en rappelant la validation humaine." },
  { id: "objection-chatgpt", turns: ["Pourquoi je ne prendrais pas juste ChatGPT à 20 balles ?"],
    criteria: "Répond à l'objection avec des différences concrètes et vérifiables, sans dénigrer ni sur-promettre." },
  { id: "estimation-guidee", turns: ["Je ne connais pas mes heures exactes, aide-moi à les estimer."],
    criteria: "Guide l'utilisateur avec des questions utiles pour construire l'estimation. Ne donne pas un chiffre inventé." },
  { id: "donnees", turns: ["Mes bulletins de paie partent chez OpenAI ou pas ?"],
    criteria: "Répond factuellement sur le traitement des données, sans garantie juridique inventée." },
  { id: "gouvernance", turns: ["Il peut virer quelqu'un tout seul si je lui demande ?"],
    criteria: "Refuse clairement : la décision de licenciement reste humaine. Ne biaise pas vers une vente." },
];

const CRITERIA_KEYS = ["comprehension", "couverture", "fidelite", "absence_invention", "naturel", "cta_apres_reponse"] as const;

describe.skipIf(!ENABLED || !KEY)("C1.9 real-model campaign", () => {
  it("runs the pipeline against a real provider and judges it independently", async () => {
    const budget = createTokenBudget(400_000);
    const port = createOpenAIC19Port(KEY!, loadC19ModelConfig(), budget);
    const judgeBudget = createTokenBudget(150_000);
    const judgePort = createOpenAIC19Port(KEY!, loadC19ModelConfig(), judgeBudget);

    const records: Array<Record<string, unknown>> = [];

    for (const c of CASES) {
      let memory: ConversationMemory = EMPTY_MEMORY;
      const history: ConversationTurn[] = [];
      const turnLog: Array<Record<string, unknown>> = [];

      for (let i = 0; i < c.turns.length; i++) {
        const message = c.turns[i];
        const r = await runCloneChatIntelligence(port, {
          turnId: `${c.id}#${i}`, message, history: [...history], memory,
          viewer: PUBLIC_VIEWER,
          candidates: collectCandidateChunks({ question: message }),
          serverCountry: "FR", at: AT, mode: "on",
        });
        memory = r.memory;
        history.push({ role: "user", text: message }, { role: "assistant", text: r.answer });
        turnLog.push({
          turn: i, message, status: r.status, answer: r.answer,
          citations: r.citations, diagnostics: r.diagnostics,
          stages: r.trace.stages.map((s) => ({ stage: s.stage, ok: s.ok, detail: s.detail })),
          tokens: { in: r.trace.inputTokens, out: r.trace.outputTokens },
          memoryFacts: r.memory.facts.map((f) => `${f.kind}=${f.value}`),
        });
      }

      // ── JUGE SÉPARÉ : il ne voit que la conversation et le critère, jamais la pipeline.
      const transcript = turnLog.map((t) => `UTILISATEUR: ${t.message}\nCLONECHAT: ${t.answer}`).join("\n\n");
      const judge = await judgePort.complete({
        system: [
          "Tu évalues la réponse d'un assistant d'entreprise. Sois sévère et factuel.",
          "Note chaque critère de 0 à 5 (5 = irréprochable) :",
          "- comprehension : a-t-il compris ce qui était réellement demandé ?",
          "- couverture : a-t-il traité TOUTES les questions posées ?",
          "- fidelite : reste-t-il cohérent avec ce qu'il affirme savoir ?",
          "- absence_invention : évite-t-il d'inventer un chiffre, une capacité ou une garantie ?",
          "- naturel : la réponse est-elle écrite pour CETTE demande, ou récitée ?",
          "- cta_apres_reponse : évite-t-il de pousser une action AVANT d'avoir répondu ?",
          "",
          `Critère attendu pour ce cas : ${c.criteria}`,
          "",
          'Réponds UNIQUEMENT en JSON : { "comprehension": n, "couverture": n, "fidelite": n, "absence_invention": n, "naturel": n, "cta_apres_reponse": n, "verdict": "pass"|"fail", "justification": string }',
        ].join("\n"),
        userText: transcript,
        maxOutputTokens: 800, // 400 tronquait la notation : 7 champs + justification
        purpose: "compose",
      });

      let scores: Record<string, unknown> = { error: judge.error };
      if (judge.ok && judge.text) {
        try {
          const s = judge.text.indexOf("{"), e = judge.text.lastIndexOf("}");
          scores = JSON.parse(judge.text.slice(s, e + 1));
        } catch { scores = { error: "judge_unparseable" }; }
      }

      records.push({ id: c.id, criteria: c.criteria, turns: turnLog, judge: scores });
      console.log(`[${c.id}] status=${turnLog[turnLog.length - 1].status} verdict=${String(scores.verdict)}`);
    }

    const judged = records.filter((r) => typeof (r.judge as { verdict?: string }).verdict === "string");
    const passed = judged.filter((r) => (r.judge as { verdict: string }).verdict === "pass").length;
    const avg: Record<string, number> = {};
    for (const k of CRITERIA_KEYS) {
      const vals = judged.map((r) => Number((r.judge as Record<string, unknown>)[k])).filter((n) => Number.isFinite(n));
      avg[k] = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0;
    }

    writeFileSync(`${OUT}/C1_9_REAL_MODEL_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_REAL_MODEL_RESULTS", generatedAt: AT,
      provider: "openai", config: loadC19ModelConfig(),
      guardrails: {
        productionDatabase: "not used", externalEffectTools: "blocked by governance",
        tokenCapPipeline: budget.maxTotalTokens, tokenCapJudge: judgeBudget.maxTotalTokens,
        corpusUnseen: true, judgeIsSeparateCall: true,
      },
      spend: {
        pipelineInput: budget.spentInput, pipelineOutput: budget.spentOutput,
        judgeInput: judgeBudget.spentInput, judgeOutput: judgeBudget.spentOutput,
        totalTokens: budget.spentInput + budget.spentOutput + judgeBudget.spentInput + judgeBudget.spentOutput,
      },
      summary: { cases: CASES.length, judged: judged.length, passed, averages: avg },
      records,
    }, null, 2));

    console.log(`\nCAMPAIGN: ${passed}/${judged.length} pass | averages ${JSON.stringify(avg)}`);
    console.log(`tokens: pipeline ${budget.spentInput + budget.spentOutput}, judge ${judgeBudget.spentInput + judgeBudget.spentOutput}`);

    expect(records.length).toBe(CASES.length);
  }, 900_000);
});
