/**
 * Pierre HR Engine — Employee Profile 360 Foundation
 *
 * Couche pure sans dépendance DB/UI.
 * Les profils salariés sont stockés dans pierre_company_memory.reusable_rh_context_json.employees[]
 * — aucune table dédiée, pas de migration Supabase nécessaire.
 *
 * Limite : 200 salariés max par entreprise (cohérent avec sanitize existant).
 */

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export type PierreContractType =
  | "cdi"
  | "cdd"
  | "alternance"
  | "stage"
  | "independant"
  | "interim"
  | "autre";

export type PierreEmployeeStatus =
  | "active"
  | "inactive"
  | "onboarding"
  | "offboarding"
  | "unknown";

export type PierreEmployeeProfile = {
  id: string;
  full_name: string;
  email?: string | null;
  job_title?: string | null;
  department?: string | null;
  contract_type?: PierreContractType | null;
  date_entree?: string | null;
  date_sortie?: string | null;
  status: PierreEmployeeStatus;
  tags?: string[];
};

/**
 * Contexte salarié injecté dans les payloads de tâche et les brain_output_json.
 * Champs volontairement légers — pas de données sensibles dans les payloads task.
 */
export type PierreEmployeeContext = {
  employee_id: string;
  employee_name: string;
  employee_email?: string | null;
  contract_type?: PierreContractType | null;
  department?: string | null;
  date_entree?: string | null;
  status?: PierreEmployeeStatus | null;
};

// ══════════════════════════════════════════════════════════
// HELPERS INTERNES
// ══════════════════════════════════════════════════════════

const CONTRACT_TYPES = new Set<string>([
  "cdi", "cdd", "alternance", "stage", "independant", "interim", "autre",
]);

const EMPLOYEE_STATUSES = new Set<string>([
  "active", "inactive", "onboarding", "offboarding", "unknown",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, maxLen = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : null;
}

function safeContractType(value: unknown): PierreContractType | null {
  const s = safeString(value)?.toLowerCase();
  return s && CONTRACT_TYPES.has(s) ? (s as PierreContractType) : null;
}

function safeEmployeeStatus(value: unknown): PierreEmployeeStatus {
  const s = safeString(value)?.toLowerCase();
  return s && EMPLOYEE_STATUSES.has(s) ? (s as PierreEmployeeStatus) : "unknown";
}

function safeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 20)
    .map((item) => safeString(item, 100))
    .filter((s): s is string => s !== null);
}

// ══════════════════════════════════════════════════════════
// SANITIZE
// ══════════════════════════════════════════════════════════

/**
 * Nettoie et valide un profil salarié entrant (provenant de payload JSON inconnu).
 * Retourne null si le minimum requis (id + full_name) est absent.
 */
export function sanitizePierreEmployeeProfile(
  raw: unknown,
): PierreEmployeeProfile | null {
  if (!isObject(raw)) return null;

  const id = safeString(raw.id, 128);
  const full_name = safeString(raw.full_name, 200);

  if (!id || !full_name) return null;

  return {
    id,
    full_name,
    email: safeString(raw.email, 320),
    job_title: safeString(raw.job_title, 200),
    department: safeString(raw.department, 200),
    contract_type: safeContractType(raw.contract_type),
    date_entree: safeString(raw.date_entree, 32),
    date_sortie: safeString(raw.date_sortie, 32),
    status: safeEmployeeStatus(raw.status),
    tags: safeTags(raw.tags),
  };
}

/**
 * Sanitize une liste d'employés. Max 200 profils, ignore les invalides silencieusement.
 */
export function sanitizePierreEmployeeList(
  raw: unknown,
): PierreEmployeeProfile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 200)
    .map((item) => sanitizePierreEmployeeProfile(item))
    .filter((p): p is PierreEmployeeProfile => p !== null);
}

// ══════════════════════════════════════════════════════════
// LOOKUP
// ══════════════════════════════════════════════════════════

/**
 * Trouve un profil salarié par son id exact.
 */
export function findPierreEmployeeById(
  employees: PierreEmployeeProfile[],
  id: string,
): PierreEmployeeProfile | null {
  const needle = id.trim().toLowerCase();
  if (!needle) return null;
  return employees.find((e) => e.id.toLowerCase() === needle) ?? null;
}

/**
 * Trouve un profil salarié par son full_name (insensible à la casse, tolérant les espaces).
 *
 * P16E §7.A — RÉSOLUTION D'ENTITÉ NON AMBIGUË : ne JAMAIS choisir le premier match partiel.
 * Avant, « Paul » renvoyait le premier Paul de la liste — sur un chemin d'action gouverné
 * (/api/pierre/use/submit, /workflows/rh), cela agissait sur un salarié DEVINÉ. Désormais :
 *   · match exact UNIQUE ⇒ résolu ;
 *   · plusieurs matches exacts (homonymes) ⇒ null (l'appelant demande une désambiguïsation) ;
 *   · match partiel : résolu UNIQUEMENT s'il désigne un SEUL salarié distinct ; sinon null.
 * Les appelants traitent null comme « non résolu » et n'exécutent aucun effet de bord — Pierre
 * doit demander, jamais deviner. (`findPierreEmployeeById` reste la voie non ambiguë par ID.)
 */
export function findPierreEmployeeByName(
  employees: PierreEmployeeProfile[],
  name: string,
): PierreEmployeeProfile | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;

  const exact = employees.filter((e) => e.full_name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // homonymes exacts ⇒ ambigu ⇒ désambiguïser

  const partial = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(needle) ||
      needle.includes(e.full_name.toLowerCase()),
  );
  const distinct = new Map(partial.map((e) => [e.id, e]));
  if (distinct.size === 1) return partial[0]; // un seul salarié distinct ⇒ résolu
  return null; // 0 ou plusieurs ⇒ jamais de choix par défaut
}

// ══════════════════════════════════════════════════════════
// BUILD CONTEXT
// ══════════════════════════════════════════════════════════

/**
 * Construit un PierreEmployeeContext à partir d'un profil complet.
 * Seuls les champs légers sont inclus — pas de données sensibles dans les payloads.
 */
export function buildPierreEmployeeContext(
  profile: PierreEmployeeProfile,
): PierreEmployeeContext {
  return {
    employee_id: profile.id,
    employee_name: profile.full_name,
    employee_email: profile.email ?? null,
    contract_type: profile.contract_type ?? null,
    department: profile.department ?? null,
    date_entree: profile.date_entree ?? null,
    status: profile.status,
  };
}

/**
 * Tente de résoudre un PierreEmployeeContext à partir d'une entrée libre.
 * Cherche par id d'abord, puis par nom.
 * Retourne null si aucun profil trouvé ou si les données d'entrée sont insuffisantes.
 */
export function resolveEmployeeContext(
  employees: PierreEmployeeProfile[],
  input: { employee_id?: string | null; employee_name?: string | null },
): PierreEmployeeContext | null {
  if (!employees.length) return null;

  if (input.employee_id) {
    const byId = findPierreEmployeeById(employees, input.employee_id);
    if (byId) return buildPierreEmployeeContext(byId);
  }

  if (input.employee_name) {
    const byName = findPierreEmployeeByName(employees, input.employee_name);
    if (byName) return buildPierreEmployeeContext(byName);
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// REGISTRY — upsert / update / delete (applicatifs, sans DB)
// ══════════════════════════════════════════════════════════

/**
 * Upsert applicatif : insère ou remplace l'employé par son id (case-insensitive).
 * - Limite le tableau à 200 profils.
 * - Immutable : retourne de nouveaux tableaux, ne mute pas l'entrée.
 */
export function upsertPierreEmployeeProfile(
  employees: PierreEmployeeProfile[],
  profile: PierreEmployeeProfile,
): { employees: PierreEmployeeProfile[]; mode: "created" | "updated" } {
  const needle = profile.id.toLowerCase();
  const idx = employees.findIndex((e) => e.id.toLowerCase() === needle);

  if (idx === -1) {
    const next = [...employees, profile].slice(0, 200);
    return { employees: next, mode: "created" };
  }

  const next = [...employees];
  next[idx] = profile;
  return { employees: next, mode: "updated" };
}

/**
 * Patch partiel : merge uniquement les champs fournis sur l'employé existant.
 * - Retourne employee: null si l'id est introuvable ou si le résultat est invalide.
 * - Immutable.
 */
export function updatePierreEmployeeProfile(
  employees: PierreEmployeeProfile[],
  id: string,
  patch: Record<string, unknown>,
): { employees: PierreEmployeeProfile[]; employee: PierreEmployeeProfile | null } {
  const needle = id.trim().toLowerCase();
  const idx = employees.findIndex((e) => e.id.toLowerCase() === needle);

  if (idx === -1) return { employees, employee: null };

  const existing = employees[idx];
  const merged = sanitizePierreEmployeeProfile({ ...existing, ...patch });

  if (!merged) return { employees, employee: null };

  const next = [...employees];
  next[idx] = merged;
  return { employees: next, employee: merged };
}

/**
 * Suppression par id (case-insensitive).
 * - deleted: true si un profil a été retiré, false si introuvable.
 * - Immutable.
 */
export function deletePierreEmployeeProfile(
  employees: PierreEmployeeProfile[],
  id: string,
): { employees: PierreEmployeeProfile[]; deleted: boolean } {
  const needle = id.trim().toLowerCase();
  const next = employees.filter((e) => e.id.toLowerCase() !== needle);
  return {
    employees: next,
    deleted: next.length < employees.length,
  };
}

// ══════════════════════════════════════════════════════════
// PAYLOAD ENRICHMENT
// ══════════════════════════════════════════════════════════

/**
 * Injecte le contexte salarié dans un payload de tâche existant.
 * Ne modifie pas le payload si context est null.
 * Retourne toujours un nouvel objet (immutable).
 */
export function enrichPayloadWithEmployeeContext(
  payload: Record<string, unknown>,
  context: PierreEmployeeContext | null,
): Record<string, unknown> {
  if (!context) return payload;
  return {
    ...payload,
    employee_id: context.employee_id,
    employee_name: context.employee_name,
    employee_context: context,
  };
}

// ══════════════════════════════════════════════════════════
// TEXT DETECTION
// ══════════════════════════════════════════════════════════

/**
 * Scans free text for a known employee full_name.
 * Priority: exact substring match first, then all name tokens found.
 * Pure function — no DB access, no side effects.
 */
export function detectEmployeeReferenceFromText(
  input: string,
  employees: PierreEmployeeProfile[],
): PierreEmployeeProfile | null {
  if (!input.trim() || !employees.length) return null;

  const haystack = input.toLowerCase().replace(/\s+/g, " ");

  function wordBoundary(text: string, start: number, end: number): boolean {
    const before = start > 0 ? text[start - 1] : " ";
    const after = end < text.length ? text[end] : " ";
    return /[^a-z0-9]/i.test(before) && /[^a-z0-9]/i.test(after);
  }

  // Priority 1: full_name exact substring with word boundaries
  for (const e of employees) {
    const name = e.full_name.toLowerCase();
    const idx = haystack.indexOf(name);
    if (idx !== -1 && wordBoundary(haystack, idx, idx + name.length)) return e;
  }

  // Priority 2: all name tokens found with word boundaries
  for (const e of employees) {
    const tokens = e.full_name
      .toLowerCase()
      .split(/[\s'-]+/)
      .filter((t) => t.length >= 2);
    if (tokens.length === 0) continue;
    const allFound = tokens.every((t) => {
      const idx = haystack.indexOf(t);
      return idx !== -1 && wordBoundary(haystack, idx, idx + t.length);
    });
    if (allFound) return e;
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// 360 SUMMARY
// ══════════════════════════════════════════════════════════

export type Employee360Summary = {
  employee_name: string;
  employee_status: PierreEmployeeStatus;
  contract_type: PierreContractType | null;
  department: string | null;
  total_missions: number;
  total_tasks: number;
  total_documents: number;
  total_logs: number;
  tasks_by_status: Record<string, number>;
  tasks_pending_approval: number;
  pending_approval_count: number;
  blocked_count: number;
  scheduled_count: number;
  last_mission_at: string | null;
  last_task_at: string | null;
  last_document_at: string | null;
  last_activity_at: string | null;
  completed_or_done_count: number;
  last_log_at: string | null;
};

/**
 * Builds a typed 360° summary from employee + mission/task/document/log arrays.
 * Purely functional — no DB access.
 * Arrays must be sorted desc by created_at (first item = most recent).
 */
export function buildEmployee360Summary(
  employee: PierreEmployeeProfile,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  documents: Record<string, unknown>[],
  logs?: Record<string, unknown>[],
): Employee360Summary {
  const tasksByStatus = tasks.reduce<Record<string, number>>((acc, t) => {
    const s = (typeof t.status === "string" ? t.status.trim() : null) ?? "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const pendingApproval = tasks.filter(
    (t) => t.approval_required === true && t.status === "awaiting_approval",
  ).length;

  const blockedCount = tasks.filter((t) => t.status === "blocked").length;
  const scheduledCount = tasks.filter((t) => t.status === "scheduled").length;
  const completedOrDoneCount = tasks.filter(
    (t) => t.status === "done" || t.status === "completed",
  ).length;

  const getAt = (row: Record<string, unknown>): string | null =>
    typeof row.created_at === "string" ? row.created_at : null;

  const lastMissionAt = missions[0] ? getAt(missions[0]) : null;
  const lastTaskAt = tasks[0] ? getAt(tasks[0]) : null;
  const lastDocAt = documents[0] ? getAt(documents[0]) : null;

  const activityDates = [lastMissionAt, lastTaskAt, lastDocAt].filter(
    (d): d is string => d !== null,
  );
  const lastActivityAt =
    activityDates.length > 0
      ? activityDates.reduce((latest, d) => (d > latest ? d : latest))
      : null;

  const lastLogAt = logs?.[0] ? getAt(logs[0]) : null;

  return {
    employee_name: employee.full_name,
    employee_status: employee.status,
    contract_type: employee.contract_type ?? null,
    department: employee.department ?? null,
    total_missions: missions.length,
    total_tasks: tasks.length,
    total_documents: documents.length,
    total_logs: logs?.length ?? 0,
    tasks_by_status: tasksByStatus,
    tasks_pending_approval: pendingApproval,
    pending_approval_count: pendingApproval,
    blocked_count: blockedCount,
    scheduled_count: scheduledCount,
    last_mission_at: lastMissionAt,
    last_task_at: lastTaskAt,
    last_document_at: lastDocAt,
    last_activity_at: lastActivityAt,
    completed_or_done_count: completedOrDoneCount,
    last_log_at: lastLogAt,
  };
}

// ══════════════════════════════════════════════════════════
// TIMELINE
// ══════════════════════════════════════════════════════════

export type EmployeeTimelineItem = {
  type: "mission" | "task" | "document" | "log";
  id: string;
  mission_id: string | null;
  task_id: string | null;
  title: string | null;
  status: string | null;
  created_at: string | null;
  source_table: string;
};

/**
 * Normalizes an activity date value: returns the ISO string if valid, null otherwise.
 */
export function normalizeEmployeeActivityDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : trimmed;
}

/**
 * Merges missions, tasks, documents, and logs into a chronological timeline (desc).
 * Pure function — no DB access.
 */
export function buildEmployeeTimeline(params: {
  missions: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  logs: Record<string, unknown>[];
}): EmployeeTimelineItem[] {
  const { missions, tasks, documents, logs } = params;

  const items: EmployeeTimelineItem[] = [
    ...missions.map((m) => ({
      type: "mission" as const,
      id: safeString(m.id, 128) ?? "",
      mission_id: safeString(m.id, 128),
      task_id: null,
      title: safeString(m.mission_summary, 500) ?? safeString(m.raw_input, 500) ?? null,
      status: safeString(m.status, 100),
      created_at: safeString(m.created_at, 64),
      source_table: "pierre_missions",
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: safeString(t.id, 128) ?? "",
      mission_id: safeString(t.mission_id, 128),
      task_id: safeString(t.id, 128),
      title: safeString(t.title, 500),
      status: safeString(t.status, 100),
      created_at: safeString(t.created_at, 64),
      source_table: "pierre_tasks",
    })),
    ...documents.map((d) => ({
      type: "document" as const,
      id: safeString(d.id, 128) ?? "",
      mission_id: safeString(d.mission_id, 128),
      task_id: safeString(d.task_id, 128),
      title: safeString(d.title, 500),
      status: null,
      created_at: safeString(d.created_at, 64),
      source_table: "pierre_documents",
    })),
    ...logs.map((l) => ({
      type: "log" as const,
      id: safeString(l.id, 128) ?? "",
      mission_id: safeString(l.mission_id, 128),
      task_id: safeString(l.task_id, 128),
      title: safeString(l.message, 500),
      status: null,
      created_at: safeString(l.created_at, 64),
      source_table: "pierre_task_logs",
    })),
  ];

  return items
    .filter((item) => item.id)
    .sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
}

// ══════════════════════════════════════════════════════════
// INSIGHTS
// ══════════════════════════════════════════════════════════

export type EmployeeInsights = {
  has_pending_approvals: boolean;
  has_blocked_items: boolean;
  has_scheduled_followups: boolean;
  needs_attention: boolean;
  latest_activity_label: string | null;
  recommended_next_action: string | null;
};

/**
 * Builds a server-computed insights object from summary + timeline.
 * Pure function — no AI, no DB.
 * Optional `now` parameter for testability (defaults to new Date()).
 */
export function buildEmployeeInsights(
  summary: Employee360Summary,
  _timeline: EmployeeTimelineItem[],
  now?: Date,
): EmployeeInsights {
  const hasPendingApprovals = summary.pending_approval_count > 0;
  const hasBlockedItems = summary.blocked_count > 0;
  const hasScheduledFollowups = summary.scheduled_count > 0;
  const needsAttention = hasPendingApprovals || hasBlockedItems;

  let latestActivityLabel: string | null = null;
  if (summary.last_activity_at) {
    const ref = (now ?? new Date()).getTime();
    const activityMs = new Date(summary.last_activity_at).getTime();
    if (!isNaN(activityMs)) {
      const diffDays = Math.floor((ref - activityMs) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) latestActivityLabel = "Aujourd'hui";
      else if (diffDays === 1) latestActivityLabel = "Hier";
      else if (diffDays < 7) latestActivityLabel = `Il y a ${diffDays} jours`;
      else if (diffDays < 30) latestActivityLabel = `Il y a ${Math.floor(diffDays / 7)} semaine(s)`;
      else latestActivityLabel = `Il y a ${Math.floor(diffDays / 30)} mois`;
    }
  }

  let recommendedNextAction: string | null = null;
  if (hasPendingApprovals) {
    recommendedNextAction = "Valider les tâches en attente d'approbation";
  } else if (hasBlockedItems) {
    recommendedNextAction = "Débloquer les tâches bloquées";
  } else if (hasScheduledFollowups) {
    recommendedNextAction = "Vérifier les relances planifiées";
  } else if (summary.total_tasks > 0 && summary.completed_or_done_count === summary.total_tasks) {
    recommendedNextAction = "Toutes les tâches sont terminées";
  } else if (summary.total_tasks === 0) {
    recommendedNextAction = "Créer une première mission pour ce salarié";
  }

  return {
    has_pending_approvals: hasPendingApprovals,
    has_blocked_items: hasBlockedItems,
    has_scheduled_followups: hasScheduledFollowups,
    needs_attention: needsAttention,
    latest_activity_label: latestActivityLabel,
    recommended_next_action: recommendedNextAction,
  };
}
