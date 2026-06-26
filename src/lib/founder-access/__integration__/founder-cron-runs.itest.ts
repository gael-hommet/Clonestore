// §1/§4 — Cron email : preuve RÉELLE via le journal des exécutions (PGlite). La carte
// « Cron email » du cockpit dérive son état d'une vraie dernière exécution, JAMAIS du seul
// secret. Les cas no-run doivent passer AVANT tout enregistrement (ordre du fichier).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { recordCronRun, getLastCronRun, FOUNDER_EMAIL_CRON_JOB } from "../cron-runs";
import { sourcesHealth, type SourceStatus } from "../command-center";

let h: FounderHarness;
const SECRET = "CLONESTORE_FOUNDER_EMAIL_CRON_SECRET";
let savedSecret: string | undefined;
beforeAll(async () => { h = await createFounderHarness(); savedSecret = process.env[SECRET]; delete process.env[SECRET]; });
afterAll(async () => { if (savedSecret === undefined) delete process.env[SECRET]; else process.env[SECRET] = savedSecret; await h.close(); });

const emailCron = (s: SourceStatus[]) => s.find((x) => x.key === "email_cron")!;

describe("cron email — état dérivé du journal réel", () => {
  it("secret présent mais aucune exécution → misconfigured (planificateur non actif)", async () => {
    process.env[SECRET] = "test-secret";
    const c = emailCron(await sourcesHealth(h.db));
    expect(c.state).toBe("misconfigured");
    expect(c.detail).toMatch(/aucune exécution/i);
    delete process.env[SECRET];
  });

  it("aucune exécution + secret absent → not_configured", async () => {
    const c = emailCron(await sourcesHealth(h.db));
    expect(c.state).toBe("not_configured");
  });

  it("recordCronRun(ok) persisté → getLastCronRun le renvoie", async () => {
    await recordCronRun(h.db, { job_name: FOUNDER_EMAIL_CRON_JOB, status: "ok", processed: 3, sent: 2, skipped: 1, retried: 0, dead: 0, duration_ms: 140 });
    const last = await getLastCronRun(h.db, FOUNDER_EMAIL_CRON_JOB);
    expect(last?.status).toBe("ok");
    expect(last?.sent).toBe(2);
    expect(last?.processed).toBe(3);
  });

  it("exécution récente OK → source connectée (dernière + prochaine)", async () => {
    const c = emailCron(await sourcesHealth(h.db));
    expect(c.state).toBe("connected");
    expect(c.detail).toMatch(/Dernière exécution réussie/);
    expect(c.detail).toMatch(/prochaine/);
  });

  it("dernière exécution en erreur → source dégradée (jamais connectée)", async () => {
    await recordCronRun(h.db, { job_name: FOUNDER_EMAIL_CRON_JOB, status: "error", duration_ms: 60, error_safe: "TickError" });
    const c = emailCron(await sourcesHealth(h.db));
    expect(c.state).toBe("degraded");
    expect(c.detail).toMatch(/en erreur/i);
  });

  it("aucune source faussement connectée + panne d'une source n'effondre pas l'ensemble", async () => {
    const sources = await sourcesHealth(h.db);
    expect(sources.length).toBeGreaterThanOrEqual(9);
    // realtime (transport prêt) et ai_cost (ledger mémoire) connectés réellement.
    expect(sources.find((s) => s.key === "realtime")?.state).toBe("connected");
    expect(sources.find((s) => s.key === "ai_cost")?.state).toBe("connected");
  });
});
