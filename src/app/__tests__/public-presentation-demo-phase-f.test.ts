// PHASE F §14 — invariants NOUVEAUX de l'expérience publique (complète golive05/06/07).
// Tests ciblés et maintenables : différenciation employé IA, intégrité funnel,
// sécurité explicite de la démo, cohérence du prix, absence de fausses promesses.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const home = read("src/app/page.tsx");
const pierre = read("src/app/agents/pierre/page.tsx");
const demo = read("src/app/demo/pierre/page.tsx");
const reserver = read("src/app/reserver/pierre/page.tsx");
const priceSrc = read("src/lib/demo/presentation/commercial-state.ts");

describe("Phase F — homepage (différenciation + prix + funnel)", () => {
  it("porte le message central employé IA vs assistant", () => {
    expect(home).toMatch(/assistant/i);
    expect(home).toMatch(/prend le travail/i);
    expect(home).toMatch(/employé IA RH/);
  });
  it("affiche le prix 449 et renvoie vers la démo ET la réservation", () => {
    expect(home).toMatch(/449/);
    expect(home).toContain("/demo/pierre");
    expect(home).toContain("/reserver/pierre");
  });
});

describe("Phase F — démo réellement sûre", () => {
  it("affiche la phrase de sécurité explicite + disclaimers", () => {
    expect(demo).toContain("Démonstration sécurisée — aucune action réelle envoyée");
    expect(demo).toMatch(/données fictives/i);
    expect(demo).toMatch(/aucun appel ia/i);
    expect(demo).toMatch(/validation humaine/i);
  });
  it("n'effectue aucun effet de bord réel (pas d'import Supabase/Stripe/Resend/fetch)", () => {
    expect(demo).not.toMatch(/from\s+["']@supabase/);
    expect(demo).not.toMatch(/new\s+Stripe\s*\(/);
    expect(demo).not.toMatch(/from\s+["']resend["']/);
    expect(demo).not.toMatch(/\bfetch\s*\(/);
  });
  it("couvre les trois piliers : mission, garde-fous (CloneGuard), trace (CloneTrace)", () => {
    expect(demo).toMatch(/CloneGuard/);
    expect(demo).toMatch(/CloneTrace/);
    expect(demo).toMatch(/validation humaine/i);
  });
});

describe("Phase F — prix : source de vérité unique", () => {
  it("la constante prix vaut 449 € HT et est reprise par la réservation", () => {
    expect(priceSrc).toMatch(/FOUNDER_PRICE\s*=\s*"449 € HT"/);
    expect(reserver).toMatch(/FOUNDER_PRICE_MONTHLY|449/);
  });
});

describe("Phase F — aucune fausse promesse sur les pages publiques", () => {
  const FALSE_PROMISES = [
    /zéro erreur/i, /conformité garantie/i, /remplace (?:un |votre )?avocat(?! ni| pas)/i,
    /DSN autonome/i, /paie officielle/i, /licenciement automatique/i, /7 jours gratuits/i,
  ];
  for (const [name, content] of Object.entries({ home, pierre, demo, reserver })) {
    it(`${name} ne contient aucune fausse promesse`, () => {
      for (const re of FALSE_PROMISES) expect(content, re.source).not.toMatch(re);
    });
  }
});
