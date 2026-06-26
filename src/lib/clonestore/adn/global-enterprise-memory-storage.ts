// TECH-05 — GlobalEnterpriseMemory storage
// Couche de persistance en mémoire (in-memory store) pour TECH-05.
//
// IMPORTANT :
//   - V1 : aucune persistance Supabase. Toutes les données sont en mémoire.
//   - Les écritures d'un employé IA nécessitent une validation humaine.
//   - CloneLearn (roadmap) activera les écritures autonomes plus tard.
//   - Ce module expose uniquement des fonctions pures ; pas de side-effects réseau.
//
// Architecture de stockage V1 :
//   Map<company_id, GlobalEnterpriseMemory> — store en mémoire
//   Patch partiel via GlobalEnterpriseMemoryPatch
//   Lecture filtrée via EnterpriseEmployeeAccessProfile

import {
  GlobalEnterpriseMemory,
  GlobalEnterpriseMemoryPatch,
  EnterpriseMemoryCategory,
  EnterpriseMemoryItem,
  EnterpriseHumanProfile,
} from "./global-enterprise-memory";
import { buildEmptyGlobalEnterpriseMemory } from "./global-enterprise-memory-defaults";

// ── Store in-memory ───────────────────────────────────────────────────────────

const _store = new Map<string, GlobalEnterpriseMemory>();

// ── Lecture ───────────────────────────────────────────────────────────────────

/**
 * Récupère la mémoire d'une entreprise par company_id.
 * Retourne null si non trouvée.
 */
export function getEnterpriseMemory(
  companyId: string,
): GlobalEnterpriseMemory | null {
  return _store.get(companyId) ?? null;
}

/**
 * Récupère ou crée une mémoire vide pour un company_id donné.
 */
export function getOrCreateEnterpriseMemory(
  companyId: string,
): GlobalEnterpriseMemory {
  if (!_store.has(companyId)) {
    const fresh = buildEmptyGlobalEnterpriseMemory(companyId);
    _store.set(companyId, fresh);
  }
  return _store.get(companyId)!;
}

/**
 * Liste tous les company_id présents dans le store.
 */
export function listEnterpriseMemoryIds(): string[] {
  return [..._store.keys()];
}

// ── Écriture ──────────────────────────────────────────────────────────────────

/**
 * Enregistre une mémoire d'entreprise dans le store.
 * Écrase toute mémoire existante pour ce company_id.
 */
export function setEnterpriseMemory(memory: GlobalEnterpriseMemory): void {
  const updated: GlobalEnterpriseMemory = {
    ...memory,
    metadata: {
      ...memory.metadata,
      updated_at: new Date().toISOString(),
    },
  };
  _store.set(memory.company_id, updated);
}

/**
 * Applique un patch partiel à une mémoire d'entreprise existante.
 * Si la mémoire n'existe pas, crée une mémoire vide puis applique le patch.
 *
 * IMPORTANT : Cette fonction est réservée aux administrateurs CloneStore.
 * Les employés IA ne peuvent pas appeler setEnterpriseMemory directement.
 */
export function patchEnterpriseMemory(
  companyId: string,
  patch: GlobalEnterpriseMemoryPatch,
): GlobalEnterpriseMemory {
  const existing = getOrCreateEnterpriseMemory(companyId);

  const patched: GlobalEnterpriseMemory = {
    ...existing,
    identity:
      patch.identity != null
        ? { ...existing.identity, ...patch.identity }
        : existing.identity,
    tone:
      patch.tone != null
        ? { ...existing.tone, ...patch.tone }
        : existing.tone,
    communication:
      patch.communication != null
        ? { ...existing.communication, ...patch.communication }
        : existing.communication,
    validation_circuits:
      patch.validation_circuits != null
        ? patch.validation_circuits
        : existing.validation_circuits,
    humans:
      patch.humans != null
        ? patch.humans
        : existing.humans,
    sites:
      patch.sites != null ? patch.sites : existing.sites,
    departments:
      patch.departments != null ? patch.departments : existing.departments,
    documents:
      patch.documents != null ? patch.documents : existing.documents,
    rules:
      patch.rules != null ? patch.rules : existing.rules,
    preferences:
      patch.preferences != null ? patch.preferences : existing.preferences,
    operational_patterns:
      patch.operational_patterns != null
        ? patch.operational_patterns
        : existing.operational_patterns,
    memory_items:
      patch.memory_items != null ? patch.memory_items : existing.memory_items,
    employee_access_profiles:
      patch.employee_access_profiles != null
        ? patch.employee_access_profiles
        : existing.employee_access_profiles,
    metadata: {
      ...existing.metadata,
      updated_at: new Date().toISOString(),
    },
  };

  _store.set(companyId, patched);
  return patched;
}

/**
 * Supprime la mémoire d'un company_id du store.
 */
export function deleteEnterpriseMemory(companyId: string): boolean {
  return _store.delete(companyId);
}

/**
 * Efface tout le store (utile pour les tests).
 */
export function clearEnterpriseMemoryStore(): void {
  _store.clear();
}

// ── Lecture filtrée (pour employés IA) ───────────────────────────────────────

/**
 * Retourne les memory_items accessibles à un employé IA selon son profil d'accès.
 * V1 : lecture filtrée par readable_categories et applies_to_employee_slugs.
 */
export function getMemoryItemsForEmployee(
  companyId: string,
  employeeSlug: string,
): EnterpriseMemoryItem[] {
  const memory = getEnterpriseMemory(companyId);
  if (!memory) return [];

  const accessProfile = memory.employee_access_profiles.find(
    (p) => p.employee_slug === employeeSlug,
  );
  if (!accessProfile) return [];

  const readableCategories = new Set<EnterpriseMemoryCategory>(
    accessProfile.readable_categories,
  );

  return memory.memory_items.filter((item) => {
    // Vérifier la catégorie
    if (!readableCategories.has(item.category)) return false;

    // Vérifier applies_to_employee_slugs (vide = tous les employés)
    if (
      item.applies_to_employee_slugs.length > 0 &&
      !item.applies_to_employee_slugs.includes(employeeSlug)
    ) {
      return false;
    }

    // Vérifier la sensibilité
    if (item.sensitivity === "confidential" && !accessProfile.can_access_sensitive) {
      return false;
    }
    if (item.sensitivity === "restricted") {
      return false; // Jamais accessible à un employé IA en V1
    }

    return true;
  });
}

/**
 * Retourne les profils humains accessibles à un employé IA.
 * V1 : lecture filtrée selon can_access_humans.
 */
export function getHumansForEmployee(
  companyId: string,
  employeeSlug: string,
): EnterpriseHumanProfile[] {
  const memory = getEnterpriseMemory(companyId);
  if (!memory) return [];

  const accessProfile = memory.employee_access_profiles.find(
    (p) => p.employee_slug === employeeSlug,
  );
  if (!accessProfile || !accessProfile.can_access_humans) return [];

  // Filtrer les humains sensibles si l'employé n'y a pas accès
  return memory.humans.humans.filter((human) => {
    if (!accessProfile.can_access_sensitive && human.sensitive_notes_allowed) {
      return false;
    }
    return true;
  });
}
