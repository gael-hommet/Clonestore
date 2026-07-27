// src/lib/pierre/v1/hr-mission-packs/instruction-router.ts
// P22 Reprise 12 — DETERMINISTIC (non-LLM) natural-instruction → mission-pack router. It scores every
// pack by token overlap between the normalized instruction and the pack's supportedIntents + title + id
// (this is the first consumer of `supportedIntents`, which was previously written but never read). The
// best match above a floor is returned; ties and no-match return null (never a random pack). This is the
// UNIFIED entry: routeInstructionToPack → packToRuntimePlan → createMissionRunFromPlan drives a natural
// instruction into the single AUTHORITATIVE runtime, not the legacy cognitive/Subsystem-A path.

import { HR_MISSION_PACKS } from "./registry";
import type { HrMissionPackDefinition } from "./types";

const COMBINING_MARKS = new RegExp("[̀-ͯ]", "g");
function norm(s: string): string { return s.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, ""); }
function tokenize(s: string): string[] { return norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3); }

export type PackRoute = { pack: HrMissionPackDefinition; score: number; matched: string[] };

/** Route an instruction to the best-matching pack. Deterministic: same input → same output. Returns null
 *  when nothing scores (the caller then falls back — it never guesses a pack). */
export function routeInstructionToPack(instruction: string, packs: readonly HrMissionPackDefinition[] = HR_MISSION_PACKS): PackRoute | null {
  const itoks = new Set(tokenize(instruction));
  if (itoks.size === 0) return null;
  let best: PackRoute | null = null;
  let tie = false;
  for (const p of packs) {
    const keyTokens = new Set<string>([
      ...tokenize(p.id.replace(/\./g, " ")),
      ...tokenize(p.title),
      ...(p.supportedIntents ?? []).flatMap((i) => tokenize(i.replace(/[._]/g, " "))),
    ]);
    const matched = [...keyTokens].filter((t) => itoks.has(t));
    const score = matched.length;
    if (score === 0) continue;
    if (!best || score > best.score) { best = { pack: p, score, matched }; tie = false; }
    else if (score === best.score && p.id !== best.pack.id) { tie = true; }
  }
  // A tie (two packs equally matched) is NOT resolved arbitrarily — the caller must disambiguate.
  return best && !tie ? best : (best && tie ? null : best);
}
