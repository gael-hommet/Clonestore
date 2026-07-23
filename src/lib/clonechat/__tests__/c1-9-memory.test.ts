// C1.9 — MÉMOIRE CONVERSATIONNELLE (artefact d'audit). Aucun appel réseau.
// Question : l'historique atteint-il réellement le modèle, et le SYSTÈME en tient-il compte
// (récupération, faits retenus, résolution des pronoms) — ou n'est-il qu'un tableau transporté ?
import { describe, it } from "vitest";
import { writeFileSync } from "fs";
import { answerPublicQuestion } from "@/lib/clonechat/intelligence/c1-1/parrain-public-adapter";

type PublicInput = Parameters<typeof answerPublicQuestion>[0];

const HISTORY = [
  { role: "user" as const, text: "On est une PME de 22 personnes, deux personnes s'occupent des RH." },
  { role: "assistant" as const, text: "Merci, c'est utile pour dimensionner." },
  { role: "user" as const, text: "Elles y passent chacune environ deux jours par semaine." },
  { role: "assistant" as const, text: "Compris." },
];

// Le tour courant est ELLIPTIQUE : il n'a de sens qu'avec l'historique.
const FOLLOW_UP = "Et avec ce que je viens de te dire, tu l'estimes à combien ?";

describe("C1.9 memory — does prior context actually reach and shape the turn", () => {
  it("compares the model payload with and without history", async () => {
    const at = new Date("2026-07-22T10:00:00.000Z").toISOString();
    const capture: Record<string, { system: string; userText: string; historyReceived: unknown }> = {};

    const run = async (label: string, history: typeof HISTORY) => {
      const responder = {
        async respond(r: { model: string; system: string; userText: string; maxOutputTokens: number; history?: unknown }) {
          capture[label] = { system: r.system ?? "", userText: r.userText ?? "", historyReceived: r.history ?? null };
          return {
            ok: true as const,
            structured: { answer: "__MODEL__", honesty: "answered" as const, tool_call: null, citations: [] as string[] },
            usage: { model: r.model, inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 },
          };
        },
      };
      await answerPublicQuestion({
        question: FOLLOW_UP, history, responder, model: "probe-model",
        maxOutputTokens: 500, attachments: [], imageDataUrls: [], at,
      } as unknown as PublicInput);
    };

    await run("withHistory", HISTORY);
    await run("withoutHistory", []);

    const w = capture.withHistory, wo = capture.withoutHistory;
    const mentions = (s: string, needle: string) => s.toLowerCase().includes(needle.toLowerCase());

    const verdict = {
      generatedAt: at,
      followUpQuestion: FOLLOW_UP,
      historyTurnsSupplied: HISTORY.length,
      // Le port responder reçoit-il l'historique ?
      historyForwardedToResponder: w?.historyReceived !== null && w?.historyReceived !== undefined,
      historyForwardedValue: w?.historyReceived ?? null,
      // Le prompt système change-t-il selon l'historique ? (=> la RÉCUPÉRATION en tient-elle compte)
      systemPromptIdentical: (w?.system ?? "") === (wo?.system ?? ""),
      systemCharsWithHistory: w?.system.length ?? 0,
      systemCharsWithoutHistory: wo?.system.length ?? 0,
      // Les faits énoncés dans l'historique apparaissent-ils dans ce que voit le modèle ?
      systemMentions22: mentions(w?.system ?? "", "22"),
      systemMentionsDeuxJours: mentions(w?.system ?? "", "deux jours"),
      userTextSent: w?.userText ?? null,
      userTextIsOnlyCurrentTurn: (w?.userText ?? "") === FOLLOW_UP,
      systemPromptHeadWith: (w?.system ?? "").slice(0, 200),
    };

    writeFileSync("c:/Users/homme/clonestore/.c1-9-proofs/_probe_memory.json", JSON.stringify(verdict, null, 2));
    console.log(JSON.stringify(verdict, null, 2));
  }, 120_000);
});
