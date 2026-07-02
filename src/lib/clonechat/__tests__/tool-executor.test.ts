import { describe, it, expect, vi } from "vitest";
import { executeGovernedAction, createIdempotencyLedger } from "../tool-executor";
import type { CloneChatProposedAction } from "../types";

function action(over: Partial<CloneChatProposedAction>): CloneChatProposedAction {
  return {
    id: "act-1", kind: "create_mission", label: "Confier la mission", risk: "sensitive",
    requiresConfirmation: true, allowed: true, reason: null, payload: { instruction: "Préparer un contrat CDI" }, href: null,
    ...over,
  };
}

describe("Exécuteur gouverné — confirmation & idempotence", () => {
  it("refuse une action non autorisée sans effet", async () => {
    const submit = vi.fn();
    const out = await executeGovernedAction(action({ allowed: false, reason: "no_permission" }), { submitMission: submit, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("refused");
    expect(submit).not.toHaveBeenCalled();
  });

  it("refuse une action sensible NON confirmée", async () => {
    const submit = vi.fn();
    const out = await executeGovernedAction(action({}), { submitMission: submit, ...createIdempotencyLedger() }, false);
    expect(out.kind).toBe("refused");
    if (out.kind === "refused") expect(out.reason).toBe("confirmation_required");
    expect(submit).not.toHaveBeenCalled();
  });

  it("exécute une création confirmée via le contrat V1 injecté", async () => {
    const submit = vi.fn(async () => ({ ok: true, missionId: "m-42" }));
    const ledger = createIdempotencyLedger();
    const out = await executeGovernedAction(action({}), { submitMission: submit, ...ledger }, true);
    expect(out.kind).toBe("executed");
    if (out.kind === "executed") { expect(out.missionId).toBe("m-42"); expect(out.href).toContain("m-42"); }
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("IDEMPOTENCE : la même proposition ne s'exécute jamais deux fois", async () => {
    const submit = vi.fn(async () => ({ ok: true, missionId: "m-1" }));
    const ledger = createIdempotencyLedger();
    const a = action({});
    const first = await executeGovernedAction(a, { submitMission: submit, ...ledger }, true);
    const second = await executeGovernedAction(a, { submitMission: submit, ...ledger }, true);
    expect(first.kind).toBe("executed");
    expect(second.kind).toBe("duplicate");
    expect(submit).toHaveBeenCalledTimes(1); // un seul effet réel
  });

  it("un échec serveur n'active PAS l'idempotence (réessai possible)", async () => {
    const submit = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: "boom" })
      .mockResolvedValueOnce({ ok: true, missionId: "m-2" });
    const ledger = createIdempotencyLedger();
    const a = action({});
    const failed = await executeGovernedAction(a, { submitMission: submit, ...ledger }, true);
    expect(failed.kind).toBe("failed");
    const retried = await executeGovernedAction(a, { submitMission: submit, ...ledger }, true);
    expect(retried.kind).toBe("executed");
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("navigation/ouverture : pas d'idempotence, renvoie le href", async () => {
    const submit = vi.fn();
    const out = await executeGovernedAction(action({ kind: "navigate", href: "/agents/pierre/use", requiresConfirmation: false }), { submitMission: submit, ...createIdempotencyLedger() });
    expect(out.kind).toBe("navigate");
    if (out.kind === "navigate") expect(out.href).toBe("/agents/pierre/use");
    expect(submit).not.toHaveBeenCalled();
  });

  it("refuse une instruction vide (aucune mission fantôme)", async () => {
    const submit = vi.fn();
    const out = await executeGovernedAction(action({ payload: { instruction: "  " } }), { submitMission: submit, ...createIdempotencyLedger() }, true);
    expect(out.kind).toBe("refused");
    expect(submit).not.toHaveBeenCalled();
  });
});
