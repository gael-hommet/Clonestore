/**
 * Pierre HR Engine — Employee Profile 360 Foundation
 *
 * Couche pure sans dépendance DB/UI.
 * Les profils salariés sont stockés dans pierre_company_memory.memory_json.employees[]
 * — aucune table dédiée, pas de migration Supabase nécessaire pour le Bloc 4.
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
 * Retourne le premier match exact. Si aucun exact, essaie une recherche partielle.
 */
export function findPierreEmployeeByName(
  employees: PierreEmployeeProfile[],
  name: string,
): PierreEmployeeProfile | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;

  const exactMatch = employees.find(
    (e) => e.full_name.toLowerCase() === needle,
  );
  if (exactMatch) return exactMatch;

  const partialMatch = employees.find(
    (e) =>
      e.full_name.toLowerCase().includes(needle) ||
      needle.includes(e.full_name.toLowerCase()),
  );
  return partialMatch ?? null;
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
    employee_context: context,
  };
}
