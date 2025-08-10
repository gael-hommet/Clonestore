// Phase E — Founder Access : tests de la logique pure (validation, état, token,
// calendrier commercial, séquence email). Aucun service externe requis.

import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  classifyEmailDomain,
  dedupeKey,
  validateStep1,
  validateStep2,
} from "../validation";
import { canTransition, assertTransition, ReservationTransitionError, isActiveClient, isEmailSuppressed } from "../state-machine";
import { issueVerificationToken, hashToken, verifyTokenHash, isExpired } from "../token";
import { getFounderPhase, getFounderCtaCopy, FOUNDER_SUBSCRIPTION_AMOUNT_CENTS } from "../commercial";
import { dueScheduledEmails, emailJobKey, FOUNDER_EMAIL_SCHEDULE } from "../email-sequence";

describe("founder-access — validation", () => {
  it("normalise l'email (trim + lowercase)", () => {
    expect(normalizeEmail("  Jean.Dupont@Vireo.FR ")).toBe("jean.dupont@vireo.fr");
  });

  it("classe les domaines email sans bloquer le perso", () => {
    expect(classifyEmailDomain("ceo@vireo.fr")).toBe("professional");
    expect(classifyEmailDomain("dirigeant@gmail.com")).toBe("personal");
    expect(classifyEmailDomain("contact@vireo.fr")).toBe("role_based");
    expect(classifyEmailDomain("x@mailinator.com")).toBe("disposable");
    expect(classifyEmailDomain("pas-un-email")).toBe("unknown");
  });

  it("dedupeKey = email normalisé (idempotence)", () => {
    expect(dedupeKey("A@B.com")).toBe(dedupeKey(" a@b.com "));
  });

  it("valide l'étape 1 et exige email/entreprise/taille", () => {
    const ok = validateStep1({ email: "ceo@vireo.fr", company_name: "Vireo", company_size: "50-249" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.email_domain_type).toBe("professional");

    const bad = validateStep1({ email: "nope", company_name: "", company_size: "x" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.email).toBeTruthy();
      expect(bad.errors.company_name).toBeTruthy();
      expect(bad.errors.company_size).toBeTruthy();
    }
  });

  it("rejette le honeypot", () => {
    const r = validateStep1({ email: "ceo@vireo.fr", company_name: "Vireo", company_size: "1-49", website_hp: "bot" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.honeypot).toBe("rejected");
  });

  it("étape 2 facultative : tout vide reste valide, site/téléphone validés", () => {
    expect(validateStep2({}).ok).toBe(true);
    const dom = validateStep2({ website: "my-company.com", phone: "+33 1 23 45 67 89" });
    expect(dom.ok).toBe(true);
    const bad = validateStep2({ website: "http://??", phone: "abc" });
    expect(bad.ok).toBe(false);
  });
});

describe("founder-access — machine d'état", () => {
  it("autorise les transitions légitimes", () => {
    expect(canTransition("started", "email_to_confirm")).toBe(true);
    expect(canTransition("email_to_confirm", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "activation_sent")).toBe(true);
    expect(canTransition("activation_started", "active_client")).toBe(true);
  });
  it("interdit les transitions incohérentes", () => {
    expect(canTransition("started", "active_client")).toBe(false);
    expect(canTransition("active_client", "confirmed")).toBe(false);
    expect(canTransition("unsubscribed", "confirmed")).toBe(false);
    expect(() => assertTransition("started", "active_client")).toThrow(ReservationTransitionError);
  });
  it("est idempotente (même état) et expose les helpers", () => {
    expect(canTransition("confirmed", "confirmed")).toBe(true);
    expect(isActiveClient("active_client")).toBe(true);
    expect(isEmailSuppressed("unsubscribed")).toBe(true);
    expect(isEmailSuppressed("confirmed")).toBe(false);
  });
});

describe("founder-access — token de vérification", () => {
  it("émet un token + hash, ne stocke jamais le clair", () => {
    const t = issueVerificationToken();
    expect(t.token.length).toBeGreaterThan(20);
    expect(t.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.hash).not.toBe(t.token);
    expect(hashToken(t.token)).toBe(t.hash);
  });
  it("vérifie via comparaison à temps constant", () => {
    const t = issueVerificationToken();
    expect(verifyTokenHash(t.token, t.hash)).toBe(true);
    expect(verifyTokenHash("mauvais", t.hash)).toBe(false);
    expect(verifyTokenHash(t.token, null)).toBe(false);
  });
  it("gère l'expiration", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 1_000_000).toISOString();
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
    expect(isExpired(null)).toBe(true);
  });
});

describe("founder-access — calendrier commercial (Europe/Paris)", () => {
  it("trois phases selon la date", () => {
    expect(getFounderPhase(new Date("2026-06-19T12:00:00+02:00"))).toBe("before_launch");
    expect(getFounderPhase(new Date("2026-09-15T12:00:00+02:00"))).toBe("launched");
    expect(getFounderPhase(new Date("2026-10-05T12:00:00+02:00"))).toBe("closed");
  });
  it("CTA : réserver avant, activer après, fermé après le 30 septembre", () => {
    expect(getFounderCtaCopy("before_launch").primaryLabel).toContain("Réserver Pierre à 449 € HT/mois");
    expect(getFounderCtaCopy("launched").primaryLabel).toContain("Activer Pierre à 449 € HT/mois");
    expect(getFounderCtaCopy("closed").open).toBe(false);
  });
  it("montant fondateur = 44900 centimes", () => {
    expect(FOUNDER_SUBSCRIPTION_AMOUNT_CENTS).toBe(44900);
  });
});

describe("founder-access — séquence email", () => {
  it("la vérification est immédiate (sendAtIso null)", () => {
    const v = FOUNDER_EMAIL_SCHEDULE.find((e) => e.kind === "verification");
    expect(v?.sendAtIso).toBeNull();
    expect(v?.requiresConfirmed).toBe(false);
  });
  it("clé de job idempotente par réservation × type", () => {
    expect(emailJobKey("r1", "launch_open")).toBe("r1:launch_open");
  });
  it("dueScheduledEmails ne renvoie que les dus", () => {
    const afterClose = dueScheduledEmails(new Date("2026-10-02T00:00:00+02:00"));
    expect(afterClose.length).toBe(FOUNDER_EMAIL_SCHEDULE.filter((e) => e.sendAtIso).length);
    const beforeLaunch = dueScheduledEmails(new Date("2026-07-01T00:00:00+02:00"));
    expect(beforeLaunch.length).toBe(0);
  });
  it("les rappels ne ciblent pas un client actif", () => {
    expect(FOUNDER_EMAIL_SCHEDULE.filter((e) => e.kind !== "verification").every((e) => e.skipIfActiveClient)).toBe(true);
  });
});
