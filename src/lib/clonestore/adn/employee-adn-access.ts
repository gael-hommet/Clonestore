// TECH-05 — Employee ADN Access
// Gestion des accès des employés IA à la GlobalEnterpriseMemory.
//
// Architecture V1 :
//   - Aucun employé IA ne peut écrire librement dans GlobalEnterpriseMemory.
//   - write_requires_human_validation = true pour tous.
//   - CloneLearn (roadmap) activera les écritures autonomes plus tard.
//
// Cette couche est distincte de la couche Pierre spécifique.
// Pierre est "le premier employé IA RH" — pas un cas spécial du système d'accès.

import {
  EnterpriseEmployeeAccessProfile,
  EnterpriseMemoryCategory,
} from "./global-enterprise-memory";

// ── Profil d'accès de base (lecture seule) ───────────────────────────────────

/**
 * Profil d'accès minimaliste pour tout employé IA.
 * Lecture des catégories publiques uniquement. Aucune écriture.
 */
export const BASE_EMPLOYEE_ACCESS_PROFILE: Omit<EnterpriseEmployeeAccessProfile, "employee_slug"> = {
  readable_categories: ["identity", "tone", "communication"],
  writable_categories: [],        // V1 : toujours vide
  can_access_humans: false,
  can_access_documents: false,
  can_access_sensitive: false,
  allowed_domains: [],
  write_requires_human_validation: true,
};

// ── Profils d'accès standards par rôle ───────────────────────────────────────

/** Catégories lisibles par un employé IA générique (accès standard) */
export const STANDARD_READABLE_CATEGORIES: EnterpriseMemoryCategory[] = [
  "identity",
  "tone",
  "communication",
  "rules",
];

/** Catégories lisibles par un employé IA RH (accès étendu) */
export const HR_READABLE_CATEGORIES: EnterpriseMemoryCategory[] = [
  "identity",
  "tone",
  "communication",
  "rules",
  "humans",
  "documents",
  "processes",
  "hr",
];

/** Catégories lisibles par un employé IA finance (accès étendu) */
export const FINANCE_READABLE_CATEGORIES: EnterpriseMemoryCategory[] = [
  "identity",
  "tone",
  "communication",
  "rules",
  "documents",
  "finance",
];

/** Catégories lisibles par un employé IA legal (accès étendu) */
export const LEGAL_READABLE_CATEGORIES: EnterpriseMemoryCategory[] = [
  "identity",
  "tone",
  "communication",
  "rules",
  "documents",
  "legal",
];

// ── Constructeur de profil d'accès ───────────────────────────────────────────

/**
 * Crée un profil d'accès pour un employé IA selon son rôle.
 * V1 : aucune écriture libre, write_requires_human_validation = true.
 */
export function buildEmployeeAccessProfile(params: {
  employee_slug: string;
  readable_categories: EnterpriseMemoryCategory[];
  can_access_humans: boolean;
  can_access_documents: boolean;
  can_access_sensitive: boolean;
  allowed_domains: string[];
}): EnterpriseEmployeeAccessProfile {
  return {
    employee_slug: params.employee_slug,
    readable_categories: params.readable_categories,
    writable_categories: [],  // V1 : toujours vide
    can_access_humans: params.can_access_humans,
    can_access_documents: params.can_access_documents,
    can_access_sensitive: params.can_access_sensitive,
    allowed_domains: params.allowed_domains,
    write_requires_human_validation: true,  // V1 : toujours requis
  };
}

// ── Profil d'accès Pierre ─────────────────────────────────────────────────────
// Pierre est l'employé IA RH de référence (TECH-02).
// Son profil d'accès est défini ici comme constante réutilisable.

export const PIERRE_DEFAULT_ACCESS_PROFILE: EnterpriseEmployeeAccessProfile = buildEmployeeAccessProfile({
  employee_slug: "pierre",
  readable_categories: HR_READABLE_CATEGORIES,
  can_access_humans: true,
  can_access_documents: true,
  can_access_sensitive: false,
  allowed_domains: ["hr", "legal", "ops"],
});

// ── Vérifications d'accès ────────────────────────────────────────────────────

/**
 * Vérifie si un employé IA peut lire une catégorie donnée.
 */
export function canEmployeeReadCategory(
  profile: EnterpriseEmployeeAccessProfile,
  category: EnterpriseMemoryCategory,
): boolean {
  return profile.readable_categories.includes(category);
}

/**
 * Vérifie si un employé IA peut accéder à un domaine donné.
 * Un profil avec allowed_domains vide = aucun domaine autorisé.
 */
export function canEmployeeAccessDomain(
  profile: EnterpriseEmployeeAccessProfile,
  domain: string,
): boolean {
  return profile.allowed_domains.includes(domain);
}

/**
 * Filtre une liste de catégories selon le profil d'accès d'un employé IA.
 */
export function filterReadableCategories(
  profile: EnterpriseEmployeeAccessProfile,
  requested: EnterpriseMemoryCategory[],
): EnterpriseMemoryCategory[] {
  const readable = new Set(profile.readable_categories);
  return requested.filter((c) => readable.has(c));
}

/**
 * Retourne true si l'employé IA peut accéder aux profils humains.
 * V1 : uniquement les humains non sensibles si can_access_sensitive = false.
 */
export function canEmployeeAccessHumans(
  profile: EnterpriseEmployeeAccessProfile,
): boolean {
  return profile.can_access_humans;
}

/**
 * Retourne true si l'employé IA peut accéder aux documents.
 */
export function canEmployeeAccessDocuments(
  profile: EnterpriseEmployeeAccessProfile,
): boolean {
  return profile.can_access_documents;
}
