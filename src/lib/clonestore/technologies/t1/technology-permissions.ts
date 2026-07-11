// src/lib/clonestore/technologies/t1/technology-permissions.ts
// T1 — Permissions d'usage des technologies. FAIL-CLOSED : tout manque (employé, société,
// techno inconnue/désactivée) → REFUS. Cette couche COMPLÈTE la frontière serveur existante
// (RLS + requireCompanyUser + requirePermission) — elle ne la remplace ni ne la contourne
// JAMAIS : elle n'accorde aucun droit au niveau données. Module PUR.
// NOTE : distinct de ../technology-permissions.ts (B46 — permissions d'ÉDITION de config).

import { isTechnologyId, type TechnologyContext, type TechnologyId } from "./technology-types";

export interface TechnologyPermissionDecision {
  readonly allowed: boolean;
  readonly reason: string;
  /** Toujours true : en cas de doute, on refuse. */
  readonly failClosed: true;
}

export interface TechnologyPermissionOptions {
  /** Technologies désactivées (statut `disabled`) — fournies par le registre. */
  readonly disabledTechnologyIds?: readonly TechnologyId[];
  /** Refus explicites par employé (ex. un employé IA sans accès connecteurs). */
  readonly deniedTechnologyIdsByEmployee?: Readonly<Record<string, readonly string[]>>;
}

const deny = (reason: string): TechnologyPermissionDecision => ({ allowed: false, reason, failClosed: true });
const allow = (reason: string): TechnologyPermissionDecision => ({ allowed: true, reason, failClosed: true });

/**
 * Un employé IA (« pierre » ou n'importe quel futur employé) peut-il utiliser une technologie ?
 * FAIL-CLOSED. Aucune logique spécifique à un employé : les règles sont identiques pour tous.
 */
export function checkTechnologyPermission(
  employeeId: string,
  technologyId: string,
  ctx: Partial<TechnologyContext> | null | undefined,
  options?: TechnologyPermissionOptions,
): TechnologyPermissionDecision {
  const employee = (employeeId ?? "").trim();
  if (employee.length === 0) return deny("employeeId manquant — refus fail-closed.");

  const companyId = (ctx?.companyId ?? "").trim();
  if (companyId.length === 0) return deny("companyId (périmètre société) manquant — refus fail-closed.");

  if (ctx?.employeeId !== undefined && ctx.employeeId.trim() !== employee) {
    return deny("Incohérence employeeId (paramètre ≠ contexte) — refus fail-closed.");
  }

  if (!isTechnologyId(technologyId)) return deny(`Technologie inconnue « ${technologyId} » — refus fail-closed.`);

  if (options?.disabledTechnologyIds?.includes(technologyId)) {
    return deny(`Technologie « ${technologyId} » désactivée — refus fail-closed.`);
  }

  const deniedForEmployee = options?.deniedTechnologyIdsByEmployee?.[employee];
  if (deniedForEmployee?.includes(technologyId)) {
    return deny(`Technologie « ${technologyId} » refusée pour l'employé « ${employee} ».`);
  }

  return allow("Périmètre employé + société présents ; technologie enregistrée et active. (La frontière serveur RLS/requireCompanyUser reste applicable.)");
}
