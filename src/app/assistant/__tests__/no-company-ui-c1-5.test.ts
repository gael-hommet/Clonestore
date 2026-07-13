// src/app/assistant/__tests__/no-company-ui-c1-5.test.ts
// C1.5 — Verrous de RÉGRESSION sur la cause RÉELLE du faux blocage « pas d'entreprise ».
//
// Le défaut n'était PAS dans l'API (C1.3/C1.4 l'avaient déjà corrigée, 436 tests verts) :
// il était dans le CLIENT. `ctxRef` démarre en `mode: "public"` et le composer acceptait un
// message AVANT que le mode ne soit résolu ⇒ le message partait dans le moteur DÉTERMINISTE
// LOCAL, n'atteignait JAMAIS `/api/assistant/chat`, et l'utilisateur lisait « Réponse
// d'orientation — je n'accède pas aux données de votre entreprise ». Reproduit au navigateur.
//
// Le dépôt n'a pas d'environnement DOM (ni jsdom, ni testing-library) : ces tests verrouillent
// donc les INVARIANTS DE SOURCE qui ont causé le défaut. Le COMPORTEMENT est prouvé, lui, par
// la QA navigateur réelle (.c1-5-proofs/).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const HOOK = read("src/app/assistant/useCloneChat.ts");
const UI = read("src/components/clonechat/CloneChatWorkspace.tsx");
const CSS = read("src/app/globals.css");

/** Code utile seulement : un commentaire ne doit jamais satisfaire une preuve. */
const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("C1.5 — la cause racine : le message ne partait jamais au serveur", () => {
  it("`send` ATTEND la résolution du mode avant de choisir sa voie", () => {
    // Sans cette barrière, un message envoyé pendant l'initialisation est traité comme PUBLIC.
    // C1.6 — l'attente est désormais BORNÉE (une barrière ne doit jamais redevenir une porte).
    expect(code(HOOK)).toMatch(/await awaitReady\(\)/);
    expect(code(HOOK)).toMatch(/READY_TIMEOUT_MS/);
    // C1.6 — la barrière vit désormais dans un module PUR, réellement testé (readiness-c1-6).
    expect(code(HOOK)).toMatch(/createReadinessBarrier\(READY_TIMEOUT_MS\)/);
  });

  it("la barrière est libérée sur TOUTES les sorties (sinon le chat resterait bloqué)", () => {
    const c = code(HOOK);
    // anonyme, authentifié, et échec inattendu
    expect(c.match(/markReady\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(c).toMatch(/\.finally\(markReady\)/); // filet de sécurité : jamais de dead state
  });

  it("le mode authentifié est établi AVANT le chargement du contexte V1 (pas après)", () => {
    const c = code(HOOK);
    const authed = c.indexOf('setMode("authenticated")');
    const ready = c.indexOf("markReady();", authed);
    const v1Call = c.indexOf("fetchPierreHistory({"); // le SITE D'APPEL, pas l'import en tête
    expect(authed).toBeGreaterThan(-1);
    expect(v1Call).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(authed);
    expect(ready).toBeLessThan(v1Call); // la barrière tombe dès que la VOIE est connue
  });
});

describe("C1.5 — aucune fausse entreprise n'est fabriquée côté client", () => {
  it("le libellé d'entreprise n'est plus dérivé de l'e-mail", () => {
    // Ancien défaut : `email.split("@")[0]` → « test-a » affiché comme entreprise, à un
    // utilisateur qui n'en a AUCUNE (« Données de votre entreprise (test-a) »).
    expect(code(HOOK)).not.toMatch(/email\??\.split\("@"\)/);
  });

  it("une réponse de découverte est assemblée dans un contexte PUBLIC (companyLabel null)", () => {
    const c = code(HOOK);
    expect(c).toMatch(/const isDiscovery = data\.public === true \|\| data\.discovery === true/);
    expect(c).toMatch(/assembleCtx = isDiscovery \? \{ \.\.\.ctx, mode: "public" as const, companyLabel: null \}/);
  });

  it("l'état entreprise vient du SERVEUR, jamais d'une supposition client", () => {
    const c = code(HOOK);
    expect(c).toMatch(/CloneChatCompanyState/);
    // La route conversations est fail-closed : `ok:true` DANS LES DEUX CAS. On distingue par
    // `source`, et l'ancien `ld.conversations.map(...)` (TypeError silencieux) est supprimé.
    expect(c).toMatch(/ld\?\.source === "company_required" \|\| !Array\.isArray\(ld\?\.conversations\)/);
  });
});

describe("C1.5 — le chat reste utilisable : un refus est contextuel, jamais un arrêt", () => {
  it("C1.6 — le prérequis est ATTACHÉ à la demande (CTA), il ne remplace jamais la réponse", () => {
    const c = code(HOOK);
    expect(c).toMatch(/function pushCta/);
    expect(c).toMatch(/prerequisiteMessage/);
    // Les états CIBLÉS restent traités sans jamais éteindre la conversation.
    for (const s of ["attachment_requires_company", "company_access_suspended", "rate_limited"]) {
      expect(c).toContain(`"${s}"`);
    }
  });

  it("un refus n'est jamais estampillé « données d'entreprise » (aucune donnée n'a été touchée)", () => {
    expect(code(HOOK)).toMatch(/push\(msg\("assistant", blocks, "public"\)\);/);
  });

  it("C1.6 — AUCUNE bannière permanente : ni « mode découverte », ni avertissement d'indisponibilité", () => {
    // §6 : une bannière permanente laisserait croire que CloneChat est diminué. Il ne l'est pas.
    expect(code(HOOK)).not.toMatch(/blocks\.push\(\{ type: "boundary"[^}]*DISCOVERY_MODE_HINT/);
    expect(code(UI)).not.toMatch(/cc-state-card/);
    expect(code(UI)).not.toMatch(/Mode découverte actif/);
  });

  it("le composer n'est JAMAIS désactivé à cause d'une absence de compte ou d'entreprise", () => {
    const c = code(UI);
    expect(c).not.toMatch(/disabled=\{[^}]*mode === "public"[^}]*\}/);
    // La seule condition de désactivation légitime du champ est « une réponse est en cours ».
    expect(c).toMatch(/disabled=\{chat\.busy\}/);
    expect(c).not.toMatch(/disabled=\{[^}]*companyState[^}]*\}/);
    expect(c).not.toMatch(/disabled=\{[^}]*discoveryMode[^}]*\}/);
  });

  it("C1.6 §7 — statut NEUTRE : jamais « connecté à votre entreprise » sans entreprise, jamais un mode « dégradé »", () => {
    const c = code(HOOK);
    expect(c).toMatch(/companyState === "active" \? "Assistant opérationnel" : "Conversation générale"/);
    expect(code(UI)).toMatch(/chat\.companyState === "active" \? " · connecté à votre entreprise" : ""/);
  });
});

describe("C1.5 — identité visuelle : le violet vif est éliminé", () => {
  it("plus aucune référence au violet dans la surface CloneChat", () => {
    expect(UI).not.toMatch(/--cs-violet/);
    expect(HOOK).not.toMatch(/--cs-violet/);
  });

  it("la bulle utilisateur porte le dégradé sombre CloneStore, pas une couleur vive", () => {
    expect(code(UI)).toMatch(/isUser \? "cc-bubble-user" : "cc-bubble-assistant"/);
    const bubble = CSS.slice(CSS.indexOf(".cc-bubble-user"), CSS.indexOf(".cc-bubble-assistant"));
    expect(bubble).toMatch(/linear-gradient/);
    expect(bubble).toMatch(/rgba\(21, 25, 34/); // graphite
    expect(bubble).toMatch(/rgba\(48, 63, 92/); // bleu nuit
    expect(bubble).not.toMatch(/107, 99, 232/); // l'ancien violet (#6b63e8)
  });

  it("la bulle assistant est une surface claire secondaire (texte sombre lisible)", () => {
    const b = CSS.slice(CSS.indexOf(".cc-bubble-assistant"));
    expect(b).toMatch(/color: var\(--cs-ink-1\)/);
    expect(b.slice(0, 400)).toMatch(/rgba\(255, 255, 255/);
  });

  it("le composer et la carte d'état existent et sont responsives", () => {
    expect(CSS).toMatch(/\.cc-composer\b/);
    expect(CSS).toMatch(/\.cc-composer:focus-within/);
    expect(CSS).toMatch(/\.cc-state-card\b/);
    expect(CSS).toMatch(/overflow-wrap: anywhere/); // aucune bulle ne déborde
    expect(CSS).toMatch(/@media \(max-width: 640px\)[\s\S]{0,200}cc-msg-col/);
  });
});
