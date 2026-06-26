// BLOC FINAL §14 — readiness env checks + verdict + assertStripeWebhookDatabaseReady.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkFounderStripeEnvironment, checkFounderEmailEnvironment, checkFounderAnalyticsEnvironment,
  aggregateProductionReadiness,
} from "../production-readiness";
import { assertStripeWebhookDatabaseReady, WebhookDatabaseNotReadyError } from "../webhook-db";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

const STRIPE_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PIERRE", "STRIPE_PRODUCT_PIERRE", "CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL"];
const EMAIL_KEYS = ["RESEND_API_KEY", "CLONESTORE_FOUNDER_EMAIL_FROM", "CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET", "CLONESTORE_FOUNDER_EMAIL_LINK_SECRET", "CLONESTORE_PUBLIC_APP_URL"];
const ALL = [...STRIPE_KEYS, ...EMAIL_KEYS, "CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET", "CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET", "NODE_ENV"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = Object.fromEntries(ALL.map((k) => [k, process.env[k]])); for (const k of ALL) delete process.env[k]; });
afterEach(() => { for (const k of ALL) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("§6/§7/§8 — env checks (présence/format, jamais de valeur exposée)", () => {
  it("stripe : variables absentes → blockers ; complètes → ok", () => {
    expect(checkFounderStripeEnvironment().ok).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    process.env.STRIPE_PRICE_PIERRE = "price_x";
    process.env.CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL = "postgres://x";
    const r = checkFounderStripeEnvironment();
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("STRIPE_PRODUCT_PIERRE"))).toBe(true);
  });
  it("email : secret faible refusé ; complet ok", () => {
    expect(checkFounderEmailEnvironment().ok).toBe(false);
    process.env.RESEND_API_KEY = "re_x";
    process.env.CLONESTORE_FOUNDER_EMAIL_FROM = "CloneStore <a@b.com>";
    process.env.CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET = "x".repeat(30);
    process.env.CLONESTORE_FOUNDER_EMAIL_LINK_SECRET = "y".repeat(30);
    expect(checkFounderEmailEnvironment().ok).toBe(true);
  });
  it("analytics : défaut de dev refusé en production", () => {
    process.env.NODE_ENV = "production";
    process.env.CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET = "clonestore-dev-analytics-session-secret";
    const r = checkFounderAnalyticsEnvironment();
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("défaut de dev"))).toBe(true);
  });
  it("verdict agrégé : blocked si au moins un blocker, ready sinon", () => {
    const blocked = aggregateProductionReadiness([{ key: "a", ok: false, blockers: ["x"], warnings: [] }]);
    expect(blocked.status).toBe("blocked");
    const ready = aggregateProductionReadiness([{ key: "a", ok: true, blockers: [], warnings: ["w"] }]);
    expect(ready.status).toBe("ready");
    expect(ready.warnings.length).toBe(1);
  });
});

describe("§5 — assertStripeWebhookDatabaseReady (fail-closed en production)", () => {
  const fakeDb = (rolerow: Record<string, unknown>): SqlExecutor => ({
    query: (async () => ({ rows: [rolerow] })) as SqlExecutor["query"],
    transaction: (async (fn: (tx: SqlExecutor) => unknown) => fn(fakeDb(rolerow))) as SqlExecutor["transaction"],
  });
  // Le verdict ok:true est mis en cache (TTL) ; on réinitialise avant chaque cas.
  beforeEach(() => { (globalThis as Record<string, unknown>).__founderWebhookReadiness = undefined; });
  const WRITER_OK = { current_user: "clonestore_stripe_webhook_writer", current_role: "clonestore_stripe_webhook_writer", is_writer: true, can_exec: true, raw_insert: false };

  it("hors production : no-op (ne lève pas, même rôle non conforme)", async () => {
    process.env.NODE_ENV = "test";
    await expect(assertStripeWebhookDatabaseReady(fakeDb({ current_user: "pierre_rt_app", raw_insert: true }))).resolves.toBeUndefined();
  });
  it("production + rôle writer conforme → accepté", async () => {
    process.env.NODE_ENV = "production";
    await expect(assertStripeWebhookDatabaseReady(fakeDb(WRITER_OK))).resolves.toBeUndefined();
  });
  it("production + rôle applicatif général (pierre_rt_app) → refusé", async () => {
    process.env.NODE_ENV = "production";
    const bad = fakeDb({ ...WRITER_OK, current_user: "pierre_rt_app", current_role: "pierre_rt_app", is_writer: false });
    await expect(assertStripeWebhookDatabaseReady(bad)).rejects.toBeInstanceOf(WebhookDatabaseNotReadyError);
  });
  it("production + INSERT brut possible → refusé", async () => {
    process.env.NODE_ENV = "production";
    await expect(assertStripeWebhookDatabaseReady(fakeDb({ ...WRITER_OK, raw_insert: true }))).rejects.toBeInstanceOf(WebhookDatabaseNotReadyError);
  });
  it("production + fonction de journal non exécutable → refusée", async () => {
    process.env.NODE_ENV = "production";
    await expect(assertStripeWebhookDatabaseReady(fakeDb({ ...WRITER_OK, can_exec: false }))).rejects.toBeInstanceOf(WebhookDatabaseNotReadyError);
  });
});
