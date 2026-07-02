// src/lib/clonechat/conversations/types.ts
// P9.4.1 — Modèles de conversation DURABLE (multi-device). Une conversation appartient
// à une entreprise (tenant, résolu serveur) + un utilisateur. Les messages ne stockent
// JAMAIS d'image brute (base64) ni de secret : uniquement des blocs riches + métadonnées.

export type ConversationRole = "user" | "assistant" | "system";

export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly rollingSummary: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastActivityAt: string;
  readonly archivedAt: string | null;
}

export interface StoredMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly seq: number;
  readonly role: ConversationRole;
  /** Blocs riches (text/cards/boundary). JAMAIS de data-URL/base64, JAMAIS de secret. */
  readonly content: unknown[];
  readonly sourceIds: string[];
  readonly actionProposal: unknown | null;
  readonly actionResult: unknown | null;
  readonly usage: unknown | null;      // token counts only
  readonly imageMeta: unknown | null;  // {mime,bytes,sanitizedHash} only
  readonly createdAt: string;
}

/** Contexte tenant résolu SERVEUR (jamais accepté du client de confiance). */
export interface ConversationCtx {
  readonly companyId: string;
  readonly userId: string;
}

export interface AppendMessageInput {
  readonly role: ConversationRole;
  readonly content: unknown[];
  readonly sourceIds?: string[];
  readonly actionProposal?: unknown | null;
  readonly actionResult?: unknown | null;
  readonly usage?: unknown | null;
  readonly imageMeta?: unknown | null;
  /** Horodatage ISO fourni par l'appelant (le store ne lit pas l'horloge). */
  readonly at: string;
}

export interface ConversationStore {
  createConversation(ctx: ConversationCtx, input: { title?: string; at: string }): Promise<ConversationSummary>;
  listConversations(ctx: ConversationCtx, opts?: { limit?: number; includeArchived?: boolean }): Promise<ConversationSummary[]>;
  getConversation(id: string, ctx: ConversationCtx): Promise<ConversationSummary | null>;
  getMessages(id: string, ctx: ConversationCtx, opts?: { limit?: number }): Promise<StoredMessage[]>;
  appendMessage(id: string, ctx: ConversationCtx, msg: AppendMessageInput): Promise<StoredMessage>;
  renameConversation(id: string, ctx: ConversationCtx, title: string, at: string): Promise<void>;
  archiveConversation(id: string, ctx: ConversationCtx, at: string): Promise<void>;
  deleteConversation(id: string, ctx: ConversationCtx): Promise<void>;
  updateSummary(id: string, ctx: ConversationCtx, summary: string, at: string): Promise<void>;
}

// ── Garde de sûreté : neutralise tout contenu interdit avant persistance ─────
const FORBIDDEN_KEYS = new Set(["image_url", "imageUrl", "dataUrl", "base64", "apiKey", "api_key", "token", "secret", "authorization"]);

/** Retire récursivement les data-URL/base64 et clés sensibles des blocs à persister. */
export function sanitizeContentForStorage(content: unknown[]): unknown[] {
  const scrub = (v: unknown): unknown => {
    if (typeof v === "string") return v.startsWith("data:") && v.includes("base64,") ? "[image retirée du stockage]" : v;
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        out[k] = scrub(val);
      }
      return out;
    }
    return v;
  };
  return content.map(scrub);
}
