// src/lib/clonechat/intelligence/c1-1/__tests__/clonechat-identity.test.ts
// C1.8 FINAL §5 — « Tu sers à quoi ? » : 40 formulations, une seule vérité.
//
// Le défaut n'était PAS un défaut de prompt : l'index de connaissance ne contenait AUCUNE source
// décrivant CloneChat lui-même. Le pipeline étant GROUNDÉ (il ne répond que sur sources), il
// refusait honnêtement : « Je préfère ne pas improviser. » Il ne mentait pas — il n'avait rien à
// citer sur lui-même.
//
// Ces tests vérifient la seule chose qui soit vraie de bout en bout SANS appeler le modèle :
// la SOURCE existe, elle est PUBLIQUE, et elle est RÉCUPÉRÉE pour toutes ces formulations.
// (La qualité de la formulation finale, elle, est mesurée par le banc avec inférence réelle.)

import { describe, it, expect } from "vitest";
import { buildKnowledgeIndex } from "../parrain-knowledge-index";
import { retrieveParrainChunks } from "../parrain-retrieval";
import { PUBLIC_VIEWER } from "../parrain-public-adapter";
import { clonechatIdentityChunk } from "../parrain-product-index";

const IDENTITY_QUESTIONS: readonly string[] = [
  // directes
  "Tu sers à quoi ?",
  "À quoi sert CloneChat ?",
  "Que peux-tu faire pour moi ?",
  "Qui es-tu ?",
  "Tu es quoi ?",
  "Qu'est-ce que tu peux faire ?",
  "Comment peux-tu m'aider ?",
  "Pourquoi tu existes ?",
  "Tu remplaces le support ?",
  "Tu connais CloneStore ?",
  "Tu peux m'aider à utiliser Pierre ?",
  "C'est quoi CloneChat ?",
  // familier / oral
  "tu fais quoi exactement",
  "tu sers a quoi",
  "t'es qui toi",
  "tu peux m'aider ou pas",
  "c koi clonechat",
  "tu gères quoi ?",
  "vous faites quoi au juste",
  "explique-moi ton rôle",
  // fautes d'orthographe
  "tu ser a quoi",
  "a quoi ser clonchat",
  "ke peu tu faire",
  "kes ke tu fais",
  "qui est tu ?",
  "clonchat c'est quoi",
  // très court
  "tu sers ?",
  "toi ?",
  "rôle ?",
  "clonechat ?",
  // transcription vocale (sans ponctuation)
  "bonjour alors tu sers a quoi exactement dans clonestore",
  "dis moi ce que tu peux faire pour mon entreprise",
  "je voudrais savoir a quoi tu sers",
  // formel / poli
  "Bonjour, pourriez-vous m'expliquer votre rôle ?",
  "Auriez-vous l'amabilité de préciser vos fonctions ?",
  "Quelles sont vos capacités exactement ?",
  // sceptique
  "tu sers vraiment à quelque chose ?",
  "en quoi tu es différent de ChatGPT ?",
  "pourquoi je te parlerais plutôt qu'à un humain ?",
  "tu es juste un chatbot non ?",
];

describe("C1.8 FINAL §5 — la source d'identité de CloneChat existe et est publique", () => {
  it("le chunk d'identité est PUBLIC (un visiteur anonyme doit pouvoir l'obtenir)", () => {
    const c = clonechatIdentityChunk();
    expect(c.parrainVisibility).toBe("PUBLIC");
    expect(c.tenantCompanyId ?? null).toBeNull();
  });

  it("il dit ce que CloneChat FAIT — et aussi ce qu'il NE fait pas", () => {
    const t = clonechatIdentityChunk().text.toLowerCase();
    for (const doit of ["expliquer", "guider", "pierre", "diagnostiquer", "image", "humain"]) {
      expect(t).toContain(doit);
    }
    // Les limites font partie de la vérité.
    for (const limite of ["ne décide jamais", "n'invente", "il le dit"].map((s) => s.toLowerCase())) {
      expect(t.includes(limite) || t.includes("limites")).toBe(true);
    }
  });

  it("il n'invente aucun essai gratuit ni aucune promesse interdite", () => {
    const t = clonechatIdentityChunk().text.toLowerCase();
    for (const interdit of ["essai gratuit", "gratuit", "bêta", "beta", "garantie juridique offerte"]) {
      if (interdit === "garantie juridique offerte") continue;
      expect(t).not.toContain(interdit);
    }
  });
});

describe("C1.8 FINAL §5 — 40 formulations récupèrent TOUTES la source d'identité", () => {
  const failures: string[] = [];

  for (const q of IDENTITY_QUESTIONS) {
    it(`« ${q} » → la source d'identité est récupérée`, () => {
      const index = buildKnowledgeIndex({ question: q, viewer: PUBLIC_VIEWER });
      // La source doit être VISIBLE (porte de visibilité franchie)…
      const visible = index.visible.some((c) => c.id === "clonechat.identity");
      expect(visible).toBe(true);

      // …et effectivement RÉCUPÉRÉE dans le top-k envoyé au modèle : présente mais jamais
      // sélectionnée, elle serait aussi inutile qu'absente.
      const retrieved = retrieveParrainChunks(q, index.visible, PUBLIC_VIEWER, { limit: 6 });
      const hit = retrieved.selected.some((r) => r.chunk.id === "clonechat.identity");
      if (!hit) failures.push(q);
      expect(hit, `« ${q} » ne récupère pas clonechat.identity`).toBe(true);
    });
  }

  it("le jeu compte au moins 40 formulations (fautes, oral, court, sceptique inclus)", () => {
    expect(IDENTITY_QUESTIONS.length).toBeGreaterThanOrEqual(40);
  });
});
