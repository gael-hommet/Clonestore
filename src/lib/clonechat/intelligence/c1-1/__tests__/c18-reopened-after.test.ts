// C1.8 REOUVERT — PREUVE APRÈS correction : le VRAI pipeline (answerPublicQuestion, déterministe)
// route désormais l'achat vers /reserver/pierre, sans Support, sans liste, sans clarification.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { answerPublicQuestion } from "../parrain-public-adapter";

const PURCHASE = [
  "je veux acheter pierre, je dois me rendre sur quelle page",
  "je veux acheter Pierre", "je veux prendre Pierre", "je veux commander Pierre",
  "je veux réserver Pierre", "comment avoir Pierre", "comment obtenir Pierre",
  "où acheter Pierre", "où payer Pierre", "je veux Pierre pour ma société",
  "je veux que Pierre travaille pour nous", "comment m'abonner à Pierre", "je souhaite souscrire à Pierre",
  "où est la page pour prendre Pierre", "quelle page pour acheter Pierre", "je peux acheter Pierre où",
  "j'le prends où Pierre", "jveux pierre", "acheter pierre", "prendre pierre maintenant",
  "je veux acquérir pierre", "comment activer pierre", "où souscrire à pierre",
];

describe("C1.8 REOUVERT — APRÈS : achat Pierre → /reserver/pierre dans le vrai pipeline", () => {
  it("les 22 formulations pointent vers /reserver/pierre, réponse directe", async () => {
    const rows: Array<Record<string, unknown>> = [];
    for (const q of PURCHASE) {
      const a = await answerPublicQuestion({ question: q, at: "2026-07-17T10:00:00Z" });
      const cta = a.suggestedCTA;
      rows.push({
        message: q, source: a.source, cta_route: cta?.route ?? null, cta_label: cta?.label ?? null,
        links: a.relevantLinks.map((l) => l.route),
        answer: a.answer,
        ok: cta?.route === "/reserver/pierre" && /réserver pierre/i.test(a.answer)
          && !/quelle page cherchez/i.test(a.answer) && !/aucune entreprise active/i.test(a.answer)
          && a.relevantLinks.every((l) => l.route !== "/questions"),
      });
    }
    const ok = rows.filter((r) => r.ok).length;
    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_PURCHASE_PIERRE_AFTER_PROOF.json", JSON.stringify({
      note: "APRÈS correction — exécution réelle answerPublicQuestion (chemin déterministe canonique)",
      total: rows.length, ok, rows,
    }, null, 2));
    // eslint-disable-next-line no-console
    console.log(`\n  ▸ APRÈS : ${ok}/${rows.length} → /reserver/pierre (direct, sans Support/liste/entreprise)`);
    for (const r of rows.slice(0, 3)) console.log(`    « ${(r.message as string).slice(0, 40)} » → ${r.cta_route} | ${(r.answer as string).slice(0, 70)}`);
    expect(ok).toBe(rows.length);
  });

  it("CAS DE RÉFÉRENCE : réponse directe, CTA Réserver Pierre, aucun Support/liste/clarification/entreprise", async () => {
    const a = await answerPublicQuestion({ question: "je veux acheter pierre, je dois me rendre sur quelle page", at: "2026-07-17T10:00:00Z" });
    expect(a.answer).toMatch(/Réserver Pierre/i);
    expect(a.suggestedCTA?.route).toBe("/reserver/pierre");
    expect(a.suggestedCTA?.label).toMatch(/Réserver Pierre/i);
    expect(a.answer).not.toMatch(/quelle page cherchez/i);
    expect(a.answer).not.toMatch(/aucune entreprise active/i);
    expect(a.relevantLinks.length).toBeLessThanOrEqual(1);          // pas une liste de pages
    expect(a.relevantLinks.every((l) => l.route !== "/questions")).toBe(true); // aucun Support
    expect(a.needsHumanEscalation).toBe(false);
  });

  it("distinctions préservées dans le pipeline : démo ≠ réservation (CTA ET premier lien rendu)", async () => {
    // Le CLIENT rend `relevantLinks[0]`, pas `suggestedCTA` : on vérifie LES DEUX, sinon le bouton
    // réellement cliqué par l'utilisateur pourrait diverger de la destination canonique.
    const demo = await answerPublicQuestion({ question: "montre-moi la démo Pierre", at: "2026-07-17T10:00:00Z" });
    expect(demo.suggestedCTA?.route).toBe("/demo/pierre");
    expect(demo.relevantLinks[0]?.route).toBe("/demo/pierre");
    const disc = await answerPublicQuestion({ question: "c'est quoi Pierre", at: "2026-07-17T10:00:00Z" });
    expect(disc.suggestedCTA?.route).toBe("/agents/pierre");
    expect(disc.relevantLinks[0]?.route).toBe("/agents/pierre");
    const price = await answerPublicQuestion({ question: "combien coûte Pierre ?", at: "2026-07-17T10:00:00Z" });
    expect(price.suggestedCTA?.route).toBe("/reserver/pierre");
    expect(price.relevantLinks[0]?.route).toBe("/reserver/pierre");
  });
});
