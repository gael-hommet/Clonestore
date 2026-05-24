// src/lib/pierre/context/employee-context.ts
// B35 — Employee context signals from PierreEmployeeProfile + 360 data.

import type { PierreContextSignal } from "./types";
import { buildContextSignal } from "./context-signals";
import {
  sanitizePierreEmployeeProfile,
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
} from "../hr/employee";

function safeStr(v: unknown, maxLen = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, maxLen) : null;
}

export function buildEmployeeContextSignals(params: {
  company_id: string;
  employee_id: string | null | undefined;
  employee_profile: Record<string, unknown> | null | undefined;
  employees: Record<string, unknown>[];
  recent_missions?: Record<string, unknown>[];
  recent_tasks?: Record<string, unknown>[];
  current_task_type?: string | null;
  current_domain?: string | null;
}): PierreContextSignal[] {
  const { company_id } = params;
  const signals: PierreContextSignal[] = [];

  // Resolve employee profile
  let rawProfile = params.employee_profile ?? null;
  if (!rawProfile && params.employee_id && params.employees.length > 0) {
    const list = sanitizePierreEmployeeList(params.employees);
    const found = findPierreEmployeeById(list, params.employee_id);
    if (found) rawProfile = found as unknown as Record<string, unknown>;
  }

  const profile = sanitizePierreEmployeeProfile(rawProfile);

  if (!profile) {
    if (params.employee_id) {
      signals.push(
        buildContextSignal({
          company_id,
          scope: "employee",
          source: "default",
          type: "missing_info",
          priority: "high",
          risk: "medium",
          title: "Profil salarié introuvable",
          content: `Aucun profil salarié trouvé pour l'identifiant ${params.employee_id}.`,
          confidence: 1.0,
          related_employee_id: params.employee_id,
        }),
      );
    }
    return signals;
  }

  // ── Employee identity ─────────────────────────────────────────────────────

  const statusRisk =
    profile.status === "offboarding"
      ? ("high" as const)
      : profile.status === "inactive"
        ? ("medium" as const)
        : ("none" as const);

  signals.push(
    buildContextSignal({
      company_id,
      scope: "employee",
      source: "employee_profile",
      type: "identity",
      priority: "high",
      risk: statusRisk,
      title: `Salarié: ${profile.full_name}`,
      content: [
        `Nom: ${profile.full_name}`,
        profile.job_title ? `Poste: ${profile.job_title}` : null,
        profile.department ? `Département: ${profile.department}` : null,
        profile.contract_type ? `Contrat: ${profile.contract_type}` : null,
        profile.date_entree ? `Entrée: ${profile.date_entree}` : null,
        `Statut: ${profile.status}`,
      ]
        .filter(Boolean)
        .join(" | "),
      confidence: 0.95,
      related_employee_id: profile.id,
      currentTaskType: params.current_task_type,
      currentDomain: params.current_domain,
      metadata: {
        status: profile.status,
        contract_type: profile.contract_type,
        department: profile.department,
      },
    }),
  );

  // ── Offboarding warning ───────────────────────────────────────────────────

  if (profile.status === "offboarding") {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "employee",
        source: "employee_profile",
        type: "risk_flag",
        priority: "critical",
        risk: "high",
        title: `Salarié en cours de départ: ${profile.full_name}`,
        content: `${profile.full_name} est en phase d'offboarding${profile.date_sortie ? ` (date de sortie: ${profile.date_sortie})` : ""}. Toute action RH requiert une attention particulière.`,
        confidence: 1.0,
        related_employee_id: profile.id,
        currentTaskType: params.current_task_type,
        metadata: { date_sortie: profile.date_sortie },
      }),
    );
  }

  // ── Mission history signal ─────────────────────────────────────────────────

  const missions = params.recent_missions ?? [];
  const tasks = params.recent_tasks ?? [];

  if (missions.length > 0 || tasks.length > 0) {
    const pendingApprovals = tasks.filter(
      (t) => t.approval_required === true && t.status === "awaiting_approval",
    ).length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;

    const hasCritical = pendingApprovals > 0 || blocked > 0;

    signals.push(
      buildContextSignal({
        company_id,
        scope: "employee",
        source: "mission_record",
        type: hasCritical ? "risk_flag" : "status",
        priority: hasCritical ? "high" : "medium",
        risk: hasCritical ? "high" : "none",
        title: `Activité RH — ${profile.full_name}`,
        content: [
          `Missions: ${missions.length}`,
          `Tâches: ${tasks.length}`,
          pendingApprovals > 0 ? `⚠ ${pendingApprovals} tâche(s) en attente d'approbation` : null,
          blocked > 0 ? `⚠ ${blocked} tâche(s) bloquée(s)` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        confidence: 0.9,
        related_employee_id: profile.id,
        currentTaskType: params.current_task_type,
        metadata: {
          total_missions: missions.length,
          total_tasks: tasks.length,
          pending_approvals: pendingApprovals,
          blocked_count: blocked,
        },
      }),
    );
  }

  // ── Missing critical info ─────────────────────────────────────────────────

  const missingFields: string[] = [];
  if (!profile.email) missingFields.push("email");
  if (!profile.job_title) missingFields.push("poste");
  if (!profile.contract_type) missingFields.push("type de contrat");
  if (!profile.date_entree) missingFields.push("date d'entrée");

  if (missingFields.length > 0) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "employee",
        source: "employee_profile",
        type: "missing_info",
        priority: "low",
        risk: "none",
        title: `Données manquantes — ${profile.full_name}`,
        content: `Champs non renseignés: ${missingFields.join(", ")}.`,
        confidence: 1.0,
        related_employee_id: profile.id,
        metadata: { missing_fields: missingFields },
      }),
    );
  }

  // ── Email contact ─────────────────────────────────────────────────────────

  const email = safeStr(profile.email);
  if (email) {
    signals.push(
      buildContextSignal({
        company_id,
        scope: "employee",
        source: "employee_profile",
        type: "capability",
        priority: "low",
        risk: "none",
        title: `Email salarié: ${profile.full_name}`,
        content: `Email: ${email}`,
        confidence: 0.95,
        related_employee_id: profile.id,
        metadata: { email },
      }),
    );
  }

  return signals;
}
