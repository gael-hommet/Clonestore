// src/lib/clonechat/core/__tests__/navigation-answer.test.ts
// Défaut RÉEL trouvé en Production (2026-07-29) : une question de NAVIGATION (« Sur quelle page
// puis-je réserver Pierre ? ») faisait choisir au modèle l'outil open_page — un function_call SANS
// texte. respondUnified ne faisant qu'un seul appel, `answer` restait vide → ok=false → la route
// renvoyait « CloneChat rencontre momentanément un problème de connexion à son modèle ».
// Ce test DÉTERMINISTE (SDK openai moqué) verrouille le correctif : une page réelle résolue sans
// texte produit désormais une réponse d'orientation fondée (label + chemin réels), ok=true.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Le modèle renvoie UNIQUEMENT un function_call open_page vers une vraie route publique, sans texte.
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = {
      create: async () => ({
        output_text: "",
        output: [
          {
            type: "function_call",
            name: "open_page",
            arguments: JSON.stringify({ path: "/reserver/pierre", reason: "Page de réservation de Pierre" }),
          },
        ],
        usage: { input_tokens: 20, output_tokens: 0 },
        model: "gpt-5.4-mini",
      }),
    };
  },
}));

import { respondUnified, loadResponderConfig } from "../responder";

describe("CloneChat Unified — réponse de navigation quand open_page n'a pas de texte", () => {
  beforeEach(() => vi.clearAllMocks());

  it("une page réelle résolue sans texte produit une réponse d'orientation fondée (ok=true)", async () => {
    const r = await respondUnified({
      apiKey: "sk-test-key-navigation-000000000000",
      config: loadResponderConfig(),
      message: "Sur quelle page puis-je réserver Pierre ?",
      history: [],
    });
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.answer.trim().length).toBeGreaterThan(0);
    // Réponse fondée sur la VRAIE page (label + chemin du registre), jamais une route inventée.
    expect(r.answer).toContain("Réserver Pierre");
    expect(r.answer).toContain("/reserver/pierre");
    expect(r.openedPage?.ok).toBe(true);
    expect(r.openedPage?.path).toBe("/reserver/pierre");
    // Ne doit JAMAIS retomber sur le message d'indisponibilité pour une simple orientation.
    expect(r.answer).not.toMatch(/problème de connexion|momentanément|indisponible/i);
  });
});
