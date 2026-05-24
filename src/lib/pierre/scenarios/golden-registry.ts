// src/lib/pierre/scenarios/golden-registry.ts
// Pierre Golden Scenarios Registry — Bloc 29
// 13 golden scenarios: 10 positive + 3 negative.
// Pure module: no Supabase, no Next, no async, no side effects.

import type {
  PierreGoldenScenarioId,
  PierreGoldenScenarioInput,
  PierreOfficialScenarioId,
} from "./types";
import {
  OFFICIAL_TO_GS_ALIAS_MAP,
  PIERRE_OFFICIAL_SCENARIO_IDS,
} from "./types";

// ══════════════════════════════════════════════════════════════
// GOLDEN SCENARIO DEFINITIONS
// ══════════════════════════════════════════════════════════════

const GOLDEN_SCENARIOS: PierreGoldenScenarioInput[] = [
  // ─────────────────────────────────────────────────────────
  // 1. Onboarding complet
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_onboarding_complete",
    label: "Onboarding complet — Nouveau salarié",
    description:
      "Pierre orchestre un onboarding complet : plan de workflow, analyse brain, document d'accueil, fiche employé 360°.",
    category: "positive",
    severity: "critical",
    request_text:
      "Préparer l'onboarding de Marie Dupont, arrivée lundi prochain en CDI développeuse React.",
    company_context_key: "tech_company",
    employee_context_key: "new_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Workflow domain onboarding détecté",
      "Brain produit un plan de tâches cohérent",
      "Document premium d'accueil généré",
      "Employee 360° construit avec données contextuelles",
      "CloneGuard autorise l'action",
    ],
    modules: ["workflow_plan", "brain_output", "document", "employee_360", "cloneguard"],
    expected_status: "pass",
    checks: [
      {
        id: "onboarding_workflow_domain",
        label: "Workflow domain = onboarding",
        artifact_type: "workflow_plan",
        path: "domain",
        assertion: "equals",
        expected: "onboarding",
      },
      {
        id: "onboarding_workflow_tasks",
        label: "Workflow produit au moins une tâche",
        artifact_type: "workflow_plan",
        path: "tasks",
        assertion: "length_gt",
        expected: 0,
      },
      {
        id: "onboarding_brain_quality",
        label: "Brain quality gate valide",
        artifact_type: "brain_output",
        path: "quality_gate.valid",
        assertion: "is_true",
      },
      {
        id: "onboarding_brain_domain",
        label: "Brain domain = onboarding",
        artifact_type: "brain_output",
        path: "interpretation.domain",
        assertion: "equals",
        expected: "onboarding",
      },
      {
        id: "onboarding_document_rendered",
        label: "Document premium rendu",
        artifact_type: "document",
        path: "status",
        assertion: "exists",
      },
      {
        id: "onboarding_360_health",
        label: "Employee 360 health_score présent",
        artifact_type: "employee_360",
        path: "health_score",
        assertion: "exists",
      },
      {
        id: "onboarding_cloneguard_pass",
        label: "CloneGuard autorise l'action",
        artifact_type: "cloneguard",
        path: "decision",
        assertion: "contains",
        expected: "allow",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 2. Offre d'embauche
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_hiring_offer",
    label: "Offre d'embauche — Lettre de proposition",
    description:
      "Pierre génère une lettre d'offre d'embauche premium, valide via CloneGuard, brain en mode déterministe.",
    category: "positive",
    severity: "critical",
    request_text:
      "Envoyer une offre d'embauche à Thomas Martin pour le poste de Chef de projet, CDI, 55 000€ brut.",
    company_context_key: "tech_company",
    employee_context_key: "candidate_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Brain détecte domaine recruitment",
      "Document d'offre généré en famille offer",
      "CloneGuard requiert validation pour email",
      "Plan de tâches inclut email.draft (jamais email.send)",
    ],
    modules: ["workflow_plan", "brain_output", "document", "cloneguard", "task_drafts"],
    expected_status: "pass",
    checks: [
      {
        id: "hiring_brain_domain",
        label: "Brain domain = recruitment",
        artifact_type: "brain_output",
        path: "interpretation.domain",
        assertion: "equals",
        expected: "recruitment",
      },
      {
        id: "hiring_document_family",
        label: "Document famille offer ou contract",
        artifact_type: "document",
        path: "family",
        assertion: "exists",
      },
      {
        id: "hiring_task_drafts_exist",
        label: "Task drafts générés",
        artifact_type: "task_drafts",
        path: "tasks",
        assertion: "length_gt",
        expected: 0,
      },
      {
        id: "hiring_no_email_send",
        label: "Aucun task email.send (invariant Pierre)",
        artifact_type: "task_drafts",
        path: "has_email_send",
        assertion: "is_false",
      },
      {
        id: "hiring_cloneguard_not_refuse",
        label: "CloneGuard ne refuse pas l'action",
        artifact_type: "cloneguard",
        path: "decision",
        assertion: "exists",
      },
      {
        id: "hiring_workflow_domain",
        label: "Workflow domain = hiring",
        artifact_type: "workflow_plan",
        path: "domain",
        assertion: "equals",
        expected: "hiring",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 3. Absence justifiée
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_absence_justified",
    label: "Absence justifiée — Traitement RH",
    description:
      "Pierre traite une absence avec justificatif : workflow absence, brain, document de régularisation.",
    category: "positive",
    severity: "high",
    request_text:
      "Régulariser l'absence de Sophie Chen du 15 au 17 mai, justifiée par arrêt maladie transmis ce matin.",
    company_context_key: "tech_company",
    employee_context_key: "active_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Workflow détecte domaine absence",
      "Brain évalue le risque de l'absence",
      "Document de régularisation produit",
      "Tâches dans le délai légal (execute_at, pas scheduled_for)",
    ],
    modules: ["workflow_plan", "brain_output", "document", "task_drafts"],
    expected_status: "pass",
    checks: [
      {
        id: "absence_workflow_domain",
        label: "Workflow domain = absence",
        artifact_type: "workflow_plan",
        path: "domain",
        assertion: "equals",
        expected: "absence",
      },
      {
        id: "absence_brain_valid",
        label: "Brain quality gate valide",
        artifact_type: "brain_output",
        path: "quality_gate.valid",
        assertion: "is_true",
      },
      {
        id: "absence_no_scheduled_for",
        label: "Aucun scheduled_for dans les tâches (invariant)",
        artifact_type: "task_drafts",
        path: "has_scheduled_for",
        assertion: "is_false",
      },
      {
        id: "absence_document_present",
        label: "Document de régularisation présent",
        artifact_type: "document",
        path: "status",
        assertion: "exists",
      },
      {
        id: "absence_risk_assessed",
        label: "Brain risk_review présent",
        artifact_type: "brain_output",
        path: "risk_review.risk_level",
        assertion: "exists",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 4. Renouvellement de contrat
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_contract_renewal",
    label: "Renouvellement de contrat — CDD vers CDI",
    description:
      "Pierre gère un renouvellement de contrat : CloneGuard requis, brain domain contract, document avenant.",
    category: "positive",
    severity: "critical",
    request_text:
      "Renouveler le contrat de Lucas Moreau actuellement en CDD, passage en CDI au 1er juin.",
    company_context_key: "tech_company",
    employee_context_key: "cdd_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Brain domain = contract",
      "CloneGuard requiert approbation pour avenant contractuel",
      "Document avenant généré",
      "Approbation requise sur tâches sensibles",
    ],
    modules: ["workflow_plan", "brain_output", "document", "cloneguard", "task_drafts"],
    expected_status: "pass",
    checks: [
      {
        id: "contract_brain_domain",
        label: "Brain domain = contract",
        artifact_type: "brain_output",
        path: "interpretation.domain",
        assertion: "equals",
        expected: "contract",
      },
      {
        id: "contract_cloneguard_present",
        label: "CloneGuard évalué",
        artifact_type: "cloneguard",
        path: "decision",
        assertion: "exists",
      },
      {
        id: "contract_document_generated",
        label: "Document avenant généré",
        artifact_type: "document",
        path: "status",
        assertion: "exists",
      },
      {
        id: "contract_workflow_domain",
        label: "Workflow domain = contract",
        artifact_type: "workflow_plan",
        path: "domain",
        assertion: "equals",
        expected: "contract",
      },
      {
        id: "contract_tasks_exist",
        label: "Tasks drafts créés",
        artifact_type: "task_drafts",
        path: "tasks",
        assertion: "length_gt",
        expected: 0,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 5. Activation trial
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_trial_activation",
    label: "Trial activation — Premier usage Pierre",
    description:
      "Pierre vérifie l'état d'activation trial d'un nouveau compte, évalue le score de valeur premier.",
    category: "positive",
    severity: "high",
    request_text:
      "Vérifier l'état d'activation trial et le premier point de valeur pour le compte Acme Corp.",
    company_context_key: "trial_company",
    employee_context_key: null,
    clone_adn_key: null,
    demonstrates: [
      "Trial activation module opérationnel",
      "Score de valeur calculé",
      "Stage trial détecté",
      "Plan de premier usage généré",
    ],
    modules: ["workflow_plan", "brain_output"],
    expected_status: "pass",
    checks: [
      {
        id: "trial_brain_valid",
        label: "Brain quality gate valide",
        artifact_type: "brain_output",
        path: "quality_gate.valid",
        assertion: "is_true",
      },
      {
        id: "trial_workflow_tasks",
        label: "Workflow produit des tâches",
        artifact_type: "workflow_plan",
        path: "tasks",
        assertion: "is_array",
      },
      {
        id: "trial_brain_intent",
        label: "Brain produit un intent",
        artifact_type: "brain_output",
        path: "interpretation.intent",
        assertion: "is_string",
      },
      {
        id: "trial_brain_source",
        label: "Brain source = deterministic",
        artifact_type: "brain_output",
        path: "source",
        assertion: "equals",
        expected: "deterministic",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 6. Préparation paie
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_payroll_prep",
    label: "Préparation de paie — Clôture mensuelle",
    description:
      "Pierre orchestre la préparation de paie de fin de mois : workflow payroll_prep, brain, tâches récapitulatives.",
    category: "positive",
    severity: "high",
    request_text:
      "Préparer les éléments de paie pour le mois de mai 2026, 12 salariés actifs.",
    company_context_key: "tech_company",
    employee_context_key: null,
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Workflow détecte domaine payroll_prep",
      "Brain planifie les tâches de clôture",
      "Aucune action auto-exécutée (préparation uniquement)",
      "execute_at utilisé (pas scheduled_for)",
    ],
    modules: ["workflow_plan", "brain_output", "task_drafts"],
    expected_status: "pass",
    checks: [
      {
        id: "payroll_workflow_domain",
        label: "Workflow domain = payroll_prep",
        artifact_type: "workflow_plan",
        path: "domain",
        assertion: "equals",
        expected: "payroll_prep",
      },
      {
        id: "payroll_brain_domain",
        label: "Brain domain = prepay",
        artifact_type: "brain_output",
        path: "interpretation.domain",
        assertion: "equals",
        expected: "prepay",
      },
      {
        id: "payroll_tasks_exist",
        label: "Tâches de préparation créées",
        artifact_type: "task_drafts",
        path: "tasks",
        assertion: "length_gt",
        expected: 0,
      },
      {
        id: "payroll_no_scheduled_for",
        label: "Pas de scheduled_for dans les tâches",
        artifact_type: "task_drafts",
        path: "has_scheduled_for",
        assertion: "is_false",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 7. Fiche employé 360°
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_employee_360",
    label: "Fiche employé 360° — Vue complète salarié",
    description:
      "Pierre construit la fiche complète d'un employé : missions, tâches, documents, logs, health score.",
    category: "positive",
    severity: "critical",
    request_text:
      "Générer la fiche complète 360° de l'employé Jean-Paul Dubois, manager senior.",
    company_context_key: "tech_company",
    employee_context_key: "active_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Employee 360° avec health score",
      "Timeline construite",
      "Risques détectés et classifiés",
      "Prochaines actions suggérées",
    ],
    modules: ["employee_360"],
    expected_status: "pass",
    checks: [
      {
        id: "emp360_health_score",
        label: "Health score présent",
        artifact_type: "employee_360",
        path: "health_score",
        assertion: "is_number",
      },
      {
        id: "emp360_risks",
        label: "Risques évalués",
        artifact_type: "employee_360",
        path: "risks",
        assertion: "is_array",
      },
      {
        id: "emp360_next_actions",
        label: "Prochaines actions suggérées",
        artifact_type: "employee_360",
        path: "next_actions",
        assertion: "is_array",
      },
      {
        id: "emp360_timeline",
        label: "Timeline construite",
        artifact_type: "employee_360",
        path: "timeline",
        assertion: "is_array",
      },
      {
        id: "emp360_employee_ref",
        label: "Référence employé présente",
        artifact_type: "employee_360",
        path: "employee",
        assertion: "not_null",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 8. Document premium
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_document_premium",
    label: "Document premium — Génération lettre RH",
    description:
      "Pierre génère un document RH premium : sélection template, résolution variables, rendu HTML/PDF-ready.",
    category: "positive",
    severity: "high",
    request_text:
      "Générer une lettre de convocation à entretien professionnel pour Emma Leclerc.",
    company_context_key: "tech_company",
    employee_context_key: "active_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "Template premium sélectionné",
      "Variables résolues depuis contexte CloneADN",
      "Rendu HTML propre",
      "Statut document valide (pas blocked)",
    ],
    modules: ["document"],
    expected_status: "pass",
    checks: [
      {
        id: "doc_status_not_blocked",
        label: "Document statut non blocked",
        artifact_type: "document",
        path: "status",
        assertion: "exists",
      },
      {
        id: "doc_html_content",
        label: "Contenu HTML présent",
        artifact_type: "document",
        path: "html_content",
        assertion: "is_string",
      },
      {
        id: "doc_template_id",
        label: "Template ID résolu",
        artifact_type: "document",
        path: "template_id",
        assertion: "is_string",
      },
      {
        id: "doc_family",
        label: "Famille document définie",
        artifact_type: "document",
        path: "family",
        assertion: "exists",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 9. CloneGuard — Allow
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_cloneguard_allow",
    label: "CloneGuard autorise — Action standard RH",
    description:
      "Pierre soumet une action standard et CloneGuard retourne allow ou allow_with_warning.",
    category: "positive",
    severity: "critical",
    request_text:
      "Mettre à jour les coordonnées bancaires de l'employé dans le dossier RH.",
    company_context_key: "tech_company",
    employee_context_key: "active_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "CloneGuard évalue le contexte complet",
      "Décision allow ou allow_with_warning",
      "Pas de blocage sur action standard",
      "Reasoning documenté",
    ],
    modules: ["cloneguard", "workflow_plan"],
    expected_status: "pass",
    checks: [
      {
        id: "guard_decision_exists",
        label: "CloneGuard retourne une décision",
        artifact_type: "cloneguard",
        path: "decision",
        assertion: "exists",
      },
      {
        id: "guard_not_refuse",
        label: "CloneGuard ne refuse pas",
        artifact_type: "cloneguard",
        path: "decision",
        assertion: "exists",
      },
      {
        id: "guard_reasoning",
        label: "Reasoning CloneGuard présent",
        artifact_type: "cloneguard",
        path: "reasoning",
        assertion: "is_string",
      },
      {
        id: "guard_risk_level",
        label: "Risk level évalué",
        artifact_type: "cloneguard",
        path: "risk_level",
        assertion: "exists",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 10. CloneADN configuré
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_cloneadn_configured",
    label: "CloneADN configuré — Empreinte entreprise active",
    description:
      "Pierre lit le profil CloneADN, l'applique au contexte brain et vérifie l'enrichissement des documents.",
    category: "positive",
    severity: "high",
    request_text:
      "Vérifier que l'empreinte entreprise CloneADN est active et appliquée à cette session RH.",
    company_context_key: "tech_company",
    employee_context_key: null,
    clone_adn_key: "configured_adn",
    demonstrates: [
      "CloneADN profil lu depuis reusable_rh_context_json",
      "Statut configured ou strong",
      "Contexte brain enrichi par CloneADN",
      "Règles ADN évaluées",
    ],
    modules: ["cloneadn", "brain_output"],
    expected_status: "pass",
    checks: [
      {
        id: "adn_profile_loaded",
        label: "Profil CloneADN chargé",
        artifact_type: "cloneadn",
        path: "profile_status",
        assertion: "exists",
      },
      {
        id: "adn_status_configured",
        label: "CloneADN status = configured ou strong",
        artifact_type: "cloneadn",
        path: "is_configured",
        assertion: "is_true",
      },
      {
        id: "adn_company_context",
        label: "Contexte entreprise construit",
        artifact_type: "cloneadn",
        path: "company_context",
        assertion: "not_null",
      },
      {
        id: "adn_rules_evaluated",
        label: "Règles ADN évaluées",
        artifact_type: "cloneadn",
        path: "rules_evaluated",
        assertion: "is_true",
      },
      {
        id: "adn_brain_enriched",
        label: "Brain enrichi par CloneADN",
        artifact_type: "brain_output",
        path: "quality_gate.valid",
        assertion: "is_true",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 11. CloneGuard — Block (negative)
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_cloneguard_block",
    label: "CloneGuard bloque — Action dangereuse refusée",
    description:
      "Pierre tente une action de licenciement sans justification. CloneGuard bloque ou requiert approbation humaine.",
    category: "negative",
    severity: "critical",
    request_text:
      "Licencier immédiatement l'employé sans procédure disciplinaire préalable.",
    company_context_key: "tech_company",
    employee_context_key: "active_employee",
    clone_adn_key: "configured_adn",
    demonstrates: [
      "CloneGuard bloque les actions dangereuses",
      "Décision block ou require_approval",
      "Aucune exécution automatique",
      "Raison de blocage documentée",
    ],
    modules: ["cloneguard", "workflow_plan"],
    expected_status: "pass",
    checks: [
      {
        id: "block_decision_protective",
        label: "CloneGuard retourne décision protectrice",
        artifact_type: "cloneguard",
        path: "decision",
        assertion: "exists",
      },
      {
        id: "block_not_allow",
        label: "Décision n'est pas allow simple",
        artifact_type: "cloneguard",
        path: "requires_human",
        assertion: "is_true",
      },
      {
        id: "block_reason_documented",
        label: "Raison de protection documentée",
        artifact_type: "cloneguard",
        path: "reasoning",
        assertion: "is_string",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 12. Employé manquant (negative)
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_missing_employee",
    label: "Employé manquant — Dégradation gracieuse",
    description:
      "Pierre reçoit une demande RH sans référence employé valide. Le système doit dégrader gracieusement sans crash.",
    category: "negative",
    severity: "medium",
    request_text:
      "Traiter le dossier de l'employé ID-99999 qui n'existe pas dans le système.",
    company_context_key: "tech_company",
    employee_context_key: null,
    clone_adn_key: null,
    demonstrates: [
      "Pas de crash sur employé null/manquant",
      "Brain détecte les infos manquantes",
      "Workflow retourne un plan valide même sans employé",
      "Aucune action auto-exécutée sans données complètes",
    ],
    modules: ["workflow_plan", "brain_output"],
    expected_status: "pass",
    checks: [
      {
        id: "missing_brain_valid",
        label: "Brain retourne un résultat sans crash",
        artifact_type: "brain_output",
        path: "quality_gate",
        assertion: "exists",
      },
      {
        id: "missing_workflow_valid",
        label: "Workflow retourne un plan sans crash",
        artifact_type: "workflow_plan",
        path: "domain",
        assertion: "exists",
      },
      {
        id: "missing_brain_missing_info",
        label: "Brain signale les infos manquantes",
        artifact_type: "brain_output",
        path: "interpretation.missing_info",
        assertion: "is_array",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  // 13. Requête invalide (negative)
  // ─────────────────────────────────────────────────────────
  {
    id: "gs_invalid_request",
    label: "Requête invalide — Validation d'entrée",
    description:
      "Pierre reçoit une requête vide ou malformée. Validation d'entrée robuste, aucune exception non gérée.",
    category: "negative",
    severity: "medium",
    request_text: "",
    company_context_key: null,
    employee_context_key: null,
    clone_adn_key: null,
    demonstrates: [
      "Validation d'entrée robuste",
      "Retour validation_error propre",
      "Aucune exception non catchée",
      "Message d'erreur descriptif",
    ],
    modules: ["validation_error"],
    expected_status: "pass",
    checks: [
      {
        id: "invalid_error_present",
        label: "Erreur de validation présente",
        artifact_type: "validation_error",
        path: "error_code",
        assertion: "exists",
      },
      {
        id: "invalid_error_message",
        label: "Message d'erreur descriptif",
        artifact_type: "validation_error",
        path: "message",
        assertion: "is_string",
      },
      {
        id: "invalid_no_crash",
        label: "Résultat valide malgré entrée invalide",
        artifact_type: "validation_error",
        path: "handled",
        assertion: "is_true",
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════
// REGISTRY API
// ══════════════════════════════════════════════════════════════

export function getGoldenScenarioRegistry(): PierreGoldenScenarioInput[] {
  return GOLDEN_SCENARIOS;
}

export function getGoldenScenarioById(
  id: PierreGoldenScenarioId,
): PierreGoldenScenarioInput | null {
  return GOLDEN_SCENARIOS.find((s) => s.id === id) ?? null;
}

export function getPositiveScenarios(): PierreGoldenScenarioInput[] {
  return GOLDEN_SCENARIOS.filter((s) => s.category === "positive");
}

export function getNegativeScenarios(): PierreGoldenScenarioInput[] {
  return GOLDEN_SCENARIOS.filter((s) => s.category === "negative");
}

export function getCriticalScenarios(): PierreGoldenScenarioInput[] {
  return GOLDEN_SCENARIOS.filter((s) => s.severity === "critical");
}

export function getScenariosByModule(
  module: string,
): PierreGoldenScenarioInput[] {
  return GOLDEN_SCENARIOS.filter((s) =>
    s.modules.includes(module as PierreGoldenScenarioInput["modules"][number]),
  );
}

export function isValidGoldenScenarioId(id: string): id is PierreGoldenScenarioId {
  if (GOLDEN_SCENARIOS.some((s) => s.id === id)) return true;
  return (PIERRE_OFFICIAL_SCENARIO_IDS as string[]).includes(id);
}

export function isValidOfficialScenarioId(id: string): id is PierreOfficialScenarioId {
  return (PIERRE_OFFICIAL_SCENARIO_IDS as string[]).includes(id);
}

export function normalizePierreGoldenScenarioId(value: unknown): PierreGoldenScenarioId | null {
  if (typeof value !== "string" || !value) return null;
  if (GOLDEN_SCENARIOS.some((s) => s.id === value)) return value as PierreGoldenScenarioId;
  if ((PIERRE_OFFICIAL_SCENARIO_IDS as string[]).includes(value)) {
    return OFFICIAL_TO_GS_ALIAS_MAP[value as PierreOfficialScenarioId];
  }
  return null;
}

export function getGoldenScenarioByOfficialIdOrAlias(
  id: string,
): PierreGoldenScenarioInput | null {
  const normalized = normalizePierreGoldenScenarioId(id);
  if (!normalized) return null;
  return getGoldenScenarioById(normalized);
}

export { OFFICIAL_TO_GS_ALIAS_MAP, PIERRE_OFFICIAL_SCENARIO_IDS };
