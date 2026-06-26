// CloneStory — tests des secrets FAIL-CLOSED (§1).
// Manipule NODE_ENV / variables d'env de manière isolée (sauvegarde + restauration).

import { describe, it, expect, afterEach } from "vitest";
import { signCookie, verifyCookie } from "@/lib/founder-access/signed-cookie";

const KEYS = ["NODE_ENV", "CLONESTORY_LOCAL_MODE", "CLONESTORY_SESSION_SECRET", "CLONESTORY_COMPANY_SALT", "RESEND_API_KEY", "CLONESTORE_FOUNDER_EMAIL_FROM", "CLONESTORY_REGISTRATION_OPEN", "DATABASE_URL"];

// Pose une configuration production COMPLÈTE puis permet d'en retirer un élément.
function setProdComplete() {
  process.env.NODE_ENV = "production";
  process.env.CLONESTORY_REGISTRATION_OPEN = "true";
  process.env.CLONESTORY_SESSION_SECRET = "s".repeat(40);
  process.env.CLONESTORY_COMPANY_SALT = "c".repeat(40);
  process.env.DATABASE_URL = "postgres://example";
  process.env.RESEND_API_KEY = "re_example";
  process.env.CLONESTORE_FOUNDER_EMAIL_FROM = "Cercle <fondateur@clonestore.pro>";
}

function snapshot() {
  const s: Record<string, string | undefined> = {};
  for (const k of KEYS) s[k] = process.env[k];
  return s;
}
function restore(s: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (s[k] === undefined) delete process.env[k];
    else process.env[k] = s[k];
  }
}

// Import frais du module config à chaque scénario (lecture d'env au moment de l'appel,
// mais on réimporte pour rester robuste si une constante était capturée).
async function freshConfig() {
  return import("../config");
}

let saved = snapshot();
afterEach(() => { restore(saved); saved = snapshot(); });

describe("secrets fail-closed", () => {
  it("production SANS secret → erreur explicite", async () => {
    saved = snapshot();
    process.env.NODE_ENV = "production";
    delete process.env.CLONESTORY_SESSION_SECRET;
    delete process.env.CLONESTORY_LOCAL_MODE;
    const cfg = await freshConfig();
    expect(() => cfg.sessionSecret()).toThrow(/CLONESTORY_SESSION_SECRET requis en production/);
  });

  it("production avec secret TROP COURT → erreur", async () => {
    saved = snapshot();
    process.env.NODE_ENV = "production";
    process.env.CLONESTORY_SESSION_SECRET = "court"; // < 24
    const cfg = await freshConfig();
    expect(() => cfg.sessionSecret()).toThrow();
  });

  it("production sans RESEND_API_KEY → email fail-closed", async () => {
    saved = snapshot();
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_API_KEY;
    const cfg = await freshConfig();
    expect(() => cfg.assertEmailConfigured()).toThrow(/RESEND_API_KEY requis/);
  });

  it("dev SANS mode local explicite → erreur (force la déclaration)", async () => {
    saved = snapshot();
    process.env.NODE_ENV = "test";
    delete process.env.CLONESTORY_LOCAL_MODE;
    delete process.env.CLONESTORY_COMPANY_SALT;
    const cfg = await freshConfig();
    expect(() => cfg.companySalt()).toThrow(/CLONESTORY_LOCAL_MODE=1/);
  });

  it("mode local explicite → valeur de développement autorisée (hors prod)", async () => {
    saved = snapshot();
    process.env.NODE_ENV = "test";
    process.env.CLONESTORY_LOCAL_MODE = "1";
    delete process.env.CLONESTORY_SESSION_SECRET;
    const cfg = await freshConfig();
    const v = cfg.sessionSecret();
    expect(v.length).toBeGreaterThanOrEqual(24);
  });

  it("le rapport de préparation ne révèle jamais les valeurs", async () => {
    saved = snapshot();
    process.env.CLONESTORY_SESSION_SECRET = "x".repeat(40);
    const cfg = await freshConfig();
    const report = cfg.inspectProductionReadiness();
    for (const v of report.vars) {
      expect(Object.keys(v)).toEqual(["name", "present", "strong"]); // booléens uniquement
    }
  });

  it("flag d'ouverture : FERMÉ par défaut, ouvert seulement si exactement 'true'", async () => {
    saved = snapshot();
    delete process.env.CLONESTORY_REGISTRATION_OPEN;
    let cfg = await freshConfig();
    expect(cfg.registrationOpen()).toBe(false); // défaut fermé

    process.env.CLONESTORY_REGISTRATION_OPEN = "false";
    cfg = await freshConfig();
    expect(cfg.registrationOpen()).toBe(false);

    process.env.CLONESTORY_REGISTRATION_OPEN = "TRUE"; // pas exactement "true"
    cfg = await freshConfig();
    expect(cfg.registrationOpen()).toBe(false);

    process.env.CLONESTORY_REGISTRATION_OPEN = "true";
    cfg = await freshConfig();
    expect(cfg.registrationOpen()).toBe(true);
  });

  it("readiness : présence des secrets N'OUVRE PAS automatiquement (flag séparé)", async () => {
    saved = snapshot();
    // Tous les secrets présents et robustes…
    process.env.CLONESTORY_SESSION_SECRET = "x".repeat(40);
    process.env.CLONESTORY_COMPANY_SALT = "y".repeat(40);
    process.env.DATABASE_URL = "postgres://x";
    process.env.RESEND_API_KEY = "re_x";
    process.env.CLONESTORE_FOUNDER_EMAIL_FROM = "a@b.co";
    // …mais flag absent → infra prête, inscriptions FERMÉES.
    delete process.env.CLONESTORY_REGISTRATION_OPEN;
    const cfg = await freshConfig();
    const report = cfg.inspectProductionReadiness();
    expect(report.ready).toBe(true); // infra prête
    expect(report.registrationOpen).toBe(false); // mais ouverture NON déduite
  });

  it("préflight prod COMPLET → ne lève pas", async () => {
    saved = snapshot();
    setProdComplete();
    const cfg = await freshConfig();
    expect(() => cfg.assertClonestoryRegistrationReady()).not.toThrow();
  });

  it("préflight prod : flag true MAIS SESSION_SECRET absent → throw", async () => {
    saved = snapshot();
    setProdComplete();
    delete process.env.CLONESTORY_SESSION_SECRET;
    const cfg = await freshConfig();
    expect(() => cfg.assertClonestoryRegistrationReady()).toThrow();
  });

  it("préflight prod : flag true MAIS COMPANY_SALT absent → throw", async () => {
    saved = snapshot();
    setProdComplete();
    delete process.env.CLONESTORY_COMPANY_SALT;
    const cfg = await freshConfig();
    expect(() => cfg.assertClonestoryRegistrationReady()).toThrow();
  });

  it("préflight prod : flag true MAIS email (RESEND) absent → throw", async () => {
    saved = snapshot();
    setProdComplete();
    delete process.env.RESEND_API_KEY;
    const cfg = await freshConfig();
    expect(() => cfg.assertClonestoryRegistrationReady()).toThrow();
  });

  it("préflight : flag false → throw (le flag seul est requis aussi)", async () => {
    saved = snapshot();
    setProdComplete();
    process.env.CLONESTORY_REGISTRATION_OPEN = "false";
    const cfg = await freshConfig();
    expect(() => cfg.assertClonestoryRegistrationReady()).toThrow();
  });

  it("cookie signé avec le MAUVAIS secret est rejeté", () => {
    const token = signCookie("partner-123", "secret-A-aaaaaaaaaaaaaaaaaaaaaaaa", 60_000);
    expect(verifyCookie(token, "secret-A-aaaaaaaaaaaaaaaaaaaaaaaa")).toBe("partner-123");
    expect(verifyCookie(token, "secret-B-bbbbbbbbbbbbbbbbbbbbbbbb")).toBeNull(); // mauvais secret
  });
});
