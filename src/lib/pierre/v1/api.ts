// src/lib/pierre/v1/api.ts
// PHASE 8.1 — Pierre Production Runtime Core — v1 API handlers (framework-agnostic).
//
// Pure handler functions: (db, ctx, input) -> result. The Next.js route files are
// thin wrappers that resolve auth + TenantContext and call these. Tests call them
// directly against a real Postgres (PGlite). Stable schemas, stable errors,
// pagination, permission checks, tenant isolation, no stack traces to clients.

import type { SqlExecutor } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./tenant-context";
import {
  MissionRepo, TaskRepo, ValidationRepo, EventRepo, type MissionRow,
} from "./repositories";
import {
  createMission, cancelMission, decideValidationAction, readMissionMissingInfo, type CreateMissionInput, type MissionView,
} from "./mission-service";

import { withTenantTransaction } from "./tenant-tx";
import * as Contracts from "./contracts";
import type { ContractAction } from "./contract-readiness";

// All tenant mission/validation paths run under the real RLS binding (PHASE 8.2-C).
export async function apiCreateMission(db: SqlExecutor, ctx: TenantContext, input: CreateMissionInput): Promise<MissionView> {
  return withTenantTransaction(db, ctx, (tx) => createMission(tx, ctx, input));
}

export async function apiListMissions(db: SqlExecutor, ctx: TenantContext, q: { limit?: number; cursor?: string | null; status?: string | null }): Promise<{ items: Array<Pick<MissionRow, "id" | "status" | "risk" | "summary" | "created_at">>; next_cursor: string | null }> {
  requirePermission(ctx, "mission.read");
  return withTenantTransaction(db, ctx, async (tx) => {
    const page = await MissionRepo.list(tx, ctx.company_id, { limit: q.limit ?? 20, cursor: q.cursor ?? null, status: q.status ?? null });
    return {
      items: page.items.map((m) => ({ id: m.id, status: m.status, risk: m.risk, summary: m.summary, created_at: m.created_at })),
      next_cursor: page.next_cursor,
    };
  });
}

export async function apiGetMission(db: SqlExecutor, ctx: TenantContext, missionId: string): Promise<MissionView> {
  requirePermission(ctx, "mission.read");
  return withTenantTransaction(db, ctx, async (tx) => {
    const m = await MissionRepo.byId(tx, ctx.company_id, missionId);
    if (!m) throw Errors.notFound("Mission not found");
    const tasks = await TaskRepo.listByMission(tx, ctx.company_id, missionId);
    const validations = await ValidationRepo.listByMission(tx, ctx.company_id, missionId);
    return {
      mission_id: m.id, status: m.status, summary: m.summary, risk: m.risk,
      tasks: tasks.map((t) => ({ id: t.id, type: t.type, status: t.status, approval_required: t.approval_required, risk: t.risk })),
      // P16E §3 (F22) — la raison exacte du blocage (questions d'info manquante) est exposée à la
      // relecture, jamais discardée : répondre à une question n'efface pas les autres.
      missing_info: await readMissionMissingInfo(tx, ctx.company_id, missionId),
      approvals: validations.map((v) => ({ id: v.id, status: v.status, reason: v.reason })),
      queued_actions: tasks.filter((t) => ["queued", "leased", "in_progress"].includes(t.status)).length,
      next_action: m.next_action, trace_reference: m.correlation_id, idempotent_replay: false,
    };
  });
}

export async function apiGetMissionTasks(db: SqlExecutor, ctx: TenantContext, missionId: string) {
  requirePermission(ctx, "task.read");
  return withTenantTransaction(db, ctx, async (tx) => {
    const m = await MissionRepo.byId(tx, ctx.company_id, missionId);
    if (!m) throw Errors.notFound("Mission not found");
    const tasks = await TaskRepo.listByMission(tx, ctx.company_id, missionId);
    return tasks.map((t) => ({
      id: t.id, type: t.type, objective: t.objective, status: t.status, risk: t.risk,
      sensitivity: t.sensitivity, approval_required: t.approval_required, attempts: t.attempts,
      max_attempts: t.max_attempts, result: t.result,
    }));
  });
}

export async function apiGetMissionTimeline(db: SqlExecutor, ctx: TenantContext, missionId: string) {
  requirePermission(ctx, "mission.read");
  return withTenantTransaction(db, ctx, async (tx) => {
    const m = await MissionRepo.byId(tx, ctx.company_id, missionId);
    if (!m) throw Errors.notFound("Mission not found");
    const events = await EventRepo.timeline(tx, ctx.company_id, missionId);
    return events.map((e) => ({
      type: e.type, actor_type: e.actor_type, prev_state: e.prev_state, new_state: e.new_state,
      task_id: e.task_id, created_at: e.created_at, metadata: e.metadata,
    }));
  });
}

export async function apiCancelMission(db: SqlExecutor, ctx: TenantContext, missionId: string) {
  return withTenantTransaction(db, ctx, (tx) => cancelMission(tx, ctx, missionId));
}

export async function apiListValidations(db: SqlExecutor, ctx: TenantContext, missionId: string) {
  requirePermission(ctx, "validation.read");
  return withTenantTransaction(db, ctx, async (tx) => {
    const m = await MissionRepo.byId(tx, ctx.company_id, missionId);
    if (!m) throw Errors.notFound("Mission not found");
    const validations = await ValidationRepo.listByMission(tx, ctx.company_id, missionId);
    return validations.map((v) => ({ id: v.id, status: v.status, reason: v.reason, validator_role: v.validator_role, task_id: v.task_id, version: v.version, risk_context: v.risk_context }));
  });
}

export async function apiDecideValidation(db: SqlExecutor, ctx: TenantContext, validationId: string, action: "approve" | "reject" | "request_changes", version: number) {
  return withTenantTransaction(db, ctx, (tx) => decideValidationAction(tx, ctx, validationId, action, version));
}

// ── PHASE 8.2 — sites, Employee 360 (RLS-bound via withTenantTransaction) ─────
export async function apiCreateSite(db: SqlExecutor, ctx: TenantContext, input: { name: string; code?: string | null; timezone?: string }) {
  const { createSite } = await import("./sites");
  return withTenantTransaction(db, ctx, (tx) => createSite(tx, ctx, input));
}
export async function apiListSites(db: SqlExecutor, ctx: TenantContext) {
  const { listSites } = await import("./sites");
  return withTenantTransaction(db, ctx, (tx) => listSites(tx, ctx));
}
export async function apiCreateEmployee(db: SqlExecutor, ctx: TenantContext, input: { first_name: string; last_name: string; site_id?: string | null; email?: string | null; role_title?: string | null; contract_type?: string; status?: string; external_ref?: string | null }) {
  const { createEmployee } = await import("./employees");
  return withTenantTransaction(db, ctx, (tx) => createEmployee(tx, ctx, input as never));
}
export async function apiListEmployees(db: SqlExecutor, ctx: TenantContext, q: { limit?: number; cursor?: string | null; status?: string | null }) {
  const { listEmployees } = await import("./employees");
  return withTenantTransaction(db, ctx, (tx) => listEmployees(tx, ctx, q));
}
export async function apiGetEmployee360(db: SqlExecutor, ctx: TenantContext, id: string) {
  const { getEmployee360 } = await import("./employees");
  return withTenantTransaction(db, ctx, (tx) => getEmployee360(tx, ctx, id));
}
export async function apiSearchEmployees(db: SqlExecutor, ctx: TenantContext, q: string, limit?: number) {
  const { searchEmployees } = await import("./employee-search");
  return withTenantTransaction(db, ctx, (tx) => searchEmployees(tx, ctx, q, limit));
}
export async function apiGetEmployeeCompleteness(db: SqlExecutor, ctx: TenantContext, id: string) {
  const { computeEmployeeCompleteness } = await import("./completeness");
  return withTenantTransaction(db, ctx, (tx) => computeEmployeeCompleteness(tx, ctx, id));
}
export async function apiPatchCompany(db: SqlExecutor, ctx: TenantContext, patch: Record<string, unknown>, version: number) {
  const { patchCompany } = await import("./company");
  return withTenantTransaction(db, ctx, (tx) => patchCompany(tx, ctx, patch, version));
}
export async function apiGetCompany(db: SqlExecutor, ctx: TenantContext) {
  const { getCompany } = await import("./company");
  return withTenantTransaction(db, ctx, (tx) => getCompany(tx, ctx));
}

// ── PHASE 8.2-C — members, invitations, roles, sites CRUD, Employee 360, import, GDPR ──
import * as Members from "./members";
import * as Roles from "./roles";
import * as Sites from "./sites";
import * as Emp from "./employees";
import * as Imp from "./employee-import";
import * as Gdpr from "./gdpr";
import * as Sensitive from "./employee-sensitive";

const T = withTenantTransaction;

// Members & invitations (tenant-bound).
export const apiListMembers = (db: SqlExecutor, ctx: TenantContext) => T(db, ctx, (tx) => Members.listMembers(tx, ctx));
export const apiCreateInvitation = (db: SqlExecutor, ctx: TenantContext, i: Members.CreateInvitationInput) => T(db, ctx, (tx) => Members.createInvitation(tx, ctx, i));
export const apiResendInvitation = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Members.resendInvitation(tx, ctx, id));
export const apiRevokeInvitation = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Members.revokeInvitation(tx, ctx, id));
export const apiSuspendMember = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Members.suspendMember(tx, ctx, id));
export const apiReactivateMember = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Members.reactivateMember(tx, ctx, id));
export const apiRemoveMember = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Members.removeMember(tx, ctx, id));
export const apiLeaveCompany = (db: SqlExecutor, ctx: TenantContext) => T(db, ctx, (tx) => Members.leaveCompany(tx, ctx));
export const apiTransferOwnership = (db: SqlExecutor, ctx: TenantContext, target: string, demote?: boolean) => T(db, ctx, (tx) => Members.transferOwnership(tx, ctx, target, { demote_self: demote }));
export const apiAssignRole = (db: SqlExecutor, ctx: TenantContext, mid: string, role: string) => T(db, ctx, (tx) => Members.assignRole(tx, ctx, mid, role));
export const apiRemoveRole = (db: SqlExecutor, ctx: TenantContext, mid: string, role: string) => T(db, ctx, (tx) => Members.removeRole(tx, ctx, mid, role));
// Invitation acceptance is an identity transition → service role, token-authorized,
// AND bound to the verified authenticated email.
export const apiAcceptInvitation = (db: SqlExecutor, input: Members.AcceptIdentity) => Members.acceptInvitation(db, input);

// Roles (tenant-bound).
export const apiListRoles = (db: SqlExecutor, ctx: TenantContext) => T(db, ctx, (tx) => Roles.listRoles(tx, ctx));
export const apiCreateRole = (db: SqlExecutor, ctx: TenantContext, i: { label: string; permissions?: string[]; key?: string }) => T(db, ctx, (tx) => Roles.createRole(tx, ctx, i));
export const apiGetRole = (db: SqlExecutor, ctx: TenantContext, key: string) => T(db, ctx, (tx) => Roles.getRole(tx, ctx, key));
export const apiPatchRole = (db: SqlExecutor, ctx: TenantContext, key: string, patch: { label?: string; permissions?: string[] }, version: number) => T(db, ctx, (tx) => Roles.patchRole(tx, ctx, key, patch, version));
export const apiArchiveRole = (db: SqlExecutor, ctx: TenantContext, key: string) => T(db, ctx, (tx) => Roles.archiveRole(tx, ctx, key));

// Multi-company (identity-scoped, service role).
export const apiListCompanies = (db: SqlExecutor, userId: string) => Members.listCompaniesForUser(db, userId);
export const apiSwitchCompany = (db: SqlExecutor, userId: string, companyId: string) => Members.switchCompany(db, userId, companyId);

// Sites CRUD (tenant-bound).
export const apiGetSite = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Sites.getSite(tx, ctx, id));
export const apiPatchSite = (db: SqlExecutor, ctx: TenantContext, id: string, patch: Record<string, unknown>, version: number) => T(db, ctx, (tx) => Sites.patchSite(tx, ctx, id, patch, version));
export const apiArchiveSite = (db: SqlExecutor, ctx: TenantContext, id: string, reassignTo?: string | null) => T(db, ctx, (tx) => Sites.archiveSite(tx, ctx, id, { reassign_to_site_id: reassignTo ?? null }));
export const apiReactivateSite = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Sites.reactivateSite(tx, ctx, id));
export const apiAssignSiteManager = (db: SqlExecutor, ctx: TenantContext, id: string, mid: string) => T(db, ctx, (tx) => Sites.assignSiteManager(tx, ctx, id, mid));

// Employee 360 (tenant-bound).
export const apiPatchEmployee = (db: SqlExecutor, ctx: TenantContext, id: string, patch: Record<string, unknown>, version: number) => T(db, ctx, (tx) => Emp.patchEmployee(tx, ctx, id, patch, version));
export const apiArchiveEmployee = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.archiveEmployee(tx, ctx, id));
export const apiReactivateEmployee = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.reactivateEmployee(tx, ctx, id));
export const apiEmployeeTimeline = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.employeeTimeline(tx, ctx, id));
export const apiListContracts = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.listContracts(tx, ctx, id));
export const apiCreateContract = (db: SqlExecutor, ctx: TenantContext, id: string, type: string) => T(db, ctx, (tx) => Emp.createContract(tx, ctx, id, type));
export const apiAddContractVersion = (db: SqlExecutor, ctx: TenantContext, id: string, contractId: string) => T(db, ctx, (tx) => Emp.addContractVersion(tx, ctx, id, contractId));
export const apiListDocuments = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.listDocuments(tx, ctx, id));
export const apiListAbsences = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.listAbsences(tx, ctx, id));
export const apiCreateAbsence = (db: SqlExecutor, ctx: TenantContext, id: string, a: { type: string; start_date: string; end_date: string; status?: string }) => T(db, ctx, (tx) => Emp.createAbsence(tx, ctx, id, a));
export const apiEmployeeMissions = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.employeeMissions(tx, ctx, id));
export const apiEmployeeTasks = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.employeeTasks(tx, ctx, id));
export const apiEmployeeAccessLog = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Emp.employeeAccessLog(tx, ctx, id));
export const apiReadSensitive = (db: SqlExecutor, ctx: TenantContext, id: string, category: Sensitive.SensitiveCategory) => T(db, ctx, (tx) => Sensitive.readSensitive(tx, ctx, id, category));
export const apiWriteSensitive = (db: SqlExecutor, ctx: TenantContext, id: string, category: Sensitive.SensitiveCategory, value: string) => T(db, ctx, (tx) => Sensitive.writeSensitive(tx, ctx, id, category, value));
export const apiListSensitiveCategories = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Sensitive.listSensitiveCategories(tx, ctx, id));

// CSV import (tenant-bound).
export const apiImportPreview = (db: SqlExecutor, ctx: TenantContext, i: Imp.PreviewInput) => T(db, ctx, (tx) => Imp.previewImport(tx, ctx, i));
export const apiImportCommit = (db: SqlExecutor, ctx: TenantContext, batchId: string) => T(db, ctx, (tx) => Imp.commitImport(tx, ctx, batchId));
export const apiGetImportBatch = (db: SqlExecutor, ctx: TenantContext, batchId: string) => T(db, ctx, (tx) => Imp.getImportBatch(tx, ctx, batchId));
export const apiImportRollback = (db: SqlExecutor, ctx: TenantContext, batchId: string) => T(db, ctx, (tx) => Imp.rollbackImport(tx, ctx, batchId));

// GDPR (tenant-bound).
export const apiExportEmployee = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Gdpr.exportEmployee(tx, ctx, id));
export const apiExportCompany = (db: SqlExecutor, ctx: TenantContext) => T(db, ctx, (tx) => Gdpr.exportCompany(tx, ctx));
export const apiAnonymizeEmployee = (db: SqlExecutor, ctx: TenantContext, id: string) => T(db, ctx, (tx) => Gdpr.anonymizeEmployee(tx, ctx, id));
export const apiSetLegalHold = (db: SqlExecutor, ctx: TenantContext, id: string, on: boolean) => T(db, ctx, (tx) => Gdpr.setLegalHold(tx, ctx, id, on));
export const apiDeleteEmployeeDocument = (db: SqlExecutor, ctx: TenantContext, id: string, documentId: string) => T(db, ctx, (tx) => Gdpr.deleteDocument(tx, ctx, id, documentId));
export const apiPurgeEmployee = (db: SqlExecutor, ctx: TenantContext, id: string, legalReason?: string | null) => T(db, ctx, (tx) => Gdpr.purgeEmployee(tx, ctx, id, { legal_reason: legalReason ?? null }));
export const apiDataAccessAudit = (db: SqlExecutor, ctx: TenantContext, limit?: number) => T(db, ctx, (tx) => Gdpr.dataAccessAudit(tx, ctx, { limit }));

// ── PHASE 8.3-B2G — contract engine (services manage their own transactions) ──────
export const apiCreateGovernedContract = (db: SqlExecutor, ctx: TenantContext, input: { employee_id: string; contract_type: string; effective_from: string; effective_to?: string | null }) => Contracts.createGovernedContract(db, ctx, { employee_id: input.employee_id, contract_type: input.contract_type, effective_from: input.effective_from, effective_to: input.effective_to ?? null });
export const apiGetContract = (db: SqlExecutor, ctx: TenantContext, id: string) => Contracts.getContract(db, ctx, id);
export const apiCreateContractVersion = (db: SqlExecutor, ctx: TenantContext, id: string, input: { effective_from: string; effective_to?: string | null }) => Contracts.createContractVersion(db, ctx, id, input);
export const apiContractReadiness = (db: SqlExecutor, ctx: TenantContext, id: string, action: ContractAction, renderer?: "pdf" | "docx", fieldValues?: Record<string, string | null>) => Contracts.checkContractReadiness(db, ctx, id, action, renderer ?? "pdf", fieldValues ?? {});
export const apiGenerateContract = (db: SqlExecutor, ctx: TenantContext, id: string, input: { renderers?: Array<"pdf" | "docx">; field_values?: Record<string, string | null> }) => Contracts.generateContract(db, ctx, id, input);
export const apiSubmitContractReview = (db: SqlExecutor, ctx: TenantContext, id: string) => Contracts.submitContractForReview(db, ctx, id);
export const apiRequestContractChanges = (db: SqlExecutor, ctx: TenantContext, id: string) => Contracts.requestContractChanges(db, ctx, id);
export const apiApproveContract = (db: SqlExecutor, ctx: TenantContext, id: string) => Contracts.approveContract(db, ctx, id);
export const apiFinalizeContract = (db: SqlExecutor, ctx: TenantContext, id: string) => Contracts.finalizeContract(db, ctx, id);
export const apiPrepareContractSignature = (db: SqlExecutor, ctx: TenantContext, id: string, input: { idempotency_key?: string }) => Contracts.prepareContractSignature(db, ctx, id, input);
export const apiCreateContractAmendment = (db: SqlExecutor, ctx: TenantContext, id: string, input: { reason: string; effective_from: string; effective_to?: string | null; idempotency_key?: string }) => Contracts.createContractAmendment(db, ctx, id, input);
export const apiListContractHistory = (db: SqlExecutor, ctx: TenantContext, id: string) => Contracts.listContractHistory(db, ctx, id);

// ── PHASE 8.3-B3 — e-signature provider runtime ──────────────────────────────────
import * as Signatures from "./signatures";
export const apiSubmitContractSignature = (db: SqlExecutor, ctx: TenantContext, id: string, input: { idempotency_key?: string }) => Signatures.submitContractToSignatureProvider(db, ctx, id, input);
export const apiGetContractSignature = (db: SqlExecutor, ctx: TenantContext, id: string) => Signatures.getContractSignature(db, ctx, id);
export const apiCancelContractSignature = (db: SqlExecutor, ctx: TenantContext, id: string) => Signatures.cancelContractSignature(db, ctx, id);
export const apiReconcileSignatures = (db: SqlExecutor, ctx: TenantContext, input: { limit?: number } = {}) => Signatures.reconcileSignatureRequests(db, ctx, input);
export const apiGetSignatureEvidence = (db: SqlExecutor, ctx: TenantContext, id: string) => Signatures.getSignatureEvidence(db, ctx, id);
export const apiProcessSignatureEvents = (db: SqlExecutor, ctx: TenantContext, input: { limit?: number } = {}) => Signatures.processPendingSignatureEvents(db, ctx, input);
