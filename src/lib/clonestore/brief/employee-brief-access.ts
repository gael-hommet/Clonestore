// TECH-09 — CloneBrief Executive Summaries — Employee Brief Access
// Contrôle d'accès des employés IA aux briefings CloneBrief.
// Pierre peut lire/générer les briefings RH liés à ses missions.
// Aucun employé ne peut supprimer les briefings en V1.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneBriefExecutiveSummary,
  CloneBriefEmployeeSlug,
  CloneBriefType,
} from "./clonebrief-types";

// ── Access profile type ───────────────────────────────────────────────────────

export interface CloneBriefEmployeeAccessProfile {
  employee_slug: CloneBriefEmployeeSlug;
  can_generate_briefs: boolean;
  allowed_brief_types: CloneBriefType[];
  can_view_all_sections: boolean;
  can_view_risk_details: boolean;
  can_view_blocked_details: boolean;
  can_delete_briefs: false;   // Toujours false — jamais supprimable en V1
  max_visibility_level: "public" | "internal" | "admin_only";
  access_notes: string[];
}

// ── Default profiles ──────────────────────────────────────────────────────────

/**
 * Profil d'accès de Pierre — peut générer et lire les briefings RH.
 * Ne peut pas masquer risques ou blocages. Ne peut pas supprimer.
 */
export const PIERRE_DEFAULT_BRIEF_ACCESS_PROFILE: CloneBriefEmployeeAccessProfile = {
  employee_slug: "pierre",
  can_generate_briefs: true,
  allowed_brief_types: ["daily", "mission", "employee", "validation", "risk"],
  can_view_all_sections: true,
  can_view_risk_details: true,
  can_view_blocked_details: true,
  can_delete_briefs: false,
  max_visibility_level: "internal",
  access_notes: [
    "Pierre peut générer des briefings RH liés à ses missions.",
    "Pierre ne peut pas masquer les risques ou blocages.",
    "Aucun briefing ne peut être supprimé en V1.",
  ],
};

/**
 * Profil d'accès minimal pour un employé inconnu.
 */
export const UNKNOWN_EMPLOYEE_BRIEF_ACCESS_PROFILE: CloneBriefEmployeeAccessProfile = {
  employee_slug: "unknown",
  can_generate_briefs: false,
  allowed_brief_types: [],
  can_view_all_sections: false,
  can_view_risk_details: false,
  can_view_blocked_details: false,
  can_delete_briefs: false,
  max_visibility_level: "public",
  access_notes: ["Employé non reconnu — accès minimal."],
};

/**
 * Profil système — peut tout lire mais jamais supprimer.
 */
export const SYSTEM_BRIEF_ACCESS_PROFILE: CloneBriefEmployeeAccessProfile = {
  employee_slug: "system",
  can_generate_briefs: true,
  allowed_brief_types: ["daily","weekly","monthly","mission","employee","risk","validation","incident","executive"],
  can_view_all_sections: true,
  can_view_risk_details: true,
  can_view_blocked_details: true,
  can_delete_briefs: false,
  max_visibility_level: "admin_only",
  access_notes: ["Accès système complet — briefings non supprimables."],
};

// ── Access functions ──────────────────────────────────────────────────────────

/**
 * Retourne le profil d'accès d'un employé pour CloneBrief.
 */
export function getEmployeeBriefAccessProfile(
  employeeSlug: CloneBriefEmployeeSlug,
): CloneBriefEmployeeAccessProfile {
  if (employeeSlug === "pierre") return PIERRE_DEFAULT_BRIEF_ACCESS_PROFILE;
  if (employeeSlug === "system") return SYSTEM_BRIEF_ACCESS_PROFILE;
  return { ...UNKNOWN_EMPLOYEE_BRIEF_ACCESS_PROFILE, employee_slug: employeeSlug };
}

/**
 * Vérifie si un employé peut générer un type de briefing.
 */
export function canEmployeeGenerateBrief(
  employeeSlug: CloneBriefEmployeeSlug,
  briefType: CloneBriefType,
): boolean {
  const profile = getEmployeeBriefAccessProfile(employeeSlug);
  return profile.can_generate_briefs && profile.allowed_brief_types.includes(briefType);
}

/**
 * Vérifie si un employé peut voir un briefing.
 * Les briefings confidentiels (admin_only) ne sont accessibles que par admin/system.
 */
export function canEmployeeViewBrief(
  employeeSlug: CloneBriefEmployeeSlug,
  brief: CloneBriefExecutiveSummary,
): boolean {
  const profile = getEmployeeBriefAccessProfile(employeeSlug);
  // En V1, les briefings sont tous internes ou publics
  if (profile.max_visibility_level === "admin_only") return true;
  if (profile.max_visibility_level === "internal") return brief.audience !== "admin";
  return brief.audience === "founder" || brief.audience === "manager";
}

/**
 * Filtre un briefing pour ne montrer que les sections accessibles à l'employé.
 * Ne masque JAMAIS les sections blocked/refused/validation.
 */
export function filterBriefForEmployee(
  employeeSlug: CloneBriefEmployeeSlug,
  brief: CloneBriefExecutiveSummary,
): CloneBriefExecutiveSummary {
  const profile = getEmployeeBriefAccessProfile(employeeSlug);

  if (profile.can_view_all_sections) return brief;

  // Filtre minimal — garde toujours overview, blocked, validations
  const visibleSections = brief.sections.filter((s) =>
    s.type === "overview" ||
    s.type === "blocked_actions" ||    // Jamais masqué
    s.type === "validations_required"  // Jamais masqué
  );

  return {
    ...brief,
    sections: visibleSections,
    risk_items: profile.can_view_risk_details ? brief.risk_items : [],
    blocked_items: brief.blocked_items,  // Toujours visible
    validation_items: brief.validation_items,  // Toujours visible
  };
}

/**
 * Construit un contexte de briefing pour un employé.
 */
export function buildEmployeeBriefContext(
  employeeSlug: CloneBriefEmployeeSlug,
  briefs: CloneBriefExecutiveSummary[],
): {
  accessible_briefs: CloneBriefExecutiveSummary[];
  access_profile: CloneBriefEmployeeAccessProfile;
  total_accessible: number;
  has_urgent_items: boolean;
} {
  const profile = getEmployeeBriefAccessProfile(employeeSlug);
  const accessible = briefs.filter((b) => canEmployeeViewBrief(employeeSlug, b));
  const hasUrgent = accessible.some(
    (b) => b.blocked_items.length > 0 || b.validation_items.length > 0,
  );

  return {
    accessible_briefs: accessible,
    access_profile: profile,
    total_accessible: accessible.length,
    has_urgent_items: hasUrgent,
  };
}
