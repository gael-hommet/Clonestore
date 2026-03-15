import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type PierreOnboardingPayload = {
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
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeBool(value: unknown) {
  return value === true;
}

function normalizeDomain(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim();
}

function makeServerSupabase(): SupabaseClient {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase serveur non configuré.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<{ error: string | null; user: User | null }> {
  const token = getBearerToken(req);

  if (!token) {
    return { error: "Token manquant.", user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: error?.message || "Utilisateur non authentifié.", user: null };
  }

  return { error: null, user: data.user };
}

function validatePayload(raw: Record<string, unknown>): PierreOnboardingPayload {
  const companyEmailDomain = normalizeDomain(
    safeString(raw.company_email_domain) || safeString(raw.company_website)
  );

  const senderEmailRequested = safeString(raw.sender_email_requested);
  const requestedDomain = senderEmailRequested.includes("@")
    ? senderEmailRequested.split("@")[1].toLowerCase().trim()
    : "";

  return {
    company_name: safeString(raw.company_name),
    legal_company_name: safeString(raw.legal_company_name),
    company_email_domain: companyEmailDomain,
    company_website: safeString(raw.company_website),
    company_phone: safeString(raw.company_phone),
    company_address: safeString(raw.company_address),
    company_city: safeString(raw.company_city),
    company_postal_code: safeString(raw.company_postal_code),
    company_country: safeString(raw.company_country) || "France",
    company_siren: safeString(raw.company_siren),
    company_size: safeString(raw.company_size),
    company_industry: safeString(raw.company_industry),
    company_description: safeString(raw.company_description),

    contact_first_name: safeString(raw.contact_first_name),
    contact_last_name: safeString(raw.contact_last_name),
    contact_job_title: safeString(raw.contact_job_title),
    contact_email: safeString(raw.contact_email),
    contact_phone: safeString(raw.contact_phone),

    hr_team_size: safeString(raw.hr_team_size),
    recruitment_volume: safeString(raw.recruitment_volume),
    main_hr_needs: safeString(raw.main_hr_needs),
    typical_document_types: safeString(raw.typical_document_types),
    usual_tone: safeString(raw.usual_tone) || "professionnel",
    preferred_language: safeString(raw.preferred_language) || "fr",
    signature_name: safeString(raw.signature_name),
    signature_job_title: safeString(raw.signature_job_title),
    signature_email: safeString(raw.signature_email),
    signature_phone: safeString(raw.signature_phone),
    default_email_footer: safeString(raw.default_email_footer),

    sender_mode: safeString(raw.sender_mode) || "clonestore_fallback",
    sender_email_requested: senderEmailRequested,
    sender_email_effective:
      safeString(raw.sender_email_effective) || "clonestore@clonestore.pro",
    reply_to_email: safeString(raw.reply_to_email) || safeString(raw.contact_email),
    sender_status: safeString(raw.sender_status) || "draft",
    domain_status: safeString(raw.domain_status) || "not_started",
    domain_name: safeString(raw.domain_name) || requestedDomain || companyEmailDomain,
    postmark_domain_id: safeString(raw.postmark_domain_id),
    postmark_signature_id: safeString(raw.postmark_signature_id),

    legal_mentions: safeString(raw.legal_mentions),
    confidentiality_notes: safeString(raw.confidentiality_notes),
    forbidden_words: safeString(raw.forbidden_words),
    mandatory_words: safeString(raw.mandatory_words),
    internal_policy_notes: safeString(raw.internal_policy_notes),

    onboarding_completed: safeBool(raw.onboarding_completed),
  };
}

export async function GET(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (e: unknown) {
    return json(500, {
      error: e instanceof Error ? e.message : "Configuration serveur invalide.",
    });
  }

  const { error: authError, user } = await getAuthenticatedUser(req, supabase);
  if (authError || !user) {
    return json(401, { error: authError || "Non authentifié." });
  }

  const { data, error } = await supabase
    .from("agent_onboarding_pierre")
    .select("*")
    .eq("user_id", user.id)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, {
    ok: true,
    onboarding: data || null,
  });
}

export async function POST(req: NextRequest) {
  let supabase: SupabaseClient;

  try {
    supabase = makeServerSupabase();
  } catch (e: unknown) {
    return json(500, {
      error: e instanceof Error ? e.message : "Configuration serveur invalide.",
    });
  }

  const { error: authError, user } = await getAuthenticatedUser(req, supabase);
  if (authError || !user) {
    return json(401, { error: authError || "Non authentifié." });
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Body JSON invalide." });
  }

  const payload = validatePayload(rawBody);

  if (!payload.company_name) {
    return json(400, { error: "Le nom de l’entreprise est obligatoire." });
  }

  if (!payload.contact_first_name || !payload.contact_last_name) {
    return json(400, { error: "Le contact principal est obligatoire." });
  }

  if (!payload.contact_email) {
    return json(400, { error: "L’email principal est obligatoire." });
  }

  const row = {
    user_id: user.id,
    agent_slug: "pierre",

    ...payload,
    onboarding_completed_at: payload.onboarding_completed ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("agent_onboarding_pierre")
    .upsert(row, {
      onConflict: "user_id,agent_slug",
    })
    .select("*")
    .single();

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, {
    ok: true,
    onboarding: data,
  });
}