// src/lib/clonechat/openai/streaming.ts
// C1.7 §8 — STREAMING RÉEL (pur, testable).
//
// Le piège : CloneChat valide les citations et applique la GARDE DE CLAIMS (C1) sur la réponse
// COMPLÈTE. Diffuser les jetons bruts au fil de l'eau reviendrait à montrer à l'utilisateur du
// texte NON GARDÉ — donc potentiellement une revendication interdite (« paiement en ligne
// ouvert », « signature live »…) — avant de le corriger. Inacceptable.
//
// Solution : une PORTE À PHRASES. On accumule les vrais jetons du provider et on ne LIBÈRE une
// phrase que lorsqu'elle est complète ET qu'elle a passé la garde. C'est du streaming AUTHENTIQUE
// (les morceaux viennent réellement du provider, au rythme du provider) — ce n'est PAS une
// réponse déjà complète révélée lettre par lettre, ce que la spec interdit explicitement.

/** Fin de phrase : ponctuation forte suivie d'une espace/fin, ou saut de ligne. */
const SENTENCE_END = /([.!?…:]["»)\]]?\s|\n)/;

export interface SentenceGate {
  /** Absorbe un delta réel du provider ; rend les phrases prêtes à être diffusées. */
  push(delta: string): string[];
  /** Vide le tampon en fin de flux (dernière phrase éventuellement sans ponctuation). */
  flush(): string[];
  /** Texte brut accumulé (pour la validation finale). */
  raw(): string;
}

/**
 * @param guard applique la garde de claims à un fragment. Elle doit être IDEMPOTENTE et ne
 *              jamais rendre un texte plus permissif que son entrée.
 */
export function createSentenceGate(guard: (text: string) => string): SentenceGate {
  let buffer = "";
  let all = "";

  function take(): string[] {
    const out: string[] = [];
    for (;;) {
      const m = SENTENCE_END.exec(buffer);
      if (!m) break;
      const cut = m.index + m[0].length;
      const sentence = buffer.slice(0, cut);
      buffer = buffer.slice(cut);
      const guarded = guard(sentence);
      if (guarded.length > 0) out.push(guarded);
    }
    return out;
  }

  return {
    push(delta) {
      if (!delta) return [];
      buffer += delta;
      all += delta;
      return take();
    },
    flush() {
      const rest = buffer;
      buffer = "";
      if (rest.trim().length === 0) return [];
      const guarded = guard(rest);
      return guarded.length > 0 ? [guarded] : [];
    },
    raw: () => all,
  };
}

// ── Extraction progressive du champ `answer` d'un flux JSON ──────────────────
// Le contrat de sortie est un objet JSON ({"answer": "...", "citations": [...]}). Le provider
// diffuse donc du JSON, pas de la prose. Cet automate suit l'état du flux et ne restitue QUE le
// contenu du champ demandé, déséchappé, au fur et à mesure. Aucune analyse JSON complète n'est
// nécessaire (elle exigerait le document entier — donc la fin du streaming).
export interface JsonFieldExtractor {
  push(chunk: string): string;
  done(): boolean;
}

export function createJsonStringFieldExtractor(field: string): JsonFieldExtractor {
  const needle = `"${field}"`;
  let seenKey = false;   // la clé a été rencontrée
  let inString = false;  // on est DANS la valeur (guillemets ouverts)
  let finished = false;
  let escape = false;
  let pending = "";      // tampon pour repérer la clé à cheval sur deux chunks

  return {
    done: () => finished,
    push(chunk) {
      if (finished || !chunk) return "";
      let out = "";

      for (const ch of chunk) {
        if (!seenKey) {
          pending += ch;
          if (pending.length > needle.length + 8) pending = pending.slice(-(needle.length + 8));
          if (pending.includes(needle)) { seenKey = true; pending = ""; }
          continue;
        }
        if (!inString) {
          if (ch === '"') inString = true; // ouverture de la valeur
          continue;                        // on ignore ':' et espaces
        }
        // Dans la chaîne : gérer les échappements JSON.
        if (escape) {
          out += ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "u" ? "" : ch;
          escape = false;
          continue;
        }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { finished = true; break; } // fin de la valeur
        out += ch;
      }
      return out;
    },
  };
}

// ── Encodage SSE ─────────────────────────────────────────────────────────────
export type StreamEvent =
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "done"; readonly payload: unknown }
  | { readonly type: "cancelled"; readonly reason: string }
  | { readonly type: "error"; readonly code: StreamErrorCode; readonly message: string };

/** Catégories d'échec DISTINCTES (§4D) — un timeout n'est pas une erreur provider. */
export type StreamErrorCode = "TIMEOUT" | "RATE_LIMITED" | "BUDGET_BLOCKED" | "PROVIDER_ERROR";

export function encodeStreamEvent(e: StreamEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

/** Classe une panne provider — sans jamais la transformer en succès. */
export function classifyProviderFailure(err: unknown): { code: StreamErrorCode; message: string } {
  const name = (err as { name?: string })?.name ?? "";
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? "");

  if (name === "AbortError") return { code: "TIMEOUT", message: "La réponse a été interrompue." };
  if (status === 429 || /rate limit/i.test(msg)) return { code: "RATE_LIMITED", message: "Trop de demandes en même temps. Réessayez dans un instant." };
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) return { code: "TIMEOUT", message: "Le service a mis trop de temps à répondre. Réessayez." };
  return { code: "PROVIDER_ERROR", message: "Je n'ai pas pu répondre à l'instant. Réessayez — votre message est conservé." };
}
