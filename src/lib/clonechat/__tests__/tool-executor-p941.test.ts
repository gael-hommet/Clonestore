import { describe, it, expect, vi } from "vitest";
import { executeGovernedAction, createIdempotencyLedger, type ExecutionDeps } from "../tool-executor";
import { createInMemoryBudget } from "../budget-memory";
import type { CloneChatProposedAction } from "../types";
import type { CloneChatOpenAIConfig } from "../openai/config";

function act(over: Partial<CloneChatProposedAction>): CloneChatProposedAction {
  return { id: "a1", kind: "decide_validation", label: "x", risk: "sensitive", requiresConfirmation: true, allowed: true, reason: null, payload: {}, href: null, ...over };
}
const noop = { submitMission: vi.fn(), ...createIdempotencyLedger() } as unknown as ExecutionDeps;

describe("P9.4.1 tool-executor — decide_validation", () => {
  it("exécute une décision réelle via le contrat injecté", async () => {
    const decide = vi.fn(async () => ({ ok: true }));
    const out = await executeGovernedAction(act({ payload: { validationId: "v1", decision: "approve", version: 3 } }), { ...noop, decideValidation: decide, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("executed");
    expect(decide).toHaveBeenCalledWith("v1", "approve", 3);
  });
  it("refuse sans confirmation", async () => {
    const decide = vi.fn();
    const out = await executeGovernedAction(act({ payload: { validationId: "v1", decision: "reject", version: 1 } }), { ...noop, decideValidation: decide, ...createIdempotencyLedger() }, false);
    expect(out.kind).toBe("refused");
    expect(decide).not.toHaveBeenCalled();
  });
  it("refuse si le contrat n'est pas branché (honnêteté)", async () => {
    const out = await executeGovernedAction(act({ payload: { validationId: "v1", decision: "approve", version: 1 } }), { ...noop, decideValidation: undefined, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("refused");
    if (out.kind === "refused") expect(out.reason).toBe("decide_unavailable");
  });
  it("idempotent : une décision confirmée ne s'exécute pas deux fois", async () => {
    const decide = vi.fn(async () => ({ ok: true }));
    const ledger = createIdempotencyLedger();
    const a = act({ payload: { validationId: "v1", decision: "approve", version: 1 } });
    await executeGovernedAction(a, { ...noop, decideValidation: decide, ...ledger }, true);
    const second = await executeGovernedAction(a, { ...noop, decideValidation: decide, ...ledger }, true);
    expect(second.kind).toBe("duplicate");
    expect(decide).toHaveBeenCalledTimes(1);
  });
});

describe("P9.4.1 tool-executor — cancel_mission & create_support_case", () => {
  it("annule une mission via le contrat réel", async () => {
    const cancel = vi.fn(async () => ({ ok: true }));
    const out = await executeGovernedAction(act({ kind: "cancel_mission", risk: "irreversible", payload: { missionId: "m1" } }), { ...noop, cancelMission: cancel, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("executed");
    expect(cancel).toHaveBeenCalledWith("m1");
  });
  it("ouvre un cas de support durable", async () => {
    const create = vi.fn(async () => ({ ok: true, id: "case-1" }));
    const out = await executeGovernedAction(act({ kind: "create_support_case", payload: { summary: "export cassé" } }), { ...noop, createSupportCase: create, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("executed");
    expect(create).toHaveBeenCalledWith("export cassé");
  });
});

describe("P9.4.2 tool-executor — idempotence DURABLE cross-session", () => {
  it("claimDurable='duplicate' → refuse l'effet (aucune exécution)", async () => {
    const submit = vi.fn(async () => ({ ok: true, missionId: "m1" }));
    const claimDurable = vi.fn(async () => ({ fingerprint: "exec_x", status: "duplicate" as const }));
    const settleDurable = vi.fn(async () => {});
    const out = await executeGovernedAction(act({ kind: "create_mission", payload: { instruction: "faire X" } }), { submitMission: submit, claimDurable, settleDurable, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("duplicate");
    expect(submit).not.toHaveBeenCalled();
    expect(settleDurable).not.toHaveBeenCalled();
  });
  it("claimDurable='new' + succès → settleDurable(fp,true) ; échec → settleDurable(fp,false)", async () => {
    const claimDurable = vi.fn(async () => ({ fingerprint: "exec_y", status: "new" as const }));
    const settleOk = vi.fn(async () => {});
    const ok = await executeGovernedAction(act({ kind: "create_mission", payload: { instruction: "X" } }), { submitMission: vi.fn(async () => ({ ok: true, missionId: "m2" })), claimDurable, settleDurable: settleOk, ...createIdempotencyLedger() }, true);
    expect(ok.kind).toBe("executed");
    expect(settleOk).toHaveBeenCalledWith("exec_y", true);
    const settleFail = vi.fn(async () => {});
    const bad = await executeGovernedAction(act({ kind: "create_mission", payload: { instruction: "X" } }), { submitMission: vi.fn(async () => ({ ok: false })), claimDurable, settleDurable: settleFail, ...createIdempotencyLedger() }, true);
    expect(bad.kind).toBe("failed");
    expect(settleFail).toHaveBeenCalledWith("exec_y", false);
  });
});

describe("P9.4.1 budget in-memory — atomicité intra-process", () => {
  const cfg = { maxInputTokens: 6000, maxOutputTokens: 700, userDailyTokenCap: 1000, companyDailyTokenCap: 5000, globalDailyTokenCap: 9000, globalMonthlyTokenCap: 100000 } as CloneChatOpenAIConfig;
  it("refuse au-delà du plafond utilisateur (reserve synchrone avant tout await)", async () => {
    const b = createInMemoryBudget();
    const scope = { userId: "u1", companyId: "c1" };
    const at = "2026-07-03T10:00:00.000Z";
    const r1 = await b.reserve(cfg, scope, 100, at); expect(r1.granted).toBe(true); await b.commit(r1, 100);
    // used 100 ; worstCase suivant = 100+700=800 ; 100+800=900<=1000 ok
    const r2 = await b.reserve(cfg, scope, 100, at); expect(r2.granted).toBe(true); await b.commit(r2, 100);
    // committed 200 ; la requête suivante (est 200 → worstCase 900) : 200+900=1100 > 1000 → refus
    const r3 = await b.reserve(cfg, scope, 200, at);
    expect(r3.granted).toBe(false);
    expect(r3.reason).toBe("user_daily");
  });
  it("release rend la réservation (échec OpenAI ne consomme pas)", async () => {
    const b = createInMemoryBudget();
    const scope = { userId: "u2", companyId: "c2" };
    const at = "2026-07-03T10:00:00.000Z";
    const r = await b.reserve(cfg, scope, 100, at); expect(r.granted).toBe(true);
    await b.release(r);
    const snap = await b.snapshot(scope, at);
    expect(snap.userDailyTokens).toBe(0); // rien de committé
  });
});
