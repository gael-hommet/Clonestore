// CS-FINAL 4 — token d'action stateless : déterminisme, cloisonnement des usages, falsification.
import { describe, it, expect } from "vitest";

process.env.CLONESTORY_LOCAL_MODE = "1";

import { buildActionToken, parseActionToken, isActionTokenExpired } from "../action-token";

describe("token d'action stateless", () => {
  const exp = 2_000_000_000_000;

  it("déterministe : mêmes entrées → même token", () => {
    const a = buildActionToken("introconfirm", "intro-1", 1, exp);
    const b = buildActionToken("introconfirm", "intro-1", 1, exp);
    expect(a).toBe(b);
    expect(a.startsWith("csya1.")).toBe(true);
  });

  it("aller-retour : on récupère sujet + génération + expiration", () => {
    const t = buildActionToken("introconfirm", "intro-42", 3, exp);
    const p = parseActionToken(t, "introconfirm");
    expect(p).toEqual({ purpose: "introconfirm", subjectId: "intro-42", generation: 3, expMs: exp });
  });

  it("CLOISONNEMENT : un token introconfirm ne se parse jamais comme introrefuse", () => {
    const t = buildActionToken("introconfirm", "intro-9", 1, exp);
    expect(parseActionToken(t, "introrefuse")).toBeNull();
    expect(parseActionToken(t, "introconfirm")).not.toBeNull();
  });

  it("falsification (HMAC altéré) → null", () => {
    const t = buildActionToken("introrefuse", "intro-x", 1, exp);
    expect(parseActionToken(t.slice(0, -4) + "AAAA", "introrefuse")).toBeNull();
    expect(parseActionToken("csya1.tampered.value", "introrefuse")).toBeNull();
    expect(parseActionToken(null, "introconfirm")).toBeNull();
  });

  it("génération distincte → token distinct (révocation)", () => {
    expect(buildActionToken("introconfirm", "i", 1, exp)).not.toBe(buildActionToken("introconfirm", "i", 2, exp));
  });

  it("expiration", () => {
    expect(isActionTokenExpired(1000, 2000)).toBe(true);
    expect(isActionTokenExpired(2000, 1000)).toBe(false);
  });
});
