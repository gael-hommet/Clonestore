// P-FINAL 01 — Phase 2 — Legal pages verdict: aggregates all page reports.
// Pure: no Supabase, no Next, no async, no throw.

import type {
  LegalPageId,
  LegalPageReport,
  LegalPagesVerdict,
  ManualLegalPageFlags,
} from "./types";
import { getAllLegalPageIds, getRequiredForLaunchPageIds, getLegalPageDefinition } from "./legal-page-registry";
import {
  buildPresenceChecks,
  buildManualValidationCheck,
  getPageStatusFromFlags,
  getDefaultManualLegalPageFlags,
  type PagePresenceInfo,
} from "./legal-page-checks";
import { runContentGuard } from "./legal-page-content-guard";

export function buildLegalPageReport(
  info: PagePresenceInfo,
  flags: ManualLegalPageFlags,
  content?: string
): LegalPageReport {
  const { page_id } = info;
  const def = getLegalPageDefinition(page_id);

  const presenceChecks = buildPresenceChecks(page_id, info);
  const manualCheck = buildManualValidationCheck(
    page_id,
    flags[`${page_id}_validated` as keyof ManualLegalPageFlags]
  );

  const contentChecks =
    content && info.exists ? runContentGuard(page_id, content).checks : [];

  const allChecks = [...presenceChecks, ...contentChecks, manualCheck];

  const blocking_count = allChecks.filter((c) => c.severity === "blocking" && !c.passes).length;
  const warning_count = allChecks.filter((c) => c.severity === "warning" && !c.passes).length;

  const status = getPageStatusFromFlags(page_id, info, flags);

  return {
    page_id,
    title: def.title,
    path: def.path,
    status,
    is_blocking_public_launch: def.required_for_public_launch && blocking_count > 0,
    checks: allChecks,
    blocking_count,
    warning_count,
    passes_all_blocking: blocking_count === 0,
  };
}

export function buildLegalPagesVerdict(
  pageInfos: PagePresenceInfo[],
  flags?: Partial<ManualLegalPageFlags>,
  contents?: Partial<Record<LegalPageId, string>>
): LegalPagesVerdict {
  const resolvedFlags = {
    ...getDefaultManualLegalPageFlags(),
    ...(flags ?? {}),
  };

  const allIds = getAllLegalPageIds();
  const requiredIds = getRequiredForLaunchPageIds();

  // Build a report for each known page; fill missing ones as not present
  const infoMap = new Map<LegalPageId, PagePresenceInfo>(
    pageInfos.map((info) => [info.page_id, info])
  );

  const reports: LegalPageReport[] = allIds.map((id) => {
    const info: PagePresenceInfo = infoMap.get(id) ?? {
      page_id: id,
      exists: false,
      has_draft_banner: false,
      sections_present: [],
    };
    const content = contents?.[id];
    return buildLegalPageReport(info, resolvedFlags, content);
  });

  const pages_present = reports
    .filter((r) => r.status !== "missing")
    .map((r) => r.page_id);

  const pages_missing = reports
    .filter((r) => r.status === "missing")
    .map((r) => r.page_id);

  const pages_validated = reports
    .filter((r) => r.status === "present_validated")
    .map((r) => r.page_id);

  const pages_draft = reports
    .filter((r) => r.status === "present_draft")
    .map((r) => r.page_id);

  const requiredMissing = requiredIds.filter((id) => pages_missing.includes(id));
  const all_required_pages_present = requiredMissing.length === 0;

  const requiredUnvalidated = requiredIds.filter((id) => !pages_validated.includes(id));
  const all_required_pages_validated = requiredUnvalidated.length === 0;

  const total_blocking_count = reports.reduce((sum, r) => sum + r.blocking_count, 0);

  const is_public_launch_blocked =
    !all_required_pages_present || !all_required_pages_validated || total_blocking_count > 0;

  return {
    all_required_pages_present,
    all_required_pages_validated,
    total_blocking_count,
    pages_present,
    pages_missing,
    pages_validated,
    pages_draft,
    reports,
    is_public_launch_blocked,
    evaluated_at: new Date().toISOString(),
  };
}

// Convenience: build verdict from all pages present with standard sections
export function buildDefaultLegalPagesVerdict(
  flags?: Partial<ManualLegalPageFlags>
): LegalPagesVerdict {
  const allIds = getAllLegalPageIds();
  const pageInfos: PagePresenceInfo[] = allIds.map((id) => ({
    page_id: id,
    exists: true,
    has_draft_banner: true,
    sections_present: getLegalPageDefinition(id).required_sections.map((s) => s.id),
  }));
  return buildLegalPagesVerdict(pageInfos, flags);
}

export function isLegalPagesPublicLaunchBlocked(
  flags?: Partial<ManualLegalPageFlags>
): boolean {
  return buildDefaultLegalPagesVerdict(flags).is_public_launch_blocked;
}
