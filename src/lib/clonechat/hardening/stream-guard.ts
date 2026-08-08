// src/lib/clonechat/hardening/stream-guard.ts
//
// Machinerie de STREAMING durcie RÉELLE (utilisée par le chemin actif de /api/assistant/chat et testée
// directement). Garantit : fermeture UNE seule fois ; aucun `send` après `close` ; budget de sortie
// borné (deltas tronqués, jamais de fuite) ; abort client → `cancelled` (le provider reçoit le signal,
// aucun chunk tardif) ; timeout provider → erreur/fallback sûr ; erreur provider AVANT premier chunk →
// event d'erreur sûr ; erreur APRÈS deltas → terminaison propre sans faux succès ; circuit ouvert →
// provider NON appelé ; aucun secret dans les events ; nettoyage des timers/listeners (via withTimeout).

import { HardeningError } from "./errors";
import { guardProviderCall } from "./provider-guard";
import type { CircuitBreaker } from "./circuit-breaker";

export type HardenedStreamEvent =
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "done"; readonly payload: unknown }
  | { readonly type: "error"; readonly code: string; readonly message: string }
  | { readonly type: "cancelled"; readonly reason: string };

export interface HardenedStreamSink {
  send(ev: HardenedStreamEvent): void;
  close(): void;
}

export interface HardenedStreamDeps {
  /** Produit la réponse en streamant des deltas via `emit`, puis renvoie le payload `done`. Reçoit un
   *  AbortSignal : un provider coopératif cesse tout travail quand il s'annule (timeout/abort). */
  readonly produce: (emit: (delta: string) => void, signal: AbortSignal) => Promise<{ donePayload: unknown }>;
  readonly breaker?: CircuitBreaker;
  readonly maxOutputChars: number;
  readonly providerTimeoutMs: number;
  readonly parentSignal?: AbortSignal | null;
  /** Classe une erreur provider en {code,message} SÛRS (jamais de secret/stack). */
  readonly onProviderError?: (e: unknown) => { code: string; message: string };
  readonly schedule?: (cb: () => void, ms: number) => { clear: () => void };
}

export interface HardenedStreamResult { readonly outcome: "done" | "error" | "cancelled"; readonly emittedChars: number; readonly closes: number; }

export async function pumpHardenedStream(sink: HardenedStreamSink, deps: HardenedStreamDeps): Promise<HardenedStreamResult> {
  let closed = false;
  let emitted = 0;
  let closes = 0;
  const safeSend = (ev: HardenedStreamEvent) => { if (closed) return; sink.send(ev); };
  const safeClose = () => { if (closed) return; closed = true; closes += 1; sink.close(); };
  const emit = (delta: string) => {
    if (closed || !delta) return;
    const remaining = deps.maxOutputChars - emitted;
    if (remaining <= 0) return; // budget de sortie atteint : plus aucun delta
    const chunk = delta.length > remaining ? delta.slice(0, remaining) : delta;
    emitted += chunk.length;
    safeSend({ type: "delta", text: chunk });
  };

  let outcome: "done" | "error" | "cancelled" = "error";
  try {
    // RETRY EXPLICITEMENT DÉSACTIVÉ pour le streaming (maxRetries=0 par construction : aucun `retry`
    // passé à guardProviderCall). Rejouer un provider de streaming après le 1er delta dupliquerait/
    // corromprait la sortie déjà émise — c'est structurellement dangereux. Le retry BORNÉ (config.retry)
    // n'est appliqué QUE sur le chemin UNAIRE servi (runServedActiveUnary), avant tout output.
    const { donePayload } = await guardProviderCall((sig) => deps.produce(emit, sig), {
      breaker: deps.breaker, timeoutMs: deps.providerTimeoutMs, parentSignal: deps.parentSignal ?? null, schedule: deps.schedule,
    });
    safeSend({ type: "done", payload: donePayload });
    outcome = "done";
  } catch (err) {
    const isCancel = err instanceof HardeningError && err.code === "cancelled";
    if (isCancel || (deps.parentSignal?.aborted && !(err instanceof HardeningError && err.code === "timeout"))) {
      safeSend({ type: "cancelled", reason: "Réponse interrompue." });
      outcome = "cancelled";
    } else {
      const safe = deps.onProviderError
        ? deps.onProviderError(err)
        : { code: err instanceof HardeningError ? err.code : "internal_safe_error", message: "Service temporairement indisponible." };
      safeSend({ type: "error", code: safe.code, message: safe.message });
      outcome = "error";
    }
  } finally {
    safeClose();
  }
  return { outcome, emittedChars: emitted, closes };
}
