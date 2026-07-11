// Cycle de vie d'abonnement — décisions pures (autorisation, résumé UI, clés d'idempotence).

import { describe, it, expect } from "vitest";
import {
  authorizeSubscriptionAction,
  summarizeSubscription,
  subscriptionUpdateIdempotencyKey,
} from "../subscription-actions";

const USER = "user-1";
const view = (over: Partial<{ id: string; status: string | null; metadataUserId: string | null; cancelAtPeriodEnd: boolean }> = {}) => ({
  id: "sub_1",
  status: "active",
  metadataUserId: USER,
  cancelAtPeriodEnd: false,
  ...over,
});

describe("authorizeSubscriptionAction", () => {
  it("pas d'abonnement local → 404 NO_SUBSCRIPTION", () => {
    const d = authorizeSubscriptionAction({ userId: USER, localSubscriptionId: null, subscription: null });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("NO_SUBSCRIPTION");
  });

  it("introuvable chez Stripe → 404 SUBSCRIPTION_NOT_FOUND", () => {
    const d = authorizeSubscriptionAction({ userId: USER, localSubscriptionId: "sub_1", subscription: null });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_NOT_FOUND");
  });

  it("id divergent → 404 SUBSCRIPTION_NOT_FOUND", () => {
    const d = authorizeSubscriptionAction({ userId: USER, localSubscriptionId: "sub_1", subscription: view({ id: "sub_x" }) });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_NOT_FOUND");
  });

  it("abonnement d'un autre utilisateur → 403", () => {
    const d = authorizeSubscriptionAction({ userId: USER, localSubscriptionId: "sub_1", subscription: view({ metadataUserId: "autre" }) });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_USER_MISMATCH");
  });

  it("abonnement de l'utilisateur → ok", () => {
    const d = authorizeSubscriptionAction({ userId: USER, localSubscriptionId: "sub_1", subscription: view() });
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.subscriptionId).toBe("sub_1");
  });

  it("metadata absente → autorisé (liaison serveur par orders)", () => {
    const d = authorizeSubscriptionAction({ userId: USER, localSubscriptionId: "sub_1", subscription: view({ metadataUserId: null }) });
    expect(d.ok).toBe(true);
  });
});

describe("summarizeSubscription", () => {
  it("actif → active, annulable, non-reprenable", () => {
    const s = summarizeSubscription({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: 100, trialEnd: null });
    expect(s.uiState).toBe("active");
    expect(s.canCancel).toBe(true);
    expect(s.canResume).toBe(false);
  });

  it("actif avec annulation programmée → cancel_scheduled, reprenable", () => {
    const s = summarizeSubscription({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: 100, trialEnd: null });
    expect(s.uiState).toBe("cancel_scheduled");
    expect(s.canCancel).toBe(false);
    expect(s.canResume).toBe(true);
  });

  it("essai → trialing, annulable", () => {
    const s = summarizeSubscription({ status: "trialing", cancelAtPeriodEnd: false, currentPeriodEnd: null, trialEnd: 200 });
    expect(s.uiState).toBe("trialing");
    expect(s.canCancel).toBe(true);
    expect(s.trialEnd).toBe(200);
  });

  it("essai avec annulation programmée → cancel_scheduled reprenable", () => {
    const s = summarizeSubscription({ status: "trialing", cancelAtPeriodEnd: true, currentPeriodEnd: null, trialEnd: 200 });
    expect(s.uiState).toBe("cancel_scheduled");
    expect(s.canResume).toBe(true);
  });

  it("impayé → past_due, ni annulable ni reprenable", () => {
    const s = summarizeSubscription({ status: "past_due", cancelAtPeriodEnd: false, currentPeriodEnd: null, trialEnd: null });
    expect(s.uiState).toBe("past_due");
    expect(s.canCancel).toBe(false);
    expect(s.canResume).toBe(false);
  });

  it("annulé → canceled", () => {
    const s = summarizeSubscription({ status: "canceled", cancelAtPeriodEnd: false, currentPeriodEnd: null, trialEnd: null });
    expect(s.uiState).toBe("canceled");
  });

  it("statut vide → none", () => {
    const s = summarizeSubscription({ status: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, trialEnd: null });
    expect(s.uiState).toBe("none");
  });
});

describe("subscriptionUpdateIdempotencyKey", () => {
  it("cancel et resume donnent des clés distinctes", () => {
    const c = subscriptionUpdateIdempotencyKey({ subscriptionId: "sub_1", intent: "cancel_at_period_end" });
    const r = subscriptionUpdateIdempotencyKey({ subscriptionId: "sub_1", intent: "resume" });
    expect(c).toBe("cs-sub-cancel_at_period_end:sub_1");
    expect(r).toBe("cs-sub-resume:sub_1");
    expect(c).not.toBe(r);
  });
});
