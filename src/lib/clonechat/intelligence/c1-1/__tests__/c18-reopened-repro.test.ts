// C1.8 REOUVERT — REPRODUCTION du défaut « acheter Pierre », mesurée sur le CHEMIN HÉRITÉ INTACT
// (routeCloneChatQuestion → linksFor), c.-à-d. EXACTEMENT la logique qui produisait le défaut, SANS
// le court-circuit de navigation. Ce test DÉMONTRE le défaut (ce n'est pas une assertion de succès) :
// le routeur historique n'a AUCUNE catégorie d'achat, donc les formulations d'ACHAT tombent en
// site_navigation / default / pricing / sales_objection et le CTA hérité n'est PAS /reserver/pierre.
// En regard, la NOUVELLE taxonomie (resolveNavigationIntent) les résout toutes vers /reserver/pierre.
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { routeCloneChatQuestion } from "../../c1/clonechat-answer-router";
import { linksFor } from "../parrain-turn-runtime";
import { resolveNavigationIntent } from "../../../navigation/intent-taxonomy";

const PURCHASE = [
  "je veux acheter pierre, je dois me rendre sur quelle page",
  "je veux acheter Pierre", "je veux prendre Pierre", "je veux commander Pierre",
  "comment avoir Pierre", "comment obtenir Pierre", "où acheter Pierre", "où payer Pierre",
  "je veux Pierre pour ma société", "comment m'abonner à Pierre", "je souhaite souscrire",
  "où est la page pour prendre Pierre", "quelle page pour acheter Pierre", "je peux acheter Pierre où",
  "c'est où pour Pierre", "j'le prends où Pierre", "jveux pierre", "acheter pierre",
  "prendre pierre maintenant", "je veux acquérir pierre", "comment activer pierre", "où souscrire à pierre",
];

describe("C1.8 REOUVERT — reproduction du défaut achat Pierre (chemin HÉRITÉ)", () => {
  it("le CTA HÉRITÉ échoue, la NOUVELLE taxonomie réussit — preuve écrite", () => {
    const rows: Array<Record<string, unknown>> = [];
    for (const q of PURCHASE) {
      const routed = routeCloneChatQuestion(q, "visitor");
      const legacy = linksFor(routed.category, q);                       // CTA hérité, chemin d'origine
      const nav = resolveNavigationIntent(q, { mode: "visitor", hasActiveCompany: false, country: null });
      rows.push({
        message: q,
        legacy_category: routed.category,
        legacy_cta: legacy.cta?.route ?? null,
        legacy_points_to_reserver: legacy.cta?.route === "/reserver/pierre",
        new_intent: nav.intent,
        new_route: nav.route,
        new_points_to_reserver: nav.route === "/reserver/pierre",
      });
    }
    const legacyOk = rows.filter((r) => r.legacy_points_to_reserver).length;
    const newOk = rows.filter((r) => r.new_points_to_reserver).length;
    mkdirSync(".c1-8-reopened-proofs", { recursive: true });
    writeFileSync(".c1-8-reopened-proofs/C18_PURCHASE_PIERRE_BEFORE_PROOF.json", JSON.stringify({
      note: "Chemin HÉRITÉ (routeCloneChatQuestion + linksFor) vs NOUVELLE taxonomie (resolveNavigationIntent).",
      total: rows.length, legacy_cta_reserver_correct: legacyOk, new_cta_reserver_correct: newOk, rows,
    }, null, 2));
    // eslint-disable-next-line no-console
    console.log(`\n  ▸ ACHAT PIERRE — HÉRITÉ : ${legacyOk}/${rows.length} vers /reserver/pierre | NOUVELLE taxonomie : ${newOk}/${rows.length}`);
    // Le défaut EST là : le chemin hérité manque la quasi-totalité ; la nouvelle taxonomie corrige.
    expect(legacyOk).toBeLessThanOrEqual(2);        // reproduction du défaut (chemin hérité inopérant)
    expect(newOk).toBeGreaterThanOrEqual(21);       // correction quasi complète (1 formulation VRAIMENT ambiguë)
    // CAS DE RÉFÉRENCE EXACT : le chemin hérité renvoyait le SUPPORT (le parasite observé) ; la
    // nouvelle taxonomie renvoie /reserver/pierre. C'est le cœur du défaut, prouvé au niveau routeur.
    const ref = rows[0] as { legacy_category: string; legacy_cta: string | null; legacy_points_to_reserver: boolean; new_points_to_reserver: boolean };
    expect(ref.legacy_points_to_reserver).toBe(false);
    expect(ref.legacy_cta).toBe("/questions");      // Support — exactement le CTA parasite rapporté
    expect(ref.new_points_to_reserver).toBe(true);
  });
});
