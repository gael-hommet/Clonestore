// src/lib/clonestore/adn/utils.ts
// Pure utility functions for the CloneADN system — Bloc 28
// No async, no side effects, no Next.js, no Supabase. No throw.

import type {
  CloneADNTone,
  CloneADNAutonomyLevel,
  CloneADNValidationMode,
  CloneADNRuleSeverity,
  CloneADNProfileStatus,
  CloneADNCommunicationLength,
  CloneADNRuleCategory,
} from "./types";

// ── Type guards ───────────────────────────────────────────────────────────────

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── Safe string extraction ────────────────────────────────────────────────────

export function safeADNString(
  value: unknown,
  maxChars = 500,
  allowEmpty = false,
): string | null {
  if (typeof value !== "string") return allowEmpty ? "" : null;
  const cleaned = value.trim().slice(0, maxChars);
  if (!allowEmpty && cleaned.length === 0) return null;
  return cleaned;
}

// ── ID normalization ──────────────────────────────────────────────────────────

export function normalizeADNId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (cleaned.length < 2 || cleaned.length > 120) return null;
  return cleaned;
}

// ── Tone normalization ────────────────────────────────────────────────────────

const VALID_ADN_TONES = new Set<CloneADNTone>([
  "formal",
  "warm",
  "direct",
  "executive",
  "neutral",
  "legal_careful",
  "candidate_friendly",
  "internal_concise",
]);

export function normalizeCloneADNTone(
  value: unknown,
  fallback: CloneADNTone = "formal",
): CloneADNTone {
  if (typeof value === "string" && VALID_ADN_TONES.has(value as CloneADNTone)) {
    return value as CloneADNTone;
  }
  return fallback;
}

// ── Autonomy level normalization ──────────────────────────────────────────────

const VALID_AUTONOMY_LEVELS = new Set<CloneADNAutonomyLevel>([
  "manual",
  "assist",
  "supervised",
  "trusted",
  "restricted",
]);

export function normalizeCloneADNAutonomyLevel(
  value: unknown,
  fallback: CloneADNAutonomyLevel = "supervised",
): CloneADNAutonomyLevel {
  if (
    typeof value === "string" &&
    VALID_AUTONOMY_LEVELS.has(value as CloneADNAutonomyLevel)
  ) {
    return value as CloneADNAutonomyLevel;
  }
  return fallback;
}

// ── Validation mode normalization ─────────────────────────────────────────────

const VALID_VALIDATION_MODES = new Set<CloneADNValidationMode>([
  "none",
  "recommended",
  "required",
  "human_only",
]);

export function normalizeCloneADNValidationMode(
  value: unknown,
  fallback: CloneADNValidationMode = "recommended",
): CloneADNValidationMode {
  if (
    typeof value === "string" &&
    VALID_VALIDATION_MODES.has(value as CloneADNValidationMode)
  ) {
    return value as CloneADNValidationMode;
  }
  return fallback;
}

// ── Rule severity normalization ───────────────────────────────────────────────

const VALID_RULE_SEVERITIES = new Set<CloneADNRuleSeverity>([
  "info",
  "warning",
  "block",
  "critical",
]);

export function normalizeCloneADNRuleSeverity(
  value: unknown,
  fallback: CloneADNRuleSeverity = "warning",
): CloneADNRuleSeverity {
  if (
    typeof value === "string" &&
    VALID_RULE_SEVERITIES.has(value as CloneADNRuleSeverity)
  ) {
    return value as CloneADNRuleSeverity;
  }
  return fallback;
}

// ── Communication length normalization ────────────────────────────────────────

const VALID_COMM_LENGTHS = new Set<CloneADNCommunicationLength>([
  "concise",
  "standard",
  "detailed",
  "comprehensive",
]);

export function normalizeCloneADNCommunicationLength(
  value: unknown,
  fallback: CloneADNCommunicationLength = "standard",
): CloneADNCommunicationLength {
  if (
    typeof value === "string" &&
    VALID_COMM_LENGTHS.has(value as CloneADNCommunicationLength)
  ) {
    return value as CloneADNCommunicationLength;
  }
  return fallback;
}

// ── Rule category normalization ───────────────────────────────────────────────

const VALID_RULE_CATEGORIES = new Set<CloneADNRuleCategory>([
  "communication",
  "validation",
  "autonomy",
  "document",
  "compliance",
  "security",
  "hr_process",
  "custom",
]);

export function normalizeCloneADNRuleCategory(
  value: unknown,
  fallback: CloneADNRuleCategory = "custom",
): CloneADNRuleCategory {
  if (
    typeof value === "string" &&
    VALID_RULE_CATEGORIES.has(value as CloneADNRuleCategory)
  ) {
    return value as CloneADNRuleCategory;
  }
  return fallback;
}

// ── Profile status normalization ──────────────────────────────────────────────

const VALID_PROFILE_STATUSES = new Set<CloneADNProfileStatus>([
  "not_configured",
  "partial",
  "configured",
  "strong",
  "locked",
]);

export function normalizeCloneADNProfileStatus(
  value: unknown,
  fallback: CloneADNProfileStatus = "not_configured",
): CloneADNProfileStatus {
  if (
    typeof value === "string" &&
    VALID_PROFILE_STATUSES.has(value as CloneADNProfileStatus)
  ) {
    return value as CloneADNProfileStatus;
  }
  return fallback;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

export function dedupeADNStringList(
  input: unknown,
  maxItems = 50,
  maxChars = 200,
): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const clean = item.trim().slice(0, maxChars);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= maxItems) break;
  }
  return result;
}

// ── Score clamping ────────────────────────────────────────────────────────────

export function clampADNScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ── ISO timestamp ─────────────────────────────────────────────────────────────

export function nowISO(): string {
  return new Date().toISOString();
}

// ── Sensitive HR topic detection ──────────────────────────────────────────────

const SENSITIVE_TOPIC_KEYWORDS = [
  "disciplinary",
  "disciplinaire",
  "dismissal",
  "licenciement",
  "harassment",
  "harcèlement",
  "harcelement",
  "salary",
  "salaire",
  "compensation",
  "rémunération",
  "remuneration",
  "medical",
  "médical",
  "health",
  "santé",
  "sante",
  "termination",
  "rupture",
  "legal",
  "juridique",
  "litigation",
  "contentieux",
  "grievance",
  "plainte",
  "investigation",
  "misconduct",
  "faute",
];

export function containsSensitiveHRTopic(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return SENSITIVE_TOPIC_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Domain detection from text ────────────────────────────────────────────────

export function detectADNDomainFromText(text: unknown): string {
  if (typeof text !== "string" || !text.trim()) return "general";
  const lower = text.toLowerCase();

  if (
    lower.includes("contract") ||
    lower.includes("contrat") ||
    lower.includes("amendment") ||
    lower.includes("avenant")
  )
    return "contract";

  if (
    lower.includes("onboard") ||
    lower.includes("intégration") ||
    lower.includes("integration") ||
    lower.includes("welcome") ||
    lower.includes("bienvenue")
  )
    return "onboarding";

  if (
    lower.includes("payroll") ||
    lower.includes("paie") ||
    lower.includes("salary") ||
    lower.includes("salaire") ||
    lower.includes("compensation")
  )
    return "payroll";

  if (
    lower.includes("email") ||
    lower.includes("message") ||
    lower.includes("communication")
  )
    return "communication";

  if (
    lower.includes("disciplinary") ||
    lower.includes("disciplinaire") ||
    lower.includes("warning") ||
    lower.includes("avertissement")
  )
    return "disciplinary";

  if (
    lower.includes("absence") ||
    lower.includes("congé") ||
    lower.includes("conge") ||
    lower.includes("leave")
  )
    return "absence";

  return "general";
}

// ── Email validation ──────────────────────────────────────────────────────────

export function isValidADNEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ── Country code normalization ────────────────────────────────────────────────

export function normalizeADNCountryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.length !== 2) return null;
  return clean;
}
