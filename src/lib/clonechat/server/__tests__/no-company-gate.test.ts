// src/lib/clonechat/server/__tests__/no-company-gate.test.ts
// C1.3 — Classifieur PUR de la porte « pas d'entreprise active ». Exerce la fonction RÉELLE
// sur les formulations exactes du bug : les questions PUBLIQUES ne doivent plus tomber sur
// « Aucune entreprise active… », et les demandes touchant aux DONNÉES/ACTIONS de l'entreprise
// doivent rester bloquées.

import { describe, expect, it } from "vitest";
import {
  classifyNoCompanyIntent,
  NO_COMPANY_ACTION_MESSAGE,
  NO_COMPANY_CLARIFY_MESSAGE,
  DISCOVERY_MODE_HINT,
} from "../no-company-gate";

describe("C1.3 — classifieur pas-d'entreprise : questions PUBLIQUES", () => {
  const PUBLIC_QUESTIONS = [
    "Comment payer Pierre ?",
    "Est-ce que tu me recommandes Pierre ?",
    "Est-ce que tu me recommandes Pierre pour me libérer de la charge RH ?",
    "Quels sont les prix ?",
    "Comment fonctionne CloneStore ?",
    "Que peut faire Pierre ?",
    "Combien coûte Pierre en Suisse ?",
    "Où puis-je voir la démo ?",
    "Est-ce disponible en Belgique ?",
    "Comment se passe un onboarding avec Pierre ?", // question SUR la capacité → publique
    "Pourquoi choisir Pierre plutôt que ChatGPT ?",
    "Quelle est la différence entre CloneStore et CloneOS ?",
  ];

  for (const q of PUBLIC_QUESTIONS) {
    it(`« ${q} » → public`, () => {
      expect(classifyNoCompanyIntent(q)).toBe("public");
    });
  }
});

describe("C1.3 — classifieur pas-d'entreprise : demandes ENTREPRISE", () => {
  const COMPANY_REQUESTS = [
    "Prépare l'onboarding de Sarah.",
    "Montre-moi mes salariés.",
    "Montre les documents de Nora.",
    "Montre-moi les documents de Nora.",
    "Continue la mission.",
    "Pourquoi ma mission est bloquée ?",
    "Crée une mission.",
    "Envoie ce document.",
    "Analyse les données de mon entreprise.",
    "Analyse les salariés de mon entreprise.",
    "Corrige le document que Pierre vient de préparer.",
  ];

  for (const q of COMPANY_REQUESTS) {
    it(`« ${q} » → company`, () => {
      expect(classifyNoCompanyIntent(q)).toBe("company");
    });
  }
});

describe("C1.3 — classifieur pas-d'entreprise : AMBIGU", () => {
  it("« Continue. » → ambiguous", () => {
    expect(classifyNoCompanyIntent("Continue.")).toBe("ambiguous");
  });
  it("message vide → ambiguous", () => {
    expect(classifyNoCompanyIntent("")).toBe("ambiguous");
    expect(classifyNoCompanyIntent("   ")).toBe("ambiguous");
  });
});

describe("C1.3 — messages canoniques", () => {
  it("le message « entreprise requise » est honnête et actionnable", () => {
    expect(NO_COMPANY_ACTION_MESSAGE).toMatch(/s[ée]lectionnez ou cr[ée]ez/i);
    // Ce n'est PLUS le blocage générique de l'ancien bug.
    expect(NO_COMPANY_ACTION_MESSAGE).not.toMatch(/Aucune entreprise active n'est associée/i);
  });
  it("la clarification propose les deux voies sans bloquer", () => {
    expect(NO_COMPANY_CLARIFY_MESSAGE).toMatch(/information g[ée]n[ée]rale/i);
    expect(NO_COMPANY_CLARIFY_MESSAGE).toMatch(/posez librement/i);
  });
  it("l'indice « mode découverte » est non bloquant", () => {
    expect(DISCOVERY_MODE_HINT).toMatch(/Mode d[ée]couverte/i);
  });
});
