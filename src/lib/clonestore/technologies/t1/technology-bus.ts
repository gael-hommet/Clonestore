// src/lib/clonestore/technologies/t1/technology-bus.ts
// T1 — TECHNOLOGY BUS : le bus générique par lequel N'IMPORTE QUEL employé IA découvre et
// consomme les technologies PAR CONTRAT. AUCUNE logique spécifique à Pierre : « pierre » est
// un employeeId comme un autre, les futurs employés passent par le MÊME chemin.
// ORDRE GARANTI : permission AVANT prepare ; audit APRÈS prepare (même en fallback/bloqué).
// Jamais d'appel provider live ; jamais de secret dans les résultats/traces.

import type { TechnologyContext, TechnologyId, TechnologyMode, TechnologyStatus } from "./technology-types";
import { blockedResult, type TechnologyResult } from "./technology-result";
import type { TechnologyContract } from "./technology-contract";
import type { TechnologyValidationReport } from "./technology-validation";
import { buildTechnologyValidationReport } from "./technology-validation";
import { createTechnologyAuditEntry, createTechnologyAuditLog, type TechnologyAuditEntry } from "./technology-audit";
import { checkTechnologyPermission, type TechnologyPermissionDecision, type TechnologyPermissionOptions } from "./technology-permissions";
import { getTechnologyFallbackText, UNKNOWN_TECHNOLOGY_FALLBACK } from "./technology-fallbacks";
import { isLiveExecutionAllowed, resolveTechnologyMode } from "./technology-status";
import { listTechnologyRegistryEntries } from "./technology-registry";

export interface TechnologyBusListing {
  readonly id: TechnologyId;
  readonly name: string;
  readonly purpose: string;
  readonly status: TechnologyStatus;
  readonly liveDependency: string;
  readonly requiresValidation: boolean;
  readonly safeFallback: string;
  readonly mode: TechnologyMode;
  readonly allowedInDemo: boolean;
  readonly allowedInProduction: boolean;
}

export interface TechnologyBusSummary {
  readonly totalTechnologies: number;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly liveBlockedTechnologies: readonly TechnologyId[];
  readonly reusableCount: number;
  readonly pierreOnlyCount: number;
  readonly employeeAgnostic: true;
  readonly liveExecutionAllowed: boolean;
  readonly auditEntriesRecorded: number;
}

export interface TechnologyBus {
  listTechnologies(): readonly TechnologyBusListing[];
  getTechnology(technologyId: string): TechnologyContract | undefined;
  canUseTechnology(employeeId: string, technologyId: string, ctx: Partial<TechnologyContext> | null | undefined): TechnologyPermissionDecision;
  prepareWithTechnology(technologyId: string, input: unknown, ctx: TechnologyContext): Promise<TechnologyResult>;
  validateTechnologyResult(result: TechnologyResult, ctx: TechnologyContext): TechnologyValidationReport;
  auditTechnologyUse(result: TechnologyResult, ctx: TechnologyContext): TechnologyAuditEntry;
  getTechnologyFallback(technologyId: string): string;
  summarizeTechnologyBus(): TechnologyBusSummary;
  listAuditEntries(): readonly TechnologyAuditEntry[];
}

export interface CreateTechnologyBusOptions {
  readonly permissionOptions?: TechnologyPermissionOptions;
}

/** Crée un TechnologyBus. Générique : aucun employé n'est privilégié, aucun provider live. */
export function createTechnologyBus(options?: CreateTechnologyBusOptions): TechnologyBus {
  const entries = listTechnologyRegistryEntries();
  const auditLog = createTechnologyAuditLog();

  const disabledIds = entries.filter((e) => e.status === "disabled").map((e) => e.id);
  const permissionOptions: TechnologyPermissionOptions = {
    disabledTechnologyIds: disabledIds,
    ...(options?.permissionOptions ?? {}),
  };

  const byId = new Map<string, TechnologyContract>(entries.map((e) => [e.id, e.contract]));

  const bus: TechnologyBus = {
    listTechnologies() {
      return entries.map((e) => ({
        id: e.id,
        name: e.contract.name,
        purpose: e.contract.purpose,
        status: e.status,
        liveDependency: e.contract.liveDependency,
        requiresValidation: e.contract.requiresValidation,
        safeFallback: e.safeFallback,
        mode: resolveTechnologyMode({ status: e.status, liveDependency: e.contract.liveDependency }),
        allowedInDemo: e.contract.allowedInDemo,
        allowedInProduction: e.contract.allowedInProduction,
      }));
    },

    // DÉCOUVERTE uniquement : appeler contract.prepare directement saute la permission
    // par employé + l'audit du bus (les gardes du contrat — scope fail-closed, anti-live —
    // restent actives). Les adaptateurs P16C DOIVENT passer par prepareWithTechnology.
    getTechnology(technologyId) {
      return byId.get(technologyId);
    },

    canUseTechnology(employeeId, technologyId, ctx) {
      return checkTechnologyPermission(employeeId, technologyId, ctx, permissionOptions);
    },

    async prepareWithTechnology(technologyId, input, ctx) {
      const contract = byId.get(technologyId);
      // Techno inconnue → refus fail-closed (jamais d'exception porteuse de contexte).
      if (!contract) {
        const result = blockedResult(
          "integration_bus",
          ctx,
          `Technologie inconnue « ${technologyId} » — refus fail-closed.`,
          UNKNOWN_TECHNOLOGY_FALLBACK,
        );
        auditLog.record(createTechnologyAuditEntry(result, ctx, `demande de techno inconnue: ${technologyId}`));
        return result;
      }

      // 1) PERMISSION AVANT prepare.
      const decision = bus.canUseTechnology(ctx?.employeeId ?? "", technologyId, ctx);
      if (!decision.allowed) {
        const result = blockedResult(contract.id, ctx, `Permission refusée : ${decision.reason}`, contract.safeFallback);
        auditLog.record(createTechnologyAuditEntry(result, ctx, "permission refusée avant prepare"));
        return result;
      }

      // 2) prepare (le contrat re-garde fail-closed + anti-live).
      const result = await contract.prepare(input, ctx);

      // 3) AUDIT APRÈS prepare — systématique, y compris fallback/bloqué/erreur.
      auditLog.record(createTechnologyAuditEntry(result, ctx));
      return result;
    },

    validateTechnologyResult(result, ctx) {
      const contract = byId.get(result.technologyId);
      if (contract) return contract.validate(result, ctx);
      // Résultat d'une techno inconnue : structurellement invalide, humain requis (fail-closed).
      return buildTechnologyValidationReport({ id: "integration_bus", requiresValidation: true }, result, ctx);
    },

    auditTechnologyUse(result, ctx) {
      const entry = createTechnologyAuditEntry(result, ctx);
      auditLog.record(entry);
      return entry;
    },

    getTechnologyFallback(technologyId) {
      return getTechnologyFallbackText(technologyId);
    },

    summarizeTechnologyBus() {
      const byStatus: Record<string, number> = {};
      for (const e of entries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      return {
        totalTechnologies: entries.length,
        byStatus,
        liveBlockedTechnologies: entries.filter((e) => e.contract.liveDependency !== "none").map((e) => e.id),
        reusableCount: entries.filter((e) => e.reusable).length,
        pierreOnlyCount: entries.filter((e) => e.pierreOnly).length,
        employeeAgnostic: true,
        liveExecutionAllowed: isLiveExecutionAllowed(), // false en T1
        auditEntriesRecorded: auditLog.count(),
      };
    },

    listAuditEntries() {
      return auditLog.list();
    },
  };

  return bus;
}

// ── Fonctions de commodité sur un bus partagé (mêmes garanties) ────────────────

let defaultBus: TechnologyBus | null = null;
function sharedBus(): TechnologyBus {
  if (defaultBus === null) defaultBus = createTechnologyBus();
  return defaultBus;
}

export function listTechnologies(): readonly TechnologyBusListing[] { return sharedBus().listTechnologies(); }
export function getTechnology(technologyId: string): TechnologyContract | undefined { return sharedBus().getTechnology(technologyId); }
export function canUseTechnology(employeeId: string, technologyId: string, ctx: Partial<TechnologyContext> | null | undefined): TechnologyPermissionDecision {
  return sharedBus().canUseTechnology(employeeId, technologyId, ctx);
}
export function prepareWithTechnology(technologyId: string, input: unknown, ctx: TechnologyContext): Promise<TechnologyResult> {
  return sharedBus().prepareWithTechnology(technologyId, input, ctx);
}
export function validateTechnologyResult(result: TechnologyResult, ctx: TechnologyContext): TechnologyValidationReport {
  return sharedBus().validateTechnologyResult(result, ctx);
}
export function auditTechnologyUse(result: TechnologyResult, ctx: TechnologyContext): TechnologyAuditEntry {
  return sharedBus().auditTechnologyUse(result, ctx);
}
export function getTechnologyFallback(technologyId: string): string { return sharedBus().getTechnologyFallback(technologyId); }
export function summarizeTechnologyBus(): TechnologyBusSummary { return sharedBus().summarizeTechnologyBus(); }
