// P-FINAL 01 — Phase 6 — Pre-defined demo scenarios.
// All data is illustrative. No real data.
// Pure: no Supabase, no Next, no async, no throw.

import type { DemoScenario } from "./demo-types";
import { DEMO_SIMULATED_PIERRE_RESPONSES } from "./demo-content";

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "scenario_rh_onboarding",
    name: "Onboarding d'un nouveau collaborateur",
    description: "Pierre prépare les documents d'onboarding pour un nouveau salarié.",
    persona: "RH Manager",
    is_illustrative: true,
    uses_real_data: false,
    steps: [
      {
        id: "step_1",
        title: "Créer une fiche collaborateur",
        description: "Demander à Pierre de créer la fiche du nouveau collaborateur.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.task_creation,
        action_type: "simulate_task",
      },
      {
        id: "step_2",
        title: "Générer le contrat brouillon",
        description: "Pierre prépare un brouillon de contrat de travail pour validation.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.document_draft,
        action_type: "view_document",
      },
      {
        id: "step_3",
        title: "Préparer l'email de bienvenue",
        description: "Pierre rédige un brouillon d'email de bienvenue pour validation humaine.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.email_draft,
        action_type: "simulate_email_draft",
      },
    ],
  },
  {
    id: "scenario_conge",
    name: "Traitement d'une demande de congé",
    description: "Pierre traite une demande de congé et prépare les communications nécessaires.",
    persona: "Responsable RH",
    is_illustrative: true,
    uses_real_data: false,
    steps: [
      {
        id: "step_1",
        title: "Enregistrer la demande de congé",
        description: "Pierre enregistre la demande et vérifie les soldes disponibles.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.task_creation,
        action_type: "simulate_task",
      },
      {
        id: "step_2",
        title: "Préparer la confirmation",
        description: "Pierre prépare un email de confirmation pour le salarié.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.email_draft,
        action_type: "simulate_email_draft",
      },
    ],
  },
  {
    id: "scenario_prepaye",
    name: "Pré-paie préparatoire",
    description: "Pierre collecte les éléments variables de paie pour transmission à l'expert-comptable.",
    persona: "Dirigeant PME",
    is_illustrative: true,
    uses_real_data: false,
    steps: [
      {
        id: "step_1",
        title: "Collecter les éléments variables",
        description: "Pierre rassemble les éléments variables du mois (absences, heures supplémentaires).",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.payroll_prep,
        action_type: "simulate_task",
      },
    ],
  },
  {
    id: "scenario_recrutement",
    name: "Recrutement — Convocation candidat",
    description: "Pierre prépare une convocation d'entretien, l'email au manager et enregistre la trace de mission.",
    persona: "Responsable RH",
    is_illustrative: true,
    uses_real_data: false,
    steps: [
      {
        id: "step_1",
        title: "Analyser la demande et détecter les infos manquantes",
        description: "Pierre identifie le type de mission, les personnes concernées et les données manquantes.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.task_creation,
        action_type: "simulate_task",
      },
      {
        id: "step_2",
        title: "Générer la convocation d'entretien (brouillon)",
        description: "Pierre prépare la convocation pour Clara Martin — validation humaine requise avant envoi.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.document_draft,
        action_type: "view_document",
      },
      {
        id: "step_3",
        title: "Préparer l'email au manager",
        description: "Pierre rédige un brouillon d'email au manager — envoi bloqué jusqu'à validation.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.email_draft,
        action_type: "simulate_email_draft",
      },
      {
        id: "step_4",
        title: "Enregistrer la trace CloneTrace",
        description: "Mission enregistrée avec horodatage — statut, acteurs, documents préparés.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.general,
        action_type: "view_audit_trail",
      },
    ],
  },
  {
    id: "scenario_absence_justificatif",
    name: "Absence — Demande de justificatif",
    description: "Pierre prépare une demande de justificatif d'absence et planifie une relance conditionnelle.",
    persona: "Responsable RH",
    is_illustrative: true,
    uses_real_data: false,
    steps: [
      {
        id: "step_1",
        title: "Détecter l'absence injustifiée et le niveau de sensibilité",
        description: "Pierre identifie le type de mission et classe le niveau de sensibilité comme élevé.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.task_creation,
        action_type: "simulate_task",
      },
      {
        id: "step_2",
        title: "Générer la demande de justificatif (brouillon)",
        description: "Pierre prépare le document — aucune sanction automatique, validation humaine requise.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.document_draft,
        action_type: "view_document",
      },
      {
        id: "step_3",
        title: "Planifier la relance conditionnelle J+48h",
        description: "Relance planifiée — ne partira que si validée explicitement par un humain.",
        simulated_pierre_response: DEMO_SIMULATED_PIERRE_RESPONSES.email_draft,
        action_type: "simulate_email_draft",
      },
    ],
  },
];

export function getDemoScenarioById(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}

export function getAllDemoScenarioIds(): string[] {
  return DEMO_SCENARIOS.map((s) => s.id);
}

export function validateDemoScenario(scenario: DemoScenario): {
  is_safe: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (scenario.uses_real_data !== false) {
    violations.push("uses_real_data must be false");
  }
  if (!scenario.is_illustrative) {
    violations.push("is_illustrative must be true");
  }
  for (const step of scenario.steps) {
    if (
      step.simulated_pierre_response.includes("real API") ||
      step.simulated_pierre_response.includes("Anthropic")
    ) {
      violations.push(`Step ${step.id} references real API calls`);
    }
  }

  return {
    is_safe: violations.length === 0,
    violations,
  };
}
