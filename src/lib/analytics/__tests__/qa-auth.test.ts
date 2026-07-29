// Analytics — authentification QA serveur-uniquement : table de classification complète.
// Prouve qu'en Production, seule une requête portant le secret serveur exact est classée `test`,
// et que TOUT autre cas (en-tête public seul, mauvais/tronqué/vide/court secret, config absente)
// échoue de manière fermée en `external`. Aucun secret réel n'apparaît dans ce fichier.

import { describe, it, expect } from "vitest";
import {
  constantTimeTokenEqual,
  isAuthenticatedProductionQaRequest,
  QA_TOKEN_MIN_LENGTH,
} from "../qa-auth";
import { classifyTraffic, type TrafficClassificationInput } from "../traffic";

// Secret FICTIF de test (47 caractères, ≥ QA_TOKEN_MIN_LENGTH). Jamais un vrai token.
const VALID_TOKEN = "qa_fake_unit_test_secret_0123456789_abcdef_ghij";

function base(): TrafficClassificationInput {
  return {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    internalCookieValue: null,
    internalCookieValid: false,
    isAuthenticatedOwner: false,
    isLocalEnvironment: false,
    isAdminRoute: false,
    testHeaderPresent: false,
    environment: "production",
  };
}

describe("qa-auth · constantTimeTokenEqual (comparaison temps constant, fail-closed)", () => {
  it("QA_TOKEN_MIN_LENGTH vaut 32", () => {
    expect(QA_TOKEN_MIN_LENGTH).toBe(32);
    expect(VALID_TOKEN.length).toBeGreaterThanOrEqual(32);
  });

  it("secret identique et suffisamment long → true", () => {
    expect(constantTimeTokenEqual(VALID_TOKEN, VALID_TOKEN)).toBe(true);
  });

  it("`provided` null/undefined/vide → false", () => {
    expect(constantTimeTokenEqual(null, VALID_TOKEN)).toBe(false);
    expect(constantTimeTokenEqual(undefined, VALID_TOKEN)).toBe(false);
    expect(constantTimeTokenEqual("", VALID_TOKEN)).toBe(false);
  });

  it("`configured` absent/vide → false", () => {
    expect(constantTimeTokenEqual(VALID_TOKEN, null)).toBe(false);
    expect(constantTimeTokenEqual(VALID_TOKEN, undefined)).toBe(false);
    expect(constantTimeTokenEqual(VALID_TOKEN, "")).toBe(false);
  });

  it("secret configuré trop court (< 32) → false, même si `provided` est identique", () => {
    const short = "0123456789abcdef0123456789abcde"; // 31 chars
    expect(short.length).toBe(31);
    expect(constantTimeTokenEqual(short, short)).toBe(false);
  });

  it("longueurs différentes (token tronqué) → false", () => {
    expect(constantTimeTokenEqual(VALID_TOKEN.slice(0, -1), VALID_TOKEN)).toBe(false);
    expect(constantTimeTokenEqual(VALID_TOKEN + "x", VALID_TOKEN)).toBe(false);
  });

  it("même longueur mais contenu différent → false", () => {
    const wrong = "x".repeat(VALID_TOKEN.length);
    expect(wrong.length).toBe(VALID_TOKEN.length);
    expect(constantTimeTokenEqual(wrong, VALID_TOKEN)).toBe(false);
  });

  it("en-tête dupliqué/malformé (secret répété/joint) → false", () => {
    expect(constantTimeTokenEqual(`${VALID_TOKEN}, ${VALID_TOKEN}`, VALID_TOKEN)).toBe(false);
    expect(constantTimeTokenEqual(` ${VALID_TOKEN} `, VALID_TOKEN)).toBe(false);
  });

  it("ne lève jamais, même avec des entrées absurdes", () => {
    expect(() => constantTimeTokenEqual(undefined, undefined)).not.toThrow();
    expect(() => constantTimeTokenEqual(null, null)).not.toThrow();
    expect(constantTimeTokenEqual(undefined, undefined)).toBe(false);
  });

  it("ne retourne qu'un booléen (jamais une portion du token)", () => {
    expect(typeof constantTimeTokenEqual(VALID_TOKEN, VALID_TOKEN)).toBe("boolean");
    expect(typeof constantTimeTokenEqual("nope", VALID_TOKEN)).toBe("boolean");
  });
});

describe("qa-auth · isAuthenticatedProductionQaRequest (table de décision)", () => {
  it("Production, bon token → true", () => {
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: VALID_TOKEN, configuredToken: VALID_TOKEN })).toBe(true);
  });

  it("Production, aucun token configuré → false", () => {
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: VALID_TOKEN, configuredToken: undefined })).toBe(false);
  });

  it("Production, token configuré mais aucun en-tête → false", () => {
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: null, configuredToken: VALID_TOKEN })).toBe(false);
  });

  it("Production, mauvais en-tête → false", () => {
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: "x".repeat(VALID_TOKEN.length), configuredToken: VALID_TOKEN })).toBe(false);
  });

  it("Production, token tronqué → false", () => {
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: VALID_TOKEN.slice(0, -1), configuredToken: VALID_TOKEN })).toBe(false);
  });

  it("Production, secret configuré trop court → false même avec en-tête correspondant", () => {
    const short = "0123456789abcdef0123456789abcde"; // 31
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: short, configuredToken: short })).toBe(false);
  });

  it("Production, token vide → false", () => {
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: "", configuredToken: VALID_TOKEN })).toBe(false);
  });

  it("Hors Production (development / test / preview), bon token → false (chemin authentifié réservé à la prod)", () => {
    for (const environment of ["development", "test", "preview"] as const) {
      expect(isAuthenticatedProductionQaRequest({ environment, providedToken: VALID_TOKEN, configuredToken: VALID_TOKEN })).toBe(false);
    }
  });

  it("Variables absentes → aucune exception, false", () => {
    expect(() => isAuthenticatedProductionQaRequest({ environment: "production", providedToken: undefined, configuredToken: undefined })).not.toThrow();
    expect(isAuthenticatedProductionQaRequest({ environment: "production", providedToken: undefined, configuredToken: undefined })).toBe(false);
  });
});

describe("qa-auth · intégration classifyTraffic (Production ne classe `test` que sur QA authentifiée)", () => {
  it("Production + QA authentifiée → test", () => {
    expect(classifyTraffic({ ...base(), authenticatedProductionQa: true })).toBe("test");
  });

  it("Production + QA authentifiée:false → external", () => {
    expect(classifyTraffic({ ...base(), authenticatedProductionQa: false })).toBe("external");
  });

  it("Production + champ QA absent (undefined) → external (fail-closed)", () => {
    expect(classifyTraffic({ ...base() })).toBe("external");
  });

  it("Production + simple x-clonestore-test (sans QA) → external : un en-tête public seul ne suffit JAMAIS", () => {
    expect(classifyTraffic({ ...base(), testHeaderPresent: true })).toBe("external");
  });

  it("Production + x-clonestore-test ET QA authentifiée → test (c'est la QA qui débloque, pas l'en-tête public)", () => {
    expect(classifyTraffic({ ...base(), testHeaderPresent: true, authenticatedProductionQa: true })).toBe("test");
  });

  it("Development + en-tête de test historique → test (comportement actuel préservé)", () => {
    expect(classifyTraffic({ ...base(), environment: "development", testHeaderPresent: true })).toBe("test");
  });

  it("Environnement CI/test → test (comportement actuel préservé)", () => {
    expect(classifyTraffic({ ...base(), environment: "test" })).toBe("test");
  });

  it("Un UA de bot connu l'emporte sur la QA authentifiée → automated (invariant de sécurité inchangé)", () => {
    expect(classifyTraffic({ ...base(), userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)", authenticatedProductionQa: true })).toBe("automated");
  });
});
