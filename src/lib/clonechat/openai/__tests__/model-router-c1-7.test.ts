// src/lib/clonechat/openai/__tests__/model-router-c1-7.test.ts
// C1.7 §3/§13.B — Le routeur est PUR et DÉTERMINISTE : aucun appel IA pour choisir une IA.
// L'invariant central : LA QUALITÉ EST LIÉE À LA TÂCHE, JAMAIS AU COMPTE.

import { describe, it, expect } from "vitest";
import {
  routeModel, loadModelRouterConfig, isAllowedModel,
  CANONICAL_DEFAULT_MODEL, CANONICAL_COMPLEX_MODEL,
  type ModelRoutingInput,
} from "../model-router";

const LUNA = CANONICAL_DEFAULT_MODEL;   // gpt-5.6-luna
const TERRA = CANONICAL_COMPLEX_MODEL;  // gpt-5.6-terra

describe("C1.7 — Luna est le défaut économique", () => {
  const staysOnLuna: Array<[string, ModelRoutingInput]> = [
    ["question de prix", { message: "Quels sont les prix de Pierre ?" }],
    ["question produit", { message: "C'est quoi CloneStore exactement ?" }],
    ["explication Pierre", { message: "Qu'est-ce que Pierre sait faire aujourd'hui ?" }],
    ["objection", { message: "J'utilise déjà ChatGPT, pourquoi payer Pierre ?" }],
    ["comparaison", { message: "Quelle différence avec un SaaS RH classique ?" }],
    ["question RH normale", { message: "Comment organiser un onboarding ?" }],
    ["image normale", { message: "Que montre cette capture ?", imageCount: 1 }],
    ["PDF court", { message: "Résume ce document.", documentCount: 1, documentChars: 3_000 }],
    ["relance conversationnelle", { message: "Et pour la Suisse ?" }],
  ];

  for (const [label, input] of staysOnLuna) {
    it(`${label} → Luna, sans escalade`, () => {
      const d = routeModel(input);
      expect(d.model).toBe(LUNA);
      expect(d.escalated).toBe(false);
      expect(d.reasons).toEqual([]);
    });
  }

  it("une question factuelle directe ne dépense AUCUN raisonnement caché", () => {
    expect(routeModel({ message: "Quels sont les prix ?" }).reasoning).toBe("none");
    expect(routeModel({ message: "Combien coûte Pierre ?" }).reasoning).toBe("none");
  });

  it("un message LONG ne suffit PAS à dépenser du raisonnement premium ni à escalader", () => {
    const long = "Bonjour, " + "je vous explique longuement mon contexte. ".repeat(30);
    const d = routeModel({ message: long });
    expect(d.model).toBe(LUNA);       // la longueur n'est pas de la complexité
    expect(d.reasoning).toBe("low");  // au plus « low » — jamais « medium »
  });
});

describe("C1.7 — Terra n'est atteint que sur PREUVE de complexité", () => {
  const escalates: Array<[string, ModelRoutingInput, RegExp]> = [
    ["plusieurs documents à comparer", { message: "Compare ces contrats.", documentCount: 4, documentChars: 20_000 }, /comparaison de 4 documents/],
    ["corpus dense", { message: "Que disent ces pièces ?", documentCount: 2, documentChars: 60_000 }, /corpus documentaire dense/],
    ["preuves contradictoires", { message: "Que retenir ?", documentCount: 2, documentChars: 5_000, evidenceConflict: true }, /contradictoires/],
    ["tableur dense", { message: "Analyse ces chiffres.", documentCount: 1, spreadsheetCount: 1, documentChars: 12_000 }, /tableur dense/],
    ["image + document complexe", { message: "Explique.", imageCount: 2, documentCount: 1, documentChars: 4_000 }, /image \+ document/],
    ["analyse stratégique demandée", { message: "Fais-moi une analyse approfondie de ma situation RH." }, /explicitement demandée/],
    ["le défaut se déclare insuffisant", { message: "Synthèse ?", defaultModelDeclaredInsufficient: true }, /preuves insuffisantes/],
  ];

  for (const [label, input, why] of escalates) {
    it(`${label} → Terra, avec preuve`, () => {
      const d = routeModel(input);
      expect(d.model).toBe(TERRA);
      expect(d.escalated).toBe(true);
      expect(d.reasons.join(" | ")).toMatch(why);
      expect(d.reasoning).toBe("medium");
    });
  }

  it("toute escalade est JUSTIFIÉE : jamais de Terra sans raison enregistrée", () => {
    const d = routeModel({ message: "Compare ces contrats.", documentCount: 5, documentChars: 50_000 });
    expect(d.escalated).toBe(true);
    expect(d.reasons.length).toBeGreaterThan(0);
  });
});

describe("C1.7 — LA QUALITÉ EST LIÉE À LA TÂCHE, JAMAIS AU COMPTE (invariant)", () => {
  it("la signature du routeur n'accepte STRUCTURELLEMENT aucun signal d'identité", () => {
    // Preuve structurelle : aucune clé d'identité n'existe dans le contrat d'entrée.
    const forbidden = ["userId", "anonymous", "companyId", "entitlement", "hasPierre", "tier", "plan", "leadScore"];
    const input: Record<string, unknown> = { message: "Quels sont les prix ?" };
    for (const k of forbidden) input[k] = "peu importe";
    // Même en INJECTANT ces champs, le résultat est identique à l'appel nu :
    expect(routeModel(input as ModelRoutingInput)).toEqual(routeModel({ message: "Quels sont les prix ?" }));
  });

  it("anonyme et client Pierre obtiennent le MÊME modèle pour la MÊME question", () => {
    // Le routeur ne peut pas les distinguer : c'est le but.
    const q = { message: "Pierre peut-il me faire gagner du temps ?" };
    const anonymous = routeModel(q);
    const payingCustomer = routeModel(q);
    expect(anonymous).toEqual(payingCustomer);
    expect(anonymous.model).toBe(LUNA);
  });

  it("une question de prix n'escalade PAS (un visiteur « commercialement intéressant » n'achète pas un meilleur modèle)", () => {
    expect(routeModel({ message: "Pourquoi 449 € ? C'est cher." }).model).toBe(LUNA);
    expect(routeModel({ message: "Je veux acheter Pierre pour 200 salariés." }).model).toBe(LUNA);
  });
});

describe("C1.7 — bornes et garde-fous", () => {
  it("le routeur ne peut JAMAIS produire un modèle inconnu", () => {
    for (const input of [{ message: "x" }, { message: "Compare.", documentCount: 9, documentChars: 99_999 }]) {
      expect(isAllowedModel(routeModel(input).model)).toBe(true);
    }
    expect(isAllowedModel("gpt-4o-mini")).toBe(false); // hors liste autorisée
    expect(isAllowedModel("modele-inexistant")).toBe(false);
  });

  it("les modèles sont pilotés par l'ENVIRONNEMENT (serveur uniquement)", () => {
    const cfg = loadModelRouterConfig({ CLONECHAT_MODEL_DEFAULT: "a-luna", CLONECHAT_MODEL_COMPLEX: "b-terra" } as NodeJS.ProcessEnv);
    expect(cfg.defaultModel).toBe("a-luna");
    expect(routeModel({ message: "Quels sont les prix ?" }, cfg).model).toBe("a-luna");
    expect(routeModel({ message: "Compare.", documentCount: 4, documentChars: 50_000 }, cfg).model).toBe("b-terra");
  });

  it("les défauts canoniques sont ceux vérifiés chez le provider", () => {
    const cfg = loadModelRouterConfig({} as NodeJS.ProcessEnv);
    expect(cfg.defaultModel).toBe("gpt-5.6-luna");
    expect(cfg.complexModel).toBe("gpt-5.6-terra");
  });

  it("la sortie est BORNÉE, et le détail visuel économique par défaut", () => {
    const pub = routeModel({ message: "Quels sont les prix ?", requestClass: "CONVERSATIONAL_OR_PUBLIC" });
    expect(pub.maxOutputTokens).toBeLessThanOrEqual(700);
    expect(pub.imageDetail).toBe("low"); // jamais « high » par réflexe
    expect(routeModel({ message: "Lis ce petit texte.", imageCount: 1, imageNeedsFineDetail: true }).imageDetail).toBe("high");
  });
});
