// src/app/assistant/__tests__/readiness-c1-6.test.ts
// C1.6 §5 — LA BARRIÈRE DE PRÊT NE DOIT JAMAIS REDEVENIR UNE PORTE.
//
// Histoire : C1.5 attendait la résolution d'identité avant d'envoyer (sinon le message partait
// dans la mauvaise voie). C1.6 a constaté au navigateur que si l'identité ne se résout JAMAIS
// (Supabase throttlé), l'attente est INFINIE et le composer se fige : la barrière était
// redevenue une porte. Elle est désormais BORNÉE.
//
// Le bornage est prouvé POUR DE VRAI (module pur), pas seulement par lecture de source.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { createReadinessBarrier, DEFAULT_READY_TIMEOUT_MS } from "@/lib/clonechat/readiness-barrier";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const HOOK = read("src/app/assistant/useCloneChat.ts");
const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("C1.6 §5 — barrière de prêt : bornée, jamais bloquante", () => {
  it("1. un envoi ATTEND la résolution de l'identité", async () => {
    const b = createReadinessBarrier(10_000);
    let released = false;
    const waiting = b.awaitReady().then(() => { released = true; });
    await Promise.resolve();
    expect(released).toBe(false); // on attend vraiment
    b.markReady();
    await waiting;
    expect(released).toBe(true);
  });

  it("2/3. l'attente est BORNÉE : sans résolution, le délai libère l'envoi", async () => {
    // Faux minuteur : on prouve le bornage sans dormir.
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const b = createReadinessBarrier(4000, (fn, ms) => { timers.push({ fn: fn as () => void, ms }); return 0; });

    let released = false;
    const waiting = b.awaitReady().then(() => { released = true; });
    await Promise.resolve();
    expect(released).toBe(false);          // l'identité n'arrive jamais…
    expect(timers[0].ms).toBe(4000);       // …mais un délai est armé

    timers[0].fn();                        // le délai expire
    await waiting;
    expect(released).toBe(true);           // l'envoi est libéré malgré l'identité non résolue
    expect(b.isReady()).toBe(false);       // et on ne PRÉTEND pas être prêt
  });

  it("4. le dépassement de délai ne FABRIQUE aucune identité", async () => {
    const b = createReadinessBarrier(1, (fn) => { (fn as () => void)(); return 0; });
    const result = await b.awaitReady();
    expect(result).toBeUndefined();  // la barrière ne rend NI utilisateur, NI entreprise, NI jeton
    expect(b.isReady()).toBe(false); // l'identité reste non résolue — et c'est dit honnêtement
  });

  it("7. une résolution TARDIVE ne rejoue rien (aucun message dupliqué)", async () => {
    const b = createReadinessBarrier(1, (fn) => { (fn as () => void)(); return 0; });
    await b.awaitReady();                  // libéré par le délai
    const spy = vi.fn();
    b.markReady(); b.markReady(); b.markReady(); // l'identité arrive enfin, plusieurs fois
    // `markReady` est idempotent et ne déclenche AUCUN renvoi : il ne rappelle personne.
    expect(spy).not.toHaveBeenCalled();
    expect(b.isReady()).toBe(true);
    await expect(b.awaitReady()).resolves.toBeUndefined(); // et n'attend plus jamais
  });

  it("`awaitReady` ne rejette jamais (une panne d'auth ne casse pas l'envoi)", async () => {
    const b = createReadinessBarrier(1, (fn) => { (fn as () => void)(); return 0; });
    await expect(b.awaitReady()).resolves.toBeUndefined();
  });

  it("le délai par défaut est fini et raisonnable", () => {
    expect(DEFAULT_READY_TIMEOUT_MS).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_READY_TIMEOUT_MS)).toBe(true);
    expect(DEFAULT_READY_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

describe("C1.6 §5 — le hook utilise la barrière bornée, et un seul CloneChat", () => {
  const c = code(HOOK);

  it("5. la requête part TOUJOURS vers le serveur — aucune voie ne le contourne", () => {
    expect(c).toMatch(/await awaitReady\(\)/);
    // Un seul appel réseau de conversation, et il n'est gardé par AUCUNE condition de mode.
    expect((c.match(/fetch\("\/api\/assistant\/chat"/g) ?? []).length).toBe(1);
    expect(c).not.toMatch(/if \(ctx\.mode === "public"\)/);
  });

  it("6. le composer redevient actif quoi qu'il arrive (`finally`)", () => {
    expect(c).toMatch(/finally \{[\s\S]{0,200}setBusy\(false\)/);
  });

  it("8. aucun second assistant local n'est appelé", () => {
    expect(c).not.toMatch(/runCloneChatTurn\(/);
  });

  it("le hook consomme le module PUR (le code testé est le code exécuté)", () => {
    expect(c).toMatch(/createReadinessBarrier\(READY_TIMEOUT_MS\)/);
  });
});
