// src/lib/pierre/v1/cognitive-runtime/tool-registry.ts
// PHASE 8.14 — the cognitive tool allowlist = the EXISTING closed runtime action registry. The model may
// only ever reference these; anything else is rejected by the plan-validator (compileMissionPlan) and the
// plan-generator's invented-action filter. No arbitrary SQL / URL / shell / provider call is representable.

import { getRuntimeActionDefinition } from "../runtime-action-registry";
import { ALLOWED_ACTION_KEYS } from "./plan-generator";

export type CognitiveTool = { readonly actionKey: string; readonly category: string; readonly risk: string; readonly version: string };

export function listCognitiveTools(): CognitiveTool[] {
  const out: CognitiveTool[] = [];
  for (const key of ALLOWED_ACTION_KEYS) {
    const def = getRuntimeActionDefinition(key);
    if (def) out.push({ actionKey: def.actionKey, category: def.category, risk: def.risk, version: def.version });
  }
  return out;
}

export function isAllowedTool(actionKey: string): boolean {
  return ALLOWED_ACTION_KEYS.includes(actionKey) && getRuntimeActionDefinition(actionKey) !== null;
}
