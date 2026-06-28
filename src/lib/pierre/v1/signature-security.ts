// src/lib/pierre/v1/signature-security.ts
// PHASE 8.3-B3-R2.1/R2.2 — canonical, FAIL-CLOSED Yousign SES / AES / QES security matrix +
// real phone-number normalization. This is a PURE module (no HTTP, no DB, no secret). The
// concrete adapter and the orchestration both resolve a signer's security through here, so an
// unsupported combination (e.g. QES + OTP, AES without a phone, AES/QES without the provider
// capability) is REFUSED before any provider HTTP call is made.

import type { SignatureLevel } from "./signature-provider";

export class SignerSecurityError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = "SignerSecurityError"; }
}

export type ProviderSignatureLevel = "electronic_signature" | "advanced_electronic_signature" | "qualified_electronic_signature";
export type ProviderAuthenticationMode = "no_otp" | "otp_email" | "otp_sms";

export type ProviderSecurityCapabilities = { aes_enabled: boolean; qes_enabled: boolean };

export type SignerSecurityInput = {
  signature_level: SignatureLevel;
  /** The requested authentication mode (per recipient). null/undefined = none requested. */
  requested_authentication_mode?: string | null;
  phone_number?: string | null;
  provider_capabilities: ProviderSecurityCapabilities;
};

export type ResolvedSignerSecurity = {
  provider_signature_level: ProviderSignatureLevel;
  /** null means the field MUST be omitted from the provider payload (QES). */
  provider_authentication_mode: ProviderAuthenticationMode | null;
  phone_number_required: boolean;
  identity_verification_required: boolean;
  capability_required: "aes" | "qes" | null;
};

// R3.1 — the ONE canonical, explicit conversion from a contract-policy signature level to the
// provider signature level (`SignatureLevel`). It NEVER weakens a requirement: `advanced` →
// AES, `qualified` → QES. There is no `advanced → simple` (SES) downgrade anywhere. `none` means
// no signature is required. The adaptation layer must use ONLY this map — never re-interpret.
export type ContractPolicyLevel = "none" | "acknowledgement" | "simple" | "advanced" | "qualified";
export function providerLevelForPolicy(level: ContractPolicyLevel): SignatureLevel | null {
  switch (level) {
    case "none": return null;
    case "acknowledgement": return "acknowledgement";
    case "simple": return "simple";
    case "advanced": return "advanced_provider_managed";
    case "qualified": return "qualified_provider_managed";
    default: throw new SignerSecurityError(`unknown contract policy signature level: ${String(level)}`, "unknown_policy_level");
  }
}

// CloneStore canonical level → Yousign security tier.
type Tier = "SES" | "AES" | "QES";
function tierForLevel(level: SignatureLevel): Tier {
  switch (level) {
    case "acknowledgement":
    case "simple":
      return "SES";
    case "advanced_provider_managed":
      return "AES";
    case "qualified_provider_managed":
      return "QES";
    default:
      throw new SignerSecurityError(`unknown signature level: ${String(level)}`, "unknown_level");
  }
}

const SES_MODES = new Set<ProviderAuthenticationMode>(["no_otp", "otp_email", "otp_sms"]);

/**
 * Resolve the EXACT provider security for one signer, FAIL-CLOSED. Throws SignerSecurityError on
 * any combination Yousign does not really support (so the caller never sends an invalid payload).
 */
export function resolveYousignSignerSecurity(input: SignerSecurityInput): ResolvedSignerSecurity {
  const tier = tierForLevel(input.signature_level);
  const requested = (input.requested_authentication_mode ?? null) as ProviderAuthenticationMode | null;
  const hasPhone = !!(input.phone_number && String(input.phone_number).trim().length > 0);

  if (tier === "SES") {
    // SES: electronic_signature with no_otp | otp_email | otp_sms. otp_sms requires a phone.
    const mode: ProviderAuthenticationMode = requested ?? "no_otp";
    if (!SES_MODES.has(mode)) throw new SignerSecurityError(`SES does not support authentication mode '${mode}'`, "ses_bad_mode");
    if (mode === "otp_sms" && !hasPhone) throw new SignerSecurityError("SES + otp_sms requires a phone number", "ses_otp_sms_no_phone");
    return {
      provider_signature_level: "electronic_signature",
      provider_authentication_mode: mode,
      phone_number_required: mode === "otp_sms",
      identity_verification_required: false,
      capability_required: null,
    };
  }

  if (tier === "AES") {
    // AES: advanced_electronic_signature, MUST be otp_sms, MUST have a phone, capability enabled.
    if (!input.provider_capabilities.aes_enabled) throw new SignerSecurityError("AES requested but the provider AES capability is not enabled", "aes_capability_disabled");
    if (requested !== "otp_sms") throw new SignerSecurityError(`AES requires otp_sms (got '${requested ?? "none"}')`, "aes_bad_mode");
    if (!hasPhone) throw new SignerSecurityError("AES requires a phone number", "aes_no_phone");
    return {
      provider_signature_level: "advanced_electronic_signature",
      provider_authentication_mode: "otp_sms",
      phone_number_required: true,
      identity_verification_required: true,
      capability_required: "aes",
    };
  }

  // QES: qualified_electronic_signature, NO OTP authentication mode (omitted), capability enabled.
  if (!input.provider_capabilities.qes_enabled) throw new SignerSecurityError("QES requested but the provider QES capability is not enabled", "qes_capability_disabled");
  if (requested !== null) throw new SignerSecurityError(`QES does not use an OTP authentication mode (got '${requested}')`, "qes_with_otp");
  return {
    provider_signature_level: "qualified_electronic_signature",
    provider_authentication_mode: null, // MUST be omitted from the payload
    phone_number_required: false,
    identity_verification_required: true,
    capability_required: "qes",
  };
}

/**
 * R2.1 request-level consistency: every signer of a QES request must be QES (no mixing with
 * SES/AES). Levels are per-request in CloneStore, so this asserts the request level is coherent
 * with each recipient's resolved tier.
 */
export function assertRequestSecurityConsistency(requestLevel: SignatureLevel, recipientLevels: SignatureLevel[]): void {
  const reqTier = tierForLevel(requestLevel);
  for (const rl of recipientLevels) {
    if (tierForLevel(rl) !== reqTier) throw new SignerSecurityError(`mixed signature tiers in one request: ${reqTier} request has a ${tierForLevel(rl)} signer`, "mixed_tiers");
  }
}

// ── Phone normalization (E.164) ─────────────────────────────────────────────────────
// R3.6 — convert national numbers ONLY for countries whose national plan is explicitly supported
// AND tested. A bare leading-zero strip is NOT a safe universal rule, so an unsupported/ambiguous
// country fails CLOSED rather than being mis-normalized. Extend ONLY with a vetted rule (or a real
// libphonenumber integration) — never with an approximate dialing table.
type NationalRule = { cc: string; national: RegExp };
const SUPPORTED_COUNTRIES: Record<string, NationalRule> = {
  // France: 10 digits, trunk 0 + [1-9] + 8 digits → +33XXXXXXXXX.
  FR: { cc: "33", national: /^0[1-9]\d{8}$/ },
  // Switzerland: 10 digits, trunk 0 + [1-9] + 8 digits → +41XXXXXXXXX.
  CH: { cc: "41", national: /^0[1-9]\d{8}$/ },
};
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize a raw phone to E.164 (+CC...). Returns the normalized number, or throws
 * SignerSecurityError when the value is absent/invalid or cannot be SAFELY normalized.
 * - already "+..." → validated as-is
 * - "00..." international prefix → "+..."
 * - national → ONLY for an explicitly-supported country whose national rule matches (FR, CH)
 * - anything else (unsupported/ambiguous country, malformed national) → fail closed
 */
export function normalizePhoneNumber(raw: string | null | undefined, countryHint?: string | null): string {
  if (raw == null || String(raw).trim().length === 0) throw new SignerSecurityError("phone number is required but missing", "phone_missing");
  let s = String(raw).trim().replace(/[\s().\- ]/g, "");
  if (s.startsWith("+")) {
    if (!E164.test(s)) throw new SignerSecurityError("phone number is not a valid E.164 number", "phone_invalid");
    return s;
  }
  if (s.startsWith("00")) {
    s = "+" + s.slice(2);
    if (!E164.test(s)) throw new SignerSecurityError("phone number is not a valid E.164 number", "phone_invalid");
    return s;
  }
  const rule = countryHint ? SUPPORTED_COUNTRIES[countryHint.trim().toUpperCase()] : undefined;
  if (!rule) throw new SignerSecurityError("phone number country is not supported for safe normalization", "phone_country_unsupported");
  if (!rule.national.test(s)) throw new SignerSecurityError("phone number does not match the national format for this country", "phone_invalid");
  s = "+" + rule.cc + s.slice(1);
  if (!E164.test(s)) throw new SignerSecurityError("phone number is not a valid E.164 number", "phone_invalid");
  return s;
}
