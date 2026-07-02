// src/lib/clonechat/openai/client.ts
// P9.4 — Abstraction du répondeur OpenAI. Deux implémentations :
//  - `RealOpenAIResponder` (SERVEUR uniquement) : Responses API + sortie structurée
//    stricte + UNE tentative de réparation, puis échec propre (repli côté appelant).
//  - `DeterministicResponder` (pur, sans réseau) : pour les tests / Playwright /
//    panne / budget épuisé. Aucune consommation OpenAI en test.
// La clé n'est jamais exposée ; jamais d'appel OpenAI depuis le navigateur.

import { classifyIntent } from "../intent";
import { parseStructuredOutput, type CloneChatStructuredOutput } from "./structured-output";
import { ALL_TOOL_NAMES, type CloneChatToolName } from "./tool-registry";

export interface OpenAIRequest {
  readonly model: string;
  readonly system: string;
  readonly userText: string;
  readonly imageDataUrls?: readonly string[];
  readonly history?: readonly { role: "user" | "assistant"; text: string }[];
  readonly maxOutputTokens: number;
}

export interface OpenAIUsage {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
}

export interface OpenAIResult {
  readonly ok: boolean;
  readonly structured: CloneChatStructuredOutput | null;
  readonly usage: OpenAIUsage;
  readonly error: string | null;
}

export interface OpenAIResponder {
  respond(req: OpenAIRequest): Promise<OpenAIResult>;
}

const ZERO_USAGE = (model: string): OpenAIUsage => ({ model, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });

// ── Répondeur RÉEL (serveur) ─────────────────────────────────────────────────

/** Construit le répondeur OpenAI réel. `apiKey` fourni par le serveur (jamais client). */
export function createRealOpenAIResponder(apiKey: string): OpenAIResponder {
  return {
    async respond(req: OpenAIRequest): Promise<OpenAIResult> {
      // Import dynamique : le SDK reste hors du bundle client.
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });

      const userContent: Array<Record<string, unknown>> = [{ type: "input_text", text: req.userText }];
      for (const url of req.imageDataUrls ?? []) {
        userContent.push({ type: "input_image", image_url: url, detail: "low" });
      }
      const input: Array<Record<string, unknown>> = [
        { role: "system", content: req.system },
        ...(req.history ?? []).map((h) => ({ role: h.role, content: h.text })),
        { role: "user", content: userContent },
      ];

      const jsonContract =
        'Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de forme : ' +
        '{"answer": string, "honesty": "answered"|"unknown"|"needs_clarification", ' +
        '"tool_call": null | {"name": <un outil de l\'allowlist>, "arguments": object}, "citations": string[]}. ' +
        'Outils autorisés (allowlist) : ' + ALL_TOOL_NAMES.join(", ") + '. ' +
        'Ne propose jamais un outil hors de cette liste. N\'invente aucune donnée.';
      const systemFull = `${req.system}\n\n${jsonContract}`;
      const call = async (repair: boolean) => {
        const baseInput = [{ role: "system", content: systemFull }, ...input.slice(1)];
        const res = await client.responses.create({
          model: req.model,
          max_output_tokens: req.maxOutputTokens,
          input: repair ? [...baseInput, { role: "system", content: "Ta réponse précédente n'était pas un JSON valide. Renvoie STRICTEMENT l'objet JSON demandé, sans texte autour." }] : baseInput,
          text: { format: { type: "json_object" } },
        } as unknown as Parameters<typeof client.responses.create>[0]);
        const usage = {
          model: (res as { model?: string }).model ?? req.model,
          inputTokens: (res as { usage?: { input_tokens?: number } }).usage?.input_tokens ?? 0,
          outputTokens: (res as { usage?: { output_tokens?: number } }).usage?.output_tokens ?? 0,
          cachedInputTokens: (res as { usage?: { input_tokens_details?: { cached_tokens?: number } } }).usage?.input_tokens_details?.cached_tokens ?? 0,
        };
        const text = (res as { output_text?: string }).output_text ?? "";
        return { parsed: parseStructuredOutput(text), usage };
      };

      try {
        let { parsed, usage } = await call(false);
        if (!parsed.ok) {
          // UNE seule tentative de réparation.
          const retry = await call(true);
          parsed = retry.parsed;
          usage = { ...usage, inputTokens: usage.inputTokens + retry.usage.inputTokens, outputTokens: usage.outputTokens + retry.usage.outputTokens };
        }
        if (!parsed.ok || !parsed.value) return { ok: false, structured: null, usage, error: "structured_output_invalid" };
        return { ok: true, structured: parsed.value, usage, error: null };
      } catch (e) {
        const status = (e as { status?: number }).status;
        return { ok: false, structured: null, usage: ZERO_USAGE(req.model), error: status ? `openai_http_${status}` : "openai_error" };
      }
    },
  };
}

// ── Répondeur DÉTERMINISTE (tests / repli, sans réseau) ─────────────────────

/** Produit une sortie structurée plausible à partir des règles (aucun appel réseau). */
export function createDeterministicResponder(): OpenAIResponder {
  return {
    async respond(req: OpenAIRequest): Promise<OpenAIResult> {
      const c = classifyIntent(req.userText);
      const toolByIntent: Partial<Record<string, CloneChatToolName>> = {
        create_mission: "prepare_mission",
        list_missions: "list_missions",
        open_mission: "list_missions",
        list_validations: "list_validations",
        list_employees: "list_employees",
        open_employee: "open_employee",
        find_document: "find_document",
        summarize: "company_summary",
        status: "company_summary",
      };
      const tool = toolByIntent[c.intent];
      const structured: CloneChatStructuredOutput = {
        answer: c.intent === "clarify"
          ? "Pouvez-vous préciser votre demande ?"
          : "Voici ce que je peux faire pour vous.",
        honesty: c.intent === "clarify" ? "needs_clarification" : "answered",
        tool_call: tool
          ? { name: tool, arguments: tool === "prepare_mission" ? { instruction: c.entities.missionInstruction ?? req.userText } : tool === "open_employee" ? { employee_id: c.entities.employeeQuery ?? "" } : tool === "find_document" ? { query: c.entities.documentQuery ?? "" } : {} }
          : null,
        citations: [],
      };
      return { ok: true, structured, usage: { model: "deterministic", inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }, error: null };
    },
  };
}
