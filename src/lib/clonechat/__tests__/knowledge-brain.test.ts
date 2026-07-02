import { describe, it, expect } from "vitest";
import {
  knowledgeChunks,
  retrieveKnowledge,
  retrieveWithBudget,
  buildGroundedSystemPrompt,
  validateCitations,
  computeCoverage,
  knowledgeSnapshot,
  diffKnowledge,
  REQUIRED_CATEGORIES,
} from "../knowledge";

describe("P9.4.1 knowledge — grounded on real canonical sources", () => {
  it("dérive les chunks des vraies sources (Pierre, prix 449, technologies, routes)", () => {
    const chunks = knowledgeChunks();
    const text = chunks.map((c) => c.text).join(" ");
    expect(chunks.length).toBeGreaterThan(25);
    expect(text).toContain("449"); // prix issu de commercial-state, jamais inventé
    expect(chunks.some((c) => c.id === "employee.pierre")).toBe(true);
    expect(chunks.some((c) => c.category === "technologies")).toBe(true);
    expect(chunks.some((c) => c.routes?.includes("/agents/pierre/use"))).toBe(true);
  });

  it("chaque chunk porte source/version/fraîcheur/hash", () => {
    for (const c of knowledgeChunks()) {
      expect(c.authority.length).toBeGreaterThan(0);
      expect(c.contentHash).toMatch(/^fnv1a_/);
      expect(["CURRENT", "STALE", "UNKNOWN"]).toContain(c.freshnessStatus);
    }
  });

  it("HONNÊTETÉ : ne présente jamais Clara/Emma/… comme employés disponibles", () => {
    const text = knowledgeChunks().map((c) => c.text).join(" ").toLowerCase();
    // Pierre est le seul nommé actif ; les autres ne doivent pas apparaître comme employés dispo
    expect(text).not.toContain("clara");
    expect(text).not.toContain("emma est");
  });

  it("HONNÊTETÉ : les capacités HUMAN_ONLY ne sont jamais surfacées textuellement", () => {
    const text = knowledgeChunks().map((c) => c.text).join(" ").toLowerCase();
    expect(text).not.toContain("whistleblower");
  });
});

describe("P9.4.1 knowledge — visibilité bornée (4 niveaux)", () => {
  it("le public ne voit jamais authenticated/internal/restricted", () => {
    const pub = retrieveKnowledge("cockpit missions validations documents", "public", 50);
    expect(pub.every((c) => c.visibility === "PUBLIC")).toBe(true);
  });
  it("le client connecté voit public + authenticated, jamais internal/restricted", () => {
    const auth = retrieveKnowledge("cockpit permissions", "authenticated", 50);
    expect(auth.every((c) => c.visibility === "PUBLIC" || c.visibility === "AUTHENTICATED_CLIENT")).toBe(true);
    expect(auth.some((c) => c.visibility === "INTERNAL_CLONESTORE" || c.visibility === "RESTRICTED")).toBe(false);
  });
});

describe("P9.4.1 knowledge — récupération, budget, citations", () => {
  it("priorise une route exacte", () => {
    const got = retrieveKnowledge("où est le cockpit /agents/pierre/use", "authenticated", 4);
    expect(got[0].routes?.includes("/agents/pierre/use")).toBe(true);
  });
  it("retrieveWithBudget borne la taille du contexte", () => {
    const got = retrieveWithBudget("explique pierre technologies prix routes cockpit", "authenticated", { limit: 6, maxChars: 600 });
    const chars = got.reduce((s, c) => s + c.text.length, 0);
    expect(chars).toBeLessThanOrEqual(600 + Math.max(...got.map((c) => c.text.length)));
  });
  it("valide les citations : supprime les inconnues, garde les présentes", () => {
    const ctx = retrieveKnowledge("qu'est-ce que pierre", "public", 5);
    const someId = ctx[0].id;
    const v = validateCitations([someId, "totally.invented.id"], ctx);
    expect(v.valid).toContain(someId);
    expect(v.malformed).toContain("totally.invented.id");
    expect(v.labels.length).toBeGreaterThan(0);
  });
});

describe("P9.4.1 knowledge — coverage gate + invalidation", () => {
  it("couvre TOUTES les catégories obligatoires", () => {
    const cov = computeCoverage();
    expect(cov.missingCategories).toEqual([]);
    expect(cov.complete).toBe(true);
    for (const cat of REQUIRED_CATEGORIES) {
      expect(cov.categories.find((c) => c.category === cat)!.indexedSources).toBeGreaterThan(0);
    }
  });
  it("un snapshot identique ne produit aucun diff", () => {
    const d = diffKnowledge(knowledgeSnapshot());
    expect(d.changed).toHaveLength(0);
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
  });
});

describe("P9.4.1 knowledge — prompt grounded", () => {
  it("public : borné, interdit l'invention, expose des citations", () => {
    const { system, contextChunks } = buildGroundedSystemPrompt("public", "qu'est-ce que pierre et combien ça coûte");
    expect(system).toMatch(/UNIQUEMENT/);
    expect(system).toMatch(/n'invente jamais un prix|N'invente JAMAIS/i);
    expect(contextChunks.length).toBeGreaterThan(0);
  });
  it("connecté : guidance d'outils (prepare_mission, decide_validation)", () => {
    const { system } = buildGroundedSystemPrompt("authenticated", "prépare un contrat");
    expect(system).toMatch(/prepare_mission/);
    expect(system).toMatch(/decide_validation/);
  });
});
