// C1.9 — GARDE DE CLAIMS EN STREAMING (artefact d'audit). Aucun appel réseau.
// Hypothèse à vérifier : route.ts:392 applique finalizeAnswerText PHRASE PAR PHRASE.
// Si une seule phrase déclenche une règle, elle est remplacée par SAFE_REFUSAL_TEXT
// (4 phrases) EN PLEIN MILIEU du flux — le lecteur voit une réponse cohérente
// interrompue par un pavé canné, puis reprendre.
import { describe, it } from "vitest";
import { writeFileSync } from "fs";
import { createSentenceGate } from "@/lib/clonechat/openai/streaming";
import { finalizeAnswerText } from "@/lib/clonechat/intelligence/c1-1/parrain-answer-schema";

describe("C1.9 stream guard — per-sentence substitution", () => {
  it("shows what a user actually reads when one mid-stream sentence trips a rule", () => {
    // Une réponse plausible d'un modèle : elle NIE correctement une capacité,
    // mais la phrase contient le motif interdit.
    const modelAnswer =
      "Bonne question. " +
      "Pierre prépare vos contrats et vos avenants, puis un humain valide. " +
      "En revanche le paiement en ligne est ouvert uniquement une fois la vérification faite. " +
      "Pour une équipe de vingt personnes, cela représente plusieurs heures par semaine. " +
      "Voulez-vous que nous estimions cela ensemble ?";

    // Simule l'arrivée du texte en petits morceaux, comme un vrai flux SSE.
    const gate = createSentenceGate((t) => finalizeAnswerText(t).safeText);
    const emitted: string[] = [];
    const CHUNK = 17;
    for (let i = 0; i < modelAnswer.length; i += CHUNK) {
      for (const s of gate.push(modelAnswer.slice(i, i + CHUNK))) emitted.push(s);
    }
    for (const s of gate.flush()) emitted.push(s);

    const streamed = emitted.join("");
    const whole = finalizeAnswerText(modelAnswer).safeText;

    const REFUSAL_HEAD = "Je préfère ne pas affirmer cela";
    const result = {
      generatedAt: "2026-07-22",
      modelAnswerChars: modelAnswer.length,
      sentencesEmitted: emitted.length,
      streamedChars: streamed.length,
      // Le flux contient-il le pavé de refus ?
      streamContainsRefusal: streamed.includes(REFUSAL_HEAD),
      // Combien de fois ? (une par phrase fautive)
      refusalOccurrencesInStream: streamed.split(REFUSAL_HEAD).length - 1,
      // Le texte complet, gardé EN UNE FOIS, donne-t-il le même résultat ?
      wholeTextContainsRefusal: whole.includes(REFUSAL_HEAD),
      wholeTextChars: whole.length,
      // DIVERGENCE : streaming et non-streaming ne produisent pas la même réponse.
      streamAndWholeDiverge: streamed !== whole,
      // Le flux garde-t-il des phrases légitimes APRÈS le refus ? (incohérence visible)
      survivingSentencesAfterRefusal: streamed.includes("Voulez-vous que nous estimions"),
      emittedSentences: emitted,
      streamedText: streamed,
      wholeGuardedText: whole,
    };

    writeFileSync("c:/Users/homme/clonestore/.c1-9-proofs/_probe_streamguard.json", JSON.stringify(result, null, 2));
    console.log(`stream contains refusal: ${result.streamContainsRefusal} (x${result.refusalOccurrencesInStream})`);
    console.log(`whole-text guard contains refusal: ${result.wholeTextContainsRefusal}`);
    console.log(`stream vs whole DIVERGE: ${result.streamAndWholeDiverge}`);
    console.log(`legitimate sentences survive after refusal: ${result.survivingSentencesAfterRefusal}`);
    console.log("--- what the user reads ---");
    console.log(streamed);
  }, 60_000);
});
