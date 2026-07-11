// Moteur d'argent pur — unités mineures, bps, arrondi cumulatif, HT, remboursement prorata.

import { describe, it, expect } from "vitest";
import {
  commissionTargetMinor,
  commissionDeltaMinor,
  eligibleNetFromInvoice,
  refundEligibleNetMinor,
  formatMinorAmount,
  assertMinorAmount,
  DEFAULT_COMMISSION_RATE_BPS,
} from "../money";

describe("commissionTargetMinor — 20 % en bps", () => {
  it("449,00 € HT → 89,80 € (l'exemple de référence)", () => {
    expect(commissionTargetMinor(44_900, DEFAULT_COMMISSION_RATE_BPS)).toBe(8_980);
  });
  it("arrondit au centime inférieur (floor)", () => {
    // 33,33 € × 20 % = 6,666 € → 6,66 €
    expect(commissionTargetMinor(3_333, 2000)).toBe(666);
  });
  it("taux 0 → 0", () => {
    expect(commissionTargetMinor(44_900, 0)).toBe(0);
  });
  it("rejette un montant non entier", () => {
    expect(() => commissionTargetMinor(100.5, 2000)).toThrow();
  });
});

describe("commissionDeltaMinor — écriture = cible cumulée − déjà écrit", () => {
  it("première commission = cible pleine", () => {
    expect(commissionDeltaMinor({ eligibleNetTotalMinor: 44_900, rateBps: 2000, alreadyWrittenMinor: 0 })).toBe(8_980);
  });
  it("remboursement total → reversal ramène la somme à 0", () => {
    // déjà écrit 8980 ; base nette après remboursement total = 0 → cible 0 → delta -8980
    expect(commissionDeltaMinor({ eligibleNetTotalMinor: 0, rateBps: 2000, alreadyWrittenMinor: 8_980 })).toBe(-8_980);
  });
  it("remboursement partiel 50 % → reversal proportionnel", () => {
    // base nette après remboursement = 22450 → cible floor(22450*0.2)=4490 ; delta = 4490-8980 = -4490
    expect(commissionDeltaMinor({ eligibleNetTotalMinor: 22_450, rateBps: 2000, alreadyWrittenMinor: 8_980 })).toBe(-4_490);
  });
  it("pas de sur-reversement : somme des écritures = cible", () => {
    const first = commissionDeltaMinor({ eligibleNetTotalMinor: 44_900, rateBps: 2000, alreadyWrittenMinor: 0 });
    const afterRefund = commissionDeltaMinor({ eligibleNetTotalMinor: 0, rateBps: 2000, alreadyWrittenMinor: first });
    expect(first + afterRefund).toBe(0);
  });
});

describe("eligibleNetFromInvoice — HT hors TVA, après remises", () => {
  it("préfère total_excluding_tax (déjà net de remises, hors TVA)", () => {
    expect(eligibleNetFromInvoice({ totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 53_880 })).toBe(44_900);
  });
  it("sinon total − tax", () => {
    expect(eligibleNetFromInvoice({ totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: null, amountPaidMinor: 53_880 })).toBe(44_900);
  });
  it("facture non encaissée (amount_paid ≤ 0) → 0", () => {
    expect(eligibleNetFromInvoice({ totalMinor: 53_880, taxMinor: 8_980, totalExcludingTaxMinor: 44_900, amountPaidMinor: 0 })).toBe(0);
  });
  it("jamais négatif", () => {
    expect(eligibleNetFromInvoice({ totalMinor: 100, taxMinor: 200, totalExcludingTaxMinor: null, amountPaidMinor: 100 })).toBe(0);
  });
});

describe("refundEligibleNetMinor — part HT du remboursement au prorata", () => {
  it("remboursement TTC total → base HT complète", () => {
    // facture TTC 53880, HT 44900 ; remboursement 53880 → HT proportionnel = 44900
    expect(refundEligibleNetMinor({ refundTtcMinor: 53_880, invoiceTotalMinor: 53_880, invoiceEligibleNetMinor: 44_900, remainingEligibleNetMinor: 44_900 })).toBe(44_900);
  });
  it("remboursement 50 % → moitié de la base HT", () => {
    expect(refundEligibleNetMinor({ refundTtcMinor: 26_940, invoiceTotalMinor: 53_880, invoiceEligibleNetMinor: 44_900, remainingEligibleNetMinor: 44_900 })).toBe(22_450);
  });
  it("borné par le reste (deux remboursements ne dépassent pas la base)", () => {
    expect(refundEligibleNetMinor({ refundTtcMinor: 53_880, invoiceTotalMinor: 53_880, invoiceEligibleNetMinor: 44_900, remainingEligibleNetMinor: 10_000 })).toBe(10_000);
  });
  it("facture 100 % remisée (total ≤ 0) → 0", () => {
    expect(refundEligibleNetMinor({ refundTtcMinor: 100, invoiceTotalMinor: 0, invoiceEligibleNetMinor: 0, remainingEligibleNetMinor: 0 })).toBe(0);
  });
});

describe("formatMinorAmount", () => {
  it("8980 eur → 89,80 €", () => { expect(formatMinorAmount(8_980, "eur")).toBe("89,80 €"); });
  it("négatif", () => { expect(formatMinorAmount(-4_490, "eur")).toBe("-44,90 €"); });
  it("devise non-eur → code", () => { expect(formatMinorAmount(49_900, "chf")).toBe("499,00 CHF"); });
});

describe("garde-fous", () => {
  it("assertMinorAmount rejette négatif et non-entier", () => {
    expect(() => assertMinorAmount(-1, "x")).toThrow();
    expect(() => assertMinorAmount(1.5, "x")).toThrow();
    expect(() => assertMinorAmount(100, "x")).not.toThrow();
  });
});
