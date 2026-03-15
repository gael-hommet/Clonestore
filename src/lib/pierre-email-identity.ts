import type { SupabaseClient } from "@supabase/supabase-js";

export type PierreOnboardingRow = {
  id?: string;
  user_id: string;
  agent_slug: "pierre" | string;

  company_name: string;
  legal_company_name: string;
  company_email_domain: string;
  company_website: string;
  company_phone: string;
  company_address: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  company_siren: string;
  company_size: string;
  company_industry: string;
  company_description: string;

  contact_first_name: string;
  contact_last_name: string;
  contact_job_title: string;
  contact_email: string;
  contact_phone: string;

  hr_team_size: string;
  recruitment_volume: string;
  main_hr_needs: string;
  typical_document_types: string;
  usual_tone: string;
  preferred_language: string;
  signature_name: string;
  signature_job_title: string;
  signature_email: string;
  signature_phone: string;
  default_email_footer: string;

  sender_mode: string;
  sender_email_requested: string;
  sender_email_effective: string;
  reply_to_email: string;
  sender_status: string;
  domain_status: string;
  domain_name: string;
  postmark_domain_id: string;
  postmark_signature_id: string;

  legal_mentions: string;
  confidentiality_notes: string;
  forbidden_words: string;
  mandatory_words: string;
  internal_policy_notes: string;

  onboarding_completed: boolean;
  onboarding_completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PierreResolvedEmailIdentity = {
  from: string;
  replyTo: string;
  senderMode: "client_verified" | "clonestore_fallback";
  senderStatus: string;
  domainStatus: string;
  requestedFrom: string;
  effectiveFrom: string;
  domainName: string;
  onboardingCompleted: boolean;
  companyName: string;
  contactEmail: string;
};

const CLONESTORE_FALLBACK_FROM = "clonestore@clonestore.pro";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDomain(value: string): string {
  return safeString(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

function domainFromEmail(email: string): string {
  const normalized = safeString(email).toLowerCase();
  if (!normalized.includes("@")) return "";
  return normalized.split("@")[1].trim();
}

function isVerifiedDomain(row: Partial<PierreOnboardingRow> | null | undefined): boolean {
  return safeString(row?.domain_status).toLowerCase() === "verified";
}

function hasRequestedSender(row: Partial<PierreOnboardingRow> | null | undefined): boolean {
  return safeString(row?.sender_email_requested).includes("@");
}

function buildReplyTo(row: Partial<PierreOnboardingRow> | null | undefined): string {
  return (
    safeString(row?.reply_to_email) ||
    safeString(row?.contact_email) ||
    safeString(row?.signature_email) ||
    ""
  );
}

function buildDomainName(row: Partial<PierreOnboardingRow> | null | undefined): string {
  return (
    normalizeDomain(safeString(row?.domain_name)) ||
    domainFromEmail(safeString(row?.sender_email_requested)) ||
    normalizeDomain(safeString(row?.company_email_domain)) ||
    normalizeDomain(safeString(row?.company_website)) ||
    ""
  );
}

export function resolvePierreEmailIdentity(
  row: Partial<PierreOnboardingRow> | null | undefined
): PierreResolvedEmailIdentity {
  const requestedFrom = safeString(row?.sender_email_requested).toLowerCase();
  const explicitEffective = safeString(row?.sender_email_effective).toLowerCase();
  const replyTo = buildReplyTo(row);
  const domainName = buildDomainName(row);
  const onboardingCompleted = row?.onboarding_completed === true;
  const companyName = safeString(row?.company_name);
  const contactEmail = safeString(row?.contact_email);
  const senderStatus = safeString(row?.sender_status) || "draft";
  const domainStatus = safeString(row?.domain_status) || "not_started";

  if (isVerifiedDomain(row) && hasRequestedSender(row)) {
    return {
      from: requestedFrom,
      replyTo,
      senderMode: "client_verified",
      senderStatus,
      domainStatus,
      requestedFrom,
      effectiveFrom: requestedFrom,
      domainName,
      onboardingCompleted,
      companyName,
      contactEmail,
    };
  }

  return {
    from: explicitEffective || CLONESTORE_FALLBACK_FROM,
    replyTo,
    senderMode: "clonestore_fallback",
    senderStatus,
    domainStatus,
    requestedFrom,
    effectiveFrom: explicitEffective || CLONESTORE_FALLBACK_FROM,
    domainName,
    onboardingCompleted,
    companyName,
    contactEmail,
  };
}

export async function getPierreOnboardingByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  row: PierreOnboardingRow | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("agent_onboarding_pierre")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    return {
      row: null,
      error: error.message,
    };
  }

  return {
    row: (data as PierreOnboardingRow | null) || null,
    error: null,
  };
}

export async function getResolvedPierreEmailIdentity(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  identity: PierreResolvedEmailIdentity;
  onboarding: PierreOnboardingRow | null;
  error: string | null;
}> {
  const { row, error } = await getPierreOnboardingByUserId(supabase, userId);

  if (error) {
    return {
      identity: resolvePierreEmailIdentity(null),
      onboarding: null,
      error,
    };
  }

  return {
    identity: resolvePierreEmailIdentity(row),
    onboarding: row,
    error: null,
  };
}

export function buildPierreEmailMetadata(
  identity: PierreResolvedEmailIdentity
): Record<string, unknown> {
  return {
    sender_mode: identity.senderMode,
    sender_status: identity.senderStatus,
    domain_status: identity.domainStatus,
    requested_from: identity.requestedFrom,
    effective_from: identity.effectiveFrom,
    reply_to: identity.replyTo,
    domain_name: identity.domainName,
    onboarding_completed: identity.onboardingCompleted,
    company_name: identity.companyName,
    contact_email: identity.contactEmail,
  };
}