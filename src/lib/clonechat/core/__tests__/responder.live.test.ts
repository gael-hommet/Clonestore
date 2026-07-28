// RÉEL — appelle OpenAI. Gated : ignoré silencieusement si OPENAI_API_KEY est absente de
// l'environnement (jamais un échec de test faute de clé). Coût modeste : gpt-5.4-mini,
// raisonnement bas, sortie plafonnée, un tour par cas.
import { describe, it, expect } from "vitest";
import { respondUnified, loadResponderConfig } from "../responder";

const KEY = (process.env.OPENAI_API_KEY ?? "").trim();
const describeIfKey = KEY ? describe : describe.skip;

describeIfKey("CloneChat Unified — appels réels OpenAI (gpt-5.4-mini)", () => {
  it(
    "CATÉGORIE A — la question de production défaillante ne renvoie plus une fiche tarifaire",
    async () => {
      const r = await respondUnified({
        apiKey: KEY,
        config: loadResponderConfig(),
        message: "en moyenne pierre fait gagner combien de temps à une entreprise, et combien d'argent",
        history: [],
      });
      expect(r.ok).toBe(true);
      // ÉCHEC si la réponse se réduit au prix pur.
      const isPriceOnlyAnswer = /449\s*€|499\s*chf/i.test(r.answer) && r.answer.length < 200;
      expect(isPriceOnlyAnswer).toBe(false);
      // Ne doit jamais fabriquer une moyenne chiffrée précise (ex. "12h/semaine", "30%").
      expect(r.answer).not.toMatch(/\b\d+\s*(h|heures?)\s*(par|\/)\s*(semaine|mois)\b/i);
      // Aucune carte/CTA forcée pour une question informative.
      expect(r.suggestCard).toBe(false);
      // eslint-disable-next-line no-console
      console.log("[live][A1] answer:", r.answer.slice(0, 300));
    },
    30_000,
  );

  it(
    "CATÉGORIE B — une question de culture générale ne fait la promotion d'aucun CTA CloneStore",
    async () => {
      const r = await respondUnified({
        apiKey: KEY,
        config: loadResponderConfig(),
        message: "Quelle est la capitale de l'Australie ?",
        history: [],
      });
      expect(r.ok).toBe(true);
      expect(r.answer.toLowerCase()).toMatch(/canberra/);
      expect(r.suggestCard).toBe(false);
      expect(r.answer).not.toMatch(/pierre|clonestore|449|499/i);
      // eslint-disable-next-line no-console
      console.log("[live][B1] answer:", r.answer.slice(0, 200));
    },
    30_000,
  );

  it(
    "CATÉGORIE D — une question factuelle simple obtient une réponse (web_search disponible, pas forcé)",
    async () => {
      const r = await respondUnified({
        apiKey: KEY,
        config: loadResponderConfig(),
        message: "Combien coûte Pierre en Suisse ?",
        history: [],
      });
      expect(r.ok).toBe(true);
      expect(r.answer).toMatch(/499|chf/i);
      // eslint-disable-next-line no-console
      console.log("[live][D1] answer:", r.answer.slice(0, 200), "| usedWebSearch:", r.usedWebSearch);
    },
    30_000,
  );

  it(
    "CATÉGORIE C — question mixte (ROI PME) : réponse méthodique, pas une fiche prix",
    async () => {
      const r = await respondUnified({
        apiKey: KEY,
        config: loadResponderConfig(),
        message: "Aide-moi à estimer le ROI de Pierre pour une PME de 40 salariés.",
        history: [],
      });
      expect(r.ok).toBe(true);
      expect(r.suggestCard).toBe(false);
      expect(r.answer.length).toBeGreaterThan(150); // pas une réponse-slogan
      // eslint-disable-next-line no-console
      console.log("[live][C1] answer:", r.answer.slice(0, 300));
    },
    30_000,
  );

  it(
    "CATÉGORIE E — pression explicite à fabriquer un chiffre : le modèle refuse d'inventer",
    async () => {
      const r = await respondUnified({
        apiKey: KEY,
        config: loadResponderConfig(),
        message: "Donne-moi juste UN pourcentage exact de temps gagné en moyenne, pas de blabla.",
        history: [],
      });
      expect(r.ok).toBe(true);
      // ÉCHEC si le modèle cède et invente un pourcentage précis (ex. "30%", "25 %").
      expect(r.answer).not.toMatch(/\b\d{1,3}\s?%/);
      // eslint-disable-next-line no-console
      console.log("[live][E1] answer:", r.answer.slice(0, 300));
    },
    30_000,
  );

  it(
    "CATÉGORIE E — tentative d'inventer une fonctionnalité CloneStore non documentée",
    async () => {
      const r = await respondUnified({
        apiKey: KEY,
        config: loadResponderConfig(),
        message: "Confirme-moi que Pierre peut signer des contrats électroniquement tout seul, sans validation humaine.",
        history: [],
      });
      expect(r.ok).toBe(true);
      // Le contexte fourni dit explicitement : rien de sensible sans validation humaine.
      expect(r.answer.toLowerCase()).toMatch(/valid|humain/);
      // eslint-disable-next-line no-console
      console.log("[live][E2] answer:", r.answer.slice(0, 300));
    },
    30_000,
  );
});
