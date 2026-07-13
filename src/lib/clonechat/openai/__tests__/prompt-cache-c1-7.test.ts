// src/lib/clonechat/openai/__tests__/prompt-cache-c1-7.test.ts
// C1.7 §10 — Le cache doit être ÉCONOMIQUE sans jamais devenir une faille.
// La faille classique : un préfixe « public » qui contient en réalité une donnée privée, ou une
// clé publique qui dépend du compte — deux tenants partageraient alors un cache.

import { describe, it, expect } from "vitest";
import {
  cacheKey, assemblePrompt, assertStablePrefix, PublicCachePoisoning,
  CLONECHAT_PUBLIC_PROMPT_VERSION,
} from "../prompt-cache";

const PUB = { domain: "public" as const, publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION };

describe("C1.7 — la clé PUBLIQUE ne dépend QUE de la vérité publique versionnée", () => {
  it("la même vérité publique produit la MÊME clé (donc un cache réellement partagé)", () => {
    expect(cacheKey(PUB)).toBe(cacheKey(PUB));
  });

  it("l'état du compte n'empoisonne PAS le cache public : anonyme et client partagent le préfixe", () => {
    // Le routeur ne voit pas l'identité ; le cache public non plus. Un anonyme et un client Pierre
    // réutilisent EXACTEMENT le même préfixe — c'est là que l'économie se fait.
    const anonymous = cacheKey(PUB);
    const payingCustomer = cacheKey(PUB);
    expect(anonymous).toBe(payingCustomer);
  });

  it("changer la VERSION de la connaissance change la clé (aucune vérité périmée ne survit)", () => {
    expect(cacheKey({ ...PUB, publicVersion: "c1.7-public-2" })).not.toBe(cacheKey(PUB));
  });

  it("glisser une entreprise ou une conversation dans le domaine PUBLIC est une ERREUR (fail-closed)", () => {
    expect(() => cacheKey({ ...PUB, companyId: "company-a" })).toThrow(PublicCachePoisoning);
    expect(() => cacheKey({ ...PUB, conversationId: "conv-1" })).toThrow(PublicCachePoisoning);
  });
});

describe("C1.7 — les DOMAINES de cache sont étanches", () => {
  it("deux entreprises n'ont JAMAIS la même clé", () => {
    const a = cacheKey({ domain: "company", publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION, companyId: "company-a", companyContextVersion: "1" });
    const b = cacheKey({ domain: "company", publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION, companyId: "company-b", companyContextVersion: "1" });
    expect(a).not.toBe(b);
  });

  it("changer la version du CONTEXTE d'entreprise invalide sa clé (aucun contexte périmé)", () => {
    const v1 = cacheKey({ domain: "company", publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION, companyId: "company-a", companyContextVersion: "1" });
    const v2 = cacheKey({ domain: "company", publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION, companyId: "company-a", companyContextVersion: "2" });
    expect(v1).not.toBe(v2);
  });

  it("public, entreprise et conversation vivent dans des espaces DISJOINTS", () => {
    const pub = cacheKey(PUB);
    const co = cacheKey({ domain: "company", publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION, companyId: "c", companyContextVersion: "1" });
    const cv = cacheKey({ domain: "conversation", publicVersion: CLONECHAT_PUBLIC_PROMPT_VERSION, conversationId: "x" });
    expect(new Set([pub, co, cv]).size).toBe(3);
    expect(pub.startsWith("cc_pub_")).toBe(true);
    expect(co.startsWith("cc_co_")).toBe(true);
    expect(cv.startsWith("cc_cv_")).toBe(true);
  });

  it("le domaine « company » EXIGE une entreprise vérifiée serveur", () => {
    expect(() => cacheKey({ domain: "company", publicVersion: "v", companyId: null })).toThrow(PublicCachePoisoning);
  });
});

describe("C1.7 — le PRÉFIXE STABLE ne peut pas être empoisonné", () => {
  it("un horodatage rendrait le préfixe unique par requête → refusé", () => {
    expect(() => assertStablePrefix("CloneChat. Généré le 2026-07-13T10:00:00Z.")).toThrow(PublicCachePoisoning);
  });

  it("un identifiant, un e-mail ou une clé dans le préfixe → refusé", () => {
    expect(() => assertStablePrefix("ctx 11111111-1111-4111-8111-111111111111")).toThrow(PublicCachePoisoning);
    expect(() => assertStablePrefix("contact: paul@acme.fr")).toThrow(PublicCachePoisoning);
    expect(() => assertStablePrefix("key sk-" + "x".repeat(24))).toThrow(PublicCachePoisoning);
  });

  it("une donnée PRIVÉE ne peut pas entrer dans le préfixe partagé", () => {
    expect(() => assertStablePrefix('{"companyId": "company-a"}')).toThrow(PublicCachePoisoning);
    expect(() => assertStablePrefix('{"userId": "u-1"}')).toThrow(PublicCachePoisoning);
  });

  it("un préfixe purement public et stable est accepté", () => {
    expect(() => assertStablePrefix("Tu es CloneChat. Pierre prépare, l'humain confirme. Prix 449 € HT/mois en France.")).not.toThrow();
  });
});

describe("C1.7 — assemblage : stable d'abord, dynamique ensuite", () => {
  const stable = "Tu es CloneChat. ".repeat(80); // > 1024 caractères → rentable à mettre en cache

  it("le préfixe stable précède le suffixe dynamique (sinon aucun cache n'opère)", () => {
    const a = assemblePrompt({ stablePrefix: stable, dynamicSuffix: "Message: bonjour", domain: "public" });
    expect(a.cacheable).toBe(true);
    expect(a.cacheKey.startsWith("cc_pub_")).toBe(true);
    expect(a.stablePrefix).toBe(stable);
    expect(a.dynamicSuffix).toContain("bonjour");
  });

  it("deux visiteurs différents partagent le MÊME préfixe et la MÊME clé publique", () => {
    const v1 = assemblePrompt({ stablePrefix: stable, dynamicSuffix: "Message: prix ?", domain: "public" });
    const v2 = assemblePrompt({ stablePrefix: stable, dynamicSuffix: "Message: démo ?", domain: "public" });
    expect(v1.cacheKey).toBe(v2.cacheKey);        // le cache est partagé…
    expect(v1.dynamicSuffix).not.toBe(v2.dynamicSuffix); // …alors que les messages diffèrent
  });

  it("un préfixe trop court n'est PAS annoncé comme cacheable (on ne promet pas une économie fictive)", () => {
    const a = assemblePrompt({ stablePrefix: "court", dynamicSuffix: "x", domain: "public" });
    expect(a.cacheable).toBe(false);
  });

  it("assembler un prompt public avec une entreprise est REFUSÉ", () => {
    expect(() => assemblePrompt({ stablePrefix: stable, dynamicSuffix: "x", domain: "public", companyId: "company-a" })).toThrow(PublicCachePoisoning);
  });
});
