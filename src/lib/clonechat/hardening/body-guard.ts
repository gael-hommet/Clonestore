// src/lib/clonechat/hardening/body-guard.ts
//
// Protection du TRANSPORT avant parsing (BLOC 13, mode active). Content-Length n'est qu'un signal
// précoce : la lecture est BORNÉE octet par octet, donc un Content-Length mensonger/absent ou un corps
// chunké reste plafonné (jamais un req.json() illimité). Le format attendu par la route est préservé
// (on renvoie le texte à parser).

export type BoundedRead = { readonly tooLarge: true } | { readonly tooLarge: false; readonly text: string };

/** Signal précoce : Content-Length déclaré > limite → true (rejet immédiat possible). */
export function contentLengthExceeds(req: Request, maxBytes: number): boolean {
  const raw = req.headers.get("content-length");
  if (raw == null || raw.trim() === "") return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

/** Lit le corps en bornant le CUMUL réel d'octets. Dépasse la limite → { tooLarge:true } sans tout
 *  bufferiser. Sûr même si Content-Length ment ou est absent (corps chunké). */
export async function readBoundedRequestText(req: Request, maxBytes: number): Promise<BoundedRead> {
  if (contentLengthExceeds(req, maxBytes)) return { tooLarge: true };
  const body = req.body;
  if (!body) {
    const text = await req.text();
    return Buffer.byteLength(text, "utf8") > maxBytes ? { tooLarge: true } : { tooLarge: false, text };
  }
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        total += value.byteLength;
        if (total > maxBytes) { try { await reader.cancel(); } catch { /* déjà fermé */ } return { tooLarge: true }; }
        chunks.push(Buffer.from(value));
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  return { tooLarge: false, text: Buffer.concat(chunks).toString("utf8") };
}
