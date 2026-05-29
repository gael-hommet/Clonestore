// P-FINAL 01 — Phase 2 — Per-page checks: presence, sections, draft banner, manual validation.
// Pure: no Supabase, no Next, no async, no throw.

import type { LegalPageId, LegalPageCheck, LegalPageStatus, ManualLegalPageFlags } from "./types";
import { getLegalPageDefinition } from "./legal-page-registry";

export interface PagePresenceInfo {
  page_id: LegalPageId;
  exists: boolean;
  has_draft_banner: boolean;
  sections_present: string[];
}

export function buildPresenceChecks(
  page_id: LegalPageId,
  info: PagePresenceInfo
): LegalPageCheck[] {
  const def = getLegalPageDefinition(page_id);
  const checks: LegalPageCheck[] = [];

  // Page exists
  checks.push({
    id: `${page_id}_page_exists`,
    page_id,
    label: `Page ${def.title} présente`,
    description: `La route ${def.path} existe et est accessible`,
    severity: "blocking",
    passes: info.exists,
    is_manual: false,
    detail: !info.exists ? `Page manquante — route ${def.path} non trouvée` : undefined,
  });

  if (!info.exists) {
    // No point checking further if page doesn't exist
    return checks;
  }

  // Draft banner present
  checks.push({
    id: `${page_id}_has_draft_banner`,
    page_id,
    label: `Bannière de validation juridique présente`,
    description: `La page contient une bannière indiquant que le contenu n'est pas un avis juridique`,
    severity: "warning",
    passes: info.has_draft_banner,
    is_manual: false,
    detail: !info.has_draft_banner ? `Bannière LegalValidationBanner absente` : undefined,
  });

  // Required sections
  const requiredSections = def.required_sections.filter((s) => s.required_for_public_launch);
  for (const section of requiredSections) {
    const present = info.sections_present.includes(section.id);
    checks.push({
      id: `${page_id}_section_${section.id}`,
      page_id,
      label: `Section requise : "${section.label}"`,
      description: section.description,
      severity: "warning",
      passes: present,
      is_manual: false,
      detail: !present ? `Section "${section.label}" non trouvée dans la page` : undefined,
    });
  }

  return checks;
}

export function buildManualValidationCheck(
  page_id: LegalPageId,
  is_validated: boolean
): LegalPageCheck {
  const def = getLegalPageDefinition(page_id);
  return {
    id: `${page_id}_manually_validated`,
    page_id,
    label: `${def.title} validée par un conseil juridique`,
    description: `Un avocat ou juriste compétent a relu et validé le contenu de cette page`,
    severity: "blocking",
    passes: is_validated,
    is_manual: true,
    detail: !is_validated
      ? `Validation juridique manuelle non effectuée pour ${def.title}`
      : undefined,
  };
}

export function getPageStatusFromFlags(
  page_id: LegalPageId,
  info: PagePresenceInfo,
  flags: ManualLegalPageFlags
): LegalPageStatus {
  if (!info.exists) return "missing";
  const flagKey = `${page_id}_validated` as keyof ManualLegalPageFlags;
  if (flags[flagKey]) return "present_validated";
  return "present_draft";
}

export function getDefaultManualLegalPageFlags(): ManualLegalPageFlags {
  return {
    cgu_validated: false,
    cgv_validated: false,
    dpa_validated: false,
    mentions_validated: false,
    confidentialite_validated: false,
  };
}
