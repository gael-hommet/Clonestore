// src/app/api/pierre/brain/route.ts

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import {
  PierreDocType,
  PierreTone,
  PIERRE_SCHEMA_VERSION,
  PIERRE_DEFAULT_LANGUAGE,
  PIERRE_CONFIDENCE_THRESHOLD,
} from "@/lib/pierre/docTypes";
import { PierreBrainResponseSchema } from "@/lib/pierre/schema";

/* ============================== */
/* INPUT VALIDATION               */
/* ============================== */

const BrainInputSchema = z.object({
  input: z.string().min(3),
  tone: z.nativeEnum(PierreTone).optional(),
  language: z.string().optional(),
  company_name: z.string().optional(),
});

/* ============================== */
/* ROUTE                          */
/* ============================== */

function checkWorkerAuth(req: Request): boolean {
  const workerSecret = process.env.PIERRE_QUEUE_WORKER_SECRET;
  // P17 — fail-CLOSED en production (convention « ouverte sans secret » tolérée en dev/test seulement).
  if (!workerSecret) return process.env.NODE_ENV !== "production";
  const provided = (req as Request & { headers: Headers }).headers.get("x-pierre-worker-secret");
  return provided === workerSecret;
}

export async function POST(req: Request) {
  if (!checkWorkerAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const body = await req.json();
    const parsed = BrainInputSchema.parse(body);

    const prompt = `
Tu es Pierre, assistant RH routeur.

Tu dois répondre STRICTEMENT en JSON valide.
Aucun texte autour.

Format exact :

{
  "doc_type": "STRING",
  "confidence_score": 0.0,
  "tone_used": "pro",
  "missing_info_questions": []
}

Doc types autorisés :
${Object.values(PierreDocType).join(", ")}

Si ambigu -> doc_type = UNKNOWN

Brief:
${parsed.input}

Ton demandé:
${parsed.tone || "pro"}

Entreprise:
${parsed.company_name || "non précisée"}
`;

    const response = await openai.responses.create({
      model: process.env.PIERRE_BRAIN_MODEL || "gpt-4.1",
      input: prompt,
      max_output_tokens: 500,
    });

    const raw = response.output_text;

    if (!raw) {
      console.log("RAW FULL RESPONSE:", response);
      throw new Error("Model returned no output_text");
    }

    let routing;
    try {
      routing = JSON.parse(raw);
    } catch {
      console.log("MODEL RAW OUTPUT:", raw);
      throw new Error("Model did not return valid JSON");
    }

    const mustAsk =
      routing.doc_type === PierreDocType.UNKNOWN ||
      routing.confidence_score < PIERRE_CONFIDENCE_THRESHOLD ||
      (routing.missing_info_questions &&
        routing.missing_info_questions.length > 0);

    const final = PierreBrainResponseSchema.parse({
      schema_version: PIERRE_SCHEMA_VERSION,
      doc_type: routing.doc_type,
      doc_title:
        routing.doc_type === PierreDocType.UNKNOWN
          ? "Clarification nécessaire"
          : "Document RH — Pierre",
      tone_used: routing.tone_used || parsed.tone || PierreTone.PRO,
      language: parsed.language || PIERRE_DEFAULT_LANGUAGE,
      final_text_html: mustAsk
        ? ""
        : "<p>Routing OK. Generation premium arrive.</p>",
      missing_info_questions: routing.missing_info_questions || [],
      confidence_score: routing.confidence_score || 0.5,
      safety_flags: {
        legal_risk: false,
        discrimination_risk: false,
        pii_risk: false,
      },
      actions: [],
    });

    return NextResponse.json(final);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 400 }
    );
  }
}

