// TECH-05 — Pierre ↔ GlobalEnterpriseMemory bridge
// Connecte Pierre (TECH-02, premier employé IA RH) à la couche GlobalEnterpriseMemory.
//
// Architecture :
//   GlobalEnterpriseMemory (TECH-05, ce bridge)
//     └── CloneADNProfile (B28) ← Pierre lit via ce bridge
//
// IMPORTANT :
//   - Ce bridge NE modifie PAS le moteur Pierre (src/lib/pierre/).
//   - Ce bridge NE modifie PAS CloneADNProfile (B28).
//   - Ce bridge NE modifie PAS EnterpriseEmpreinte (B44).
//   - Il traduit GlobalEnterpriseMemory → informations lisibles par Pierre.
//   - Pierre reste "le premier consommateur" de la mémoire globale.
//
// Ce que ce bridge NE fait PAS :
//   - Dupliquer la mémoire Pierre dans la mémoire globale sans tri.
//   - Transformer CloneADN en CRM ou SIRH complet.
//   - Écrire en Supabase.
//   - Appeler OpenAI, Anthropic, ou Stripe.

import {
  GlobalEnterpriseMemory,
  EnterpriseMemoryItem,
  EnterpriseHumanProfile,
} from "./global-enterprise-memory";
import { PIERRE_DEFAULT_ACCESS_PROFILE } from "./employee-adn-access";
import { getMemoryItemsForEmployee, getHumansForEmployee } from "./global-enterprise-memory-storage";

// ── Types du contexte Pierre ──────────────────────────────────────────────────

/**
 * Contexte entreprise distillé depuis GlobalEnterpriseMemory pour Pierre.
 * Ce type est conçu pour être injecté dans le runtime Pierre sans le modifier.
 */
export interface PierreEnterpriseContext {
  company_name: string;
  language: string;
  timezone: string;
  default_tone: string;
  preferred_formality: string;
  vocabulary_preferences: string[];
  signature_rules: string[];
  allowed_channels: string[];
  default_channel: string;
  escalation_channel: string | null;
  validation_required_domains: string[];
  accessible_memory_items: EnterpriseMemoryItem[];
  accessible_humans_count: number;
  is_demo: boolean;
}

// ── Bridge : GlobalEnterpriseMemory → PierreEnterpriseContext ─────────────────

/**
 * Distille une GlobalEnterpriseMemory en un contexte lisible par Pierre.
 * Pierre ne reçoit que ce qu'il est autorisé à lire (PIERRE_DEFAULT_ACCESS_PROFILE).
 *
 * Utilise le companyId pour récupérer les données depuis le storage in-memory.
 * Si aucune mémoire n'est trouvée, retourne un contexte minimal.
 */
export function buildPierreEnterpriseContextFromMemory(
  memory: GlobalEnterpriseMemory,
): PierreEnterpriseContext {
  const accessProfile = PIERRE_DEFAULT_ACCESS_PROFILE;

  // Filtrer les memory_items selon le profil d'accès Pierre
  const companyId = memory.company_id;
  const accessibleItems = getMemoryItemsForEmployee(companyId, accessProfile.employee_slug);

  // Récupérer les humains accessibles
  const accessibleHumans = getHumansForEmployee(companyId, accessProfile.employee_slug);

  // Domaines nécessitant validation
  const validationDomains = memory.validation_circuits
    .flatMap((c) => c.applies_to_domains)
    .filter((d, i, arr) => arr.indexOf(d) === i);  // unique

  return {
    company_name: memory.identity.company_name,
    language: memory.identity.language,
    timezone: memory.identity.timezone,
    default_tone: memory.tone.default_tone,
    preferred_formality: memory.tone.preferred_formality,
    vocabulary_preferences: [...(memory.tone.vocabulary_preferences ?? [])],
    signature_rules: [...(memory.tone.signature_rules ?? [])],
    allowed_channels: [...(memory.communication.allowed_channels ?? [])],
    default_channel: memory.communication.default_channel,
    escalation_channel: memory.communication.escalation_channel ?? null,
    validation_required_domains: validationDomains,
    accessible_memory_items: accessibleItems,
    accessible_humans_count: accessibleHumans.length,
    is_demo: memory.metadata.is_demo,
  };
}

/**
 * Distille directement depuis une mémoire passée en paramètre,
 * sans passer par le storage (utile pour les tests et la preview).
 */
export function buildPierreEnterpriseContextDirect(
  memory: GlobalEnterpriseMemory,
): PierreEnterpriseContext {
  const accessProfile = PIERRE_DEFAULT_ACCESS_PROFILE;

  // Filtrage direct (sans storage)
  const readableCategories = new Set(accessProfile.readable_categories);

  const accessibleItems = memory.memory_items.filter((item) => {
    if (!readableCategories.has(item.category)) return false;
    if (
      item.applies_to_employee_slugs.length > 0 &&
      !item.applies_to_employee_slugs.includes("pierre")
    ) {
      return false;
    }
    if (item.sensitivity === "confidential" && !accessProfile.can_access_sensitive) return false;
    if (item.sensitivity === "restricted") return false;
    return true;
  });

  const accessibleHumansCount =
    accessProfile.can_access_humans
      ? memory.humans.humans.filter((h) =>
          accessProfile.can_access_sensitive ? true : !h.sensitive_notes_allowed,
        ).length
      : 0;

  const validationDomains = memory.validation_circuits
    .flatMap((c) => c.applies_to_domains)
    .filter((d, i, arr) => arr.indexOf(d) === i);

  return {
    company_name: memory.identity.company_name,
    language: memory.identity.language,
    timezone: memory.identity.timezone,
    default_tone: memory.tone.default_tone,
    preferred_formality: memory.tone.preferred_formality,
    vocabulary_preferences: [...(memory.tone.vocabulary_preferences ?? [])],
    signature_rules: [...(memory.tone.signature_rules ?? [])],
    allowed_channels: [...(memory.communication.allowed_channels ?? [])],
    default_channel: memory.communication.default_channel,
    escalation_channel: memory.communication.escalation_channel ?? null,
    validation_required_domains: validationDomains,
    accessible_memory_items: accessibleItems,
    accessible_humans_count: accessibleHumansCount,
    is_demo: memory.metadata.is_demo,
  };
}

// ── Helpers d'extraction ──────────────────────────────────────────────────────

/**
 * Extrait les règles métier actives depuis GlobalEnterpriseMemory.
 * Retourne uniquement les règles lisibles par Pierre.
 */
export function extractActiveRulesForPierre(
  memory: GlobalEnterpriseMemory,
): string[] {
  return memory.rules
    .filter(
      (rule) =>
        rule.active &&
        (rule.applies_to_employee_slugs.length === 0 ||
          rule.applies_to_employee_slugs.includes("pierre")),
    )
    .map((rule) => `[${rule.severity.toUpperCase()}] ${rule.label} — ${rule.action}`);
}

/**
 * Vérifie si un domaine nécessite une validation humaine pour Pierre.
 */
export function isPierreValidationRequired(
  memory: GlobalEnterpriseMemory,
  domain: string,
): boolean {
  return memory.validation_circuits.some(
    (circuit) =>
      circuit.mandatory_before_execution &&
      (circuit.applies_to_domains.includes(domain) ||
        circuit.applies_to_domains.includes("*")),
  );
}

/**
 * Retourne les approbateurs humains requis pour un domaine donné.
 */
export function getRequiredApproversForDomain(
  memory: GlobalEnterpriseMemory,
  domain: string,
): EnterpriseHumanProfile[] {
  const approverIds = new Set<string>();
  for (const circuit of memory.validation_circuits) {
    if (
      circuit.mandatory_before_execution &&
      (circuit.applies_to_domains.includes(domain) ||
        circuit.applies_to_domains.includes("*"))
    ) {
      for (const id of circuit.required_approvers) {
        approverIds.add(id);
      }
    }
  }

  return memory.humans.humans.filter((h) => approverIds.has(h.human_id));
}
