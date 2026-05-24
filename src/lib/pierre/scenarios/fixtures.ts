// src/lib/pierre/scenarios/fixtures.ts
// Pierre Golden Scenarios — Fixtures
// Bloc 29: static test data for scenarios. No Supabase, no async.

import type { CloneADNProfile } from "../../clonestore/adn/types";

// ══════════════════════════════════════════════════════════════
// 1. COMPANY CONTEXTS
// ══════════════════════════════════════════════════════════════

export type GoldenCompanyContext = {
  company_id: string;
  company_name: string;
  sector: string;
  headcount: number;
  country_code: string;
  reusable_rh_context_json: Record<string, unknown>;
};

const COMPANY_CONTEXTS: Record<string, GoldenCompanyContext> = {
  tech_company: {
    company_id: "comp_tech_001",
    company_name: "Acme Tech SAS",
    sector: "technology",
    headcount: 45,
    country_code: "FR",
    reusable_rh_context_json: {
      document_templates: [],
      employees: [],
      clone_adn: {
        status: "configured",
        company_name: "Acme Tech SAS",
        sector: "technology",
        country_code: "FR",
        legal_form: "SAS",
        headcount_range: "10-49",
        language_code: "fr",
        tone: "warm",
        communication_length: "standard",
        autonomy_level: "supervised",
        validation_mode: "recommended",
        sites: [],
        departments: [],
        rules: [
          {
            id: "rule_001",
            label: "Validation contractuelle requise",
            description: "Tout avenant ou nouveau contrat nécessite validation RH",
            category: "validation",
            severity: "warning",
            condition: "action contient contrat ou avenant",
            action: "require_approval",
            active: true,
            applies_to_domains: ["contract", "amendment"],
            applies_to_task_types: ["contract_action"],
            requires_human_validation: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        inferred_preferences: [],
        sensitive_topics: ["disciplinaire", "licenciement"],
        avoid_words: [],
        never_auto_execute: ["disciplinary_decision", "dismissal_action"],
        always_require_human_for: ["licenciement", "rupture conventionnelle"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
      },
    },
  },

  trial_company: {
    company_id: "comp_trial_002",
    company_name: "StartRH SARL",
    sector: "services",
    headcount: 8,
    country_code: "FR",
    reusable_rh_context_json: {
      document_templates: [],
      employees: [],
    },
  },
};

// ══════════════════════════════════════════════════════════════
// 2. EMPLOYEE CONTEXTS
// ══════════════════════════════════════════════════════════════

export type GoldenEmployeeContext = {
  employee_id: string;
  employee_name: string;
  role: string;
  contract_type: "CDI" | "CDD" | "apprentissage" | "stage";
  start_date: string;
  department: string;
  manager_id: string | null;
  employee_row: Record<string, unknown>;
  missions: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  logs: Record<string, unknown>[];
};

const EMPLOYEE_CONTEXTS: Record<string, GoldenEmployeeContext> = {
  new_employee: {
    employee_id: "emp_new_001",
    employee_name: "Marie Dupont",
    role: "Développeuse React",
    contract_type: "CDI",
    start_date: "2026-05-25",
    department: "Technique",
    manager_id: "emp_mgr_001",
    employee_row: {
      id: "emp_new_001",
      employee_name: "Marie Dupont",
      job_title: "Développeuse React",
      contract_type: "CDI",
      start_date: "2026-05-25",
      department: "Technique",
      status: "active",
      email: "marie.dupont@acmetech.fr",
    },
    missions: [],
    tasks: [],
    documents: [],
    logs: [],
  },

  active_employee: {
    employee_id: "emp_act_002",
    employee_name: "Jean-Paul Dubois",
    role: "Manager Senior",
    contract_type: "CDI",
    start_date: "2022-03-01",
    department: "Operations",
    manager_id: null,
    employee_row: {
      id: "emp_act_002",
      employee_name: "Jean-Paul Dubois",
      job_title: "Manager Senior",
      contract_type: "CDI",
      start_date: "2022-03-01",
      department: "Operations",
      status: "active",
      email: "jpdubois@acmetech.fr",
    },
    missions: [
      {
        id: "mission_001",
        title: "Suivi RH mensuel",
        mission_summary: "Suivi des indicateurs RH du mois d'avril",
        status: "completed",
        created_at: "2026-04-01T09:00:00Z",
        employee_id: "emp_act_002",
        raw_input: "Suivi mensuel RH",
      },
    ],
    tasks: [
      {
        id: "task_001",
        type: "document_generate",
        title: "Compte-rendu entretien professionnel",
        status: "completed",
        approval_required: false,
        execute_at: "2026-04-15T09:00:00Z",
        payload_json: { doc_type: "entretien_professionnel" },
        created_at: "2026-04-01T09:00:00Z",
      },
    ],
    documents: [
      {
        id: "doc_001",
        doc_type: "entretien_professionnel",
        title: "Entretien professionnel 2026",
        status: "signed",
        created_at: "2026-04-15T10:00:00Z",
        employee_id: "emp_act_002",
      },
    ],
    logs: [
      {
        id: "log_001",
        event_type: "mission_created",
        message: "Mission RH créée",
        meta_json: { source: "submit" },
        created_at: "2026-04-01T09:00:00Z",
      },
    ],
  },

  cdd_employee: {
    employee_id: "emp_cdd_003",
    employee_name: "Lucas Moreau",
    role: "Développeur Backend",
    contract_type: "CDD",
    start_date: "2026-01-01",
    department: "Technique",
    manager_id: "emp_act_002",
    employee_row: {
      id: "emp_cdd_003",
      employee_name: "Lucas Moreau",
      job_title: "Développeur Backend",
      contract_type: "CDD",
      start_date: "2026-01-01",
      end_date: "2026-05-31",
      department: "Technique",
      status: "active",
      email: "lucas.moreau@acmetech.fr",
    },
    missions: [],
    tasks: [],
    documents: [],
    logs: [],
  },

  candidate_employee: {
    employee_id: "emp_cand_004",
    employee_name: "Thomas Martin",
    role: "Chef de projet",
    contract_type: "CDI",
    start_date: "2026-06-01",
    department: "Projets",
    manager_id: null,
    employee_row: {
      id: "emp_cand_004",
      employee_name: "Thomas Martin",
      job_title: "Chef de projet",
      contract_type: "CDI",
      status: "candidate",
      email: "thomas.martin@candidate.fr",
      salary_gross: 55000,
    },
    missions: [],
    tasks: [],
    documents: [],
    logs: [],
  },
};

// ══════════════════════════════════════════════════════════════
// 3. CLONEADN FIXTURES
// ══════════════════════════════════════════════════════════════

const CLONEADN_FIXTURES: Record<string, CloneADNProfile> = {
  configured_adn: {
    status: "configured",
    version: "1.0.0",
    company_identity: {
      legal_name: "Acme Tech SAS",
      trade_name: "Acme Tech",
      sector: "technology",
      size_range: "10-49",
      country_code: "FR",
      main_language: "fr",
      hr_contact_email: "rh@acmetech.fr",
      values: ["innovation", "confiance", "transparence"],
      mission_statement: "Faire croitre les talents tech de demain.",
    },
    communication: {
      tone: "warm",
      preferred_length: "standard",
      formal_closing: "Cordialement,",
      greeting_style: "Bonjour,",
      avoid_words: ["malheureusement", "probleme"],
      preferred_words: ["equipe", "collaboration"],
      signature_template: null,
      language_code: "fr",
    },
    validation: {
      default_mode: "recommended",
      always_require_human_for: ["licenciement", "rupture conventionnelle", "sanction"],
      never_auto_execute: ["disciplinary_decision", "dismissal_action", "email_send"],
      sensitive_topics: ["licenciement", "disciplinaire", "harcelement"],
      approval_required_risk_levels: ["high", "critical"],
    },
    autonomy: {
      level: "supervised",
      allowed_auto_task_types: ["document_generate", "reminder_create"],
      blocked_auto_task_types: ["email_send", "dismissal_action"],
      max_auto_tasks_per_mission: 5,
      require_approval_above_risk: "medium",
    },
    document: {
      preferred_format: "html",
      preferred_tone: "warm",
      always_include_signature: true,
      always_include_legal_footer: false,
      require_validation_for_risk_levels: ["high", "critical"],
      preferred_template_ids: [],
    },
    rules: [
      {
        id: "rule_adn_001",
        label: "Email jamais auto-envoye",
        description: "Tout email RH doit passer en draft avant envoi",
        category: "security",
        severity: "critical",
        condition: "type contient email",
        action: "require_approval",
        active: true,
        applies_to_domains: [],
        applies_to_task_types: ["email_send", "email.send", "send_email"],
        requires_human_validation: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    sites: [],
    departments: [
      {
        id: "dept_001",
        name: "Technique",
        manager_name: null,
        headcount: 15,
        active: true,
      },
      {
        id: "dept_002",
        name: "Operations",
        manager_name: "Jean-Paul Dubois",
        headcount: 12,
        active: true,
      },
    ],
    inferred_preferences: [],
    completeness_score: 82,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  },
};

// ══════════════════════════════════════════════════════════════
// 4. ACCESSOR FUNCTIONS
// ══════════════════════════════════════════════════════════════

export function getGoldenCompanyContext(key: string): GoldenCompanyContext | null {
  return COMPANY_CONTEXTS[key] ?? null;
}

export function getGoldenEmployeeContext(key: string): GoldenEmployeeContext | null {
  return EMPLOYEE_CONTEXTS[key] ?? null;
}

export function getGoldenCloneADN(key: string): CloneADNProfile | null {
  return CLONEADN_FIXTURES[key] ?? null;
}

export function getGoldenReusableRhContext(
  companyKey: string | null,
): Record<string, unknown> {
  if (!companyKey) return { document_templates: [], employees: [] };
  const ctx = COMPANY_CONTEXTS[companyKey];
  if (!ctx) return { document_templates: [], employees: [] };
  return ctx.reusable_rh_context_json;
}

export function listGoldenFixtureKeys(): {
  companies: string[];
  employees: string[];
  clone_adns: string[];
} {
  return {
    companies: Object.keys(COMPANY_CONTEXTS),
    employees: Object.keys(EMPLOYEE_CONTEXTS),
    clone_adns: Object.keys(CLONEADN_FIXTURES),
  };
}
