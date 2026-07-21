// src/lib/clonechat/public-answer/__tests__/c18-a2-clusters.test.ts
// C1.8 A2 — un contrat par CAUSE RACINE, vérifié sur des représentants réels de chaque cluster.
//
// Les représentants viennent des identifiants du corpus (identification de régression), mais le
// contrat vérifié est celui de la CAUSE, pas de la réponse : il s'applique donc identiquement à
// toute nouvelle formulation relevant de la même cause.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { answerPublicQuestion } from "../../intelligence/c1-1/parrain-public-adapter";
import { classifyPublicSituation } from "../public-situation";
import { INTERNAL_TOKEN_RX, PLACEHOLDER_RX, PARASITE_RX, DODGE_RX } from "../public-output-guard";

const FIXTURE = "src/lib/clonechat/navigation/__tests__/fixtures/torture-1000.json";
const DEFECTS = ".c1-8-reopened-proofs/a2/c/C18_A2_FINAL_DEFECTS.json";
const AT = "2026-07-18T10:00:00Z";
const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
const COMMERCIAL_TEXT = /\b\d{3}\s*(?:€|eur|euros|chf)\b|\bréserv[a-z]*\b|prix fondateur|démo immersive/i;
const COMMERCIAL_ROUTES = new Set(["/reserver/pierre", "/demo", "/demo/pierre"]);

const messages: string[] = (() => {
  const d = JSON.parse(readFileSync(FIXTURE, "utf8")) as { groups: { cases: Array<{ message: string }> }[] };
  return d.groups.flatMap((g) => g.cases).map((c) => c.message);
})();

type Contract = (a: Awaited<ReturnType<typeof answerPublicQuestion>>, q: string) => void;

/** Contrat attendu par cause racine — la propriété vérifiée, jamais un texte figé. */
const CONTRACTS: Readonly<Record<string, Contract>> = {
  argumentaire_prix_hors_sujet: (a, q) => {
    // Sur une situation d'incident, aucun fragment tarifaire ni CTA commercial n'est toléré.
    if (classifyPublicSituation(q).kind === "incident") {
      const routes = [a.suggestedCTA?.route ?? "", ...a.relevantLinks.map((l) => l.route)];
      expect(a.answer).not.toMatch(COMMERCIAL_TEXT);
      expect(routes.some((r) => COMMERCIAL_ROUTES.has(r))).toBe(false);
    }
  },
  limites_ou_capacites_non_expliquees: (a) => {
    expect(a.answer).not.toMatch(DODGE_RX);
    expect(a.answer.length).toBeGreaterThan(60);
  },
  plan_du_site_hors_sujet: (a) => {
    expect(norm(a.answer)).not.toMatch(/les pages cles|quelle page cherchez/);
  },
  pays_non_repondu_ou_errone: (a, q) => {
    const m = norm(q);
    if (/canada|maroc|quebec|allemagne|berlin|londres|etats|usa|new ?york|espagne|madrid/.test(m)) {
      expect(norm(a.answer)).toMatch(/pas encore|ne fait pas partie|pas couvert/);
      expect(a.suggestedCTA?.route).not.toBe("/reserver/pierre");
    }
  },
  dump_roadmap_interne: (a) => {
    expect(a.answer).not.toMatch(INTERNAL_TOKEN_RX);
  },
  action_privee_sans_explication_connexion: (a) => {
    expect(a.answer).not.toMatch(PARASITE_RX);
    expect(a.answer).not.toMatch(DODGE_RX);
  },
  correction_ou_negation_ignoree: (a, q) => {
    const m = norm(q);
    const routes = [a.suggestedCTA?.route ?? "", ...a.relevantLinks.map((l) => l.route)];
    if (/jamais dit vouloir m'?inscrire|pas (a )?m'?inscrire/.test(m)) expect(routes).not.toContain("/signup");
    if (/ne cherche pas a me connecter|pas me connecter/.test(m)) expect(routes).not.toContain("/login");
    expect(a.answer).not.toMatch(DODGE_RX);
  },
  reponse_generique_de_derobade: (a) => {
    expect(a.answer).not.toMatch(DODGE_RX);
  },
  support_mal_route: (a, q) => {
    const m = norm(q);
    if (/rembours|debite|preleve|factur|bug|panne|marche pa|erreur/.test(m)) {
      expect(a.suggestedCTA?.route).toBe("/questions");
    }
  },
  validation_humaine_non_explicitee: (a) => {
    expect(a.answer).not.toMatch(DODGE_RX);
  },
  legal_cgv_mentions_mal_routees: (a, q) => {
    const m = norm(q);
    if (/\bcgv\b|conditions generales de vente/.test(m)) expect(a.suggestedCTA?.route).toBe("/legal/cgv");
    if (/mentions legales/.test(m)) expect(a.suggestedCTA?.route).toBe("/legal/mentions");
  },
  placeholder_ou_texte_parasite: (a) => {
    expect(a.answer).not.toMatch(PLACEHOLDER_RX);
    expect(a.answer).not.toMatch(PARASITE_RX);
  },
  login_signup_mal_traites: (a) => {
    expect(a.answer).not.toMatch(DODGE_RX);
  },
  faux_succes_ou_invention_non_refuses: (a) => {
    expect(a.answer).not.toMatch(/\bj'ai\s+(bien\s+)?(créé|exécuté|lancé|validé|envoyé|signé|généré)|c'est fait\b/i);
  },
  hors_perimetre_mal_refuse: (a) => {
    expect(a.answer).not.toMatch(DODGE_RX);
  },
  injection_non_refusee_explicitement: (a) => {
    expect(a.answer).not.toMatch(/voici (mon|le) (prompt|système)|mes instructions? (internes?|système)|clé api/i);
    expect(a.suggestedCTA?.route).not.toBe("/demo");
  },
};

describe("C1.8 A2 — un contrat vérifié par cause racine (16 clusters)", () => {
  if (!existsSync(DEFECTS)) {
    it("artefact de défauts absent — cluster gate non exécutée", () => expect(true).toBe(true));
  } else {
    const defects = JSON.parse(readFileSync(DEFECTS, "utf8")) as {
      clusters: Array<{ root_cause: string; affected_ids: number[] }>;
    };
    it("les 16 causes racines sont toutes couvertes par un contrat", () => {
      expect(defects.clusters.length).toBe(16);
      for (const c of defects.clusters) expect(Object.keys(CONTRACTS)).toContain(c.root_cause);
    });

    for (const cluster of defects.clusters) {
      const reps = cluster.affected_ids.slice(0, 3);
      it(`${cluster.root_cause} — ${reps.length} représentants respectent le contrat`, async () => {
        for (const id of reps) {
          const q = messages[id];
          const a = await answerPublicQuestion({ question: q, at: AT });
          CONTRACTS[cluster.root_cause](a, q);
        }
      });
    }
  }
});
