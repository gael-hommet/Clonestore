// §1 — route email-tick : auth secret cron (refus sans/mauvais secret) + ENREGISTREMENT
// réel de chaque exécution (ok/erreur) dans le journal des runs.
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";

let tickResult: { sent: number; skipped: number; retried: number; dead: number } = { sent: 1, skipped: 0, retried: 0, dead: 0 };
let tickThrows = false;
vi.mock("@/lib/pierre/v1/db", () => ({ getRuntimeDb: vi.fn(async () => ({ __fake: true })) }));
vi.mock("@/lib/founder-access/email-worker", () => ({
  runEmailTick: vi.fn(async () => { if (tickThrows) throw new Error("BoomTick"); return tickResult; }),
}));
vi.mock("@/lib/founder-access/email-provider", () => ({
  resolveFounderEmailProvider: vi.fn(() => ({ mode: "local" })),
  isFounderEmailConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/founder-access/request-utils", () => ({ purgeExpiredRateLimits: vi.fn(async () => 0) }));
vi.mock("@/lib/founder-access/cron-runs", () => ({
  FOUNDER_EMAIL_CRON_JOB: "founder_email_tick",
  recordCronRun: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/internal/founder-access/email-tick/route";
import { recordCronRun } from "@/lib/founder-access/cron-runs";

const recorded = recordCronRun as unknown as Mock;
const SECRET = "CLONESTORE_FOUNDER_EMAIL_CRON_SECRET";
let saved: string | undefined;
beforeEach(() => { saved = process.env[SECRET]; process.env[SECRET] = "the-cron-secret"; tickThrows = false; tickResult = { sent: 1, skipped: 0, retried: 0, dead: 0 }; recorded.mockClear(); });
afterEach(() => { if (saved === undefined) delete process.env[SECRET]; else process.env[SECRET] = saved; });

const post = (headers: Record<string, string> = {}) =>
  POST(new Request("http://x/api/internal/founder-access/email-tick", { method: "POST", headers }));

describe("email-tick cron — auth + journalisation", () => {
  it("sans secret → 401, aucune exécution enregistrée", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(recorded).not.toHaveBeenCalled();
  });
  it("mauvais secret → 401", async () => {
    expect((await post({ "x-cron-secret": "mauvais" })).status).toBe(401);
    expect(recorded).not.toHaveBeenCalled();
  });
  it("bon secret (x-cron-secret) → 200 + run enregistré (status ok)", async () => {
    const res = await post({ "x-cron-secret": "the-cron-secret" });
    expect(res.status).toBe(200);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][1]).toMatchObject({ job_name: "founder_email_tick", status: "ok", sent: 1 });
  });
  it("bon secret en Bearer → accepté aussi", async () => {
    expect((await post({ authorization: "Bearer the-cron-secret" })).status).toBe(200);
  });
  it("tick en erreur → run enregistré status=error puis l'erreur remonte", async () => {
    tickThrows = true;
    await expect(post({ "x-cron-secret": "the-cron-secret" })).rejects.toThrow();
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0][1]).toMatchObject({ job_name: "founder_email_tick", status: "error" });
  });
});
