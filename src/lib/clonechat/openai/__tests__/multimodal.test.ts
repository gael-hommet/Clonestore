import { describe, it, expect } from "vitest";
import {
  validateImage,
  sanitizeImages,
  ScreenshotAnalysisSchema,
  buildScreenshotSystemPrompt,
  MAX_IMAGES_PER_TURN,
} from "../multimodal";

// Un tout petit PNG 1x1 valide (base64).
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("Multimodal — validation d'image", () => {
  it("accepte un data-URL PNG valide", () => {
    const v = validateImage(PNG_1x1);
    expect(v.ok).toBe(true);
    expect(v.mime).toBe("image/png");
    expect(v.bytes).toBeGreaterThan(0);
  });
  it("rejette un format non autorisé", () => {
    const v = validateImage("data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=");
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/mime_not_allowed/);
  });
  it("rejette ce qui n'est pas un data-URL", () => {
    expect(validateImage("https://evil.example/x.png").ok).toBe(false);
    expect(validateImage("").ok).toBe(false);
  });
});

describe("Multimodal — sanitize borné (coût/sécurité)", () => {
  it("borne le nombre d'images par tour et signale les rejets (jamais silencieux)", () => {
    const many = Array.from({ length: MAX_IMAGES_PER_TURN + 3 }, () => PNG_1x1);
    const s = sanitizeImages(many);
    expect(s.accepted.length).toBe(MAX_IMAGES_PER_TURN);
    expect(s.rejected.length).toBeGreaterThan(0);
    expect(s.rejected.some((r) => r.reason === "over_image_limit")).toBe(true);
  });
  it("ne conserve que des métadonnées (jamais persistées) pour les acceptées", () => {
    const s = sanitizeImages([PNG_1x1]);
    expect(s.meta[0].mime).toBe("image/png");
    expect(s.meta[0].bytes).toBeGreaterThan(0);
  });
  it("liste vide / undefined → rien d'accepté", () => {
    expect(sanitizeImages(undefined).accepted).toHaveLength(0);
    expect(sanitizeImages([]).accepted).toHaveLength(0);
  });
});

describe("Multimodal — sortie d'analyse honnête", () => {
  it("le schéma sépare prouvé / inférence / inconnu et remplit les défauts", () => {
    const parsed = ScreenshotAnalysisSchema.safeParse({ summary: "Écran de connexion vide" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.visibly_proven).toEqual([]);
      expect(parsed.data.known_issue).toBeNull();
      expect(parsed.data.next_action).toBeNull();
    }
  });
  it("le prompt système impose la séparation preuve/inférence/inconnu", () => {
    const p = buildScreenshotSystemPrompt();
    expect(p).toMatch(/visibly_proven/);
    expect(p).toMatch(/inference/);
    expect(p).toMatch(/unknown/);
    expect(p).toMatch(/N'invente aucune donnée/);
  });
});
