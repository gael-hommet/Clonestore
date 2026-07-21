// src/lib/clonechat/response/__tests__/canonical.test.ts
// C1.8 BLOC A — chaque source de la route converge vers UNE forme visible.

import { describe, it, expect } from "vitest";
import { buildRenderedResponse } from "../canonical";

const care = (over: Record<string, unknown> = {}) => ({
  diagnosis: { status: "unknown", area: "unknown", reason: "…", confidence: "unknown", evidence: [], escalation_required: false },
  blockers: [], actions: [], human_required: false, ...over,
});

describe("C1.8 BLOC A — toute source produit une réponse VISIBLE", () => {
  it("texte public : la réponse traverse telle quelle", () => {
    const r = buildRenderedResponse({
      ok: true, source: "openai_public",
      structured: { answer: "Je suis CloneChat.", honesty: "answered", citations: ["la présentation"] },
    }, care());
    expect(r.answer).toBe("Je suis CloneChat.");
    expect(r.honesty).toBe("answered");
    expect(r.retryable_error).toBeNull();
    expect(r.citations.map((c) => c.label)).toContain("la présentation");
  });

  // ═══ LE DÉFAUT CORRIGÉ ═══
  it("VISION : `analysis` devient une VRAIE réponse (elle n'était rendue par aucun champ visible)", () => {
    const r = buildRenderedResponse({
      ok: true, source: "openai_vision",
      analysis: {
        summary: "L'écran montre la page de réservation.",
        visibly_proven: ["bouton « Réserver »", "prix 449 €"],
        inference: ["vous êtes à l'étape 2"],
        unknown: ["l'état de votre compte"],
        next_action: "Cliquer sur « Réserver ».",
      },
      imagesSentToProvider: 1,
    }, care());

    expect(r.answer).toContain("page de réservation");
    expect(r.answer).toContain("Ce que je vois");
    expect(r.answer).toContain("bouton « Réserver »");
    // Les hypothèses sont NOMMÉES comme telles — jamais présentées comme des faits.
    expect(r.answer).toContain("Hypothèses (à confirmer)");
    expect(r.answer).toContain("Ce que l'image ne montre pas");
    expect(r.honesty).toBe("answered");
    expect(r.images_sent_to_provider).toBe(1);
  });

  it("un problème connu ENRICHIT la réponse ; il ne la remplace pas", () => {
    const r = buildRenderedResponse({
      ok: true, source: "openai_vision",
      analysis: { summary: "Erreur affichée.", visibly_proven: [], inference: [], unknown: [] },
      knownIssue: { title: "Le paiement en ligne n'est pas ouvert", workaround: "La réservation se fait sans paiement." },
    }, care());
    expect(r.answer).toContain("Erreur affichée.");
    expect(r.answer).toContain("Problème connu");
    expect(r.answer).toContain("sans paiement");
  });

  it("refus, repli, image indisponible, blocage : tous restent VISIBLES", () => {
    for (const [source, answer] of [
      ["refused", "Je ne peux pas suivre cette instruction."],
      ["public_fallback", "Voici ce que je sais."],
      ["image_unavailable", "Je ne peux pas traiter cette image."],
      ["rate_limited", "Trop de demandes, réessayez."],
    ] as const) {
      const r = buildRenderedResponse({ ok: true, source, structured: { answer, honesty: "answered" } }, care());
      expect(r.answer).toBe(answer);
      expect(r.source).toBe(source);
      expect(r.retryable_error).toBeNull();
    }
  });
});

describe("C1.8 BLOC A — un assemblage partiel n'est JAMAIS une réponse terminée", () => {
  it("une réponse VIDE échoue de façon visible et rejouable", () => {
    const r = buildRenderedResponse({ ok: true, source: "openai_public", structured: { answer: "   ", honesty: "answered" } }, care());
    expect(r.retryable_error).toBe("empty_answer");
    expect(r.honesty).toBe("unknown");           // surtout PAS « answered »
    expect(r.answer.length).toBeGreaterThan(20); // l'utilisateur voit une phrase utile
    expect(r.answer).toMatch(/Réessayez/i);
  });

  it("aucun champ `structured` ET aucune `analysis` ⇒ échec visible, jamais un faux succès", () => {
    const r = buildRenderedResponse({ ok: true, source: "openai_vision" }, care());
    expect(r.retryable_error).toBe("empty_answer");
    expect(r.honesty).not.toBe("answered");
  });

  it("une erreur de la route est portée telle quelle", () => {
    const r = buildRenderedResponse({ ok: false, source: "error", error: "CloneChat n'est pas disponible." }, care());
    expect(r.retryable_error).toBe("CloneChat n'est pas disponible.");
  });

  it("une honnêteté INCONNUE ne devient jamais « répondu »", () => {
    const r = buildRenderedResponse({ ok: true, source: "x", structured: { answer: "…", honesty: "n'importe quoi" } }, care());
    expect(r.honesty).toBe("unknown");
  });
});

describe("C1.8 BLOC A — liens, escalade, blocage, pièces jointes", () => {
  it("les liens sont VALIDÉS par le registre ; une route inventée est écartée", () => {
    const r = buildRenderedResponse({
      ok: true, source: "openai_public",
      structured: { answer: "Voici." },
      suggestedCTA: { route: "/reserver/pierre", label: "Réserver Pierre" },
      relevantLinks: [{ route: "/route-inventee", label: "Piège" }, { route: "javascript:alert(1)", label: "Hostile" }],
    }, care());
    expect(r.links.map((l) => l.href)).toEqual(["/reserver/pierre"]);
    expect(r.links[0].label).toBe("Réserver Pierre");
  });

  it("l'escalade CloneCare devient une honnêteté `escalated`", () => {
    const r = buildRenderedResponse(
      { ok: true, source: "openai_public", structured: { answer: "Je transmets.", honesty: "answered" } },
      care({ human_required: true }),
    );
    expect(r.honesty).toBe("escalated");
    expect(r.human_required).toBe(true);
  });

  it("un blocage PROUVÉ devient `blocked`, et sa limite est dite À CÔTÉ de la réponse", () => {
    const r = buildRenderedResponse(
      { ok: true, source: "openai_public", structured: { answer: "Voici ce que je peux dire.", honesty: "answered" } },
      care({
        diagnosis: { status: "blocked", area: "employee_access", reason: "x", confidence: "certain", evidence: [], escalation_required: false },
        blockers: [{ code: "pierre_not_active", title: "Pierre n'est pas activé", message: "Pierre n'est pas activé.", next_step_label: "Activer Pierre", next_step_href: "/reserver/pierre" }],
      }),
    );
    expect(r.honesty).toBe("blocked");
    expect(r.answer).toBe("Voici ce que je peux dire."); // la réponse RESTE la réponse
    expect(r.limitation).toContain("Pierre n'est pas activé");
    expect(r.links.map((l) => l.href)).toContain("/reserver/pierre");
  });

  it("« analysé » n'est vrai que si le fichier a RÉELLEMENT produit des extraits", () => {
    const r = buildRenderedResponse({
      ok: true, source: "openai_public", structured: { answer: "ok" },
      attachments: [
        { name: "contrat.pdf", state: "analysed", detail: "3 extraits" },
        { name: "photo.png", state: "unsupported_analysis", detail: "format non analysable" },
      ],
    }, care());
    const [pdf, png] = r.attachments;
    expect(pdf).toMatchObject({ kind: "document", analysed: true });
    expect(pdf.provider_evidence).toBe("3 extraits");
    expect(png).toMatchObject({ kind: "image", analysed: false });
    expect(png.provider_evidence).toBeNull(); // aucune preuve ⇒ aucune affirmation
  });
});
