// CloneStory — Le Cercle des Partenaires Fondateurs — Tests d'invariants (Bloc 1).
//
// Couvre le vocabulaire verrouillé, les machines d'état (partenaire + contribution),
// l'attribution directe/réseau (cas Jérémie/Paul), l'anti-fraude et les tokens.

import { describe, it, expect } from "vitest";

import {
  DOCTRINE,
  INTRO_SEQUENCE,
  TITLE_FR,
  TITLE_INTL,
  PROGRAM_NAME,
  UNIVERSE_NAME,
  buildIdentity,
  formatRegistryBadge,
  formatRegistryNumber,
  formatSinceLine,
  assertNoForbiddenTerm,
  findForbiddenTerm,
} from "../vocabulary";

import {
  assertPartnerTransition,
  PartnerTransitionError,
  holdsPublicTitle,
  isEligibleForPublicRegistry,
  deriveStatusAfterMilestones,
  isPartnerTransitionListed,
} from "../partner-status";

import {
  assertContributionTransition,
  ContributionTransitionError,
  isContributionTransitionListed,
  derivePartnerStats,
  deriveContributionStatus,
  analyzeContribution,
  isContributionVerified,
  DEFAULT_VALIDATION_DELAY_MS,
  isInProgress,
} from "../contribution";
import type { ContributionEvent, ContributionEventType, EvidenceSource, Introduction } from "../types";

import {
  resolveDirectAttribution,
  buildBranchGraph,
  ancestorsOf,
  descendantsOf,
  computePartnerImpact,
  computeImpactFromContributions,
  assertNoDirectCreditTheft,
  AttributionIntegrityError,
  detectBranchCycle,
  branchOrigin,
} from "../attribution";

import {
  checkSelfAttribution,
  checkDeclaredBeforePurchase,
  checkDuplicateCompany,
  checkDuplicatePayment,
  checkEmailDomain,
  checkCollusionSignals,
  checkPostVerificationEdit,
  checkCrossTenantAccess,
  combineVerdicts,
  evaluateIntroductionFraud,
} from "../anti-fraud";

import {
  issuePartnerLinkToken,
  issuePartnerCode,
  hashPartnerCode,
  hashLinkToken,
  secretMatchesHash,
  normalizeCode,
  companyFingerprint,
  PARTNER_LINK_PREFIX,
} from "../token";

import {
  normalizeEmailForCompare,
  buildPublicSlug,
  isValidPublicSlug,
  companyDedupKey,
} from "../normalize";

// ── Vocabulaire ───────────────────────────────────────────────────────────
describe("vocabulaire officiel", () => {
  it("conserve la phrase doctrinale verbatim", () => {
    expect(DOCTRINE).toContain("CloneStory n'est ni un programme d'affiliation ni un système de parrainage commercial.");
    expect(DOCTRINE).toContain("registre officiel des personnes ayant contribué de manière vérifiée");
    expect(DOCTRINE).toContain("au commencement de CloneStore.");
  });

  it("expose les noms officiels", () => {
    expect(UNIVERSE_NAME).toBe("CloneStory");
    expect(PROGRAM_NAME).toBe("Le Cercle des Partenaires Fondateurs");
    expect(TITLE_FR).toBe("Partenaire Fondateur de CloneStore");
    expect(TITLE_INTL).toBe("Founding Partner");
  });

  it("formate le badge de registre exactement", () => {
    expect(formatRegistryBadge(17)).toBe("FOUNDING PARTNER #017");
    expect(formatRegistryNumber(17)).toBe("017");
    expect(formatRegistryNumber(1042)).toBe("1042");
    expect(() => formatRegistryBadge(0)).toThrow();
  });

  it("formate la ligne « Depuis … » en français", () => {
    expect(formatSinceLine(new Date(Date.UTC(2026, 6, 1)))).toBe("Depuis juillet 2026");
    expect(formatSinceLine(new Date(Date.UTC(2026, 0, 15)))).toBe("Depuis janvier 2026");
  });

  it("construit l'identité complète", () => {
    const id = buildIdentity(17, new Date(Date.UTC(2026, 6, 1)));
    expect(id).toEqual({
      badge: "FOUNDING PARTNER #017",
      titleFr: "Partenaire Fondateur de CloneStore",
      since: "Depuis juillet 2026",
    });
  });

  it("rejette les termes interdits comme désignation principale", () => {
    for (const bad of [
      "Programme d'affiliation",
      "Système de parrainage",
      "Devenez Founder",
      "Vous êtes actionnaire",
      "Gagnez des points",
      "Concours du mois",
      "Notre cofondateur",
    ]) {
      expect(() => assertNoForbiddenTerm(bad), bad).toThrow();
    }
  });

  it("accepte les libellés légitimes", () => {
    for (const ok of [
      "Partenaire Fondateur de CloneStore",
      "Founding Partner",
      "Le Cercle des Partenaires Fondateurs",
      "Une contribution vérifiée au commencement",
    ]) {
      expect(() => assertNoForbiddenTerm(ok), ok).not.toThrow();
    }
  });

  it("respecte les frontières de mots (pas de faux positif)", () => {
    // « transaction » / « fraction » contiennent « action » mais ne doivent pas matcher.
    expect(findForbiddenTerm("Chaque transaction est tracée")).toBeNull();
    expect(findForbiddenTerm("une fraction du temps")).toBeNull();
    // mais « action » mot entier déclenche
    expect(findForbiddenTerm("Vous recevez une action")).toBe("action");
  });

  it("fige la séquence d'introduction", () => {
    expect(INTRO_SEQUENCE).toHaveLength(3);
    expect(INTRO_SEQUENCE[0]).toBe("Certaines personnes découvriront CloneStore lorsqu'elle sera déjà connue.");
    expect(INTRO_SEQUENCE[1]).toBe("D'autres auront contribué à son commencement.");
    expect(INTRO_SEQUENCE[2]).toBe("Leur nom restera inscrit dans son histoire.");
  });
});

// ── Machine d'état partenaire ───────────────────────────────────────────────
describe("statut partenaire", () => {
  const ctx0 = { verifiedContributions: 0 };
  const ctx1 = { verifiedContributions: 1 };

  it("autorise la progression nominale", () => {
    expect(() => assertPartnerTransition("registered", "email_verified", ctx0)).not.toThrow();
    expect(() => assertPartnerTransition("email_verified", "identity_verified", ctx0)).not.toThrow();
    expect(() => assertPartnerTransition("identity_verified", "active_contributor", ctx0)).not.toThrow();
  });

  it("interdit les sauts non listés", () => {
    expect(() => assertPartnerTransition("registered", "founding_partner", ctx1)).toThrow(PartnerTransitionError);
    expect(isPartnerTransitionListed("registered", "active_contributor")).toBe(false);
  });

  it("n'accorde le titre qu'avec ≥1 contribution vérifiée", () => {
    expect(() => assertPartnerTransition("active_contributor", "founding_partner", ctx0)).toThrow(PartnerTransitionError);
    expect(() => assertPartnerTransition("active_contributor", "founding_partner", ctx1)).not.toThrow();
  });

  it("un inscrit n'est PAS un Partenaire Fondateur public", () => {
    expect(holdsPublicTitle("registered")).toBe(false);
    expect(holdsPublicTitle("email_verified")).toBe(false);
    expect(holdsPublicTitle("identity_verified")).toBe(false);
    expect(holdsPublicTitle("active_contributor")).toBe(false);
    expect(holdsPublicTitle("founding_partner")).toBe(true);
    expect(isEligibleForPublicRegistry("founding_partner")).toBe(true);
    expect(isEligibleForPublicRegistry("suspended")).toBe(false);
  });

  it("withdrawn est terminal", () => {
    expect(() => assertPartnerTransition("withdrawn", "registered", ctx1)).toThrow();
  });

  it("dérive le statut sans écraser un état administratif", () => {
    expect(deriveStatusAfterMilestones({ current: "registered", emailVerified: false, identityVerified: false, hasIntroductions: false, verifiedContributions: 0 })).toBe("registered");
    expect(deriveStatusAfterMilestones({ current: "identity_verified", emailVerified: true, identityVerified: true, hasIntroductions: true, verifiedContributions: 0 })).toBe("active_contributor");
    expect(deriveStatusAfterMilestones({ current: "active_contributor", emailVerified: true, identityVerified: true, hasIntroductions: true, verifiedContributions: 2 })).toBe("founding_partner");
    expect(deriveStatusAfterMilestones({ current: "suspended", emailVerified: true, identityVerified: true, hasIntroductions: true, verifiedContributions: 5 })).toBe("suspended");
  });
});

// ── Cycle de vie d'une contribution ─────────────────────────────────────────
describe("contribution", () => {
  it("avance d'un seul cran dans le flux nominal", () => {
    expect(isContributionTransitionListed("declared", "prospect_confirmed")).toBe(true);
    expect(isContributionTransitionListed("declared", "purchase_captured")).toBe(false);
    expect(() => assertContributionTransition("prospect_registered", "company_created")).not.toThrow();
  });

  it("exige une preuve pour la vérification", () => {
    expect(() => assertContributionTransition("validation_pending", "verified")).toThrow(ContributionTransitionError);
    expect(() => assertContributionTransition("validation_pending", "verified", { evidenceRef: "stripe_evt_1", validationDelayElapsed: true })).not.toThrow();
    expect(() => assertContributionTransition("validation_pending", "verified", { evidenceRef: "stripe_evt_1", validationDelayElapsed: false })).toThrow();
  });

  it("permet annulation depuis non-terminal, pas depuis verified", () => {
    expect(isContributionTransitionListed("purchase_captured", "canceled")).toBe(true);
    expect(isContributionTransitionListed("verified", "canceled")).toBe(false);
  });

  it("n'expire qu'avant la capture de l'achat", () => {
    expect(isContributionTransitionListed("prospect_registered", "expired")).toBe(true);
    expect(isContributionTransitionListed("activation_completed", "expired")).toBe(false);
  });

  it("résout un litige vers vérifié ou annulé", () => {
    expect(isContributionTransitionListed("disputed", "verified")).toBe(true);
    expect(isContributionTransitionListed("disputed", "canceled")).toBe(true);
    expect(isContributionTransitionListed("disputed", "prospect_registered")).toBe(false);
  });

  it("dérive les statistiques depuis les introductions (jamais saisies)", () => {
    const intros: Pick<Introduction, "status">[] = [
      { status: "declared" },
      { status: "prospect_registered" },
      { status: "purchase_captured" },
      { status: "verified" },
      { status: "verified" },
      { status: "canceled" },
    ];
    const stats = derivePartnerStats({ directIntroductions: intros, networkVerifiedCount: 6 });
    expect(stats.verifiedDirect).toBe(2);
    expect(stats.customersWithPurchase).toBe(3); // purchase_captured + 2 verified (achat franchi)
    expect(stats.prospectsRegistered).toBe(4); // registered + purchase + 2 verified
    expect(stats.canceled).toBe(1);
    expect(stats.verifiedNetwork).toBe(6);
    expect(stats.introductionsInProgress).toBe(3); // declared, prospect_registered, purchase_captured
  });

  it("reconstruit le statut nominal (contigu) depuis des événements append-only", () => {
    // Chaîne partielle CONTIGUË : declared → confirmed → registered.
    expect(
      deriveContributionStatus([
        ev("introduction_declared", "2026-07-01T10:00:00Z"),
        ev("introduction_confirmed", "2026-07-02T10:00:00Z"),
        ev("prospect_registered", "2026-07-03T10:00:00Z"),
      ]),
    ).toBe("prospect_registered");
    // Activation terminée (preuve) → le délai de validation court.
    expect(deriveContributionStatus(fullChain().slice(0, 6))).toBe("validation_pending");
    expect(isInProgress("purchase_captured")).toBe(true);
    expect(isInProgress("verified")).toBe(false);
  });
});

// ── #1 — VALIDATION STRICTE D'UNE CONTRIBUTION (tests négatifs) ──────────────
// Helpers de construction d'événements.
function ev(
  type: ContributionEventType,
  occurredAt: string,
  evidenceRef: string | null = null,
  source: EvidenceSource = "phase_e",
): ContributionEvent {
  return { id: `${type}@${occurredAt}`, partnerId: "p1", introductionId: "i1", type, source, occurredAt, evidenceRef };
}

/** Chaîne complète et VALIDE (délai par défaut largement écoulé). */
function fullChain(verifyAt = "2026-07-20T10:00:00Z"): ContributionEvent[] {
  return [
    ev("introduction_declared", "2026-07-01T10:00:00Z"),
    ev("introduction_confirmed", "2026-07-02T10:00:00Z"),
    ev("prospect_registered", "2026-07-03T10:00:00Z"),
    ev("company_created", "2026-07-04T10:00:00Z"),
    ev("purchase_captured", "2026-07-05T10:00:00Z", "stripe_evt_pay", "stripe"),
    ev("activation_completed", "2026-07-06T10:00:00Z", "act_1"),
    ev("contribution_verified", verifyAt, "verify_1"),
  ];
}

describe("validation stricte d'une contribution", () => {
  it("vérifie UNIQUEMENT une chaîne de preuves complète, ordonnée et hors délai", () => {
    expect(DEFAULT_VALIDATION_DELAY_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const a = analyzeContribution(fullChain());
    expect(a.status).toBe("verified");
    expect(a.verified).toBe(true);
    expect(a.reasonCodes).toEqual(["OK"]);
    expect(isContributionVerified(fullChain())).toBe(true);
  });

  it("REFUSE `contribution_verified` seul", () => {
    const a = analyzeContribution([ev("contribution_verified", "2026-07-20T10:00:00Z", "verify_1")]);
    expect(a.status).toBe("disputed");
    expect(a.verified).toBe(false);
    expect(a.reasonCodes).toContain("MISSING_EVENT");
  });

  it("REFUSE une vérification sans achat", () => {
    const chain = fullChain().filter((e) => e.type !== "purchase_captured");
    const a = analyzeContribution(chain);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("MISSING_EVENT");
  });

  it("REFUSE une vérification sans activation", () => {
    const chain = fullChain().filter((e) => e.type !== "activation_completed");
    const a = analyzeContribution(chain);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("MISSING_EVENT");
  });

  it("REFUSE une vérification avant le délai", () => {
    // verified seulement 1 jour après l'activation (< 7 jours par défaut).
    const a = analyzeContribution(fullChain("2026-07-07T10:00:00Z"));
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("DELAY_NOT_ELAPSED");
    // Avec un délai réduit, la même chaîne devient valide.
    expect(analyzeContribution(fullChain("2026-07-07T10:00:00Z"), { validationDelayMs: 0 }).status).toBe("verified");
  });

  it("REFUSE une preuve serveur manquante (evidenceRef absent)", () => {
    const chain = fullChain().map((e) =>
      e.type === "purchase_captured" ? { ...e, evidenceRef: null } : e,
    );
    const a = analyzeContribution(chain);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("MISSING_EVIDENCE");
  });

  it("REFUSE un événement Stripe dupliqué (même empreinte de preuve)", () => {
    const chain = fullChain();
    chain.push(ev("purchase_captured", "2026-07-05T11:00:00Z", "stripe_evt_pay", "stripe"));
    const a = analyzeContribution(chain);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes.some((c) => c === "DUPLICATE_EVENT" || c === "DUPLICATE_EVIDENCE")).toBe(true);
  });

  it("REFUSE une preuve déjà consommée par une autre contribution (rejeu)", () => {
    const a = analyzeContribution(fullChain(), { consumedEvidenceRefs: new Set(["stripe_evt_pay"]) });
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("DUPLICATE_EVIDENCE");
  });

  it("REFUSE des événements hors ordre", () => {
    // purchase_captured horodaté AVANT prospect_registered.
    const chain = [
      ev("introduction_declared", "2026-07-01T10:00:00Z"),
      ev("introduction_confirmed", "2026-07-02T10:00:00Z"),
      ev("company_created", "2026-07-03T10:00:00Z"),
      ev("purchase_captured", "2026-07-04T10:00:00Z", "stripe_evt_pay", "stripe"),
      ev("prospect_registered", "2026-07-05T10:00:00Z"), // hors ordre
      ev("activation_completed", "2026-07-06T10:00:00Z", "act_1"),
      ev("contribution_verified", "2026-07-20T10:00:00Z", "verify_1"),
    ];
    const a = analyzeContribution(chain);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("OUT_OF_ORDER");
  });

  it("REFUSE une vérification après annulation", () => {
    const chain = [
      ...fullChain("2026-07-08T10:00:00Z").slice(0, 6),
      ev("contribution_canceled", "2026-07-09T10:00:00Z", "refund_1"),
      ev("contribution_verified", "2026-07-20T10:00:00Z", "verify_1"),
    ];
    const a = analyzeContribution(chain);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("VERIFY_AFTER_CANCEL");
  });

  it("traite l'annulation comme terminale (sans tentative de vérif)", () => {
    const chain = [...fullChain().slice(0, 5), ev("contribution_canceled", "2026-07-09T10:00:00Z", "refund_1")];
    expect(analyzeContribution(chain).status).toBe("canceled");
  });

  it("REFUSE de vérifier un litige sans validation manuelle autorisée", () => {
    const disputed = [
      ...fullChain("2026-07-20T10:00:00Z").slice(0, 6),
      ev("contribution_disputed", "2026-07-08T10:00:00Z"),
      ev("contribution_verified", "2026-07-20T10:00:00Z", "verify_1"),
    ];
    const a = analyzeContribution(disputed);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("DISPUTED_UNRESOLVED");

    // Avec une validation manuelle autorisée (preuve) postérieure au litige → vérifiable.
    const resolved = [
      ...fullChain("2026-07-21T10:00:00Z").slice(0, 6),
      ev("contribution_disputed", "2026-07-08T10:00:00Z"),
      ev("manual_validation", "2026-07-19T10:00:00Z", "audit_admin_1", "manual"),
      ev("contribution_verified", "2026-07-21T10:00:00Z", "verify_1"),
    ];
    expect(analyzeContribution(resolved).status).toBe("verified");
  });

  it("REFUSE une chaîne avec un trou (jalon manquant) avant toute vérification", () => {
    // declared puis company_created (saut de confirmed + registered).
    const a = analyzeContribution([
      ev("introduction_declared", "2026-07-01T10:00:00Z"),
      ev("company_created", "2026-07-04T10:00:00Z"),
    ]);
    expect(a.status).toBe("disputed");
    expect(a.reasonCodes).toContain("MISSING_EVENT");
  });
});

// ── Attribution directe & réseau ────────────────────────────────────────────
describe("attribution", () => {
  it("résout une attribution unique / la plus ancienne / ambiguë", () => {
    expect(resolveDirectAttribution([{ partnerId: "a", method: "link", declaredAt: "2026-07-01T00:00:00Z" }]).reason).toBe("single_candidate");
    const earliest = resolveDirectAttribution([
      { partnerId: "a", method: "link", declaredAt: "2026-07-02T00:00:00Z" },
      { partnerId: "b", method: "code", declaredAt: "2026-07-01T00:00:00Z" },
    ]);
    expect(earliest.partnerId).toBe("b");
    expect(earliest.reason).toBe("earliest_valid_candidate");
    const ambiguous = resolveDirectAttribution([
      { partnerId: "a", method: "link", declaredAt: "2026-07-01T00:00:00Z" },
      { partnerId: "b", method: "link", declaredAt: "2026-07-01T00:00:00Z" },
    ]);
    expect(ambiguous.partnerId).toBeNull();
    expect(ambiguous.reason).toBe("ambiguous_same_instant");
  });

  it("CAS JÉRÉMIE/PAUL : Paul garde le direct, Jérémie l'impact réseau sans voler le mérite", () => {
    // Jérémie (J) introduit Paul (P). Paul apporte 6 clients (contributions directes de Paul).
    const graph = buildBranchGraph([
      { id: "J", introducedByPartnerId: null },
      { id: "P", introducedByPartnerId: "J" },
    ]);
    const verified = { counts: new Map<string, number>([["P", 6], ["J", 0]]) };

    const paul = computePartnerImpact(graph, verified, "P");
    expect(paul.direct).toBe(6);
    expect(paul.network).toBe(0);

    const jeremie = computePartnerImpact(graph, verified, "J");
    expect(jeremie.direct).toBe(0); // Jérémie ne vole AUCUN crédit direct
    expect(jeremie.network).toBe(6); // mais conserve l'impact réseau de sa branche

    expect(branchOrigin(graph, "P")).toBe("J");
    expect(ancestorsOf(graph, "P")).toEqual(["J"]);
    expect(descendantsOf(graph, "J").has("P")).toBe(true);
  });

  it("agrège l'impact réseau sur plusieurs niveaux sans double comptage du direct", () => {
    const graph = buildBranchGraph([
      { id: "J", introducedByPartnerId: null },
      { id: "P", introducedByPartnerId: "J" },
      { id: "M", introducedByPartnerId: "P" },
    ]);
    const verified = { counts: new Map<string, number>([["J", 1], ["P", 6], ["M", 3]]) };
    const j = computePartnerImpact(graph, verified, "J");
    expect(j.direct).toBe(1);
    expect(j.network).toBe(9); // 6 (P) + 3 (M)
    const p = computePartnerImpact(graph, verified, "P");
    expect(p.direct).toBe(6);
    expect(p.network).toBe(3);
  });

  it("protège contre les cycles dans le graphe", () => {
    const graph = buildBranchGraph([
      { id: "A", introducedByPartnerId: "B" },
      { id: "B", introducedByPartnerId: "A" },
    ]);
    expect(ancestorsOf(graph, "A").length).toBeLessThanOrEqual(2);
  });

  // ── #2 — Preuve formelle par identifiants uniques ────────────────────────
  it("PREUVE FORMELLE Jérémie/Paul par identifiants : 6 directs à Paul, 6 réseau à Jérémie, 0 volé", () => {
    const graph = buildBranchGraph([
      { id: "J", introducedByPartnerId: null },
      { id: "P", introducedByPartnerId: "J" },
    ]);
    // Six contributions identifiées, toutes propriété DIRECTE de Paul.
    const contribs = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i + 1}`,
      directOwnerId: "P",
      companyFingerprint: `company-${i + 1}`,
    }));

    const impact = computeImpactFromContributions(graph, contribs);
    expect(impact.get("P")!.direct.size).toBe(6); // Paul : 6 directs
    expect(impact.get("P")!.network.size).toBe(0);
    expect(impact.get("J")!.direct.size).toBe(0); // Jérémie : AUCUN direct volé
    expect(impact.get("J")!.network.size).toBe(6); // Jérémie : 6 en réseau
    // Les ensembles direct(P) et network(J) sont identiques (mêmes ids), mais
    // jamais comptés en direct chez Jérémie.
    expect([...impact.get("J")!.network].sort()).toEqual([...impact.get("P")!.direct].sort());

    expect(() => assertNoDirectCreditTheft(graph, contribs)).not.toThrow();
  });

  it("REJETTE une tentative de double attribution (même contribution, deux propriétaires)", () => {
    const graph = buildBranchGraph([
      { id: "J", introducedByPartnerId: null },
      { id: "P", introducedByPartnerId: "J" },
    ]);
    // c1 attribuée en direct à Paul ET à Jérémie (vol de crédit).
    const contribs = [
      { id: "c1", directOwnerId: "P" },
      { id: "c1", directOwnerId: "J" },
    ];
    expect(() => assertNoDirectCreditTheft(graph, contribs)).toThrow(AttributionIntegrityError);
    try {
      assertNoDirectCreditTheft(graph, contribs);
    } catch (e) {
      expect((e as AttributionIntegrityError).code).toBe("DOUBLE_DIRECT_ATTRIBUTION");
    }
  });

  it("REJETTE la même contribution présente deux fois", () => {
    const graph = buildBranchGraph([{ id: "P", introducedByPartnerId: null }]);
    const contribs = [
      { id: "c1", directOwnerId: "P" },
      { id: "c1", directOwnerId: "P" },
    ];
    try {
      assertNoDirectCreditTheft(graph, contribs);
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as AttributionIntegrityError).code).toBe("DUPLICATE_CONTRIBUTION");
    }
  });

  it("REJETTE deux partenaires revendiquant la même entreprise", () => {
    const graph = buildBranchGraph([
      { id: "A", introducedByPartnerId: null },
      { id: "B", introducedByPartnerId: null },
    ]);
    const contribs = [
      { id: "c1", directOwnerId: "A", companyFingerprint: "acme" },
      { id: "c2", directOwnerId: "B", companyFingerprint: "acme" },
    ];
    try {
      assertNoDirectCreditTheft(graph, contribs);
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as AttributionIntegrityError).code).toBe("DUPLICATE_COMPANY_ATTRIBUTION");
    }
  });

  it("REJETTE un cycle de branche", () => {
    const graph = buildBranchGraph([
      { id: "A", introducedByPartnerId: "B" },
      { id: "B", introducedByPartnerId: "A" },
    ]);
    expect(detectBranchCycle(graph)).not.toBeNull();
    try {
      assertNoDirectCreditTheft(graph, [{ id: "c1", directOwnerId: "A" }]);
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as AttributionIntegrityError).code).toBe("CYCLE_DETECTED");
    }
  });

  it("valide une branche à plusieurs niveaux par identifiants", () => {
    const graph = buildBranchGraph([
      { id: "J", introducedByPartnerId: null },
      { id: "P", introducedByPartnerId: "J" },
      { id: "M", introducedByPartnerId: "P" },
    ]);
    const contribs = [
      { id: "c1", directOwnerId: "J", companyFingerprint: "co-j" },
      { id: "c2", directOwnerId: "P", companyFingerprint: "co-p1" },
      { id: "c3", directOwnerId: "P", companyFingerprint: "co-p2" },
      { id: "c4", directOwnerId: "M", companyFingerprint: "co-m" },
    ];
    expect(() => assertNoDirectCreditTheft(graph, contribs)).not.toThrow();
    const impact = computeImpactFromContributions(graph, contribs);
    expect(impact.get("J")!.direct.size).toBe(1);
    expect(impact.get("J")!.network.size).toBe(3); // c2, c3 (P) + c4 (M)
    expect(impact.get("P")!.direct.size).toBe(2);
    expect(impact.get("P")!.network.size).toBe(1); // c4 (M)
    expect(impact.get("M")!.direct.size).toBe(1);
    expect(impact.get("M")!.network.size).toBe(0);
  });
});

// ── Anti-fraude ─────────────────────────────────────────────────────────────
describe("anti-fraude", () => {
  it("rejette l'auto-attribution", () => {
    expect(checkSelfAttribution({ partnerEmail: "a@x.com", prospectEmail: "A@X.com" }).decision).toBe("reject");
    expect(checkSelfAttribution({ partnerEmail: "a@x.com", prospectEmail: "b@y.com" }).decision).toBe("allow");
  });

  it("rejette une introduction déclarée après l'achat", () => {
    expect(checkDeclaredBeforePurchase({ declaredAt: "2026-07-10T00:00:00Z", purchaseAt: "2026-07-05T00:00:00Z" }).decision).toBe("reject");
    expect(checkDeclaredBeforePurchase({ declaredAt: "2026-07-01T00:00:00Z", purchaseAt: "2026-07-05T00:00:00Z" }).decision).toBe("allow");
    expect(checkDeclaredBeforePurchase({ declaredAt: "2026-07-10T00:00:00Z", purchaseAt: null }).decision).toBe("allow");
  });

  it("rejette les doublons d'entreprise et de paiement", () => {
    expect(checkDuplicateCompany({ companyFingerprint: "fp1", alreadyAttributedFingerprints: new Set(["fp1"]) }).decision).toBe("reject");
    expect(checkDuplicateCompany({ companyFingerprint: "fp2", alreadyAttributedFingerprints: new Set(["fp1"]) }).decision).toBe("allow");
    expect(checkDuplicatePayment({ stripeEventId: "evt1", consumedStripeEventIds: new Set(["evt1"]) }).decision).toBe("reject");
  });

  it("traite les domaines email correctement (Gmail jamais bloqué)", () => {
    expect(checkEmailDomain("paul@mailinator.com").decision).toBe("reject");
    expect(checkEmailDomain("paul@gmail.com").decision).toBe("allow");
    expect(checkEmailDomain("contact@entreprise.fr").decision).toBe("review");
  });

  it("évalue les signaux de collusion sans rejet automatique", () => {
    expect(checkCollusionSignals({ sameHashedIp: true, sameBranch: true }).decision).toBe("review");
    expect(checkCollusionSignals({ sameHashedIp: true }).decision).toBe("review");
    expect(checkCollusionSignals({}).decision).toBe("allow");
  });

  it("exige une revue pour toute édition après vérification", () => {
    expect(checkPostVerificationEdit({ currentStatus: "verified", isEditingAttribution: true }).decision).toBe("review");
    expect(checkPostVerificationEdit({ currentStatus: "verified", isEditingAttribution: false }).decision).toBe("allow");
  });

  it("bloque l'accès inter-tenant", () => {
    expect(checkCrossTenantAccess({ requestTenantId: "t1", resourceTenantId: "t2" }).decision).toBe("reject");
    expect(checkCrossTenantAccess({ requestTenantId: "t1", resourceTenantId: "t1" }).decision).toBe("allow");
  });

  it("combine les verdicts : le pire gagne", () => {
    const v = combineVerdicts([
      { decision: "allow", code: "OK", reason: "", requiresTrace: false },
      { decision: "review", code: "MULTI_ACCOUNT", reason: "", requiresTrace: true },
      { decision: "reject", code: "SELF_ATTRIBUTION", reason: "", requiresTrace: true },
    ]);
    expect(v.decision).toBe("reject");
    expect(v.code).toBe("SELF_ATTRIBUTION");
  });

  it("évaluation composite d'une introduction", () => {
    const ok = evaluateIntroductionFraud({
      partnerEmail: "jeremie@partner.com",
      prospectEmail: "buyer@acme.com",
      declaredAt: "2026-07-01T00:00:00Z",
      purchaseAt: "2026-07-05T00:00:00Z",
      companyFingerprint: "fpA",
      alreadyAttributedFingerprints: new Set(),
      stripeEventId: "evtA",
      consumedStripeEventIds: new Set(),
    });
    expect(ok.decision).toBe("allow");

    const fraud = evaluateIntroductionFraud({
      partnerEmail: "jeremie@partner.com",
      prospectEmail: "jeremie@partner.com", // auto-attribution
      declaredAt: "2026-07-10T00:00:00Z",
      purchaseAt: "2026-07-05T00:00:00Z", // + déclaré après achat
      companyFingerprint: "fpA",
      alreadyAttributedFingerprints: new Set(["fpA"]), // + entreprise déjà attribuée
      stripeEventId: "evtA",
      consumedStripeEventIds: new Set(),
    });
    expect(fraud.decision).toBe("reject");
  });
});

// ── Tokens & normalisation ──────────────────────────────────────────────────
describe("token & normalisation", () => {
  it("émet un lien personnel opaque et vérifiable, jamais en clair au stockage", () => {
    const t = issuePartnerLinkToken();
    expect(t.value.startsWith(PARTNER_LINK_PREFIX)).toBe(true);
    expect(t.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.hash).not.toContain(t.value);
    expect(secretMatchesHash(t.value, t.hash, "link")).toBe(true);
    expect(secretMatchesHash(t.value + "x", t.hash, "link")).toBe(false);
    expect(hashLinkToken(t.value)).toBe(t.hash);
  });

  it("émet un code personnel lisible, insensible à la casse et aux tirets", () => {
    const c = issuePartnerCode();
    expect(c.value).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(secretMatchesHash(c.value.toLowerCase(), c.hash, "code")).toBe(true);
    expect(secretMatchesHash(c.value.replace("-", ""), c.hash, "code")).toBe(true);
    expect(normalizeCode("abcd-2k9m")).toBe("ABCD2K9M");
    expect(hashPartnerCode("abcd-2k9m")).toBe(hashPartnerCode("ABCD2K9M"));
  });

  it("empreinte d'entreprise déterministe et dépendante du sel", () => {
    expect(companyFingerprint("acme", "salt1")).toBe(companyFingerprint("acme", "salt1"));
    expect(companyFingerprint("acme", "salt1")).not.toBe(companyFingerprint("acme", "salt2"));
    expect(companyFingerprint("", "salt1")).toBe("");
  });

  it("normalise emails, slugs et clés de dédup", () => {
    expect(normalizeEmailForCompare("  Paul@ACME.com ")).toBe("paul@acme.com");
    const slug = buildPublicSlug("Jérémie Dupont", 17);
    expect(slug).toBe("jeremie-dupont-017");
    expect(isValidPublicSlug(slug)).toBe(true);
    expect(isValidPublicSlug("Bad Slug!")).toBe(false);
    expect(companyDedupKey({ name: "ACME SAS" })).toBe("acme");
    expect(companyDedupKey({ domain: "www.Acme.com" })).toBe("acme.com");
  });
});
