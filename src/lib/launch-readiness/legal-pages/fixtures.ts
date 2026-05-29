// P-FINAL 01 — Phase 2 — Fixtures for legal page validator tests.
// Pure: no Supabase, no Next, no async, no throw.

import type { ManualLegalPageFlags } from "./types";
import type { PagePresenceInfo } from "./legal-page-checks";
import { getAllLegalPageIds, getLegalPageDefinition } from "./legal-page-registry";

// All pages present with full sections and draft banners
export const FIXTURE_ALL_PAGES_PRESENT: PagePresenceInfo[] = getAllLegalPageIds().map((id) => ({
  page_id: id,
  exists: true,
  has_draft_banner: true,
  sections_present: getLegalPageDefinition(id).required_sections.map((s) => s.id),
}));

// Only CGU and CGV present
export const FIXTURE_PARTIAL_PAGES: PagePresenceInfo[] = [
  {
    page_id: "cgu",
    exists: true,
    has_draft_banner: true,
    sections_present: ["objet", "acceptation", "acces", "limites_ia", "donnees_rh", "usages_interdits", "suspension", "propriete"],
  },
  {
    page_id: "cgv",
    exists: true,
    has_draft_banner: true,
    sections_present: ["objet", "tarifs", "facturation", "resiliation", "remboursement", "perimetre", "exclusions", "responsabilite"],
  },
];

// No pages at all
export const FIXTURE_NO_PAGES: PagePresenceInfo[] = getAllLegalPageIds().map((id) => ({
  page_id: id,
  exists: false,
  has_draft_banner: false,
  sections_present: [],
}));

// All flags false (default)
export const FIXTURE_FLAGS_ALL_FALSE: ManualLegalPageFlags = {
  cgu_validated: false,
  cgv_validated: false,
  dpa_validated: false,
  mentions_validated: false,
  confidentialite_validated: false,
};

// All flags true (fully validated by legal counsel)
export const FIXTURE_FLAGS_ALL_TRUE: ManualLegalPageFlags = {
  cgu_validated: true,
  cgv_validated: true,
  dpa_validated: true,
  mentions_validated: true,
  confidentialite_validated: true,
};

// Only CGU and CGV validated
export const FIXTURE_FLAGS_PARTIAL: ManualLegalPageFlags = {
  cgu_validated: true,
  cgv_validated: true,
  dpa_validated: false,
  mentions_validated: false,
  confidentialite_validated: false,
};

// Content with no forbidden claims and correct disclaimers
export const FIXTURE_CGU_CLEAN_CONTENT = `
  Pierre est un outil d'assistance. La validation humaine est obligatoire pour tout document officiel.
  Pierre ne garantit pas la conformité légale et ne remplace pas un avocat ou juriste.
  Pierre ne génère pas de bulletins de paie officiels. Droits des utilisateurs détaillés ci-après.
`;

// Content with a forbidden claim
export const FIXTURE_CGU_FORBIDDEN_CONTENT = `
  Pierre garantit la conformité légale de tous les documents générés.
  Utilisez Pierre en toute confiance pour tous vos besoins RH.
`;

// Content with missing required disclaimers
export const FIXTURE_CGU_MISSING_DISCLAIMER_CONTENT = `
  Pierre est un outil IA. Il peut générer des documents, des emails, et des tâches RH.
  Il ne décide pas de licenciements. Contactez-nous pour plus d'informations.
`;

// Content for confidentialite page (clean)
export const FIXTURE_CONFIDENTIALITE_CLEAN_CONTENT = `
  Cette politique de confidentialité décrit la collecte des données personnelles conformément au RGPD.
  Les droits des personnes concernées incluent : accès, rectification, suppression, portabilité.
  Les données sont conservées pour la durée de la relation contractuelle.
  Pour exercer vos droits, contactez notre DPO.
`;
