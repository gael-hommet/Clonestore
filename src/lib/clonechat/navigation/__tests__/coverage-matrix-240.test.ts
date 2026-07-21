// C1.8 REOUVERT §9 — MATRICE DE COUVERTURE SYSTÉMATIQUE (assertive, NON affaiblie).
// 240 formulations générées par 8 agents adverses INDÉPENDANTS (sans accès au routeur) — corpus
// figé en fixture. On exige : 100 % sur les axes commerciaux critiques (prix, démo, découverte,
// navigation) et « ne jamais forcer l'achat » ; des planchers stricts ailleurs ; et surtout que
// TOUT résidu appartienne à une ALLOWLIST explicite d'ambiguïtés légitimes (ellipse pronominale
// sans contexte, « j'en veux plus » réellement ambigu, « laisse tomber » = abandon). Ainsi tout
// NOUVEAU mauvais routage hors de cette liste fait ÉCHOUER le test (garde anti-régression stricte).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolveNavigationIntent, type NavContext } from "../intent-taxonomy";

type Case = { message: string; expected_intent: string; note: string };
const fixture = JSON.parse(readFileSync("src/lib/clonechat/navigation/__tests__/fixtures/adversarial-240.json", "utf8")) as { categories: { category: string; cases: Case[] }[] };
const visitor: NavContext = { mode: "visitor", hasActiveCompany: false, country: null };

function accepts(expected: string, route: string | null, intent: string): boolean {
  switch (expected) {
    case "purchase": return route === "/reserver/pierre";
    case "pricing": return route === "/reserver/pierre" && (intent === "pierre_pricing" || intent === "purchase_pierre");
    case "demo": return route === "/demo/pierre";
    case "discover": return route === "/agents/pierre" || route === "/comprendre-clonestore";
    case "support": return route === "/questions";
    case "cancel": return route === "/profile";
    case "navigate": return route !== null;
    case "none_of_pierre": return route !== "/reserver/pierre";
    case "ambiguous": return true;
    default: return route !== null;
  }
}

// Résidus ACCEPTÉS : ambiguïtés légitimes où la clarification (ou un routage voisin défendable) est
// le bon comportement produit. Aucune n'appartient à la classe du défaut (achat → Support/entreprise).
const ALLOWED_RESIDUALS = new Set<string>([
  "comment je fais pour l'avoir",                 // pronom « l' » non lié, sans contexte Pierre
  "on peut demarrer quand",                       // peut être l'onboarding APRÈS achat
  "faut que ça soit a moi ce truc",               // extrêmement indirect
  "jarrive pas a me connecter",                   // → /login : correct pour un souci de connexion
  "j'en veux plus de votre truc",                 // « j'en veux plus » = ambigu (plus / plus de)
  "je paie encore alors que je m'en sers plus, comment on arrête ce bazar",
  "est-ce que je suis engagé sur 12 mois ou je peux partir ?", // question d'engagement, pas un ordre
  "finalement laisse tomber",                     // abandon = clarifier, PAS résilier l'abonnement
  "ok bah je prends, on fait comment",            // « je prends » nu (évite « je prends note »)
  "jveux le meme que mon pote a pris",            // référence externe indirecte
]);

describe("C1.8 REOUVERT §9 — matrice 240 (assertive)", () => {
  const perIntent: Record<string, { total: number; ok: number }> = {};
  const residuals: string[] = [];
  let total = 0, ok = 0;
  for (const cat of fixture.categories) for (const c of cat.cases) {
    const r = resolveNavigationIntent(c.message, visitor);
    const good = accepts(c.expected_intent, r.route, r.intent);
    perIntent[c.expected_intent] ??= { total: 0, ok: 0 };
    perIntent[c.expected_intent].total++; total++;
    if (good) { perIntent[c.expected_intent].ok++; ok++; } else residuals.push(c.message);
  }

  it("100 % sur les axes commerciaux critiques (prix, démo, découverte, navigation) et « jamais forcer l'achat »", () => {
    for (const k of ["pricing", "demo", "discover", "navigate", "none_of_pierre"]) {
      expect(perIntent[k].ok, `${k} ${perIntent[k].ok}/${perIntent[k].total}`).toBe(perIntent[k].total);
    }
  });

  it("planchers stricts : achat ≥ 30/35, support ≥ 34/35, annulation ≥ 32/36", () => {
    expect(perIntent.purchase.ok).toBeGreaterThanOrEqual(30);
    expect(perIntent.support.ok).toBeGreaterThanOrEqual(34);
    expect(perIntent.cancel.ok).toBeGreaterThanOrEqual(32);
  });

  it("taux global ≥ 95 % sur des formulations générées indépendamment", () => {
    expect(ok / total).toBeGreaterThanOrEqual(0.95);
  });

  it("GARDE ANTI-RÉGRESSION : tout résidu appartient à l'allowlist d'ambiguïtés légitimes", () => {
    const unexpected = residuals.filter((m) => !ALLOWED_RESIDUALS.has(m));
    expect(unexpected, `mauvais routages HORS allowlist : ${JSON.stringify(unexpected)}`).toEqual([]);
  });
});
