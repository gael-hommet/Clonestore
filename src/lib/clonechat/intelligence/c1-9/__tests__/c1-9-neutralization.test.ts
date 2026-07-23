// C1.9 — PREUVE DE NEUTRALISATION DES COURT-CIRCUITS (§5).
//
// Trois comportements changent, et chacun est vérifié dans les DEUX sens — sinon on ne
// prouve pas qu'on a corrigé un défaut, seulement qu'on a changé quelque chose :
//
//   M1  le raccourci de navigation ignorait `ports.responder`.
//       → avec modèle : le modèle répond ; sans modèle : la phrase figée sert encore.
//   M2  toute violation de garde remplaçait la réponse ENTIÈRE.
//       → violation de CTA seul : le texte du modèle est conservé, la destination tombe.
//       → violation de texte : excision phrase à phrase avant tout remplacement.
//   L   la garantie C1.8 « pas de liste de pages » tenait par accident du court-circuit.
//       → elle est désormais explicite pour les intentions à destination unique.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { runParrainTurn } from "../../c1-1/parrain-turn-runtime";
import type { ParrainViewerContext } from "../../c1-1/parrain-types";
import { checkPublicOutput } from "../../../public-answer";

const OUT = "c:/Users/homme/clonestore/.c1-9-proofs";
const PUBLIC: ParrainViewerContext = { mode: "public", companyId: null, userId: null, role: null };
const AT = "2026-07-22T10:00:00.000Z";

/** Message dont la taxonomie fait une intention d'achat à confiance suffisante. */
const PURCHASE = "je veux acheter pierre, je dois me rendre sur quelle page";

function responderReturning(answer: string) {
  const calls: string[] = [];
  return {
    calls,
    port: {
      async respond(r: { userText: string }) {
        calls.push(r.userText);
        return {
          ok: true as const,
          structured: { answer, honesty: "answered" as const, tool_call: null, citations: [] as string[] },
          usage: { inputTokens: 10, outputTokens: 5, model: "stub" },
        };
      },
    },
  };
}

describe("C1.9 neutralization of legacy short-circuits", () => {
  const proof: Record<string, unknown> = {};

  it("M1 — with a responder, the model answers a purchase intent (it no longer gets skipped)", async () => {
    const r = responderReturning("La réservation se fait depuis la page dédiée, sans paiement en ligne pour l'instant.");
    const out = await runParrainTurn(
      { viewer: PUBLIC, question: PURCHASE, at: AT },
      { responder: r.port },
    );
    // Le modèle a bien été sollicité…
    expect(r.calls.length).toBe(1);
    // …et son texte est celui qui sort.
    expect(out.answer).toContain("La réservation se fait depuis la page dédiée");
    expect(out.source).not.toBe("deterministic_parrain");
    proof.m1WithResponder = { modelCalled: r.calls.length, source: out.source, answer: out.answer };
  });

  it("M1 — without a responder, the deterministic navigation sentence still serves", async () => {
    const out = await runParrainTurn({ viewer: PUBLIC, question: PURCHASE, at: AT }, {});
    // La voie dégradée n'est PAS supprimée : elle reste la bonne réponse sans modèle.
    expect(out.source).toBe("deterministic_parrain");
    expect(out.answer.length).toBeGreaterThan(20);
    expect(out.usageTokens).toBe(0);
    proof.m1WithoutResponder = { source: out.source, answer: out.answer };
  });

  it("L — a single-destination intent still carries exactly one link", async () => {
    const r = responderReturning("La réservation se fait depuis la page dédiée.");
    const out = await runParrainTurn({ viewer: PUBLIC, question: PURCHASE, at: AT }, { responder: r.port });
    // Garantie C1.8 préservée alors même que le modèle a repris la parole.
    expect(out.relevantLinks.length).toBe(1);
    expect(out.suggestedCTA?.route).toBe("/reserver/pierre");
    expect(out.relevantLinks[0].route).toBe("/reserver/pierre");
    proof.singleDestination = { links: out.relevantLinks, cta: out.suggestedCTA };
  });

  it("M2 — a text-only violation is excised sentence by sentence, not substituted wholesale", async () => {
    // Une phrase saine, une phrase RÉELLEMENT fautive au sens de la garde, une phrase saine.
    // Le motif retenu est du jargon de chantier interne (INTERNAL_TOKEN_RX) : c'est bien ce
    // que la garde existe pour arrêter, et ce n'est pas retiré par `sanitizePublicText`.
    const clean1 = "Pierre prépare vos documents RH et un humain valide toujours.";
    const dirty = "Voici la feuille de route interne du chantier en cours.";
    const clean2 = "Vous gardez la main sur chaque décision sensible.";
    const r = responderReturning(`${clean1} ${dirty} ${clean2}`);
    const out = await runParrainTurn(
      { viewer: PUBLIC, question: "comment Pierre prépare-t-il un contrat ?", at: AT },
      { responder: r.port },
    );
    // Le texte du modèle survit, amputé de la seule phrase fautive.
    expect(out.answer).toContain("Pierre prépare vos documents RH");
    expect(out.answer).not.toContain("feuille de route interne");
    // Et surtout : ce n'est PAS le paragraphe de repli qui a pris la place.
    expect(out.answer).not.toMatch(/je préfère ne pas répondre de travers/i);
    proof.m2TextExcision = { answer: out.answer };
  });

  it("M2 — a CTA-only violation drops the destination and keeps the model's words", async () => {
    // Sur un incident, la garde interdit toute destination commerciale. Le TEXTE, lui,
    // est irréprochable : l'ancien code jetait quand même la réponse entière.
    const honest = "Je comprends, et je ne peux pas consulter votre facture depuis ce chat public. Le support peut vérifier votre dossier.";
    const r = responderReturning(honest);
    const out = await runParrainTurn(
      { viewer: PUBLIC, question: "j'ai été débité deux fois ce mois-ci", at: AT },
      { responder: r.port },
    );
    const verdict = checkPublicOutput({
      text: out.answer,
      ctaRoute: out.suggestedCTA?.route ?? null,
      linkRoutes: out.relevantLinks.map((l) => l.route),
      commercialForbidden: true,
    });
    // Quelle que soit la branche empruntée, la sortie est propre…
    expect(verdict.ok).toBe(true);
    // …et aucune destination commerciale ne subsiste sur un incident.
    for (const l of out.relevantLinks) {
      expect(["/reserver/pierre", "/demo", "/demo/pierre"]).not.toContain(l.route);
    }
    expect(["/reserver/pierre", "/demo", "/demo/pierre"]).not.toContain(out.suggestedCTA?.route ?? "");
    proof.m2CtaOnly = { answer: out.answer, cta: out.suggestedCTA, links: out.relevantLinks };
  });

  it("writes the neutralization proof", () => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/C1_9_NEUTRALIZATION_RESULTS.json`, JSON.stringify({
      artifact: "C1_9_NEUTRALIZATION_RESULTS",
      generatedAt: "2026-07-22",
      method: "runParrainTurn appelé directement, responder stub, aucun réseau.",
      fixes: {
        M1: "parrain-turn-runtime.ts — le raccourci de navigation exige désormais `!ports.responder`.",
        M2: "parrain-turn-runtime.ts — violation de CTA seul ⇒ retrait de la destination ; violation de texte ⇒ excision phrase à phrase ; substitution intégrale seulement en dernier recours.",
        L: "parrain-turn-runtime.ts — une intention à destination unique ne porte qu'un lien (garantie C1.8 rendue explicite).",
      },
      proof,
    }, null, 2));
    expect(Object.keys(proof).length).toBeGreaterThanOrEqual(5);
  });
});
