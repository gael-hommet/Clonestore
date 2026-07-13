// src/lib/clonechat/openai/__tests__/streaming-c1-7.test.ts
// C1.7 §8/§14.F — STREAMING RÉEL.
//
// Le danger propre au streaming : diffuser du texte NON GARDÉ. CloneChat applique la garde de
// claims C1 (aucune revendication « live » non prouvée). Si on poussait les jetons bruts, une
// phrase interdite serait affichée AVANT d'être corrigée. La porte à phrases l'empêche.

import { describe, it, expect } from "vitest";
import {
  createSentenceGate, createJsonStringFieldExtractor,
  encodeStreamEvent, classifyProviderFailure,
} from "../streaming";

const IDENTITY = (t: string) => t;

describe("C1.7 — porte à phrases : rien n'est diffusé avant d'être gardé", () => {
  it("ne libère une phrase que lorsqu'elle est COMPLÈTE", () => {
    const g = createSentenceGate(IDENTITY);
    expect(g.push("Pierre prépare ")).toEqual([]);   // phrase incomplète → rien
    expect(g.push("vos contrats")).toEqual([]);      // toujours incomplète
    // L'espace de fin appartient à la phrase libérée : le reliquat n'en porte donc pas.
    expect(g.push(". Il ne signe")).toEqual(["Pierre prépare vos contrats. "]);
    expect(g.flush()).toEqual(["Il ne signe"]);      // le reliquat sort à la fin
  });

  it("APPLIQUE la garde avant diffusion (une revendication interdite ne s'affiche jamais)", () => {
    // Garde simulée fidèle au contrat : elle neutralise une revendication non prouvée.
    const guard = (t: string) => t.replace(/le paiement en ligne est ouvert/gi, "le paiement en ligne n'est pas ouvert");
    const g = createSentenceGate(guard);
    const out = g.push("Bonne nouvelle : le paiement en ligne est ouvert. ");
    expect(out.join("")).toContain("n'est pas ouvert");
    expect(out.join("")).not.toMatch(/: le paiement en ligne est ouvert/);
  });

  it("une phrase entièrement supprimée par la garde n'est pas diffusée du tout", () => {
    const g = createSentenceGate(() => "");
    expect(g.push("Revendication interdite. ")).toEqual([]);
  });

  it("le texte brut complet reste disponible pour la validation finale", () => {
    const g = createSentenceGate(IDENTITY);
    g.push("Une phrase. ");
    g.push("Deux.");
    expect(g.raw()).toBe("Une phrase. Deux.");
  });
});

describe("C1.7 — extraction progressive du champ `answer` d'un flux JSON", () => {
  it("ne restitue QUE la prose de `answer`, jamais le JSON alentour", () => {
    const x = createJsonStringFieldExtractor("answer");
    let out = "";
    for (const chunk of ['{"honesty":"answered",', ' "answer": "Pierre est un ', 'employé IA RH.", ', '"citations": ["a"]}']) {
      out += x.push(chunk);
    }
    expect(out).toBe("Pierre est un employé IA RH.");
    expect(out).not.toContain("citations");
    expect(out).not.toContain("{");
  });

  it("fonctionne quand la clé est coupée entre deux morceaux réseau", () => {
    const x = createJsonStringFieldExtractor("answer");
    let out = "";
    for (const chunk of ['{"ans', 'wer": "Bonjour', ' !"}']) out += x.push(chunk);
    expect(out).toBe("Bonjour !");
  });

  it("déséchappe les guillemets et les sauts de ligne", () => {
    const x = createJsonStringFieldExtractor("answer");
    const out = x.push('{"answer": "Il dit \\"oui\\".\\nPuis part."}');
    expect(out).toBe('Il dit "oui".\nPuis part.');
  });

  it("s'arrête à la fin de la valeur (le reste du JSON n'est jamais diffusé)", () => {
    const x = createJsonStringFieldExtractor("answer");
    x.push('{"answer": "Fini."');
    expect(x.done()).toBe(true);
    expect(x.push(', "citations": ["secret"]}')).toBe("");
  });
});

describe("C1.7 §4D — les pannes sont DISTINGUÉES, jamais transformées en succès", () => {
  it("timeout ≠ rate limit ≠ erreur provider", () => {
    expect(classifyProviderFailure({ name: "AbortError" }).code).toBe("TIMEOUT");
    expect(classifyProviderFailure({ status: 429 }).code).toBe("RATE_LIMITED");
    expect(classifyProviderFailure({ message: "ETIMEDOUT" }).code).toBe("TIMEOUT");
    expect(classifyProviderFailure(new Error("boom")).code).toBe("PROVIDER_ERROR");
  });

  it("aucun message d'échec ne prétend qu'une réponse a été produite", () => {
    for (const e of [{ name: "AbortError" }, { status: 429 }, new Error("boom")]) {
      const f = classifyProviderFailure(e);
      expect(f.message).not.toMatch(/terminé|complété|réussi/i);
    }
  });
});

describe("C1.7 — encodage SSE : une annulation reste une annulation", () => {
  it("les événements sont typés et sérialisables", () => {
    expect(encodeStreamEvent({ type: "delta", text: "a" })).toMatch(/^event: delta\ndata: /);
    const cancelled = encodeStreamEvent({ type: "cancelled", reason: "Réponse interrompue." });
    expect(cancelled).toMatch(/^event: cancelled/);
    // Un flux annulé ne doit JAMAIS être encodé comme « done ».
    expect(cancelled).not.toContain("done");
  });

  it("`done` transporte la réponse FINALE validée (source de vérité du client)", () => {
    const e = encodeStreamEvent({ type: "done", payload: { structured: { answer: "final validé" } } });
    expect(e).toContain("final validé");
  });
});
