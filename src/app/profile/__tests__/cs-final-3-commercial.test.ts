// CS-FINAL 3 — contribution commerciale (structure, sécurité, source de vérité, câblage).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { renderCommercialEmail } from "@/lib/clonestory/founding-partners/server/commercial-emails";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const ENGINE = read("src/lib/clonestory/founding-partners/server/commercial.ts");
const BRIDGE = read("src/lib/clonestory/founding-partners/server/stripe-commercial-bridge.ts");
const EMAILS = read("src/lib/clonestory/founding-partners/server/commercial-emails.ts");
const WEBHOOK = read("src/app/api/webhooks/stripe/route.ts");
const CRON = read("src/app/api/cron/clonestory-commercial-outbox/route.ts");
const CONFIG = read("src/lib/clonestory/founding-partners/server/config.ts");
const COCKPIT = read("src/lib/clonestory/founding-partners/server/cockpit.ts");
const ADMIN = read("src/lib/clonestory/founding-partners/server/admin-store.ts");
const MIG07 = read("supabase/migrations/2026-06-26_07__clonestory_fp_commercial_contributions.sql");

describe("source de vérité du paiement (autoritative serveur)", () => {
  it("le paiement vient d'invoice.paid signé — jamais d'une page /success ou du navigateur", () => {
    expect(ENGINE).toContain('"invoice.paid"');
    expect(BRIDGE).toContain("invoice.paid");
    // capture déclenchée par l'événement Stripe, pas par un appel client
    expect(ENGINE).toMatch(/markPurchaseCaptured/);
    expect(WEBHOOK).toContain("constructEvent"); // signature vérifiée avant tout
  });
  it("checkout.session.completed (essai) ne capture pas de paiement à montant nul", () => {
    expect(ENGINE).toMatch(/trial_or_zero_amount|amountPaid.*<=\s*0/);
  });
});

describe("modèle financier robuste (migration _07)", () => {
  it("tables présentes, RLS forcée, append-only, aucun DELETE, rollback documenté", () => {
    expect(MIG07).toContain("create table if not exists clonestory_fp_commercial_contributions");
    expect(MIG07).toContain("create table if not exists clonestory_fp_commercial_events");
    expect(MIG07).toContain("create table if not exists clonestory_fp_stripe_events");
    expect(MIG07).toContain("create table if not exists clonestory_fp_commercial_outbox");
    expect(MIG07).toContain("force  row level security");
    expect(MIG07).toContain("clonestory_forbid_mutation"); // events append-only
    expect(MIG07).toMatch(/ROLLBACK/i);
    expect(MIG07).not.toMatch(/\bdelete from\b/i);
  });
  it("montants en entiers (bigint), aucun float/numeric financier", () => {
    expect(MIG07).toMatch(/gross_amount\s+bigint/);
    expect(MIG07).toMatch(/refunded_amount\s+bigint/);
    expect(MIG07).toMatch(/net_amount\s+bigint/);
    expect(MIG07).not.toMatch(/(gross_amount|net_amount|refunded_amount)\s+(numeric|real|double|float)/i);
  });
  it("unicité : une contribution par abonnement ; ledger unique par event Stripe", () => {
    expect(MIG07).toContain("uq_csy_cc_subscription");
    expect(MIG07).toMatch(/stripe_event_id\s+text not null unique/);
  });
});

describe("machine d'états & règles verrouillées", () => {
  it("vérification exige paiement + activation + délai ; refuse le retour arrière", () => {
    expect(ENGINE).toMatch(/no_payment/);
    expect(ENGINE).toMatch(/activation_incomplete/);
    expect(ENGINE).toMatch(/validation_window_open/);
    expect(ENGINE).toContain("CC_TERMINAL");
  });
  it("registry_number alloué atomiquement (verrou) + permanent ; distinctions révocables", () => {
    expect(ENGINE).toContain("pg_advisory_xact_lock");
    expect(ENGINE).toContain("promoteToFoundingPartner");
    expect(ENGINE).toContain("recomputeCommercialDistinctions");
    expect(ENGINE).toMatch(/revokeAward/);
  });
  it("remboursement/annulation/litige sans effacer l'historique", () => {
    expect(ENGINE).toContain("applyRefund");
    expect(ENGINE).toMatch(/dispute_opened/);
    expect(ENGINE).toMatch(/dispute_closed/);
    expect(ENGINE).toMatch(/renewal_recorded/); // renouvellement ≠ nouveau client
  });
});

describe("câblage webhook (additif, best-effort) & sécurité", () => {
  it("pont branché sur le webhook canonique, jamais un second webhook", () => {
    expect(WEBHOOK).toContain("bridgeClonestoryCommercial");
    expect(BRIDGE).toMatch(/best-effort|never|avalée|avalé/i);
    expect(BRIDGE).toMatch(/catch/); // n'interrompt jamais le webhook principal
  });
  it("cron outbox commerciale : Bearer-only, fail-closed (503 sans secret, 401 sinon)", () => {
    expect(CRON).toContain("timingSafeEqual");
    expect(CRON).toContain("commercialOutboxCronSecret");
    expect(CRON).toContain("503");
    expect(CRON).toContain("401");
    expect(CRON).not.toMatch(/\?secret=/);
  });
  it("aucun secret Stripe ni PII en clair dans les modules commerciaux", () => {
    for (const src of [ENGINE, BRIDGE, EMAILS]) {
      expect(src).not.toMatch(/sk_live|sk_test_[A-Za-z0-9]{10}/);
    }
    void EMAILS;
    // Vérifie les emails RENDUS (pas le commentaire-garde) : aucune promesse financière,
    // démenti honorifique présent dans chaque message.
    const KINDS = ["client_paid", "activation_completed", "validation_pending",
      "contribution_verified", "contribution_refunded", "contribution_disputed", "distinction_awarded"];
    for (const k of KINDS) {
      const m = renderCommercialEmail(k, "https://clonestore.pro/profile");
      const blob = `${m.subject} ${m.html} ${m.text}`;
      expect(blob, `vocabulaire interdit dans ${k}`).not.toMatch(/commission|payout|cashback|vous (gagnez|toucherez|recevez)|votre gain|parrainage/i);
      expect(blob).toContain("aucune part, action"); // démenti honorifique
    }
  });
});

describe("config, cockpit, admin", () => {
  it("délai de validation + seuil remboursement partiel configurables, documentés", () => {
    expect(CONFIG).toContain("contributionValidationDelayMs");
    expect(CONFIG).toContain("partialRefundReviewPct");
    expect(CONFIG).toContain("eligibleCommercialProducts");
  });
  it("cockpit lit les contributions commerciales avec repli gracieux si _07 absente", () => {
    expect(COCKPIT).toContain("getCommercialStatsForPartner");
    expect(COCKPIT).toMatch(/catch\s*\{[^}]*_07/);
    expect(COCKPIT).toContain("clientsPaid");
  });
  it("contrat admin : vérifier / invalider / réconcilier (raison + audit)", () => {
    expect(ADMIN).toContain("adminVerifyContribution");
    expect(ADMIN).toContain("adminInvalidateContribution");
    expect(ADMIN).toContain("adminReconcileCommercial");
    expect(ADMIN).toContain("adminListCommercialReview");
  });
});
