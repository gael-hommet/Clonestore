// src/lib/pierre/v1/cognitive-runtime/evidence.ts
// PHASE 8.14 — result verification (owner §13): Pierre may only CLAIM an effect after re-reading it from
// the server. This module provides the verification contract used to close cognitive operations honestly:
// a claimed effect is confirmed ONLY if a server re-read returns the expected persisted state. No re-read
// → not confirmed (never a false success). Pure over an injected re-read function (DB in production).

export type ClaimedEffect = {
  readonly kind: "mission_created" | "task_created" | "document_generated" | "message_sent" | "validation_recorded" | "employee_updated" | "provider_submitted";
  readonly ref: string;                       // the id/key that must exist server-side
};

export type EffectVerification = {
  readonly kind: ClaimedEffect["kind"];
  readonly ref: string;
  readonly confirmed: boolean;
  readonly reason: string;
};

export type ServerReadFn = (effect: ClaimedEffect) => Promise<boolean>;

/** Verify one claimed effect via a server re-read. Fail-closed: any error → not confirmed. */
export async function verifyEffect(effect: ClaimedEffect, read: ServerReadFn): Promise<EffectVerification> {
  if (!effect.ref) return { kind: effect.kind, ref: effect.ref, confirmed: false, reason: "missing_ref" };
  try {
    const ok = await read(effect);
    return { kind: effect.kind, ref: effect.ref, confirmed: ok, reason: ok ? "server_confirmed" : "not_found_on_reread" };
  } catch (e) {
    return { kind: effect.kind, ref: effect.ref, confirmed: false, reason: `reread_error:${(e as Error).message.slice(0, 60)}` };
  }
}

export async function verifyAllEffects(effects: readonly ClaimedEffect[], read: ServerReadFn): Promise<{ verifications: EffectVerification[]; allConfirmed: boolean; fabricated: number }> {
  const verifications = await Promise.all(effects.map((e) => verifyEffect(e, read)));
  const fabricated = verifications.filter((v) => !v.confirmed).length;
  return { verifications, allConfirmed: fabricated === 0, fabricated };
}
