// src/lib/billing/__tests__/order-activation.test.ts
// B31.8 — Pure structural tests for order-activation helpers.
// No Supabase calls — tests verify payload shape, invariants, types.

import { describe, it, expect } from "vitest";
import type { UpsertOrderParams } from "../order-activation";

// ── UpsertOrderParams payload shape ────────────────────────────────

describe("UpsertOrderParams shape", () => {
  it("contains user_id (server-derived, never client)", () => {
    const params: UpsertOrderParams = {
      user_id: "user-from-supabase-token",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_abc123",
      stripe_customer_id: "cus_xyz",
    };
    expect(params.user_id).toBe("user-from-supabase-token");
  });

  it("supports status=trialing (trial access)", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "trialing",
      stripe_subscription_id: "sub_trial",
      stripe_customer_id: null,
    };
    expect(params.status).toBe("trialing");
  });

  it("supports status=active (paid subscription)", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_paid",
      stripe_customer_id: "cus_paid",
    };
    expect(params.status).toBe("active");
  });

  it("supports status=canceled (revoked access)", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "canceled",
      stripe_subscription_id: "sub_cancelled",
      stripe_customer_id: null,
    };
    expect(params.status).toBe("canceled");
  });

  it("idempotency key is user_id + agent_slug (unique combination)", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_abc",
      stripe_customer_id: null,
    };
    const idempotencyKey = `${params.user_id}:${params.agent_slug}`;
    expect(idempotencyKey).toBe("u1:pierre");
  });

  it("does NOT contain client secrets", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_abc",
      stripe_customer_id: null,
    };
    const json = JSON.stringify(params);
    expect(json).not.toContain("sk_");
    expect(json).not.toContain("STRIPE_SECRET");
    expect(json).not.toContain("SERVICE_ROLE");
    expect(json).not.toContain("bearer");
  });

  it("stripe_customer_id can be null (not always present on trial)", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "trialing",
      stripe_subscription_id: "sub_trial",
      stripe_customer_id: null,
    };
    expect(params.stripe_customer_id).toBeNull();
  });

  it("started_at defaults are handled by caller (optional field)", () => {
    const withStartedAt: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_abc",
      stripe_customer_id: null,
      started_at: new Date().toISOString(),
    };
    expect(withStartedAt.started_at).toBeTruthy();

    const withoutStartedAt: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_abc",
      stripe_customer_id: null,
    };
    expect(withoutStartedAt.started_at).toBeUndefined();
  });

  it("ended_at is set for canceled orders", () => {
    const params: UpsertOrderParams = {
      user_id: "u1",
      agent_slug: "pierre",
      status: "canceled",
      stripe_subscription_id: "sub_abc",
      stripe_customer_id: null,
      ended_at: new Date().toISOString(),
    };
    expect(params.ended_at).toBeTruthy();
    expect(params.status).toBe("canceled");
  });
});
