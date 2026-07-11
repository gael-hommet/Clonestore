// Extracteurs de champs Stripe tolérants à la version d'API.
// Régression couverte : avec le SDK v20 / API 2025-11-17.clover, `Invoice.subscription`,
// `Invoice.payment_intent` et `Subscription.current_period_end` N'EXISTENT PLUS. Lus en
// brut sur un Record<string, unknown>, ils renvoyaient silencieusement null.

import { describe, it, expect } from "vitest";
import {
  extractInvoiceSubscriptionId,
  extractInvoicePaymentIntentId,
  extractSubscriptionCurrentPeriodEnd,
} from "../stripe-event-fields";

describe("extractInvoiceSubscriptionId", () => {
  it("forme COURANTE : parent.subscription_details.subscription", () => {
    const invoice = { parent: { type: "subscription_details", subscription_details: { subscription: "sub_courant" } } };
    expect(extractInvoiceSubscriptionId(invoice)).toBe("sub_courant");
  });

  it("forme courante avec objet développé (expand)", () => {
    const invoice = { parent: { subscription_details: { subscription: { id: "sub_expand" } } } };
    expect(extractInvoiceSubscriptionId(invoice)).toBe("sub_expand");
  });

  it("forme LEGACY : invoice.subscription (événement rejoué)", () => {
    expect(extractInvoiceSubscriptionId({ subscription: "sub_legacy" })).toBe("sub_legacy");
  });

  it("la forme courante prime sur la forme legacy", () => {
    const invoice = {
      subscription: "sub_legacy",
      parent: { subscription_details: { subscription: "sub_courant" } },
    };
    expect(extractInvoiceSubscriptionId(invoice)).toBe("sub_courant");
  });

  it("facture hors abonnement (parent quote_details) → null", () => {
    expect(extractInvoiceSubscriptionId({ parent: { type: "quote_details", quote_details: { quote: "qt_1" } } })).toBeNull();
  });

  it.each([{}, { parent: null }, { parent: { subscription_details: null } }, { subscription: "" }, { subscription: 42 }])(
    "forme dégradée %# → null (jamais d'exception)",
    (invoice) => {
      expect(extractInvoiceSubscriptionId(invoice as Record<string, unknown>)).toBeNull();
    },
  );
});

describe("extractInvoicePaymentIntentId", () => {
  it("forme COURANTE : payments.data[].payment.payment_intent", () => {
    const invoice = { payments: { data: [{ payment: { type: "payment_intent", payment_intent: "pi_courant" } }] } };
    expect(extractInvoicePaymentIntentId(invoice)).toBe("pi_courant");
  });

  it("ignore les entrées sans payment_intent et prend la première valide", () => {
    const invoice = {
      payments: { data: [{ payment: { type: "charge", charge: "ch_1" } }, { payment: { payment_intent: "pi_2" } }] },
    };
    expect(extractInvoicePaymentIntentId(invoice)).toBe("pi_2");
  });

  it("forme LEGACY : invoice.payment_intent", () => {
    expect(extractInvoicePaymentIntentId({ payment_intent: "pi_legacy" })).toBe("pi_legacy");
  });

  it("aucun paiement → null", () => {
    expect(extractInvoicePaymentIntentId({ payments: { data: [] } })).toBeNull();
  });
});

describe("extractSubscriptionCurrentPeriodEnd", () => {
  it("forme COURANTE : items.data[].current_period_end", () => {
    expect(extractSubscriptionCurrentPeriodEnd({ items: { data: [{ current_period_end: 1_800_000_000 }] } })).toBe(1_800_000_000);
  });

  it("multi-lignes → retient la fin de période la plus tardive", () => {
    const sub = { items: { data: [{ current_period_end: 1_700_000_000 }, { current_period_end: 1_900_000_000 }] } };
    expect(extractSubscriptionCurrentPeriodEnd(sub)).toBe(1_900_000_000);
  });

  it("forme LEGACY : subscription.current_period_end", () => {
    expect(extractSubscriptionCurrentPeriodEnd({ current_period_end: 1_650_000_000 })).toBe(1_650_000_000);
  });

  it("la forme courante prime sur la forme legacy", () => {
    const sub = { current_period_end: 1_000, items: { data: [{ current_period_end: 2_000 }] } };
    expect(extractSubscriptionCurrentPeriodEnd(sub)).toBe(2_000);
  });

  it.each([{}, { items: { data: [] } }, { items: { data: [{}] } }, { current_period_end: "demain" }])(
    "forme dégradée %# → null",
    (sub) => {
      expect(extractSubscriptionCurrentPeriodEnd(sub as Record<string, unknown>)).toBeNull();
    },
  );
});
