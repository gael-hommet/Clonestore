// src/lib/pierre/v1/ultimate/p16a/__tests__/p16a-scenario-matrix.test.ts
// P16A — asserts the 20 behavioral scenarios (owner §18) over the REAL deterministic contract.

import { describe, it, expect, beforeAll } from "vitest";
import { runScenarioMatrix, type ScenarioRecord } from "../scenario-matrix";

let S: ScenarioRecord[];
const by = (n: number) => S.find((s) => s.n === n)!;
beforeAll(async () => { S = await runScenarioMatrix(); }, 120_000);

describe("P16A scenario matrix (20 scenarios)", () => {
  it("all 20 scenarios produce a governed record", () => {
    expect(S).toHaveLength(20);
    for (const s of S) { expect(s.disposition.length).toBeGreaterThan(0); expect(s.nextSafeStep.length).toBeGreaterThan(0); }
  });

  it("sensitive final decisions are human-only (12 salary, 13 dismissal, 14 sanction)", () => {
    expect(by(12).disposition).toBe("human_only"); expect(by(12).humanOnly).toContain("salary_change");
    expect(by(13).disposition).toBe("human_only"); expect(by(13).humanOnly).toContain("dismissal");
    expect(by(14).disposition).toBe("human_only"); expect(by(14).humanOnly).toContain("sanction");
  });

  it("send/sign scenarios never claim completion (10 mail, 11 signature)", () => {
    for (const n of [10, 11]) {
      expect(by(n).explanation).not.toMatch(/envoy[ée]|sign[ée]/i);
      expect(by(n).disposition).not.toBe("execute_local");
    }
  });

  it("continuity resolves the authoritative target (6 continue, 7 correct, 8 latest, 9 status)", () => {
    expect(by(6).continuityTarget).toBe("mis-onb");
    expect(by(7).continuityTarget).toBe("art-doc");
    expect(by(8).continuityTarget).toBe("v2");
    expect(by(9).authoritativeStatus).toBe("must_re-read_durable_state");
  });

  it("missing (15) and ambiguous (16) employee both block on clarification", () => {
    expect(by(15).clarificationBlocks).toBe(true);
    expect(by(16).clarificationBlocks).toBe(true);
  });

  it("duplicate request (18) is identical to (1) — idempotent", () => {
    expect(by(18).capabilities).toEqual(by(1).capabilities);
    expect(by(18).disposition).toBe(by(1).disposition);
    expect(by(18).missionTasks).toBe(by(1).missionTasks);
  });

  it("foreign-tenant entity (19) is permission-blocked, never acted on", () => {
    expect(by(19).blockedCodes).toContain("permission_forbidden_entity");
    expect(by(19).disposition).not.toBe("execute_local");
  });

  it("pre-payroll (4) stays preparation, not the full engine", () => {
    expect(by(4).disposition).not.toBe("execute_local");
    expect(by(4).canonicalItems).toContain("pierre.absences_prepayroll");
  });

  it("unsupported request (20) is declined honestly", () => {
    expect(by(20).disposition).toBe("refused_unsupported");
  });
});
