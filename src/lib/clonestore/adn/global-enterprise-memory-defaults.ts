// TECH-05 — GlobalEnterpriseMemory defaults
// Valeurs par défaut et constructeurs pour GlobalEnterpriseMemory.
// Pure functions : aucun async, aucun Supabase, aucun appel réseau.

import {
  GlobalEnterpriseMemory,
  EnterpriseIdentityProfile,
  EnterpriseToneProfile,
  EnterpriseCommunicationProfile,
  EnterpriseValidationCircuit,
  EnterpriseHumanRegistry,
  GlobalEnterpriseMemoryMetadata,
} from "./global-enterprise-memory";

// ── Constantes ────────────────────────────────────────────────────────────────

export const DEFAULT_ENTERPRISE_MEMORY_VERSION = "1.0.0";

export const ENTERPRISE_MEMORY_ID_PREFIX = "mem_";

// ── Profils par défaut ────────────────────────────────────────────────────────

export const DEFAULT_ENTERPRISE_IDENTITY_PROFILE: EnterpriseIdentityProfile = {
  company_name: "Entreprise CloneStore",
  legal_name: null,
  industry: null,
  size_range: null,
  country: "FR",
  language: "fr",
  timezone: "Europe/Paris",
  public_description: null,
  internal_context: null,
};

export const DEFAULT_ENTERPRISE_TONE_PROFILE: EnterpriseToneProfile = {
  default_tone: "neutral",
  forbidden_tones: [],
  preferred_formality: "standard",
  writing_style: null,
  vocabulary_preferences: [],
  signature_rules: [],
  examples: [],
};

export const DEFAULT_ENTERPRISE_COMMUNICATION_PROFILE: EnterpriseCommunicationProfile = {
  allowed_channels: ["email", "chat"],
  default_channel: "email",
  escalation_channel: null,
  response_time_expectations: null,
  email_rules: null,
  internal_message_rules: null,
  external_message_rules: null,
};

export const DEFAULT_VALIDATION_CIRCUITS: EnterpriseValidationCircuit[] = [
  {
    circuit_id: "circuit_default",
    name: "Circuit par défaut",
    applies_to_domains: ["*"],
    applies_to_risk_levels: ["medium", "high", "critical"],
    required_approvers: [],
    fallback_approver: null,
    sla_hours: 24,
    mandatory_before_execution: true,
  },
];

export const DEFAULT_HUMAN_REGISTRY: EnterpriseHumanRegistry = {
  humans: [],
  total_count: 0,
  active_count: 0,
};

// ── Métadonnées par défaut ────────────────────────────────────────────────────

function buildDefaultMetadata(
  source: "manual" | "import" | "api" | "demo" = "manual",
  isDemo = false,
): GlobalEnterpriseMemoryMetadata {
  const now = new Date().toISOString();
  return {
    version: DEFAULT_ENTERPRISE_MEMORY_VERSION,
    created_at: now,
    updated_at: now,
    source,
    is_demo: isDemo,
    coverage_score: 0,
  };
}

// ── Constructeur principal : mémoire vide ─────────────────────────────────────

/**
 * Crée une GlobalEnterpriseMemory vide pour une entreprise donnée.
 * Aucune donnée sensible, aucune donnée demo, prête à être enrichie.
 */
export function buildEmptyGlobalEnterpriseMemory(
  companyId: string,
  memoryId?: string,
): GlobalEnterpriseMemory {
  const id = memoryId ?? `${ENTERPRISE_MEMORY_ID_PREFIX}${companyId.replace(/[^a-z0-9]/gi, "_")}`;

  return {
    memory_id: id,
    company_id: companyId,
    identity: { ...DEFAULT_ENTERPRISE_IDENTITY_PROFILE },
    tone: { ...DEFAULT_ENTERPRISE_TONE_PROFILE },
    communication: { ...DEFAULT_ENTERPRISE_COMMUNICATION_PROFILE },
    validation_circuits: [...DEFAULT_VALIDATION_CIRCUITS],
    humans: { ...DEFAULT_HUMAN_REGISTRY },
    sites: [],
    departments: [],
    documents: [],
    rules: [],
    preferences: [],
    operational_patterns: [],
    memory_items: [],
    employee_access_profiles: [],
    metadata: buildDefaultMetadata("manual", false),
  };
}

// ── Constructeur demo ─────────────────────────────────────────────────────────

/**
 * Crée une GlobalEnterpriseMemory de démo avec des données fictives.
 * IMPORTANT : is_demo = true — ne jamais envoyer en production.
 * Les vrais humains (clients) ne sont pas des employés IA CloneStore.
 */
export function buildDemoGlobalEnterpriseMemory(
  companyId: string = "demo_company",
): GlobalEnterpriseMemory {
  const memory = buildEmptyGlobalEnterpriseMemory(companyId, `${ENTERPRISE_MEMORY_ID_PREFIX}demo_${companyId}`);

  // Identité demo
  memory.identity = {
    company_name: "Acme Corp (Demo)",
    legal_name: "Acme Corporation SAS",
    industry: "Technologie",
    size_range: "50-200",
    country: "FR",
    language: "fr",
    timezone: "Europe/Paris",
    public_description: "Entreprise de démonstration CloneStore.",
    internal_context: "Contexte interne de démonstration — données fictives.",
  };

  // Ton demo
  memory.tone = {
    default_tone: "warm",
    forbidden_tones: ["trop familier", "condescendant"],
    preferred_formality: "standard",
    writing_style: "Direct et chaleureux",
    vocabulary_preferences: ["collaborateur", "équipe"],
    signature_rules: ["Cordialement", "L'équipe Acme"],
    examples: [
      "Bonjour [prénom], je reviens vers vous concernant votre demande…",
    ],
  };

  // Communication demo
  memory.communication = {
    allowed_channels: ["email", "chat", "phone"],
    default_channel: "email",
    escalation_channel: "phone",
    response_time_expectations: "24h ouvrées",
    email_rules: "Objet clair, signature standard, copie RH si contrat.",
    internal_message_rules: "Slack/Teams — pas de données confidentielles.",
    external_message_rules: "Email officiel uniquement, validé par manager.",
  };

  // Sites demo
  memory.sites = [
    {
      site_id: "site_paris",
      name: "Siège Paris",
      country: "FR",
      city: "Paris",
      timezone: "Europe/Paris",
      is_headquarters: true,
      active: true,
    },
    {
      site_id: "site_lyon",
      name: "Agence Lyon",
      country: "FR",
      city: "Lyon",
      timezone: "Europe/Paris",
      is_headquarters: false,
      active: true,
    },
  ];

  // Départements demo
  memory.departments = [
    {
      department_id: "dept_rh",
      name: "Ressources Humaines",
      manager_human_id: "human_drh_demo",
      headcount: 5,
      domains: ["hr", "legal"],
      active: true,
    },
    {
      department_id: "dept_ops",
      name: "Opérations",
      manager_human_id: "human_ops_demo",
      headcount: 15,
      domains: ["ops", "finance"],
      active: true,
    },
  ];

  // Humains demo — VRAIS HUMAINS de l'entreprise cliente (pas des employés IA)
  memory.humans = {
    humans: [
      {
        human_id: "human_drh_demo",
        full_name: "Marie Dupont (Demo)",
        role_title: "Directrice RH",
        department_id: "dept_rh",
        site_id: "site_paris",
        manager_human_id: null,
        email: null,  // pas de données réelles en demo
        phone: null,
        employment_status: "active",
        contract_type: "cdi",
        permissions: ["validate_hr", "approve_contracts"],
        sensitive_notes_allowed: false,
        context_notes: "DRH responsable des validations RH et contrats.",
        document_refs: [],
        tags: ["rh", "validation", "direction"],
      },
      {
        human_id: "human_ops_demo",
        full_name: "Jean Martin (Demo)",
        role_title: "Directeur Opérations",
        department_id: "dept_ops",
        site_id: "site_paris",
        manager_human_id: null,
        email: null,
        phone: null,
        employment_status: "active",
        contract_type: "cdi",
        permissions: ["validate_ops", "approve_purchases"],
        sensitive_notes_allowed: false,
        context_notes: "Directeur des opérations, supervise les achats.",
        document_refs: [],
        tags: ["ops", "validation", "direction"],
      },
    ],
    total_count: 2,
    active_count: 2,
  };

  // Circuits de validation demo
  memory.validation_circuits = [
    {
      circuit_id: "circuit_rh_demo",
      name: "Circuit RH",
      applies_to_domains: ["hr", "legal"],
      applies_to_risk_levels: ["medium", "high", "critical"],
      required_approvers: ["human_drh_demo"],
      fallback_approver: null,
      sla_hours: 48,
      mandatory_before_execution: true,
    },
    {
      circuit_id: "circuit_ops_demo",
      name: "Circuit Opérations",
      applies_to_domains: ["ops", "finance"],
      applies_to_risk_levels: ["high", "critical"],
      required_approvers: ["human_ops_demo"],
      fallback_approver: "human_drh_demo",
      sla_hours: 24,
      mandatory_before_execution: true,
    },
  ];

  // Items de mémoire demo
  memory.memory_items = [
    {
      item_id: "item_demo_001",
      category: "identity",
      content: "Acme Corp est une entreprise tech française fondée en 2010.",
      source: "explicit",
      scope: "global",
      stability: "permanent",
      sensitivity: "internal",
      confidence: 1.0,
      applies_to_employee_slugs: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      item_id: "item_demo_002",
      category: "tone",
      content: "Le ton privilégié est chaleureux et professionnel, jamais condescendant.",
      source: "explicit",
      scope: "global",
      stability: "stable",
      sensitivity: "internal",
      confidence: 0.9,
      applies_to_employee_slugs: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      item_id: "item_demo_003",
      category: "rules",
      content: "Toute communication externe doit être validée par le manager avant envoi.",
      source: "document",
      scope: "global",
      stability: "stable",
      sensitivity: "internal",
      confidence: 1.0,
      applies_to_employee_slugs: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Profil d'accès demo pour Pierre
  memory.employee_access_profiles = [
    {
      employee_slug: "pierre",
      readable_categories: [
        "identity", "tone", "communication", "rules",
        "humans", "documents", "processes", "hr",
      ],
      writable_categories: [],  // V1 : aucune écriture libre
      can_access_humans: true,
      can_access_documents: true,
      can_access_sensitive: false,
      allowed_domains: ["hr", "legal", "ops"],
      write_requires_human_validation: true,
    },
  ];

  // Métadonnées demo
  memory.metadata = buildDefaultMetadata("demo", true);
  memory.metadata.coverage_score = 45;  // score demo

  return memory;
}
