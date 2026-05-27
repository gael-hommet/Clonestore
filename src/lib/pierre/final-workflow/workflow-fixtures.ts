// B42 — Fixtures: fake adapters and test helpers

import type { B42WorkflowAdapters } from "./types";
import type { PierreArtifactRequest } from "../tasks/executors";

// ── Fake adapters (no Supabase, no email, no side effects) ───────────────────

export type FakeAdapterState = {
  traces: Array<{ scenarioId: string; message: string }>;
  artifacts: Array<{ scenarioId: string; artifact: PierreArtifactRequest }>;
  realEmailSentCount: number;
};

export function buildFakeB42Adapters(): {
  adapters: B42WorkflowAdapters;
  state: FakeAdapterState;
} {
  const state: FakeAdapterState = {
    traces: [],
    artifacts: [],
    realEmailSentCount: 0,
  };

  const adapters: B42WorkflowAdapters = {
    logTrace: (scenarioId, message) => {
      state.traces.push({ scenarioId, message });
    },
    recordArtifact: (scenarioId, artifact) => {
      state.artifacts.push({ scenarioId, artifact });
    },
    assertNoRealEmailSent: () => {
      // In tests, no real email is ever sent
      return state.realEmailSentCount === 0;
    },
  };

  return { adapters, state };
}

// ── Employee context fixtures ─────────────────────────────────────────────────

export const FIXTURE_EMPLOYEE_MARIE_DUPONT = {
  employee_name: "Marie Dupont",
  employee_id: "emp-001",
  contract_type: "CDI",
  start_date: "2026-07-01",
  department: "RH",
};

export const FIXTURE_EMPLOYEE_THOMAS_MARTIN = {
  employee_name: "Thomas Martin",
  employee_id: "emp-002",
  contract_type: "CDI",
  department: "Finance",
};

export const FIXTURE_EMPLOYEE_SOPHIE_BERNARD = {
  employee_name: "Sophie Bernard",
  employee_id: "emp-042",
  contract_type: "CDI",
  department: "Comptabilité",
};

export const FIXTURE_EMPLOYEE_LUCAS_MOREAU = {
  employee_name: "Lucas Moreau",
  employee_id: "emp-099",
  contract_type: "CDD",
  department: "Commercial",
};

export const FIXTURE_EMPLOYEE_CLAIRE_FONTAINE = {
  employee_name: "Claire Fontaine",
  employee_id: "emp-033",
  contract_type: "CDI",
  department: "Marketing",
};

// ── Sample HR inputs ──────────────────────────────────────────────────────────

export const FIXTURE_HR_INPUTS = {
  hiring:
    "Recruter Marie Dupont en CDI dès le 01/07/2026. Préparer le dossier d'embauche.",
  onboarding:
    "Thomas Martin arrive lundi. Checklist onboarding et email de bienvenue.",
  absence:
    "Sophie Bernard absente depuis lundi 25/05/2026. Pas de justificatif reçu.",
  payroll_prep:
    "Préparer la synthèse pré-paie pour mai 2026 avec les éléments variables.",
  employee_file:
    "Dossier de Lucas Moreau incomplet. Pièces manquantes : RIB, diplôme.",
  general_hr:
    "Préparer un document de procédure interne RH sur le process de remboursement des notes de frais.",
  interview:
    "Convoquer Claire Fontaine pour son entretien annuel le 15/06/2026.",
  sensitive_case:
    "Signalement de harcèlement moral. Cas grave. Synthèse factuelle uniquement.",
};

// ── Task executor shim: converts workflow task draft to executor task format ──

export function makeExecutorTask(
  id: string,
  taskDraft: {
    type: string;
    title: string;
    status: string;
    payload_json: Record<string, unknown>;
  },
  overrideStatus?: string,
): {
  id: string;
  type: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
} {
  return {
    id,
    type: taskDraft.type,
    title: taskDraft.title,
    status: overrideStatus ?? "running",
    payload: taskDraft.payload_json,
  };
}
