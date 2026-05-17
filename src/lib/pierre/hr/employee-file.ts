// ═══════════════════════════════════════════════════════════
// Pierre HR Engine — Employee File 360 / Dossier Salarié
// Module pur : pas de Supabase, pas de Next, pas d'async
// ═══════════════════════════════════════════════════════════

// ── Helpers internes ──────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function lower(s: string): string {
  return s.toLowerCase();
}

function normalizeNameStr(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asNestedObject(v: unknown): Record<string, unknown> | null {
  return isObject(v) ? v : null;
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function collectRowText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  const directFields = [
    "title", "mission_summary", "message", "text_content", "html_content",
    "description", "subject", "raw_input", "intent", "doc_type", "employee_name", "type",
  ];
  for (const field of directFields) {
    const val = asStr(row[field]);
    if (val) parts.push(val);
  }
  const nestedFields = [
    "payload_json", "brain_output_json", "context_snapshot_json", "meta_json", "employee_context",
  ];
  for (const field of nestedFields) {
    const nested = asNestedObject(row[field]);
    if (!nested) continue;
    for (const key of [
      "title", "summary", "description", "instructions", "context",
      "message", "type", "domain", "intent", "text_content", "html_content",
    ]) {
      const val = asStr(nested[key]);
      if (val) parts.push(val);
    }
  }
  return parts.join(" ");
}

// ── Types exportés ────────────────────────────────────────

export type PierreEmployeeFileStatus =
  | "complete"
  | "incomplete"
  | "attention_required"
  | "sensitive";

export type PierreEmployeeFileRiskLevel =
  | "green"
  | "orange"
  | "red"
  | "black";

export type PierreEmployeeFileSectionKey =
  | "profile"
  | "missions"
  | "tasks"
  | "documents"
  | "logs"
  | "missing_info"
  | "risks"
  | "next_actions"
  | "timeline";

export type PierreEmployeeTimelineEventType =
  | "mission_created"
  | "task_created"
  | "task_completed"
  | "task_blocked"
  | "approval_required"
  | "document_generated"
  | "email_prepared"
  | "absence"
  | "contract"
  | "onboarding"
  | "offboarding"
  | "training"
  | "interview"
  | "note"
  | "unknown";

export type PierreEmployeeFileProfile = {
  employee_id: string;
  employee_name: string;
  normalized_name: string;
  email: string | null;
  role: string | null;
  department: string | null;
  site: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  raw: Record<string, unknown>;
};

export type PierreEmployeeIdentity = {
  employee_id: string;
  employee_name: string;
  normalized_name: string;
  email: string | null;
};

export type PierreEmployeeFileMission = {
  id: string;
  status: string;
  summary: string;
  intent: string | null;
  risk_level: string | null;
  approval_required: boolean;
  created_at: string | null;
  updated_at: string | null;
  raw: Record<string, unknown>;
};

export type PierreEmployeeFileTask = {
  id: string;
  mission_id: string | null;
  type: string;
  title: string;
  status: string;
  approval_required: boolean;
  execute_at: string | null;
  risk_level: string | null;
  created_at: string | null;
  updated_at: string | null;
  raw: Record<string, unknown>;
};

export type PierreEmployeeFileDocument = {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  title: string;
  doc_type: string | null;
  created_at: string | null;
  raw: Record<string, unknown>;
};

export type PierreEmployeeFileLog = {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  event_type: string | null;
  message: string | null;
  created_at: string | null;
  raw: Record<string, unknown>;
};

export type PierreEmployeeTimelineEvent = {
  id: string;
  source_id: string;
  source_type: "mission" | "task" | "document" | "log";
  event_type: PierreEmployeeTimelineEventType;
  title: string;
  description: string | null;
  date: string | null;
  risk_level: PierreEmployeeFileRiskLevel;
};

export type PierreEmployeeFileMissingInfo = {
  field: string;
  label: string;
  required: boolean;
  reason: string;
};

export type PierreEmployeeFileRisk = {
  level: PierreEmployeeFileRiskLevel;
  code: string;
  label: string;
  reason: string;
  source_type: "profile" | "mission" | "task" | "document" | "log";
  source_id: string | null;
};

export type PierreEmployeeFileNextAction = {
  type:
    | "complete_profile"
    | "request_documents"
    | "resolve_blocked_task"
    | "approve_sensitive_task"
    | "investigate_error"
    | "generate_summary"
    | "prepare_followup"
    | "no_action";
  label: string;
  priority: "low" | "normal" | "high" | "urgent";
  task_id?: string | null;
  mission_id?: string | null;
};

export type PierreEmployeeFileHealth = {
  score: number;
  label: string;
};

export type PierreEmployeeFileSection = {
  key: PierreEmployeeFileSectionKey;
  label: string;
  count: number;
};

export type PierreEmployeeFileDigest = {
  tone: "action" | "waiting" | "blocked" | "complete" | "sensitive";
  text: string;
};

export type PierreEmployeeFile360 = {
  profile: PierreEmployeeFileProfile;
  status: PierreEmployeeFileStatus;
  risk_level: PierreEmployeeFileRiskLevel;
  health: PierreEmployeeFileHealth;
  missions: PierreEmployeeFileMission[];
  tasks: PierreEmployeeFileTask[];
  documents: PierreEmployeeFileDocument[];
  logs: PierreEmployeeFileLog[];
  timeline: PierreEmployeeTimelineEvent[];
  missing_info: PierreEmployeeFileMissingInfo[];
  risks: PierreEmployeeFileRisk[];
  next_actions: PierreEmployeeFileNextAction[];
  sections: PierreEmployeeFileSection[];
  digest: PierreEmployeeFileDigest;
};

export type PierreEmployeeFileSnapshot = {
  employee_id: string;
  employee_name: string;
  status: PierreEmployeeFileStatus;
  health_score: number;
  risk_level: PierreEmployeeFileRiskLevel;
  missing_info_count: number;
  open_tasks_count: number;
  pending_approval_count: number;
  latest_event_at: string | null;
  digest_text: string;
};

export type PierreEmployeeFileIndex = {
  files: Array<{
    profile: PierreEmployeeFileProfile;
    status: PierreEmployeeFileStatus;
    health: PierreEmployeeFileHealth;
    risk_level: PierreEmployeeFileRiskLevel;
    missing_info_count: number;
    open_tasks_count: number;
    pending_approval_count: number;
    next_action_count: number;
    digest: PierreEmployeeFileDigest;
    latest_event_at: string | null;
  }>;
  totals: {
    employees: number;
    complete: number;
    incomplete: number;
    attention_required: number;
    sensitive: number;
  };
  attention_required: PierreEmployeeFileSnapshot[];
  sensitive: PierreEmployeeFileSnapshot[];
  incomplete: PierreEmployeeFileSnapshot[];
};

// ── Constantes internes ───────────────────────────────────

const SECTION_LABELS: Record<PierreEmployeeFileSectionKey, string> = {
  profile: "Profil salarié",
  missions: "Missions",
  tasks: "Tâches",
  documents: "Documents",
  logs: "Historique",
  missing_info: "Informations manquantes",
  risks: "Risques identifiés",
  next_actions: "Prochaines actions",
  timeline: "Chronologie",
};

const SECTION_ORDER: PierreEmployeeFileSectionKey[] = [
  "profile", "missions", "tasks", "documents", "logs",
  "missing_info", "risks", "next_actions", "timeline",
];

type RiskSignalDef = {
  level: PierreEmployeeFileRiskLevel;
  code: string;
  label: string;
  keywords: string[];
};

const RISK_SIGNAL_DEFS: RiskSignalDef[] = [
  {
    level: "black",
    code: "harcelement",
    label: "Harcèlement signalé",
    keywords: [
      "harcelement", "harcele", "harcelée", "harcèlement",
      "harcelé", "harcelée",
    ],
  },
  {
    level: "black",
    code: "procedure_disciplinaire",
    label: "Procédure disciplinaire",
    keywords: [
      "procedure disciplinaire", "mesure disciplinaire",
      "faute grave", "faute lourde",
      "mise a pied disciplinaire", "mise a pied",
      "avertissement disciplinaire",
    ],
  },
  {
    level: "black",
    code: "litige_prud",
    label: "Contentieux prud'hommal",
    keywords: [
      "prudhommes", "prud hommes",
      "conseil de prud", "contentieux social",
      "action en justice", "plainte penale", "plainte pénale",
      "tribunal administratif",
    ],
  },
  {
    level: "black",
    code: "discrimination",
    label: "Discrimination signalée",
    keywords: [
      "discrimination", "discriminatoire",
      "egalite professionnelle", "inégalité de traitement",
    ],
  },
  {
    level: "black",
    code: "violence",
    label: "Violence ou agression",
    keywords: [
      "agression", "violence physique", "violence au travail",
      "accident grave", "accident mortel",
      "atteinte a la dignite", "atteinte à la dignité",
    ],
  },
  {
    level: "red",
    code: "licenciement",
    label: "Procédure de licenciement",
    keywords: [
      "licenciement", "licencie", "licencié", "licenciée",
      "mise en demeure",
    ],
  },
  {
    level: "red",
    code: "rupture",
    label: "Rupture de contrat",
    keywords: [
      "rupture conventionnelle", "fin de contrat",
      "resiliation", "résiliation",
      "contrat resilie", "inaptitude",
    ],
  },
  {
    level: "red",
    code: "paie_critique",
    label: "Problème de paie critique",
    keywords: [
      "salaire bloque", "salaire bloqué",
      "paie incorrecte", "erreur de paie",
      "contentieux paie",
    ],
  },
  {
    level: "red",
    code: "offboarding",
    label: "Départ du salarié",
    keywords: [
      "offboarding", "depart definitif", "départ définitif",
      "fin de mission definitive",
    ],
  },
  {
    level: "red",
    code: "tache_erreur",
    label: "Tâche en erreur critique",
    keywords: [
      "erreur critique", "task error",
      "tache en erreur", "tâche en erreur",
    ],
  },
  {
    level: "orange",
    code: "bloquage",
    label: "Tâche ou dossier bloqué",
    keywords: ["bloque", "bloqué", "blocked", "blocage", "bloquée"],
  },
  {
    level: "orange",
    code: "absence",
    label: "Absence signalée",
    keywords: [
      "absence", "absent", "absente",
      "arret maladie", "arrêt maladie",
      "congé maladie",
    ],
  },
  {
    level: "orange",
    code: "onboarding_incomplet",
    label: "Onboarding incomplet",
    keywords: [
      "onboarding incomplet", "accueil incomplet",
      "integration incomplete", "intégration incomplète",
    ],
  },
  {
    level: "orange",
    code: "info_manquante",
    label: "Information manquante",
    keywords: [
      "information manquante", "infos manquantes",
      "document manquant", "document absent",
      "donnée manquante",
    ],
  },
];

// ── Normalisation interne des rows DB ─────────────────────

function normalizeMission(row: Record<string, unknown>): PierreEmployeeFileMission {
  const brain = asNestedObject(row.brain_output_json) ?? {};
  return {
    id: asStr(row.id) ?? `m_${simpleHash((asStr(row.mission_summary) ?? "") + (asStr(row.intent) ?? "") + (asStr(row.created_at) ?? ""))}`,
    status: asStr(row.status) ?? "unknown",
    summary: asStr(row.mission_summary) ?? asStr(brain.title) ?? "Mission sans résumé",
    intent: asStr(row.intent) ?? asStr(brain.workflow_domain) ?? null,
    risk_level: asStr(row.risk_level) ?? null,
    approval_required: row.approval_required === true,
    created_at: asStr(row.created_at) ?? null,
    updated_at: asStr(row.updated_at) ?? null,
    raw: row,
  };
}

function normalizeTask(row: Record<string, unknown>): PierreEmployeeFileTask {
  return {
    id: asStr(row.id) ?? `t_${simpleHash((asStr(row.title) ?? "") + (asStr(row.type) ?? "") + (asStr(row.created_at) ?? ""))}`,
    mission_id: asStr(row.mission_id) ?? null,
    type: asStr(row.type) ?? "unknown",
    title: asStr(row.title) ?? "Tâche sans titre",
    status: asStr(row.status) ?? "unknown",
    approval_required: row.approval_required === true,
    execute_at: asStr(row.execute_at) ?? null,
    risk_level: asStr(row.risk_level) ?? null,
    created_at: asStr(row.created_at) ?? null,
    updated_at: asStr(row.updated_at) ?? null,
    raw: row,
  };
}

function normalizeDocument(row: Record<string, unknown>): PierreEmployeeFileDocument {
  return {
    id: asStr(row.id) ?? `d_${simpleHash((asStr(row.title) ?? "") + (asStr(row.doc_type) ?? "") + (asStr(row.created_at) ?? ""))}`,
    mission_id: asStr(row.mission_id) ?? null,
    task_id: asStr(row.task_id) ?? null,
    title: asStr(row.title) ?? asStr(row.doc_type) ?? "Document sans titre",
    doc_type: asStr(row.doc_type) ?? null,
    created_at: asStr(row.created_at) ?? null,
    raw: row,
  };
}

function normalizeLog(row: Record<string, unknown>): PierreEmployeeFileLog {
  return {
    id: asStr(row.id) ?? `l_${simpleHash((asStr(row.message) ?? "") + (asStr(row.event_type) ?? "") + (asStr(row.created_at) ?? ""))}`,
    mission_id: asStr(row.mission_id) ?? null,
    task_id: asStr(row.task_id) ?? null,
    event_type: asStr(row.event_type) ?? null,
    message: asStr(row.message) ?? null,
    created_at: asStr(row.created_at) ?? null,
    raw: row,
  };
}

// ── Fonctions exportées ───────────────────────────────────

/**
 * Transforme un profil salarié brut en profil stable.
 */
export function normalizeEmployeeFileProfile(employee: unknown): PierreEmployeeFileProfile {
  const raw: Record<string, unknown> = isObject(employee) ? employee : {};

  const employee_id =
    asStr(raw.id) ??
    asStr(raw.employee_id) ??
    null;

  const employee_name =
    asStr(raw.full_name) ??
    asStr(raw.name) ??
    asStr(raw.employee_name) ??
    asStr(raw.email) ??
    "Salarié sans nom";

  const normalized_name = normalizeNameStr(employee_name);

  const hashInput = normalized_name + (asStr(raw.email) ?? "");
  const final_id =
    employee_id ??
    `emp_${normalized_name.replace(/\s+/g, "_").slice(0, 32)}_${simpleHash(hashInput)}`;

  const email = asStr(raw.email) ?? null;
  const role = asStr(raw.role) ?? asStr(raw.job_title) ?? null;
  const department = asStr(raw.department) ?? asStr(raw.department_name) ?? null;
  const site = asStr(raw.site) ?? null;
  const status = asStr(raw.status) ?? "unknown";
  const start_date = asStr(raw.start_date) ?? asStr(raw.date_entree) ?? null;
  const end_date = asStr(raw.end_date) ?? asStr(raw.date_sortie) ?? null;

  return {
    employee_id: final_id,
    employee_name,
    normalized_name,
    email,
    role,
    department,
    site,
    status,
    start_date,
    end_date,
    raw,
  };
}

/**
 * Retourne l'identité normalisée et stable d'un salarié.
 */
export function resolveEmployeeIdentity(
  profile: PierreEmployeeFileProfile,
): PierreEmployeeIdentity {
  return {
    employee_id: profile.employee_id,
    employee_name: profile.employee_name,
    normalized_name: profile.normalized_name,
    email: profile.email ? lower(profile.email.trim()) : null,
  };
}

/**
 * Détermine si une ligne DB appartient à un salarié donné.
 * Match fort : employee_id ou email.
 * Match moyen : nom complet (anti faux-positifs intégrés).
 */
export function doesRowBelongToEmployee(
  row: unknown,
  identity: PierreEmployeeIdentity,
): boolean {
  if (!isObject(row)) return false;

  const { employee_id, email, normalized_name } = identity;
  const normLen = normalized_name.trim().length;
  const nameSafe = normLen >= 5;
  const nameHasSpace = normalized_name.includes(" ");

  // ── Match fort : employee_id ──
  if (employee_id && asStr(row.employee_id) === employee_id) return true;

  // Recherche dans les objets imbriqués connus
  const nestedKeys = [
    "employee_context", "payload_json", "brain_output_json",
    "context_snapshot_json", "meta_json",
  ];
  for (const key of nestedKeys) {
    const nested = asNestedObject(row[key]);
    if (!nested) continue;

    if (employee_id && asStr(nested.employee_id) === employee_id) return true;

    const subCtx = asNestedObject(nested.employee_context);
    if (subCtx && employee_id && asStr(subCtx.employee_id) === employee_id) return true;
  }

  // ── Match fort : email ──
  if (email) {
    const directEmail =
      asStr(row.email) ??
      asStr(row.employee_email) ??
      null;
    if (directEmail && lower(directEmail) === email) return true;

    for (const key of nestedKeys) {
      const nested = asNestedObject(row[key]);
      if (!nested) continue;
      const nestedEmail =
        asStr(nested.email) ??
        asStr(nested.employee_email) ??
        null;
      if (nestedEmail && lower(nestedEmail) === email) return true;
    }
  }

  // ── Match moyen : nom complet ──
  // Uniquement si nom suffisamment long ET contient prénom + nom
  if (nameSafe && nameHasSpace) {
    // Champ employee_name direct
    const directName = asStr(row.employee_name);
    if (directName && normalizeNameStr(directName) === normalized_name) return true;

    // Champs imbriqués
    for (const key of nestedKeys) {
      const nested = asNestedObject(row[key]);
      if (!nested) continue;
      const nestedName =
        asStr(nested.employee_name) ??
        asStr(nested.name) ??
        null;
      if (nestedName && normalizeNameStr(nestedName) === normalized_name) return true;
    }

    // Texte libre — seulement si nom >= 8 caractères (réduit faux positifs)
    if (normLen >= 8) {
      for (const key of ["title", "mission_summary", "message", "text_content"]) {
        const text = asStr(row[key]);
        if (!text) continue;
        if (normalizeNameStr(text).includes(normalized_name)) return true;
      }
    }
  }

  return false;
}

export function filterEmployeeMissions(
  identity: PierreEmployeeIdentity,
  missions: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(missions)) return [];
  return missions.filter(
    (m): m is Record<string, unknown> =>
      isObject(m) && doesRowBelongToEmployee(m, identity),
  );
}

export function filterEmployeeTasks(
  identity: PierreEmployeeIdentity,
  tasks: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(
    (t): t is Record<string, unknown> =>
      isObject(t) && doesRowBelongToEmployee(t, identity),
  );
}

export function filterEmployeeDocuments(
  identity: PierreEmployeeIdentity,
  documents: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(documents)) return [];
  return documents.filter(
    (d): d is Record<string, unknown> =>
      isObject(d) && doesRowBelongToEmployee(d, identity),
  );
}

export function filterEmployeeLogs(
  identity: PierreEmployeeIdentity,
  logs: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(logs)) return [];
  return logs.filter(
    (l): l is Record<string, unknown> =>
      isObject(l) && doesRowBelongToEmployee(l, identity),
  );
}

/**
 * Classifie les risques du dossier salarié à partir du contenu brut.
 * Retourne une liste ordonnée (black > red > orange > green).
 */
export function classifyEmployeeFileRisk(
  profile: PierreEmployeeFileProfile,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  documents: Record<string, unknown>[],
  logs: Record<string, unknown>[],
): PierreEmployeeFileRisk[] {
  const risks: PierreEmployeeFileRisk[] = [];
  const seenKeys = new Set<string>();

  function addRisk(risk: PierreEmployeeFileRisk) {
    const key = `${risk.code}:${risk.source_id ?? "profile"}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    risks.push(risk);
  }

  // Détection basée sur les mots-clés dans toutes les sources
  type SourceEntry = {
    source_type: "mission" | "task" | "document" | "log";
    row: Record<string, unknown>;
  };
  const safeMissions = Array.isArray(missions) ? missions : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeDocs = Array.isArray(documents) ? documents : [];
  const safeLogs = Array.isArray(logs) ? logs : [];
  const allItems: SourceEntry[] = [
    ...safeMissions.map((m) => ({ source_type: "mission" as const, row: m })),
    ...safeTasks.map((t) => ({ source_type: "task" as const, row: t })),
    ...safeDocs.map((d) => ({ source_type: "document" as const, row: d })),
    ...safeLogs.map((l) => ({ source_type: "log" as const, row: l })),
  ];

  for (const { source_type, row } of allItems) {
    const sourceId = asStr(row.id) ?? null;
    const rawText = collectRowText(row);
    const textNorm = normalizeNameStr(rawText);

    for (const sig of RISK_SIGNAL_DEFS) {
      if (sig.keywords.some((kw) => textNorm.includes(normalizeNameStr(kw)))) {
        addRisk({
          level: sig.level,
          code: sig.code,
          label: sig.label,
          reason: `Signal détecté dans ${source_type}`,
          source_type,
          source_id: sourceId,
        });
      }
    }
  }

  // Détection basée sur le statut des tâches
  for (const task of safeTasks) {
    const taskId = asStr(task.id) ?? null;
    const status = lower(asStr(task.status) ?? "");

    if (status === "blocked") {
      addRisk({
        level: "orange",
        code: "bloquage",
        label: "Tâche bloquée",
        reason: "Une tâche est bloquée",
        source_type: "task",
        source_id: taskId,
      });
    }
    if (status === "error") {
      addRisk({
        level: "red",
        code: "tache_erreur",
        label: "Tâche en erreur",
        reason: "Une tâche est en erreur",
        source_type: "task",
        source_id: taskId,
      });
    }
    if (task.approval_required === true && status === "awaiting_approval") {
      addRisk({
        level: "orange",
        code: "approbation_requise",
        label: "Approbation requise",
        reason: "Une tâche nécessite une validation humaine",
        source_type: "task",
        source_id: taskId,
      });
    }
  }

  // Détection basée sur le risk_level des missions
  for (const mission of safeMissions) {
    const missionId = asStr(mission.id) ?? null;
    const mRisk = lower(asStr(mission.risk_level) ?? "");
    if (mRisk === "high") {
      addRisk({
        level: "red",
        code: "mission_risque_eleve",
        label: "Mission à risque élevé",
        reason: "Mission classifiée risque élevé",
        source_type: "mission",
        source_id: missionId,
      });
    }
  }

  // Détection basée sur le profil
  if (profile.status === "offboarding") {
    addRisk({
      level: "red",
      code: "offboarding",
      label: "Salarié en départ",
      reason: "Statut salarié : offboarding",
      source_type: "profile",
      source_id: null,
    });
  }
  if (profile.status === "inactive" && !profile.end_date) {
    addRisk({
      level: "orange",
      code: "sortie_non_documentee",
      label: "Sortie non documentée",
      reason: "Salarié inactif sans date de sortie enregistrée",
      source_type: "profile",
      source_id: null,
    });
  }

  // Tri décroissant par niveau
  const ORDER: Record<PierreEmployeeFileRiskLevel, number> = {
    black: 3, red: 2, orange: 1, green: 0,
  };
  risks.sort((a, b) => ORDER[b.level] - ORDER[a.level]);

  return risks;
}

/**
 * Détecte les informations manquantes dans le dossier salarié.
 */
export function detectEmployeeMissingInfo(
  profile: PierreEmployeeFileProfile,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  documents: Record<string, unknown>[],
): PierreEmployeeFileMissingInfo[] {
  const missing: PierreEmployeeFileMissingInfo[] = [];
  const seenFields = new Set<string>();

  function addMissing(info: PierreEmployeeFileMissingInfo) {
    if (seenFields.has(info.field)) return;
    seenFields.add(info.field);
    missing.push(info);
  }

  // Profil de base
  if (!profile.email) {
    addMissing({
      field: "email",
      label: "Adresse email",
      required: true,
      reason: "L'email du salarié est requis pour les communications RH.",
    });
  }
  if (!profile.role) {
    addMissing({
      field: "role",
      label: "Poste / Rôle",
      required: false,
      reason: "Le poste du salarié n'est pas renseigné.",
    });
  }
  if (!profile.department) {
    addMissing({
      field: "department",
      label: "Département",
      required: false,
      reason: "Le département du salarié n'est pas renseigné.",
    });
  }

  // Détection de domaines RH dans les missions
  const safeMissionsDetect = Array.isArray(missions) ? missions : [];
  const safeTasksDetect = Array.isArray(tasks) ? tasks : [];
  const safeDocsDetect = Array.isArray(documents) ? documents : [];
  const allMissionText = safeMissionsDetect
    .map((m) => collectRowText(m))
    .join(" ")
    .toLowerCase();

  const hasOnboarding =
    /onboarding|embauche|accueil|arrivée|intégration/.test(allMissionText);
  const hasOffboarding =
    /offboarding|départ|sortie|fin de contrat|fin du contrat/.test(allMissionText);
  const hasAbsence =
    /absence|absent|congé|arrêt maladie/.test(allMissionText);
  const hasContract =
    /contrat|avenant|signature/.test(allMissionText);
  const hasSensitive =
    /sensible|disciplin|licenciem|harcel/.test(allMissionText);

  if (hasOnboarding && !profile.start_date) {
    addMissing({
      field: "start_date",
      label: "Date d'arrivée",
      required: true,
      reason: "Mission onboarding détectée mais date d'arrivée non renseignée.",
    });
  }

  if (hasOffboarding && !profile.end_date) {
    addMissing({
      field: "end_date",
      label: "Date de départ",
      required: false,
      reason: "Mission de départ détectée mais date de sortie non renseignée.",
    });
  }

  if (hasAbsence) {
    const absenceTexts = allMissionText;
    if (!/justificatif|date (d|de) retour|durée/.test(absenceTexts)) {
      addMissing({
        field: "absence_details",
        label: "Détails absence",
        required: false,
        reason: "Mission d'absence sans justificatif ou durée renseignée.",
      });
    }
  }

  if (hasContract && safeDocsDetect.length === 0) {
    addMissing({
      field: "contract_documents",
      label: "Documents contractuels",
      required: true,
      reason: "Mission contractuelle détectée mais aucun document généré.",
    });
  }

  if (hasOffboarding) {
    const hasExitDoc = safeDocsDetect.some((d) => {
      const dt = lower(asStr(d.doc_type) ?? asStr(d.title) ?? "");
      return /depart|sortie|offboarding|attestation/.test(dt);
    });
    if (!hasExitDoc) {
      addMissing({
        field: "exit_document",
        label: "Document de départ",
        required: false,
        reason: "Aucun document de départ généré pour ce salarié.",
      });
    }
  }

  if (hasSensitive) {
    const hasPendingApproval = safeTasksDetect.some(
      (t) => t.approval_required === true && asStr(t.status) === "awaiting_approval",
    );
    if (hasPendingApproval) {
      addMissing({
        field: "human_validation",
        label: "Validation humaine",
        required: true,
        reason: "Dossier sensible avec tâche en attente d'approbation humaine.",
      });
    }
  }

  return missing;
}

// ── Inférence des event_type de la timeline ───────────────

function inferTimelineEventType(
  sourceType: "mission" | "task" | "document" | "log",
  row: Record<string, unknown>,
): PierreEmployeeTimelineEventType {
  const text = lower(collectRowText(row));
  const status = lower(asStr(row.status) ?? "");
  const type = lower(asStr(row.type) ?? "");
  const eventType = lower(asStr(row.event_type) ?? "");

  if (sourceType === "document") return "document_generated";

  if (sourceType === "log") {
    if (eventType.includes("email")) return "email_prepared";
    if (eventType.includes("task_completed") || eventType.includes("execution_completed"))
      return "task_completed";
    if (eventType.includes("task_created")) return "task_created";
    if (eventType.includes("mission_created")) return "mission_created";
    if (eventType.includes("approval")) return "approval_required";
    if (eventType.includes("blocked")) return "task_blocked";
    return "note";
  }

  if (sourceType === "task") {
    if (type.includes("email")) return "email_prepared";
    if (status === "done" || status === "completed") return "task_completed";
    if (status === "blocked") return "task_blocked";
    if (status === "awaiting_approval") return "approval_required";
    if (/onboarding|accueil/.test(text)) return "onboarding";
    if (/offboarding|départ|sortie/.test(text)) return "offboarding";
    if (/formation|training/.test(text)) return "training";
    if (/entretien|interview/.test(text)) return "interview";
    if (/absence|congé|arrêt/.test(text)) return "absence";
    if (/contrat|avenant/.test(text)) return "contract";
    return "task_created";
  }

  if (sourceType === "mission") {
    if (/onboarding|accueil|intégration/.test(text)) return "onboarding";
    if (/offboarding|départ/.test(text)) return "offboarding";
    if (/absence|congé|arrêt/.test(text)) return "absence";
    if (/contrat|avenant/.test(text)) return "contract";
    if (/formation/.test(text)) return "training";
    if (/entretien/.test(text)) return "interview";
    return "mission_created";
  }

  return "unknown";
}

function inferTimelineRisk(
  sourceType: "mission" | "task" | "document" | "log",
  row: Record<string, unknown>,
): PierreEmployeeFileRiskLevel {
  const text = lower(collectRowText(row));
  const status = lower(asStr(row.status) ?? "");
  const mRisk = lower(asStr(row.risk_level) ?? "");

  if (
    /harcelement|faute grave|faute lourde|prudhommes|agression|discrimination/.test(text)
  )
    return "black";
  if (
    /licenciement|rupture conventionnelle|fin de contrat|inaptitude/.test(text) ||
    mRisk === "high" ||
    status === "error"
  )
    return "red";
  if (/bloque|bloqué|absent|absence|onboarding incomplet/.test(text) || status === "blocked")
    return "orange";
  return "green";
}

/**
 * Fusionne missions, tâches, documents et logs en une timeline chronologique.
 */
export function buildEmployeeTimeline(
  profile: PierreEmployeeFileProfile,
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  documents: Record<string, unknown>[],
  logs: Record<string, unknown>[],
): PierreEmployeeTimelineEvent[] {
  const events: PierreEmployeeTimelineEvent[] = [];
  let counter = 0;
  const seenEventIds = new Set<string>();

  function addEvent(
    sourceType: "mission" | "task" | "document" | "log",
    row: Record<string, unknown>,
  ) {
    const sourceId = asStr(row.id) ?? String(++counter);
    const eventId = `${sourceType}:${sourceId}`;
    if (seenEventIds.has(eventId)) return;
    seenEventIds.add(eventId);
    const date = asStr(row.created_at) ?? null;
    const eventType = inferTimelineEventType(sourceType, row);
    const riskLevel = inferTimelineRisk(sourceType, row);

    let title = "";
    let description: string | null = null;

    switch (sourceType) {
      case "mission":
        title =
          asStr(row.mission_summary) ??
          asStr(asNestedObject(row.brain_output_json)?.title) ??
          "Mission";
        description = asStr(row.intent) ?? null;
        break;
      case "task":
        title = asStr(row.title) ?? asStr(row.type) ?? "Tâche";
        description = asStr(row.status) ?? null;
        break;
      case "document":
        title = asStr(row.title) ?? asStr(row.doc_type) ?? "Document";
        description = asStr(row.doc_type) ?? null;
        break;
      case "log":
        title = asStr(row.message) ?? asStr(row.event_type) ?? "Événement";
        description = asStr(row.event_type) ?? null;
        break;
    }

    events.push({
      id: eventId,
      source_id: sourceId,
      source_type: sourceType,
      event_type: eventType,
      title: title || "Événement",
      description,
      date,
      risk_level: riskLevel,
    });
  }

  for (const m of missions) { if (isObject(m)) addEvent("mission", m); }
  for (const t of tasks) { if (isObject(t)) addEvent("task", t); }
  for (const d of documents) { if (isObject(d)) addEvent("document", d); }
  for (const l of logs) { if (isObject(l)) addEvent("log", l); }

  // Tri décroissant par date, null à la fin
  events.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return isNaN(da) || isNaN(db) ? 0 : db - da;
  });

  void profile; // Le profil est disponible pour extension future
  return events;
}

// ── Types internes pour les fonctions d'analyse ───────────

type EFPartial = {
  profile: PierreEmployeeFileProfile;
  missions: PierreEmployeeFileMission[];
  tasks: PierreEmployeeFileTask[];
  documents: PierreEmployeeFileDocument[];
  logs: PierreEmployeeFileLog[];
  risks: PierreEmployeeFileRisk[];
  missing_info: PierreEmployeeFileMissingInfo[];
  timeline: PierreEmployeeTimelineEvent[];
  next_actions?: PierreEmployeeFileNextAction[];
  health?: PierreEmployeeFileHealth;
};

/**
 * Construit les sections du dossier avec leurs compteurs.
 */
export function buildEmployeeFileSections(
  file: EFPartial & { next_actions: PierreEmployeeFileNextAction[] },
): PierreEmployeeFileSection[] {
  const counts: Record<PierreEmployeeFileSectionKey, number> = {
    profile: 1,
    missions: file.missions.length,
    tasks: file.tasks.length,
    documents: file.documents.length,
    logs: file.logs.length,
    missing_info: file.missing_info.length,
    risks: file.risks.length,
    next_actions: file.next_actions.filter((a) => a.type !== "no_action").length,
    timeline: file.timeline.length,
  };

  return SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    count: counts[key],
  }));
}

/**
 * Calcule le score de santé du dossier (0–100).
 */
export function scoreEmployeeFileHealth(fileLike: {
  tasks: PierreEmployeeFileTask[];
  risks: PierreEmployeeFileRisk[];
  missing_info: PierreEmployeeFileMissingInfo[];
  documents: PierreEmployeeFileDocument[];
}): PierreEmployeeFileHealth {
  let score = 100;

  for (const risk of fileLike.risks) {
    if (risk.level === "black") score -= 30;
    else if (risk.level === "red") score -= 15;
  }

  for (const info of fileLike.missing_info) {
    score -= info.required ? 8 : 3;
  }

  for (const task of fileLike.tasks) {
    const st = lower(task.status);
    if (st === "blocked") score -= 5;
    else if (st === "error") score -= 5;
    else if (st === "awaiting_approval") score -= 3;
  }

  if (fileLike.documents.length > 0) score += 5;

  score = Math.max(0, Math.min(100, score));

  let label: string;
  if (score >= 90) label = "Dossier complet et sain";
  else if (score >= 70) label = "Dossier globalement sain, quelques actions requises";
  else if (score >= 50) label = "Dossier à surveiller";
  else if (score >= 25) label = "Dossier RH sensible";
  else label = "Dossier critique — intervention humaine requise";

  return { score, label };
}

/**
 * Génère les prochaines actions recommandées pour le dossier.
 */
export function buildEmployeeNextActions(fileLike: {
  tasks: PierreEmployeeFileTask[];
  risks: PierreEmployeeFileRisk[];
  missing_info: PierreEmployeeFileMissingInfo[];
  missions: PierreEmployeeFileMission[];
}): PierreEmployeeFileNextAction[] {
  const actions: PierreEmployeeFileNextAction[] = [];

  const hasBlack = fileLike.risks.some((r) => r.level === "black");
  const hasRed = fileLike.risks.some((r) => r.level === "red");
  const hasOrange = fileLike.risks.some((r) => r.level === "orange");

  // Cas sensible — validation humaine prioritaire
  if (hasBlack) {
    actions.push({
      type: "approve_sensitive_task",
      label: "Cas sensible RH — validation humaine immédiate requise",
      priority: "urgent",
    });
    return actions; // Aucune autre action dans un cas noir
  }

  // Complétion profil
  const requiredMissing = fileLike.missing_info.filter((m) => m.required);
  if (requiredMissing.length > 0) {
    actions.push({
      type: "complete_profile",
      label: `Compléter le profil salarié (${requiredMissing.length} champ(s) requis manquant(s))`,
      priority: "high",
    });
  }

  // Tâche en attente d'approbation
  const awaitingApproval = fileLike.tasks.filter(
    (t) => t.approval_required && lower(t.status) === "awaiting_approval",
  );
  for (const task of awaitingApproval.slice(0, 3)) {
    actions.push({
      type: "approve_sensitive_task",
      label: `Valider la tâche : ${task.title}`,
      priority: "high",
      task_id: task.id,
      mission_id: task.mission_id ?? null,
    });
  }

  // Tâches bloquées
  const blocked = fileLike.tasks.filter((t) => lower(t.status) === "blocked");
  for (const task of blocked.slice(0, 3)) {
    actions.push({
      type: "resolve_blocked_task",
      label: `Débloquer : ${task.title}`,
      priority: "high",
      task_id: task.id,
      mission_id: task.mission_id ?? null,
    });
  }

  // Tâches en erreur
  const errored = fileLike.tasks.filter((t) => lower(t.status) === "error");
  for (const task of errored.slice(0, 2)) {
    actions.push({
      type: "investigate_error",
      label: `Enquêter sur l'erreur : ${task.title}`,
      priority: "high",
      task_id: task.id,
      mission_id: task.mission_id ?? null,
    });
  }

  // Infos manquantes optionnelles
  const optionalMissing = fileLike.missing_info.filter((m) => !m.required);
  if (optionalMissing.length > 0) {
    actions.push({
      type: "request_documents",
      label: `Demander les informations manquantes (${optionalMissing.length})`,
      priority: "normal",
    });
  }

  // Risques red sans action déjà planifiée
  if (hasRed && actions.length === 0) {
    actions.push({
      type: "generate_summary",
      label: "Générer une synthèse du dossier pour revue RH",
      priority: "normal",
    });
  }

  // Risques orange
  if (hasOrange && actions.length === 0) {
    actions.push({
      type: "prepare_followup",
      label: "Préparer un suivi RH pour ce dossier",
      priority: "low",
    });
  }

  // Dossier parfait
  if (actions.length === 0) {
    actions.push({
      type: "no_action",
      label: "Aucune action requise — dossier en ordre",
      priority: "low",
    });
  }

  return actions;
}

/**
 * Génère un digest opérationnel court en français.
 */
export function buildEmployeeFileDigest(fileLike: {
  risks: PierreEmployeeFileRisk[];
  tasks: PierreEmployeeFileTask[];
  missing_info: PierreEmployeeFileMissingInfo[];
  next_actions?: PierreEmployeeFileNextAction[];
  health?: PierreEmployeeFileHealth;
}): PierreEmployeeFileDigest {
  const hasBlack = fileLike.risks.some((r) => r.level === "black");
  const hasRed = fileLike.risks.some((r) => r.level === "red");
  const hasOrange = fileLike.risks.some((r) => r.level === "orange");
  const blockedCount = fileLike.tasks.filter((t) => lower(t.status) === "blocked").length;
  const errorCount = fileLike.tasks.filter((t) => lower(t.status) === "error").length;
  const approvalCount = fileLike.tasks.filter(
    (t) => lower(t.status) === "awaiting_approval",
  ).length;
  const missingCount = fileLike.missing_info.length;
  const requiredMissingCount = fileLike.missing_info.filter((m) => m.required).length;
  const nextCount =
    fileLike.next_actions?.filter((a) => a.type !== "no_action").length ?? 0;

  if (hasBlack) {
    return {
      tone: "sensitive",
      text: "Dossier sensible RH — validation humaine immédiate requise avant toute action.",
    };
  }

  if (blockedCount > 0 || errorCount > 0) {
    const parts: string[] = [];
    if (blockedCount > 0) parts.push(`${blockedCount} tâche(s) bloquée(s)`);
    if (errorCount > 0) parts.push(`${errorCount} tâche(s) en erreur`);
    return {
      tone: "blocked",
      text: `Dossier bloqué : ${parts.join(", ")}. Intervention requise.`,
    };
  }

  if (approvalCount > 0 && !hasRed) {
    return {
      tone: "waiting",
      text: `Dossier en attente : ${approvalCount} tâche(s) requièrent une validation humaine.`,
    };
  }

  if (hasRed || nextCount > 0 || requiredMissingCount > 0) {
    const parts: string[] = [];
    if (nextCount > 0) parts.push(`${nextCount} action(s) RH à traiter`);
    if (requiredMissingCount > 0) parts.push(`${requiredMissingCount} information(s) obligatoire(s) manquante(s)`);
    if (hasRed) parts.push("risque élevé détecté");
    return {
      tone: "action",
      text: `Dossier salarié actif : ${parts.join(", ")}.`,
    };
  }

  if (hasOrange || missingCount > 0) {
    const parts: string[] = [];
    if (hasOrange) parts.push("point(s) de vigilance détecté(s)");
    if (missingCount > 0) parts.push(`${missingCount} information(s) à compléter`);
    return {
      tone: "action",
      text: `Dossier à surveiller : ${parts.join(", ")}.`,
    };
  }

  return {
    tone: "complete",
    text: "Dossier complet : aucun blocage détecté.",
  };
}

// ── Niveau de risque maximal ──────────────────────────────

function computeMaxRiskLevel(
  risks: PierreEmployeeFileRisk[],
): PierreEmployeeFileRiskLevel {
  if (risks.some((r) => r.level === "black")) return "black";
  if (risks.some((r) => r.level === "red")) return "red";
  if (risks.some((r) => r.level === "orange")) return "orange";
  return "green";
}

function computeFileStatus(
  risk_level: PierreEmployeeFileRiskLevel,
  missing_info: PierreEmployeeFileMissingInfo[],
  next_actions: PierreEmployeeFileNextAction[],
): PierreEmployeeFileStatus {
  if (risk_level === "black") return "sensitive";

  const hasRequiredMissing = missing_info.some((m) => m.required);
  const hasNonTrivialAction = next_actions.some(
    (a) => a.type !== "no_action",
  );

  if (risk_level === "red" || hasNonTrivialAction) return "attention_required";
  if (hasRequiredMissing) return "incomplete";
  if (missing_info.length > 0) return "incomplete";

  return "complete";
}

/**
 * Construit le dossier salarié 360 complet à partir des données brutes.
 */
export function buildEmployeeFile360(params: {
  employee: Record<string, unknown>;
  missions: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  logs: Record<string, unknown>[];
  now?: Date;
}): PierreEmployeeFile360 {
  const {
    employee,
    missions: rawMissionsIn = [],
    tasks: rawTasksIn = [],
    documents: rawDocsIn = [],
    logs: rawLogsIn = [],
  } = params;

  // Normalisation du profil
  const profile = normalizeEmployeeFileProfile(employee);
  const identity = resolveEmployeeIdentity(profile);

  // Filtrage des données liées au salarié
  const rawMissions = filterEmployeeMissions(identity, rawMissionsIn);
  const rawTasks = filterEmployeeTasks(identity, rawTasksIn);
  const rawDocs = filterEmployeeDocuments(identity, rawDocsIn);
  const rawLogs = filterEmployeeLogs(identity, rawLogsIn);

  // Normalisation vers les types typés
  const missions = rawMissions.map(normalizeMission);
  const tasks = rawTasks.map(normalizeTask);
  const documents = rawDocs.map(normalizeDocument);
  const logs = rawLogs.map(normalizeLog);

  // Calculs d'analyse (sur les rows bruts pour la recherche textuelle)
  const risks = classifyEmployeeFileRisk(profile, rawMissions, rawTasks, rawDocs, rawLogs);
  const missing_info = detectEmployeeMissingInfo(profile, rawMissions, rawTasks, rawDocs);
  const timeline = buildEmployeeTimeline(profile, rawMissions, rawTasks, rawDocs, rawLogs);

  // Métriques dérivées
  const partialFile: EFPartial = {
    profile, missions, tasks, documents, logs, risks, missing_info, timeline,
  };
  const health = scoreEmployeeFileHealth(partialFile);
  const next_actions = buildEmployeeNextActions(partialFile);
  const sections = buildEmployeeFileSections({ ...partialFile, next_actions });
  const digest = buildEmployeeFileDigest({ ...partialFile, health, next_actions });

  // Statut global
  const risk_level = computeMaxRiskLevel(risks);
  const status = computeFileStatus(risk_level, missing_info, next_actions);

  return {
    profile,
    status,
    risk_level,
    health,
    missions,
    tasks,
    documents,
    logs,
    timeline,
    missing_info,
    risks,
    next_actions,
    sections,
    digest,
  };
}

/**
 * Construit un snapshot compact du dossier salarié.
 */
export function buildEmployeeFileSnapshot(
  file: PierreEmployeeFile360,
): PierreEmployeeFileSnapshot {
  const openStatuses = new Set(["ready", "retry", "running", "scheduled", "awaiting_approval"]);
  const openTasksCount = file.tasks.filter((t) => openStatuses.has(lower(t.status))).length;
  const pendingApprovalCount = file.tasks.filter(
    (t) => lower(t.status) === "awaiting_approval",
  ).length;

  const latestEventAt =
    file.timeline.length > 0
      ? (file.timeline[0].date ?? null)
      : (file.logs[0]?.created_at ??
         file.tasks[0]?.created_at ??
         file.missions[0]?.created_at ??
         null);

  return {
    employee_id: file.profile.employee_id,
    employee_name: file.profile.employee_name,
    status: file.status,
    health_score: file.health.score,
    risk_level: file.risk_level,
    missing_info_count: file.missing_info.length,
    open_tasks_count: openTasksCount,
    pending_approval_count: pendingApprovalCount,
    latest_event_at: latestEventAt,
    digest_text: file.digest.text,
  };
}

/**
 * Construit l'index global de tous les dossiers salariés.
 */
export function buildEmployeeFileIndex(
  employees: Record<string, unknown>[],
  missions: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
  documents: Record<string, unknown>[],
  logs: Record<string, unknown>[],
): PierreEmployeeFileIndex {
  const files: PierreEmployeeFileIndex["files"] = [];
  const attention_required: PierreEmployeeFileSnapshot[] = [];
  const sensitive: PierreEmployeeFileSnapshot[] = [];
  const incomplete: PierreEmployeeFileSnapshot[] = [];

  const totals = {
    employees: 0,
    complete: 0,
    incomplete: 0,
    attention_required: 0,
    sensitive: 0,
  };

  if (!Array.isArray(employees)) return { files, totals, attention_required, sensitive, incomplete };

  for (const emp of employees) {
    if (!isObject(emp)) continue;

    let file: PierreEmployeeFile360;
    try {
      file = buildEmployeeFile360({ employee: emp, missions, tasks, documents, logs });
    } catch {
      continue;
    }

    const snapshot = buildEmployeeFileSnapshot(file);
    const openStatuses = new Set(["ready", "retry", "running", "scheduled", "awaiting_approval"]);

    files.push({
      profile: file.profile,
      status: file.status,
      health: file.health,
      risk_level: file.risk_level,
      missing_info_count: file.missing_info.length,
      open_tasks_count: file.tasks.filter((t) => openStatuses.has(lower(t.status))).length,
      pending_approval_count: file.tasks.filter(
        (t) => lower(t.status) === "awaiting_approval",
      ).length,
      next_action_count: file.next_actions.filter((a) => a.type !== "no_action").length,
      digest: file.digest,
      latest_event_at: snapshot.latest_event_at,
    });

    totals.employees++;
    if (file.status === "complete") totals.complete++;
    else if (file.status === "incomplete") totals.incomplete++;
    else if (file.status === "attention_required") totals.attention_required++;
    else if (file.status === "sensitive") totals.sensitive++;

    if (file.status === "sensitive") sensitive.push(snapshot);
    else if (file.status === "attention_required") attention_required.push(snapshot);
    else if (file.status === "incomplete") incomplete.push(snapshot);
  }

  return { files, totals, attention_required, sensitive, incomplete };
}
