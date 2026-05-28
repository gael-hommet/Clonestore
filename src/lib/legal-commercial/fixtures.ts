// B47 — Legal Commercial Test Fixtures
// Pure: no Supabase, no Next, no async. For tests only.

import type { OutputContext } from "./types";

export function buildMarketingOutputContext(overrides?: Partial<OutputContext>): OutputContext {
  return {
    surface: "marketing",
    domain: "general",
    is_sensitive: false,
    is_official_document: false,
    is_public_claim: true,
    is_demo: false,
    is_paid_customer: false,
    ...overrides,
  };
}

export function buildPayrollOutputContext(overrides?: Partial<OutputContext>): OutputContext {
  return {
    surface: "document",
    domain: "payroll",
    is_sensitive: true,
    is_official_document: true,
    is_public_claim: false,
    is_demo: false,
    is_paid_customer: true,
    ...overrides,
  };
}

export function buildOfficialDocumentContext(overrides?: Partial<OutputContext>): OutputContext {
  return {
    surface: "document",
    domain: "hr",
    is_sensitive: true,
    is_official_document: true,
    is_public_claim: false,
    is_demo: false,
    is_paid_customer: true,
    ...overrides,
  };
}

export function buildDemoContext(overrides?: Partial<OutputContext>): OutputContext {
  return {
    surface: "demo",
    domain: "general",
    is_sensitive: false,
    is_official_document: false,
    is_public_claim: false,
    is_demo: true,
    is_paid_customer: false,
    ...overrides,
  };
}

export function buildCockpitContext(overrides?: Partial<OutputContext>): OutputContext {
  return {
    surface: "cockpit",
    domain: "hr",
    is_sensitive: false,
    is_official_document: false,
    is_public_claim: false,
    is_demo: false,
    is_paid_customer: true,
    ...overrides,
  };
}

export const SAFE_PRODUCTIVITY_CLAIM = "Pierre automatise une grande partie de la charge RH opérationnelle.";
export const SAFE_COST_SAVING_CLAIM = "Pierre aide à gagner du temps et de l'argent.";
export const SAFE_AUTOMATION_CLAIM = "Pierre prépare, structure, suit, relance et documente.";
export const SAFE_SLOGAN = "Gagnez du temps et de l'argent.";
export const SAFE_REPLACEMENT_CLAIM = "Pierre prend en charge une grande partie du travail RH opérationnel, l'humain garde la responsabilité finale.";

export const FORBIDDEN_LEGAL_CLAIM = "Pierre remplace un avocat.";
export const FORBIDDEN_CONFORMITY_CLAIM = "Pierre garantit la conformité légale.";
export const FORBIDDEN_ZERO_ERROR_CLAIM = "Pierre garantit zéro erreur.";
export const FORBIDDEN_DSN_CLAIM = "Pierre remplace la DSN.";
export const FORBIDDEN_PAYROLL_CLAIM = "Pierre remplace un logiciel de paie.";
export const FORBIDDEN_DISMISSAL_CLAIM = "Pierre prend seul les décisions de licenciement.";
export const FORBIDDEN_AUTO_SANCTION = "Pierre peut envoyer des sanctions automatiquement.";
export const FORBIDDEN_FULL_AUTONOMY = "Pierre est un service juridique autonome.";
