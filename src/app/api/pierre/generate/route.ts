import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

export const runtime = "nodejs";

const ROUTER_HMAC_SECRET = process.env.ROUTER_HMAC_SECRET!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!ROUTER_HMAC_SECRET) throw new Error("Missing ROUTER_HMAC_SECRET");
if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

/**
 * =========================
 * HMAC Auth
 * =========================
 */
function timingSafeEqualHex(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function assertRouterAuth(req: Request, rawBody: string) {
  const clientId = req.headers.get("x-client-id") || "";
  const timestamp = req.headers.get("x-timestamp") || "";
  const signature = req.headers.get("x-signature") || "";

  if (!clientId || !timestamp || !signature) throw new Error("UNAUTHORIZED");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error("UNAUTHORIZED");

  const now = Date.now();
  if (Math.abs(now - ts) > 5 * 60 * 1000) throw new Error("UNAUTHORIZED");

  const expected = crypto
    .createHmac("sha256", ROUTER_HMAC_SECRET)
    .update(`${clientId}.${timestamp}.${rawBody}`)
    .digest("hex");

  if (!timingSafeEqualHex(expected, signature)) throw new Error("UNAUTHORIZED");
  return clientId;
}

function jsonFail(code: string, message: string, details?: any, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/**
 * =========================
 * Input schema
 * =========================
 */
const GenerateSchema = z.object({
  client_id: z.string().min(3),
  request_id: z.string().min(3),
  mission: z.enum(["doc", "email", "hris"]),
  payload: z.object({}).passthrough().default({}),
});

/**
 * =========================
 * Output schema (zod) — on reste flexible côté server,
 * le strict est imposé par le json_schema OpenAI
 * =========================
 */
const ActionSchema = z.object({
  type: z.literal("call_execute"),
  action: z.enum(["doc.generate", "email.send", "hris.sync"]),
  payload: z.object({}).passthrough(),
});

const ModelOutSchema = z.object({
  agent: z.literal("pierre"),
  request_id: z.string().min(3),
  reasoning_summary: z.string().min(1),
  actions: z.array(ActionSchema).min(1),
  safety: z.object({
    pii_detected: z.boolean(),
    requires_human_review: z.boolean(),
    notes: z.string().default(""),
  }),
});

/**
 * =========================
 * JSON Schema STRICT (OpenAI)
 * IMPORTANT: additionalProperties: false PARTOUT
 * =========================
 */

// payloads stricts
const DOC_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "title", "html", "filename", "doc_type"],
  properties: {
    request_id: { type: "string", minLength: 3 },
    title: { type: "string", minLength: 1 },
    html: { type: "string", minLength: 1 },
    filename: { type: "string", minLength: 3 },
    doc_type: { type: "string", minLength: 2 },
  },
} as const;

const EMAIL_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "to", "subject", "body_html"],
  properties: {
    request_id: { type: "string", minLength: 3 },
    to: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 3 },
    },
    subject: { type: "string", minLength: 1 },
    body_html: { type: "string", minLength: 1 },
  },
} as const;

// HRIS : payload libre interdit en strict json_schema → on passe un JSON string
const HRIS_PAYLOAD = {
  type: "object",
  additionalProperties: false,
  required: ["request_id", "vendor", "mode", "payload_json"],
  properties: {
    request_id: { type: "string", minLength: 3 },
    vendor: { type: "string", minLength: 2 },
    mode: { type: "string", enum: ["import", "api", "both"] },
    payload_json: { type: "string", minLength: 2 }, // JSON.stringify(...)
  },
} as const;

// actions discriminées (action → payload)
const ACTION_DOC = {
  type: "object",
  additionalProperties: false,
  required: ["type", "action", "payload"],
  properties: {
    type: { type: "string", enum: ["call_execute"] },
    action: { type: "string", enum: ["doc.generate"] },
    payload: DOC_PAYLOAD,
  },
} as const;

const ACTION_EMAIL = {
  type: "object",
  additionalProperties: false,
  required: ["type", "action", "payload"],
  properties: {
    type: { type: "string", enum: ["call_execute"] },
    action: { type: "string", enum: ["email.send"] },
    payload: EMAIL_PAYLOAD,
  },
} as const;

const ACTION_HRIS = {
  type: "object",
  additionalProperties: false,
  required: ["type", "action", "payload"],
  properties: {
    type: { type: "string", enum: ["call_execute"] },
    action: { type: "string", enum: ["hris.sync"] },
    payload: HRIS_PAYLOAD,
  },
} as const;

const OUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["agent", "request_id", "reasoning_summary", "actions", "safety"],
  properties: {
    agent: { type: "string", enum: ["pierre"] },
    request_id: { type: "string", minLength: 3 },
    reasoning_summary: { type: "string", minLength: 1 },
    actions: {
      type: "array",
      minItems: 1,
      items: {
        anyOf: [ACTION_DOC, ACTION_EMAIL, ACTION_HRIS],
      },
    },
    safety: {
      type: "object",
      additionalProperties: false,
      required: ["pii_detected", "requires_human_review", "notes"],
      properties: {
        pii_detected: { type: "boolean" },
        requires_human_review: { type: "boolean" },
        notes: { type: "string" },
      },
    },
  },
} as const;

function buildInstructions() {
  return `
Tu es Pierre, agent RH CloneStore.

Entrée JSON:
- client_id
- request_id
- mission ∈ ["doc","email","hris"]
- payload

Tu dois renvoyer du JSON STRICT selon le schema imposé.

Règles:
- agent="pierre"
- request_id = copie exacte de l'entrée
- actions non vide

Conventions:
- Si mission="doc": renvoie 1 action doc.generate avec payload {request_id:"doc_<request_id>", title, html, filename, doc_type}
- Si mission="email": renvoie 1 action email.send avec payload {request_id:"email_<request_id>", to, subject, body_html}
- Si mission="hris": renvoie 1 action hris.sync avec payload {request_id:"hris_<request_id>", vendor, mode, payload_json}
  - payload_json DOIT être une string JSON (JSON.stringify).
`.trim();
}

/**
 * =========================
 * Extraction robuste
 * =========================
 */
function tryParseJson(s: any) {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractModelJson(openaiResponse: any) {
  if (typeof openaiResponse?.output_text === "string") {
    const j = tryParseJson(openaiResponse.output_text);
    if (j) return j;
  }

  const out = openaiResponse?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string") {
            const j = tryParseJson(c.text);
            if (j) return j;
          }
        }
      }
    }
  }
  return null;
}

/**
 * =========================
 * Call OpenAI (Responses)
 * =========================
 */
async function callOpenAI(input: z.infer<typeof GenerateSchema>) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: buildInstructions(),
      input: JSON.stringify(input),
      temperature: 0.2,
      text: {
        format: {
          type: "json_schema",
          name: "pierre_generate_v1",
          strict: true,
          schema: OUT_SCHEMA,
        },
      },
    }),
  });

  const rawText = await res.text();
  let rawJson: any = null;
  try {
    rawJson = rawText ? JSON.parse(rawText) : null;
  } catch {
    return { ok: false, status: res.status, raw: rawText, error: "OPENAI_NOT_JSON" };
  }

  if (!res.ok) return { ok: false, status: res.status, raw: rawJson, error: "OPENAI_HTTP_ERROR" };

  const modelJson = extractModelJson(rawJson);
  if (!modelJson) {
    return { ok: false, status: 502, raw: rawJson, error: "CANNOT_EXTRACT_MODEL_JSON" };
  }

  return { ok: true, modelJson };
}

export async function POST(req: Request) {
  const raw = await req.text();

  // Auth
  let clientFromHeader = "";
  try {
    clientFromHeader = assertRouterAuth(req, raw);
  } catch {
    return jsonFail("UNAUTHORIZED", "Router signature invalid or missing", undefined, 401);
  }

  // Parse
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonFail("BAD_REQUEST", "Invalid JSON body");
  }

  // Validate input
  let input: z.infer<typeof GenerateSchema>;
  try {
    input = GenerateSchema.parse(body);
  } catch (e: any) {
    return jsonFail("BAD_REQUEST", "Validation error", e?.errors ?? e, 400);
  }

  if (input.client_id !== clientFromHeader) {
    return jsonFail("CLIENT_ID_MISMATCH", "client_id mismatch", undefined, 403);
  }

  // Call OpenAI
  const ai = await callOpenAI(input);
  if (!ai.ok) {
    return jsonFail("OPENAI_ERROR", "OpenAI call failed", ai, 502);
  }

  // Force server side safety
  const fixed = { ...ai.modelJson, agent: "pierre", request_id: input.request_id };

  // Validate output
  let out: z.infer<typeof ModelOutSchema>;
  try {
    out = ModelOutSchema.parse(fixed);
  } catch (e: any) {
    return jsonFail(
      "OPENAI_ERROR",
      "Model JSON does not match required schema",
      { zod: e?.errors ?? e, modelJson: ai.modelJson },
      502
    );
  }

  // Post-process: si hris.sync → convertir payload_json string en vrai objet pour execute (optionnel)
  // (On le fait plutôt dans execute plus tard. Là on renvoie brut.)
  return NextResponse.json({ ok: true, result: out }, { status: 200 });
}





