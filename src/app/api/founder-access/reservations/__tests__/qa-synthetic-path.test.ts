// Route-level proof for the QA-safe synthetic reservation path added by df8b404f.
// Guarantees proven here (not covered elsewhere): the PUBLIC POST /api/founder-access/reservations
// route (a) sends NO email and classifies the analytics truth as `test` ONLY when the request carries
// the server QA secret in Production, and (b) is strictly the NORMAL flow (email sent, trafficClass
// `external`) for a request with NO token or a WRONG token. The auth DECISION itself
// (isAuthenticatedProductionQaRequest — constant-time, Production-only) is kept REAL here and is also
// unit-tested in src/lib/analytics/__tests__/qa-auth.test.ts. All side-effecting dependencies are mocked
// so NO real reservation is persisted and NO real email is sent.
import { describe, it, expect, vi, beforeEach } from "vitest";

const QA_SECRET = "qa-secret-token-abcdefghijklmnop-0123456789"; // >= 32 chars

// --- side-effecting deps mocked (no real DB / email / cookies) ---
const sendEmail = vi.fn(async () => ({ ok: true }));
const bridgeSpy = vi.fn(async () => ({ ok: true, outcome: "inserted" as const }));

vi.mock("@/lib/founder-access/runtime", () => ({ getFounderDb: vi.fn(async () => ({ query: vi.fn() })) }));
vi.mock("@/lib/founder-access/validation", () => ({
  validateStep1: vi.fn(() => ({ ok: true, value: { email: "user@example.com", email_domain_type: "corporate", company_name: "Acme", company_size: "11-50" }, errors: {} })),
  summarizeUserAgent: vi.fn(() => "ua"),
}));
vi.mock("@/lib/founder-access/token", () => ({ issueVerificationToken: vi.fn(() => ({ hash: "h", expiresAt: new Date().toISOString(), token: "t" })) }));
vi.mock("@/lib/founder-access/store", () => ({
  createOrUpdateReservation: vi.fn(async () => ({ id: "res-1", already_confirmed: false })),
  markVerificationSent: vi.fn(async () => {}),
}));
vi.mock("@/lib/founder-access/request-utils", () => ({
  distributedRateLimit: vi.fn(async () => ({ ok: true, retryAfter: 0 })),
  hashIp: vi.fn(() => "iphash"),
  getClientIp: vi.fn(() => "1.2.3.4"),
  readJsonBounded: vi.fn(async (req: Request) => await req.json()),
  extractTracking: vi.fn(() => ({})),
}));
vi.mock("@/lib/founder-access/email-provider", () => ({
  isFounderEmailConfigured: vi.fn(() => true),
  resolveFounderEmailProvider: vi.fn(() => ({ send: sendEmail })),
  renderVerificationEmail: vi.fn(() => ({ html: "<p>x</p>", text: "x" })),
}));
vi.mock("@/lib/founder-access/signed-cookie", () => ({ buildReservationCookie: vi.fn(() => "rid=1; HttpOnly") }));
vi.mock("@/lib/founder-access/analytics-session", () => ({ resolveAnalyticsSession: vi.fn(() => ({ sessionId: "sess", setCookie: null })) }));
vi.mock("@/lib/analytics/server-events", () => ({
  resolveAnalyticsEnvironment: vi.fn(() => "production"),
  boundedAnalyticsWrite: vi.fn(async (fn: () => Promise<unknown>) => { try { return await fn(); } catch { return undefined; } }),
}));
vi.mock("@/lib/analytics/identity", () => ({ readVisitorId: vi.fn(() => null), readSessionId: vi.fn(() => null) }));
vi.mock("@/lib/analytics/correlation", () => ({ upsertConversionLink: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics/adapters/founder-access-adapter", () => ({
  bridgeFounderServerEvent: (...args: unknown[]) => bridgeSpy(...(args as [])),
  founderEventIdFor: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));
// NOTE: @/lib/analytics/qa-auth is intentionally NOT mocked — the real constant-time, Production-only
// decision runs, so this test proves the actual gate wiring, not a reproduction.

const ORIGIN = "http://localhost:3000";
function post(headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/founder-access/reservations`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ email: "user@example.com", company_name: "Acme", company_size: "11-50" }),
  });
}
function lastTrafficClass(): string | undefined {
  const call = bridgeSpy.mock.calls.at(-1);
  return call ? (call[1] as { trafficClass?: string }).trafficClass : undefined;
}

describe("POST /api/founder-access/reservations — QA-safe synthetic path (df8b404f)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLONESTORE_ANALYTICS_QA_TOKEN = QA_SECRET;
  });

  it("NO token → NORMAL flow: email sent, analytics trafficClass = external", async () => {
    const { POST } = await import("../route");
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(lastTrafficClass()).toBe("external");
  });

  it("WRONG token → NORMAL flow: email sent, trafficClass = external (secret mismatch never opens the QA path)", async () => {
    const { POST } = await import("../route");
    await POST(post({ "x-clonestore-qa-token": "wrong-but-long-enough-value-0123456789xx" }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(lastTrafficClass()).toBe("external");
  });

  it("CORRECT QA token in Production → SYNTHETIC path: NO email sent, trafficClass = test", async () => {
    const { POST } = await import("../route");
    const res = await POST(post({ "x-clonestore-qa-token": QA_SECRET }));
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled(); // aucun email réel sur le chemin QA
    expect(lastTrafficClass()).toBe("test");    // réservation QA isolée du funnel propriétaire
  });

  it("does not leak the QA secret in the response body or headers", async () => {
    const { POST } = await import("../route");
    const res = await POST(post({ "x-clonestore-qa-token": QA_SECRET }));
    const body = await res.clone().text();
    expect(body).not.toContain(QA_SECRET);
    let headerBlob = "";
    res.headers.forEach((v, k) => { headerBlob += `${k}:${v}\n`; });
    expect(headerBlob).not.toContain(QA_SECRET);
  });
});
