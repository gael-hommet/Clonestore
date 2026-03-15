// src/lib/pierre/schema.ts

import { z } from "zod";
import {
  PierreDocType,
  PierreTone,
  PIERRE_SCHEMA_VERSION,
  PIERRE_DEFAULT_LANGUAGE,
} from "./docTypes";

/**
 * Questions manquantes (format stable, exploitable UI + logique)
 */
export const MissingInfoQuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]),
    expected_format: z.enum(["text", "number", "date", "email", "phone", "choice"]),
    choices: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type MissingInfoQuestion = z.infer<typeof MissingInfoQuestionSchema>;

/**
 * Flags sécurité
 */
export const SafetyFlagsSchema = z
  .object({
    legal_risk: z.boolean(),
    discrimination_risk: z.boolean(),
    pii_risk: z.boolean(),
  })
  .strict();

export type SafetyFlags = z.infer<typeof SafetyFlagsSchema>;

/**
 * Action (pour Make). IMPORTANT : pas de z.record ici.
 * On accepte un objet libre avec n'importe quelles clés, valeurs unknown.
 */
const LooseObjectSchema = z.object({}).catchall(z.unknown());

export const PierreActionSchema = z
  .object({
    type: z.enum(["doc.generate", "email.send"]),
    payload: LooseObjectSchema.optional(),
  })
  .strict();

export type PierreAction = z.infer<typeof PierreActionSchema>;

/**
 * Réponse finale du Brain (contrat produit)
 */
export const PierreBrainResponseSchema = z
  .object({
    schema_version: z.literal(PIERRE_SCHEMA_VERSION),

    doc_type: z.nativeEnum(PierreDocType),
    doc_title: z.string().min(1),

    tone_used: z.nativeEnum(PierreTone),
    language: z.string().min(2).default(PIERRE_DEFAULT_LANGUAGE),

    // HTML final copiable
    final_text_html: z.string(),

    // Questions si infos manquantes
    missing_info_questions: z.array(MissingInfoQuestionSchema),

    // 0..1
    confidence_score: z.number().min(0).max(1),

    safety_flags: SafetyFlagsSchema,

    // Actions recommandées (Make)
    actions: z.array(PierreActionSchema).default([]),
  })
  .strict();

export type PierreBrainResponse = z.infer<typeof PierreBrainResponseSchema>;
