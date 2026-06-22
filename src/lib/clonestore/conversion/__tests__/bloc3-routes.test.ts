// BLOC 3 — Route-level tests : invoque réellement les handlers HTTP, prouve
// que les bridges sont appelés, prouve les comportements adversariaux.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET as pTokenGET, POST as pTokenPOST } from "@/app/p/[token]/route";
import { POST as eventsPOST } from "@/app/api/conversion/events/route";
import { POST as diagnosticPOST } from "@/app/api/conversion/diagnostic/route";
import {
  __resetConversionStoreForTests,
  createConversionSessionFromGrant,
  getConversionSession,
  importAttributionGrant,
  getGrantByTokenId,
  listConversionEvents,
} from "../storage";
import { issueAttributionToken } from "../attribution-token";
import { readConversionSessionId, CONVERSION_SESSION_COOKIE } from "../session";
import { signCookie } from "@/lib/founder-access/signed-cookie";

const TOKEN_ID = "12345678901234567890123456789012abcd0000"; // 40 hex

function enableDevBackend() {
  process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE = "true";
  process.env.LEADFORGE_ATTRIBUTION_SIGNING_KEY = "test-secret-bloc3-routes";
  __resetConversionStoreForTests();
}
function disableDevBackend() {
  __resetConversionStoreForTests();
  delete process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE;
  delete process.env.LEADFORGE_ATTRIBUTION_SIGNING_KEY;
}

function mockRequest(opts: { url: string; method?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = { url: "http://localhost/" }) {
  const headers = new Headers(opts.headers ?? {});
  if (opts.cookie) headers.set("cookie", opts.cookie);
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  if (body) {
    headers.set("content-type", "application/json");
    headers.set("content-length", String(body.length));
  }
  return new Request(opts.url, { method: opts.method ?? "GET", headers, body });
}

function buildCookie(sessionId: string): string {
  const secret =
    process.env.CLONESTORE_CONVERSION_SESSION_SECRET ??
    process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET ??
    "clonestore-bloc3-dev-session-secret";
  const token = signCookie(sessionId, secret, 7 * 24 * 60 * 60 * 1000);
  return `${CONVERSION_SESSION_COOKIE}=${token}`;
}

describe("BLOC 3 — route /p/[token]", () => {
  beforeEach(enableDevBackend);
  afterEach(disableDevBackend);

  it("token valide → 303 vers /demo/pierre + cookie + headers noindex/no-referrer", async () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
      contactKind: "DIRECT", campaignId: "spring_2026", prospectId: "lf_001",
    });
    const token = issueAttributionToken(TOKEN_ID)!;
    const req = mockRequest({ url: `http://localhost/p/${token}` });
    const res = await pTokenGET(req as never, { params: Promise.resolve({ token }) });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/demo/pierre");
    expect(res.headers.get("location")).not.toContain(token); // pas de token dans URL finale
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toContain("no-store");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(CONVERSION_SESSION_COOKIE);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("token malformé → 303 vers /demo/pierre + session organique (réponse indistinguable)", async () => {
    const req = mockRequest({ url: "http://localhost/p/garbage" });
    const res = await pTokenGET(req as never, { params: Promise.resolve({ token: "garbage" }) });
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toContain(CONVERSION_SESSION_COOKIE);
    // pas d'information sur la raison
    expect(res.headers.get("x-clonestore-attribution-reason")).toBeNull();
  });

  it("signature modifiée → 303 organique, JAMAIS d'info sur l'existence", async () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_PROOF_FIRST", cohort: "V0-B",
      contactKind: "DIRECT", campaignId: "c", prospectId: "lf_001",
    });
    const valid = issueAttributionToken(TOKEN_ID)!;
    const tampered = valid.slice(0, -1) + (valid.endsWith("a") ? "b" : "a");
    const req = mockRequest({ url: `http://localhost/p/${tampered}` });
    const res = await pTokenGET(req as never, { params: Promise.resolve({ token: tampered }) });
    expect(res.status).toBe(303);
  });

  it("POST refusé → 405", async () => {
    const res = await pTokenPOST();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });
});

describe("BLOC 3 — route /api/conversion/events", () => {
  beforeEach(enableDevBackend);
  afterEach(disableDevBackend);

  it("event client autorisé avec cookie session valide → 200", async () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
      contactKind: "DIRECT", campaignId: "c", prospectId: "lf_001",
    });
    const session = createConversionSessionFromGrant(getGrantByTokenId(TOKEN_ID)!);
    const req = mockRequest({
      url: "http://localhost/api/conversion/events",
      method: "POST",
      cookie: buildCookie(session.id),
      body: { event_type: "demo_started", idempotency_key: "demo_started:abc12345" },
    });
    const res = await eventsPOST(req as never);
    expect(res.status).toBe(200);
    expect(listConversionEvents(session.id).some((e) => e.eventType === "demo_started")).toBe(true);
  });

  it("event server-only refusé depuis client → 422", async () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
      contactKind: "DIRECT", campaignId: "c", prospectId: "lf_001",
    });
    const session = createConversionSessionFromGrant(getGrantByTokenId(TOKEN_ID)!);
    const req = mockRequest({
      url: "http://localhost/api/conversion/events",
      method: "POST",
      cookie: buildCookie(session.id),
      body: { event_type: "checkout_started", idempotency_key: "x12345678" },
    });
    const res = await eventsPOST(req as never);
    expect(res.status).toBe(422);
  });

  it("idempotency_key invalide → 400", async () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
      contactKind: "DIRECT", campaignId: "c", prospectId: "lf_001",
    });
    const session = createConversionSessionFromGrant(getGrantByTokenId(TOKEN_ID)!);
    const req = mockRequest({
      url: "http://localhost/api/conversion/events",
      method: "POST",
      cookie: buildCookie(session.id),
      body: { event_type: "demo_started", idempotency_key: "ab" }, // trop court
    });
    const res = await eventsPOST(req as never);
    expect(res.status).toBe(400);
  });

  it("sans cookie session valide → 204 silencieux (pas de fuite, pas d'erreur visible)", async () => {
    const req = mockRequest({
      url: "http://localhost/api/conversion/events",
      method: "POST",
      body: { event_type: "demo_started", idempotency_key: "demo_started:abc12345" },
    });
    const res = await eventsPOST(req as never);
    expect(res.status).toBe(204);
  });

  it("cookie falsifié → 204 silencieux (sig HMAC ne match pas)", async () => {
    const req = mockRequest({
      url: "http://localhost/api/conversion/events",
      method: "POST",
      cookie: `${CONVERSION_SESSION_COOKIE}=fake.cookie`,
      body: { event_type: "demo_started", idempotency_key: "demo_started:abc12345" },
    });
    const res = await eventsPOST(req as never);
    expect(res.status).toBe(204);
  });

  it("idempotency déduplique (2 events identiques = 1 stocké)", async () => {
    importAttributionGrant({
      tokenId: TOKEN_ID, variant: "VARIANT_DEPARTMENT_OUTCOME", cohort: "V0-A",
      contactKind: "DIRECT", campaignId: "c", prospectId: "lf_001",
    });
    const session = createConversionSessionFromGrant(getGrantByTokenId(TOKEN_ID)!);
    const cookie = buildCookie(session.id);
    const body = { event_type: "purchase_cta_clicked", idempotency_key: "cta:abc12345" };
    await eventsPOST(mockRequest({ url: "http://localhost/api/conversion/events", method: "POST", cookie, body }) as never);
    await eventsPOST(mockRequest({ url: "http://localhost/api/conversion/events", method: "POST", cookie, body }) as never);
    const events = listConversionEvents(session.id).filter((e) => e.eventType === "purchase_cta_clicked");
    expect(events.length).toBe(1);
  });
});

describe("BLOC 3 — route /api/conversion/diagnostic", () => {
  beforeEach(enableDevBackend);
  afterEach(disableDevBackend);

  it("payload valide → 200 + résultat conforme contrat", async () => {
    const req = mockRequest({
      url: "http://localhost/api/conversion/diagnostic",
      method: "POST",
      body: {
        answers: {
          headcount: 60, hr_team_size: 2, monthly_hires: 4, monthly_on_offboardings: 2,
          monthly_docs_emails_ops: 30, autonomy_level: "medium", validation_required: true,
        },
      },
    });
    const res = await diagnosticPOST(req as never);
    const body = (await res.json()) as { ok: boolean; result: Record<string, unknown> };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.compatibility).toBeDefined();
    expect(body.result.financial_saving).toBeNull(); // pas de coût horaire fourni
    expect((body.result.price_comparison as { pierre_eur_month: number }).pierre_eur_month).toBe(449);
  });

  it("champ sensible (nom_salarié) → 422", async () => {
    const req = mockRequest({
      url: "http://localhost/api/conversion/diagnostic",
      method: "POST",
      body: { answers: { headcount: 50, nom_salarié: "Alice", monthly_hires: 5 } },
    });
    const res = await diagnosticPOST(req as never);
    expect(res.status).toBe(422);
  });

  it("payload trop gros → 413", async () => {
    const req = new Request("http://localhost/api/conversion/diagnostic", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(9000) },
      body: "{}",
    });
    const res = await diagnosticPOST(req as never);
    expect(res.status).toBe(413);
  });
});
