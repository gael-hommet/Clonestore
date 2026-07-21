// E-R3 §4 — VRAIES routes analytics (presence/funnel/reservations) avec base PGlite
// injectée : session émise par le serveur, id de session du corps ignoré, liaison
// réservation via le cookie, cookie falsifié non repris, AUCUNE PII persistée.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createFounderHarness, type FounderHarness } from "./founder-harness";
import { __setFounderDbForTests } from "../runtime";
import { readAnalyticsSession, ANALYTICS_SESSION_COOKIE } from "../signed-cookie";

let h: FounderHarness;
beforeAll(async () => {
  h = await createFounderHarness();
  process.env.CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET = "er3-analytics-secret-0123456789";
  process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET = "er3-reservation-secret-0123456789";
  __setFounderDbForTests(h.db);
});
afterAll(async () => { __setFounderDbForTests(null); await h.close(); });

function setCookies(res: Response): string[] {
  const g = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof g === "function") return g.call(res.headers);
  const one = res.headers.get("set-cookie");
  return one ? [one] : [];
}
function analyticsCookie(res: Response): string | null {
  const c = setCookies(res).find((x) => x.startsWith(`${ANALYTICS_SESSION_COOKIE}=`));
  return c ? c.split(";")[0] : null; // "cs_analytics_session=<val>"
}
async function presence(body: Record<string, unknown>, cookie?: string) {
  const { POST } = await import("@/app/api/founder-access/presence/route");
  return POST(new Request("http://x/api/founder-access/presence", { method: "POST", body: JSON.stringify(body), headers: cookie ? { cookie } : {} }));
}
async function reservation(body: Record<string, unknown>, cookie?: string) {
  const { POST } = await import("@/app/api/founder-access/reservations/route");
  return POST(new Request("http://x/api/founder-access/reservations", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) } }));
}
async function funnel(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/founder-access/funnel/route");
  return POST(new Request("http://x/api/founder-access/funnel", { method: "POST", body: JSON.stringify(body) }));
}

describe("§4 — session analytics serveur + persistance", () => {
  it("première requête émet la session ; la réutilise ; ignore l'id du corps", async () => {
    const r1 = await presence({ current_path: "/" });
    expect(r1.status).toBe(204);
    const cookie = analyticsCookie(r1)!;
    expect(cookie).toBeTruthy();
    const sessionId = readAnalyticsSession(cookie)!;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    // 2e requête AVEC le cookie + un UUID arbitraire dans le corps → ignoré, même session.
    const r2 = await presence({ current_path: "/demo", anonymous_session_id: "99999999-9999-4999-8999-999999999999" }, cookie);
    expect(r2.status).toBe(204);
    expect(analyticsCookie(r2)).toBeNull(); // pas de nouvelle session
    const sess = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_web_sessions where anonymous_session_id=$1", [sessionId]);
    expect(sess.rows[0].n).toBe(1);
    const forged = await h.db.query<{ n: number }>("select count(*)::int n from clonestore_web_sessions where anonymous_session_id='99999999-9999-4999-8999-999999999999'");
    expect(forged.rows[0].n).toBe(0); // l'id du corps n'a jamais créé de session
  });

  it("réservation liée à la session du cookie (jamais l'id du corps)", async () => {
    const r1 = await presence({ current_path: "/reserver/pierre" });
    const cookie = analyticsCookie(r1)!;
    const sessionId = readAnalyticsSession(cookie)!;
    const res = await reservation({ email: "link@acme.fr", company_name: "Acme", company_size: "50-249", website_hp: "", anonymous_session_id: "88888888-8888-4888-8888-888888888888" }, cookie);
    expect(res.status).toBe(200);
    const row = await h.db.query<{ anonymous_session_id: string }>("select anonymous_session_id from clonestore_founder_reservations where email_normalized='link@acme.fr'");
    expect(row.rows[0].anonymous_session_id).toBe(sessionId);
  });

  it("cookie falsifié → nouvelle session (ne reprend pas une session existante)", async () => {
    const r = await presence({ current_path: "/" }, `${ANALYTICS_SESSION_COOKIE}=falsifié.invalide`);
    expect(r.status).toBe(204);
    expect(analyticsCookie(r)).toBeTruthy(); // une NOUVELLE session est émise
  });

  it("aucune PII persistée (paths/referrer/UTM nettoyés)", async () => {
    // Session FRAÎCHE (sans cookie) → INSERT avec les champs d'origine sanitisés.
    await presence({
      current_path: "/reserver?email=victim@example.com&token=secret123",
      landing_path: "/verify/victim@example.com",
      referrer: "https://user:pass@tracker.com/p?secret=zzz#frag",
      utm_source: "campaign_secret_token",
      utm_campaign: "launch",
      events: [{ name: "founder_cta_clicked", path: "/x?token=abc" }],
    });

    const dump = await h.db.query<{ blob: string }>(
      `select coalesce(string_agg(current_path,' ')||' '||string_agg(coalesce(referrer,''),' ')||' '||string_agg(coalesce(utm_source,''),' ')||' '||string_agg(coalesce(landing_path,''),' '),'') as blob
       from clonestore_web_sessions`);
    const blob = (dump.rows[0]?.blob ?? "").toLowerCase();
    for (const bad of ["victim@example.com", "@example.com", "token", "secret", "pass@", "campaign_secret"]) {
      expect(blob.includes(bad)).toBe(false);
    }
    // referrer réduit à origin+path (pas de credentials/query/fragment)
    expect(blob.includes("tracker.com")).toBe(true);
    expect(blob.includes("zzz")).toBe(false);
  });
});

// C1.8 — défaut trouvé par l'acceptation propriétaire assistée par IA : `funnel` (comme
// `presence`) doit persister réellement quand sa dépendance DB fonctionne (régression positive,
// symétrique aux tests fail-open de c18-founder-access-beacon-fail-open.test.ts).
describe("C1.8 — funnel persiste réellement quand la DB fonctionne", () => {
  it("un événement client connu est écrit en base et répond 204", async () => {
    const res = await funnel({ name: "founder_cta_clicked", ctaVariant: "hero", landingPath: "/reserver/pierre" });
    expect(res.status).toBe(204);
    const row = await h.db.query<{ n: number }>(
      "select count(*)::int n from clonestore_founder_funnel_events where event_name='founder_cta_clicked'",
    );
    expect(row.rows[0].n).toBeGreaterThan(0);
  });
});
