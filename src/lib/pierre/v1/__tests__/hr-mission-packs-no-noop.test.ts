import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { HR_MISSION_PACKS } from "../hr-mission-packs/registry";
import { getRuntimeActionHandler } from "../runtime-action-handlers";
import { isKnownRuntimeAction } from "../runtime-action-registry";
import type { StepBinding } from "../hr-mission-packs/types";

// P22 reprise — non-regression guard: every runtime_action step across every pack binds to a REAL,
// registered, handled action, and NONE remains `mission.noop`. Also writes the inventory snapshot.
describe("mission packs — no mission.noop remains (P22 reprise)", () => {
  it("has zero mission.noop runtime steps and every action is registered + handled", () => {
    const noops: Array<Record<string, unknown>> = [];
    for (const pack of HR_MISSION_PACKS) {
      for (const s of pack.steps) {
        if (s.binding.type !== "runtime_action") continue;
        const actionKey = (s.binding as Extract<StepBinding, { type: "runtime_action" }>).actionKey;
        if (actionKey === "mission.noop") noops.push({ pack: pack.id, step: s.key, kind: s.kind, label: s.label });
        expect(isKnownRuntimeAction(actionKey)).toBe(true);
        expect(getRuntimeActionHandler(actionKey)).not.toBeNull();
      }
    }
    fs.writeFileSync(
      path.join(process.cwd(), "docs", "reports", "P22_NOOP_INVENTORY.json"),
      JSON.stringify({ total: noops.length, packs_with_noop: [...new Set(noops.map((n) => n.pack))].length, rows: noops }, null, 2),
      "utf8",
    );
    expect(noops).toHaveLength(0);
  });
});
