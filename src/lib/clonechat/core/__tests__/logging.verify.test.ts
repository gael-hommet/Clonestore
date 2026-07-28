// Vérification PONCTUELLE (pas une suite permanente) de la journalisation structurée exigée par
// la correction de production du 2026-07-24 : erreurs journalisées, sans secret, avec le code
// d'erreur, le statut HTTP, le modèle demandé.
import { describe, it, expect, vi } from "vitest";
import { respondUnified, loadResponderConfig, readOpenAIKeyLazy } from "../responder";

describe("CloneChat Unified — vérification de la journalisation d'échec (sans secret)", () => {
  it("readOpenAIKeyLazy journalise bruyamment l'absence de clé EN PRODUCTION", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = readOpenAIKeyLazy({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.event).toBe("clonechat_unified_failure");
    expect(logged.errorCode).toBe("no_api_key");
    expect(logged.production).toBe(true);
    expect(JSON.stringify(logged)).not.toMatch(/sk-|OPENAI_API_KEY=/);
    spy.mockRestore();
  });

  it("readOpenAIKeyLazy ne journalise PAS hors production (dev/test silencieux)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    readOpenAIKeyLazy({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("respondUnified journalise le code d'erreur RÉEL sur un échec réseau (clé invalide), sans exposer la clé", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await respondUnified({
      apiKey: "sk-invalid-verification-key-000000000000",
      config: loadResponderConfig(),
      message: "test",
      history: [],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    const logged = JSON.parse(spy.mock.calls[spy.mock.calls.length - 1][0] as string);
    expect(logged.event).toBe("clonechat_unified_failure");
    expect(typeof logged.errorCode).toBe("string");
    expect(logged.requestedModel).toBe("gpt-5.4-mini");
    expect(JSON.stringify(logged)).not.toMatch(/sk-invalid-verification-key/);
    spy.mockRestore();
  }, 30_000);
});
