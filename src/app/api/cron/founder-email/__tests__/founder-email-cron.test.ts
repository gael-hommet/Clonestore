// Route PUBLIQUE /api/cron/founder-email — auth UNIQUEMENT `Authorization: Bearer <CRON_SECRET>`.
// Fail-closed (CRON_SECRET absent), refus 401 (sans/mauvais Bearer, ?secret= n'est plus accepté),
// 503 si le secret de relais interne manque, et relais interne contrôlé quand tout est configuré.
// Aucune valeur de secret ne doit apparaître dans la réponse.
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { GET } from "@/app/api/cron/founder-email/route";

const CRON = "the-cron-secret-value-XYZ";
const EMAIL = "the-internal-email-secret-ABC";

let savedCron: string | undefined;
let savedEmail: string | undefined;
let fetchMock: Mock;

beforeEach(() => {
  savedCron = process.env.CRON_SECRET;
  savedEmail = process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET;
  fetchMock = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify({ ok: true, mode: "local", sent: 1 }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  if (savedCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedCron;
  if (savedEmail === undefined) delete process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET; else process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = savedEmail;
  vi.unstubAllGlobals();
});

function req(headers: Record<string, string> = {}, url = "http://x/api/cron/founder-email") {
  return GET(new Request(url, { method: "GET", headers }));
}
const HOST = { host: "clonestore.pro", "x-forwarded-proto": "https" };

describe("route publique /api/cron/founder-email — auth Bearer uniquement", () => {
  it("CRON_SECRET absent côté serveur → refus contrôlé fail-closed, aucun relais interne", async () => {
    delete process.env.CRON_SECRET;
    process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = EMAIL;
    const res = await req({ authorization: `Bearer ${CRON}`, ...HOST });
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled(); // jamais d'exécution sans secret serveur
  });

  it("sans Authorization → 401", async () => {
    process.env.CRON_SECRET = CRON;
    process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = EMAIL;
    const res = await req({ ...HOST });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Bearer incorrect → 401", async () => {
    process.env.CRON_SECRET = CRON;
    process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = EMAIL;
    const res = await req({ authorization: "Bearer wrong-secret", ...HOST });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Bearer correct mais CLONESTORE_FOUNDER_EMAIL_CRON_SECRET absent → 503", async () => {
    process.env.CRON_SECRET = CRON;
    delete process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET;
    const res = await req({ authorization: `Bearer ${CRON}`, ...HOST });
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled(); // pas de relais sans secret interne
  });

  it("Bearer correct + les deux secrets → relais interne autorisé + résultat contrôlé", async () => {
    process.env.CRON_SECRET = CRON;
    process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = EMAIL;
    const res = await req({ authorization: `Bearer ${CRON}`, ...HOST });
    expect(res.status).toBe(200);
    // relais vers la route interne email-tick, avec le secret interne en en-tête (pas en URL)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, opts] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://clonestore.pro/api/internal/founder-access/email-tick");
    expect(opts.method).toBe("POST");
    expect(opts.headers["x-cron-secret"]).toBe(EMAIL);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ ok: true, sent: 1 });
  });

  it("?secret=valide sans Bearer → 401 (query param n'est plus accepté)", async () => {
    process.env.CRON_SECRET = CRON;
    process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = EMAIL;
    const res = await req({ ...HOST }, `http://x/api/cron/founder-email?secret=${CRON}`);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aucune valeur de secret dans la réponse (refus ou succès)", async () => {
    process.env.CRON_SECRET = CRON;
    process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET = EMAIL;
    const denied = await (await req({ authorization: "Bearer wrong", ...HOST })).text();
    expect(denied).not.toContain(CRON);
    expect(denied).not.toContain(EMAIL);
    const ok = await (await req({ authorization: `Bearer ${CRON}`, ...HOST })).text();
    expect(ok).not.toContain(CRON);
    expect(ok).not.toContain(EMAIL);
  });
});
