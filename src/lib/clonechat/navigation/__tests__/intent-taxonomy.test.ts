// src/lib/clonechat/navigation/__tests__/intent-taxonomy.test.ts
// C1.8 REOUVERT §8 — MATRICE ACHAT / PRIX / DÉMO / INFORMATION + intégrité du registre.

import { describe, it, expect } from "vitest";
import { resolveNavigationIntent, type NavContext } from "../intent-taxonomy";
import { DESTINATIONS, isRealDestinationRoute } from "../destination-registry";
import { getRouteEntry } from "@/lib/nav/route-registry";

const visitor: NavContext = { mode: "visitor", hasActiveCompany: false, country: null };
const clientNoCompany: NavContext = { mode: "client", hasActiveCompany: false, country: null };
const clientWithCompany: NavContext = { mode: "client", hasActiveCompany: true, country: "FR" };

describe("C1.8 REOUVERT — intégrité du registre (aucune route inventée)", () => {
  it("chaque destination et chaque CTA pointent vers une route RÉELLE", () => {
    for (const d of DESTINATIONS) {
      expect(isRealDestinationRoute(d.route), `${d.id} route ${d.route}`).toBe(true);
      expect(isRealDestinationRoute(d.cta.route), `${d.id} cta ${d.cta.route}`).toBe(true);
    }
  });
  it("les routes commerciales clés sont dans le registre canonique (CTA rendables)", () => {
    for (const r of ["/reserver/pierre", "/agents/pierre", "/demo", "/demo/pierre", "/questions"]) {
      expect(getRouteEntry(r), r).not.toBeNull();
    }
  });
});

// ═══ MATRICE ACHAT — 22 formulations doivent TOUTES pointer /reserver/pierre ═══
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

describe("C1.8 REOUVERT — TOUTE intention d'achat → /reserver/pierre (le défaut bloquant)", () => {
  for (const q of PURCHASE) {
    it(`« ${q} » → /reserver/pierre, sans clarification ni Support`, () => {
      const r = resolveNavigationIntent(q, clientNoCompany);
      expect(r.intent === "purchase_pierre" || r.intent === "reserve_pierre", `intent=${r.intent}`).toBe(true);
      expect(r.clarification_required).toBe(false);
      expect(r.route).toBe("/reserver/pierre");
      expect(r.cta?.route).toBe("/reserver/pierre");
      expect(r.cta?.label).toMatch(/réserver pierre/i);
      expect(r.context_mode).toBe("commercial");
      // Une question commerciale n'exige JAMAIS une entreprise, même connecté sans entreprise.
      expect(r.company_required).toBe(false);
    });
  }

  it("le CAS DE RÉFÉRENCE EXACT est vert dans les 3 contextes", () => {
    for (const ctx of [visitor, clientNoCompany, clientWithCompany]) {
      const r = resolveNavigationIntent("je veux acheter pierre, je dois me rendre sur quelle page", ctx);
      expect(r.route).toBe("/reserver/pierre");
      expect(r.cta?.route).toBe("/reserver/pierre");
      expect(r.clarification_required).toBe(false);
      expect(r.context_mode).toBe("commercial");
      expect(r.company_required).toBe(false);
    }
  });
});

describe("C1.8 REOUVERT — distinctions : prix ≠ démo ≠ découverte ≠ support ≠ annulation", () => {
  const cases: Array<[string, string, string | null]> = [
    ["combien coûte Pierre ?", "pierre_pricing", "/reserver/pierre"],
    ["quel est le prix de Pierre", "pierre_pricing", "/reserver/pierre"],
    ["montre-moi la démo Pierre", "request_pierre_demo", "/demo/pierre"],
    ["je veux voir Pierre en action", "request_pierre_demo", "/demo/pierre"],
    ["peut-on essayer Pierre ?", "request_pierre_demo", "/demo/pierre"],
    ["c'est quoi Pierre", "discover_pierre", "/agents/pierre"],
    ["qui est Pierre ?", "discover_pierre", "/agents/pierre"],
    ["je veux seulement comprendre Pierre", "discover_pierre", "/agents/pierre"],
    ["je veux parler au support à propos de Pierre", "support_request", "/questions"],
    ["je veux annuler Pierre", "cancellation_question", "/profile"],
    ["je veux résilier mon abonnement", "cancellation_question", "/profile"],
    ["quels sont vos pays disponibles", "country_availability", null],
    ["comment devenir partenaire", "partner_program", "/founding-partners"],
    ["je veux me connecter", "login_help", "/login"],
    ["comment créer un compte", "signup_help", "/signup"],
    ["où est votre politique de confidentialité", "privacy_information", "/legal/confidentialite"],
    // C1.8 A2 — ATTENTE CORRIGÉE : servir les CGU à qui demande les CGV est un défaut avéré
    // (cluster `legal_cgv_mentions_mal_routees` de l'audit A2) : ce sont deux documents
    // contractuels différents, et /legal/cgv existe. L'ancienne attente encodait le bug.
    ["où sont les CGV", "legal_information", "/legal/cgv"],
    ["où sont les mentions légales", "legal_information", "/legal/mentions"],
  ];
  for (const [q, intent, route] of cases) {
    it(`« ${q} » → ${intent}`, () => {
      const r = resolveNavigationIntent(q, visitor);
      expect(r.intent, `got ${r.intent}`).toBe(intent);
      if (route) expect(r.route).toBe(route);
      expect(r.clarification_required).toBe(false);
    });
  }

  it("NÉGATION : « je ne veux pas acheter Pierre, seulement voir la démo » ⇒ démo, aucun CTA achat", () => {
    const r = resolveNavigationIntent("je ne veux pas acheter Pierre, seulement voir la démo", visitor);
    expect(r.route).toBe("/demo/pierre");
    expect(r.cta?.route).not.toBe("/reserver/pierre");
  });

  it("NÉGATION simple : « je ne veux pas acheter Pierre » ⇒ découverte, jamais réservation forcée", () => {
    const r = resolveNavigationIntent("je ne veux pas acheter Pierre", visitor);
    expect(r.route).not.toBe("/reserver/pierre");
    expect(r.intent).toBe("discover_pierre");
  });

  it("ne transforme PAS tout message contenant « Pierre » en réservation", () => {
    const r = resolveNavigationIntent("Pierre est-il capable de gérer la paie ?", visitor);
    expect(r.route).not.toBe("/reserver/pierre");
  });
});

describe("C1.8 REOUVERT — multi-tour : ellipse d'achat", () => {
  it("« combien coûte Pierre ? » puis « et pour l'acheter ? » ⇒ /reserver/pierre", () => {
    const hist = [{ role: "user" as const, text: "combien coûte Pierre ?" }, { role: "assistant" as const, text: "Pierre coûte 449 € …" }];
    const r = resolveNavigationIntent("et pour l'acheter ?", visitor, hist);
    expect(r.route).toBe("/reserver/pierre");
    expect(r.clarification_required).toBe(false);
  });

  it("« et pour l'acheter ? » SANS contexte Pierre ⇒ pas de réservation aveugle", () => {
    const r = resolveNavigationIntent("et pour l'acheter ?", visitor, []);
    expect(r.route).not.toBe("/reserver/pierre");
  });

  it("correction : « je veux acheter Pierre » puis « non, seulement la démo » ⇒ démo", () => {
    const r = resolveNavigationIntent("non, seulement voir la démo", visitor, [{ role: "user", text: "je veux acheter Pierre" }]);
    expect(r.route).toBe("/demo/pierre");
  });
});
