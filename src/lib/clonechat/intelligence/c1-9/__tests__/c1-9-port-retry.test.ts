// C1.9 — REPRISE BORNÉE SUR LIMITATION DE DÉBIT.
//
// Défaut de mesure trouvé en campagne : seize verdicts consécutifs invalides, tous en
// `openai_http_429`. Le port n'avait aucune reprise et la relance du banc repartait dans
// l'instant, donc dans la même fenêtre de limitation. Une limitation n'est pas une panne :
// c'est une invitation à attendre. Sans attente, elle détruit la mesure et se déguise en
// défaut produit.
import { describe, it, expect, vi, beforeEach } from "vitest";

let attempts = 0;
/** Statuts renvoyés successivement ; `null` = succès. */
let script: (number | null)[] = [];
/** Effet de bord joué APRÈS chaque tentative — sert à simuler un budget consommé ailleurs. */
let afterAttempt: (() => void) | null = null;

vi.mock("openai", () => {
  class FakeOpenAI {
    responses = {
      create: async () => {
        const next = script[Math.min(attempts, script.length - 1)];
        attempts += 1;
        afterAttempt?.();
        if (next !== null) throw Object.assign(new Error(`http ${next}`), { status: next, headers: {} });
        return { output_text: '{"ok":true}', usage: { input_tokens: 10, output_tokens: 5 } };
      },
    };
    constructor(_: unknown) { /* clé jamais journalisée */ }
  }
  return { default: FakeOpenAI };
});

import { createOpenAIC19Port, createTokenBudget, C19_DEFAULT_CONFIG } from "../openai-port";

beforeEach(() => { attempts = 0; script = []; afterAttempt = null; });

const call = (port: ReturnType<typeof createOpenAIC19Port>) =>
  port.complete({ system: "s", userText: "u", maxOutputTokens: 500, purpose: "compose" });

describe("C1.9 — port modèle : reprise bornée", () => {
  it("réessaie une limitation de débit et finit par aboutir", async () => {
    script = [429, 429, null];
    const port = createOpenAIC19Port("k".repeat(40), C19_DEFAULT_CONFIG);
    const res = await call(port);
    expect(res.ok).toBe(true);
    expect(res.text).toContain("ok");
    expect(attempts).toBe(3);
  }, 60_000);

  it("ne réessaie PAS une erreur définitive : une clé invalide reste invalide", async () => {
    script = [401];
    const port = createOpenAIC19Port("k".repeat(40), C19_DEFAULT_CONFIG);
    const res = await call(port);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("openai_http_401");
    expect(attempts, "aucune relance sur une authentification refusée").toBe(1);
  }, 30_000);

  it("borne les tentatives : une limitation persistante finit par échouer honnêtement", async () => {
    script = [429];
    const port = createOpenAIC19Port("k".repeat(40), C19_DEFAULT_CONFIG);
    const res = await call(port);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("openai_http_429");
    // Bornée : ni une seule tentative (pas de reprise), ni une boucle sans fin.
    expect(attempts).toBeGreaterThan(1);
    expect(attempts).toBeLessThanOrEqual(4);
  }, 120_000);

  it("n'insiste pas quand le budget est épuisé ENTRE-TEMPS par un autre appel", async () => {
    // Un appel en échec ne consomme aucun jeton : ce n'est donc pas lui qui épuise le
    // budget. Le cas réel est celui d'une campagne — un budget PARTAGÉ que d'autres appels
    // vident pendant qu'on patiente. Relancer alors serait dépenser ce qui n'existe plus.
    script = [429];
    const budget = createTokenBudget(1_000);
    afterAttempt = () => { budget.spentInput = 1_000; };
    const port = createOpenAIC19Port("k".repeat(40), C19_DEFAULT_CONFIG, budget);
    const res = await call(port);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("budget_exhausted");
    expect(attempts, "on ne relance pas après épuisement").toBe(1);
  }, 30_000);

  it("refuse d'emblée quand le budget est déjà épuisé", async () => {
    script = [null];
    const budget = createTokenBudget(100);
    budget.spentOutput = 100;
    const port = createOpenAIC19Port("k".repeat(40), C19_DEFAULT_CONFIG, budget);
    const res = await call(port);
    expect(res.error).toBe("budget_exhausted");
    expect(attempts, "aucun appel réseau n'est émis").toBe(0);
  }, 30_000);
});
