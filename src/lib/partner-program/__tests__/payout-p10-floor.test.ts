// src/lib/partner-program/__tests__/payout-p10-floor.test.ts
//
// E1.1 §5 — PLANCHER DUR P10 SUR LES VERSEMENTS PARTENAIRES (régression).
//
// LE DÉFAUT CORRIGÉ : `defaultPayoutDeps().productionAuthorized` ne consultait QUE la garde
// d'environnement (`isPartnerLivePayoutAuthorized`). Un environnement pleinement configuré
// (9 variables + clé `sk_live_`) pouvait donc autoriser un VRAI transfert Stripe Connect alors
// que `PRODUCTION_AUTHORIZED = false as const` — ce que `.env.example` promet pourtant d'empêcher.
// `defaultPayoutDeps` n'avait AUCUN test : c'est exactement pour cela que la brèche a survécu.
//
// DOCTRINE VERROUILLÉE ICI :
//   · le plancher P10 est une CONSTANTE DE CODE — aucune variable d'environnement ne le lève ;
//   · la garde d'environnement peut AJOUTER des restrictions, jamais CONTOURNER le plancher ;
//   · aucun test ne mute la constante canonique (on ne « simule » jamais un P10 vrai).

import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type Stripe from "stripe";

import { defaultPayoutDeps, batchHash } from "../server/payouts";
import { evaluateLivePayoutAuthorization, isPartnerLivePayoutAuthorized } from "../live-authorization";
import { payoutIdempotencyKey } from "../payout-rules";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";

// Un client Stripe factice : ces dépendances-là (productionAuthorized / stripeIsLive / stripeMode)
// ne l'appellent JAMAIS. Aucun appel réseau, aucun appel Stripe, aucun transfert.
const fakeStripe = {} as unknown as Stripe;

/** L'environnement qui satisfait les NEUF gardes de `evaluateLivePayoutAuthorization`. */
const FULLY_AUTHORIZED_ENV: Record<string, string> = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  PARTNER_PAYOUTS_ENABLED: "true",
  PARTNER_PAYOUT_DRY_RUN: "false",
  PARTNER_PAYOUT_LIVE_AUTHORIZED: "true",
  STRIPE_SECRET_KEY: "sk_live_exemple_jamais_reel",
  PARTNER_PAYOUT_CRON_SECRET: "secret-de-cron",
};

function stubEnv(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("§0 — la constante canonique n'est jamais mutée par les tests", () => {
  it("PRODUCTION_AUTHORIZED est false, et le reste (aucun test ne la simule vraie)", () => {
    expect(PRODUCTION_AUTHORIZED).toBe(false);
  });
});

describe("§1 — le plancher P10 domine la garde d'environnement", () => {
  it("1. P10=false + TOUTES les variables live activées ⇒ productionAuthorized() reste FAUX", () => {
    stubEnv(FULLY_AUTHORIZED_ENV);

    // La garde d'ENVIRONNEMENT, elle, est bien satisfaite : ce n'est donc pas elle qui refuse.
    expect(isPartnerLivePayoutAuthorized(FULLY_AUTHORIZED_ENV)).toBe(true);
    expect(evaluateLivePayoutAuthorization(FULLY_AUTHORIZED_ENV).authorized).toBe(true);

    // …et pourtant la dépendance réelle refuse : le PLANCHER P10 domine.
    const deps = defaultPayoutDeps(fakeStripe);
    expect(deps.productionAuthorized()).toBe(false);
  });

  it("5./6. environnement live complet + secret cron, P10=false ⇒ le transfert live est bloqué", () => {
    stubEnv(FULLY_AUTHORIZED_ENV);
    const deps = defaultPayoutDeps(fakeStripe);

    // La clé est live…
    expect(deps.stripeIsLive()).toBe(true);
    // …donc la garde de `runMonthlyPayouts` — `stripeIsLive() && !productionAuthorized()` —
    // est VRAIE : le run sort en `skipped: "live_not_authorized"` sans toucher Stripe.
    expect(deps.stripeIsLive() && !deps.productionAuthorized()).toBe(true);
  });

  it("2. la seule forme `sk_live_` n'autorise rien", () => {
    stubEnv({ STRIPE_SECRET_KEY: "sk_live_exemple_jamais_reel" });
    const deps = defaultPayoutDeps(fakeStripe);
    expect(deps.stripeIsLive()).toBe(true);      // la FORME est live…
    expect(deps.productionAuthorized()).toBe(false); // …mais elle n'autorise pas
    expect(isPartnerLivePayoutAuthorized({ STRIPE_SECRET_KEY: "sk_live_exemple_jamais_reel" })).toBe(false);
  });

  it("3. NODE_ENV=production seul n'autorise rien", () => {
    stubEnv({ NODE_ENV: "production" });
    expect(defaultPayoutDeps(fakeStripe).productionAuthorized()).toBe(false);
  });

  it("4. VERCEL_ENV=production seul n'autorise rien", () => {
    stubEnv({ VERCEL_ENV: "production" });
    expect(defaultPayoutDeps(fakeStripe).productionAuthorized()).toBe(false);
  });

  it("10. autorisation live absente ⇒ fail-closed", () => {
    const { PARTNER_PAYOUT_LIVE_AUTHORIZED: _omis, ...sansAutorisation } = FULLY_AUTHORIZED_ENV;
    stubEnv(sansAutorisation);
    expect(defaultPayoutDeps(fakeStripe).productionAuthorized()).toBe(false);
    expect(isPartnerLivePayoutAuthorized(sansAutorisation)).toBe(false);
  });

  it("aucune combinaison de variables ne franchit le plancher (balayage exhaustif du produit cartésien)", () => {
    const keys = Object.keys(FULLY_AUTHORIZED_ENV);
    // 2^7 = 128 sous-ensembles : AUCUN ne doit autoriser un versement tant que P10 est faux.
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const env: Record<string, string> = {};
      keys.forEach((k, i) => { if (mask & (1 << i)) env[k] = FULLY_AUTHORIZED_ENV[k]; });
      vi.unstubAllEnvs();
      stubEnv(env);
      expect(defaultPayoutDeps(fakeStripe).productionAuthorized(), `mask=${mask}`).toBe(false);
    }
  });
});

describe("§2 — le mode Stripe vient du serveur, jamais d'une entrée", () => {
  it("9. une clé de TEST ne produit jamais un mode live", () => {
    stubEnv({ ...FULLY_AUTHORIZED_ENV, STRIPE_SECRET_KEY: "sk_test_exemple" });
    const deps = defaultPayoutDeps(fakeStripe);
    expect(deps.stripeMode()).toBe("test");
    expect(deps.stripeIsLive()).toBe(false);
    expect(deps.productionAuthorized()).toBe(false); // plancher P10, en plus de la clé test
  });

  it("17. le mode est DÉRIVÉ de la clé serveur — aucune requête ne peut le forger", () => {
    stubEnv({ STRIPE_SECRET_KEY: "sk_test_exemple" });
    const deps = defaultPayoutDeps(fakeStripe);
    // `stripeMode`/`stripeIsLive`/`productionAuthorized` sont des fonctions SANS paramètre :
    // il n'existe aucun canal par lequel un corps de requête pourrait les influencer.
    expect(deps.stripeMode.length).toBe(0);
    expect(deps.stripeIsLive.length).toBe(0);
    expect(deps.productionAuthorized.length).toBe(0);
    expect(deps.stripeMode()).toBe("test");
  });
});

describe("§3 — idempotence déterministe", () => {
  it("13. le même lot produit la même clé ; un lot différent, une clé différente", () => {
    const a = batchHash(["e3", "e1", "e2"]);
    const b = batchHash(["e1", "e2", "e3"]); // ordre différent, même lot
    expect(a).toBe(b);                        // l'empreinte est indépendante de l'ordre
    expect(batchHash(["e1", "e2"])).not.toBe(a);

    const k1 = payoutIdempotencyKey("partner-1", "2026-06", a);
    const k2 = payoutIdempotencyKey("partner-1", "2026-06", b);
    expect(k1).toBe(k2);                                                  // rejeu ⇒ même clé
    expect(payoutIdempotencyKey("partner-1", "2026-07", a)).not.toBe(k1); // autre période
    expect(payoutIdempotencyKey("partner-2", "2026-06", a)).not.toBe(k1); // autre cabinet
  });
});

describe("§4 — la promesse de `.env.example` correspond au comportement réel", () => {
  it("18. `.env.example` annonce le plancher P10 sur les versements — et le code l'applique", () => {
    const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    // La promesse court sur DEUX lignes de commentaire : on recolle le texte avant de le lire
    // (retirer les préfixes « # » et replier les retours à la ligne).
    const prose = envExample.replace(/^\s*#\s?/gm, "").replace(/\s*\n\s*/g, " ");

    // La promesse est bien écrite dans la documentation…
    expect(prose).toMatch(/plancher P10/i);
    expect(prose).toMatch(/REFUSE tout transfert live tant que la production n'est pas autoris/i);
    expect(prose).toMatch(/aucune activation Live possible par le code seul/i);

    // …et elle est désormais VRAIE : environnement pleinement live ⇒ toujours refusé.
    stubEnv(FULLY_AUTHORIZED_ENV);
    expect(defaultPayoutDeps(fakeStripe).productionAuthorized()).toBe(false);
  });

  it("le code du versement CONSOMME réellement la constante P10 (pas seulement en commentaire)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/partner-program/server/payouts.ts"), "utf8");
    const sansCommentaires = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sansCommentaires).toMatch(/import\s*\{\s*PRODUCTION_AUTHORIZED\s*\}\s*from\s*["']@\/lib\/clonestore\/production\/p10-production-gate["']/);
    expect(sansCommentaires).toMatch(/productionAuthorized:\s*\(\)\s*=>\s*Boolean\(PRODUCTION_AUTHORIZED\)\s*&&\s*isPartnerLivePayoutAuthorized\(\)/);
  });
});
