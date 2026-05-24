// src/lib/clonestore/documents/company-templates.ts
// Company-level document template management — Bloc 27
// Stores in reusable_rh_context_json.document_templates only.
// No throw. No employees. No memory_json. No secrets.

import type { CloneDocumentTemplate } from "./types";
import {
  isPlainObject,
  normalizeDocumentType,
  normalizeHexColor,
  safeDocumentText,
  clampDocumentQualityScore,
} from "./utils";
import {
  buildDefaultCloneDocumentTheme,
  buildDefaultCloneDocumentSignature,
  buildCloneDocumentTemplateRegistry,
} from "./template-registry";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BLOCKS = 60;
const MAX_VARIABLES = 80;
const MAX_CONTENT_CHARS = 20000;
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 1000;
const MAX_TAGS = 30;
const MAX_TAG_CHARS = 80;
const MAX_TEMPLATES_PER_COMPANY = 200;

const VALID_AUDIENCES = new Set([
  "internal",
  "employee",
  "candidate",
  "manager",
  "executive",
  "external_partner",
]);
const VALID_FORMATS = new Set(["text", "markdown", "html", "pdf_ready_html"]);
const VALID_TONES = new Set([
  "formal",
  "warm",
  "direct",
  "executive",
  "legal_careful",
  "candidate_friendly",
  "neutral",
]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const VALID_VALIDATION_MODES = new Set([
  "none",
  "recommended",
  "required",
  "human_only",
]);
const VALID_SCOPES = new Set([
  "platform_default",
  "company_custom",
  "employee_ai_custom",
]);
const VALID_BLOCK_TYPES = new Set([
  "header",
  "title",
  "subtitle",
  "paragraph",
  "bullet_list",
  "numbered_list",
  "table",
  "signature",
  "legal_notice",
  "footer",
  "separator",
  "callout",
  "variable",
]);
const VALID_DENSITY = new Set(["compact", "comfortable", "spacious"]);

// Dangerous patterns to strip from template content
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
];

function stripDangerous(value: string): string {
  let result = value;
  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result;
}

function sanitizeString(
  value: unknown,
  maxChars: number,
  allowEmpty = false,
): string | null {
  if (typeof value !== "string") return allowEmpty ? "" : null;
  const cleaned = stripDangerous(value.trim()).slice(0, maxChars);
  if (!allowEmpty && cleaned.length === 0) return null;
  return cleaned;
}

function sanitizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (cleaned.length < 2 || cleaned.length > 120) return null;
  return cleaned;
}

// ── Block sanitization ────────────────────────────────────────────────────────

function sanitizeBlock(input: unknown): CloneDocumentTemplate["blocks"][0] | null {
  if (!isPlainObject(input)) return null;

  const id = sanitizeId(input["id"]);
  if (!id) return null;

  const blockType =
    typeof input["type"] === "string" && VALID_BLOCK_TYPES.has(input["type"])
      ? (input["type"] as CloneDocumentTemplate["blocks"][0]["type"])
      : "paragraph";

  const label =
    sanitizeString(input["label"], 200, true) ?? "";
  const content =
    sanitizeString(input["content"], MAX_CONTENT_CHARS, true) ?? "";

  const optional =
    typeof input["optional"] === "boolean" ? input["optional"] : false;

  const rawVars = Array.isArray(input["variables"]) ? input["variables"] : [];
  const variables = rawVars
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter(Boolean)
    .slice(0, 50);

  const rawRisk = input["risk_level"];
  const risk_level =
    typeof rawRisk === "string" && VALID_RISK_LEVELS.has(rawRisk)
      ? (rawRisk as CloneDocumentTemplate["blocks"][0]["risk_level"])
      : "low";

  return { id, type: blockType, label, content, optional, variables, risk_level };
}

// ── Variable sanitization ─────────────────────────────────────────────────────

function sanitizeVariable(
  input: unknown,
): CloneDocumentTemplate["variables"][0] | null {
  if (!isPlainObject(input)) return null;

  const key =
    typeof input["key"] === "string"
      ? input["key"].trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
      : "";
  if (!key) return null;

  const label = sanitizeString(input["label"], 200, true) ?? key;
  const required =
    typeof input["required"] === "boolean" ? input["required"] : false;
  const description = sanitizeString(input["description"], 500, true) ?? "";
  const rawFallback = input["fallback"];
  const fallback =
    typeof rawFallback === "string"
      ? sanitizeString(rawFallback, 500, true)
      : null;
  const sensitive =
    typeof input["sensitive"] === "boolean" ? input["sensitive"] : false;

  return { key, label, required, description, fallback, sensitive };
}

// ── Theme sanitization ────────────────────────────────────────────────────────

function sanitizeTheme(
  input: unknown,
): CloneDocumentTemplate["theme"] {
  const defaults = buildDefaultCloneDocumentTheme();
  if (!isPlainObject(input)) return defaults;

  return {
    name: sanitizeString(input["name"], 100, true) ?? defaults.name,
    primary_color: normalizeHexColor(input["primary_color"], defaults.primary_color),
    accent_color: normalizeHexColor(input["accent_color"], defaults.accent_color),
    text_color: normalizeHexColor(input["text_color"], defaults.text_color),
    background_color: normalizeHexColor(
      input["background_color"],
      defaults.background_color,
    ),
    font_family: sanitizeString(input["font_family"], 100, true) ?? defaults.font_family,
    border_radius:
      typeof input["border_radius"] === "string" &&
      /^[0-9]+(?:px|rem|em|%)$/.test(input["border_radius"].trim())
        ? input["border_radius"].trim()
        : defaults.border_radius,
    density:
      typeof input["density"] === "string" &&
      VALID_DENSITY.has(input["density"])
        ? (input["density"] as CloneDocumentTemplate["theme"]["density"])
        : defaults.density,
  };
}

// ── Signature sanitization ────────────────────────────────────────────────────

function sanitizeSignature(
  input: unknown,
): CloneDocumentTemplate["signature"] {
  if (!isPlainObject(input)) return null;

  const name = sanitizeString(input["name"], 200, true);
  const role = sanitizeString(input["role"], 200, true);
  const company = sanitizeString(input["company"], 200, true);
  const rawEmail =
    typeof input["email"] === "string" ? input["email"].trim() : null;
  const email =
    rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
      ? rawEmail.slice(0, 200)
      : null;
  const phone = sanitizeString(input["phone"], 50, true);
  const legal_footer = sanitizeString(input["legal_footer"], 2000, true);

  return {
    name: name || null,
    role: role || null,
    company: company || null,
    email,
    phone: phone || null,
    legal_footer: legal_footer || null,
  };
}

// ── Core sanitization ─────────────────────────────────────────────────────────

export function sanitizeCompanyDocumentTemplate(
  input: unknown,
): CloneDocumentTemplate | null {
  try {
    if (!isPlainObject(input)) return null;

    const id = sanitizeId(input["id"]);
    if (!id) return null;

    const document_type = normalizeDocumentType(input["document_type"]);
    if (document_type === "generic_hr_document" && !input["document_type"]) return null;

    const title = sanitizeString(input["title"], MAX_TITLE_CHARS);
    if (!title) return null;

    const version =
      typeof input["version"] === "string" && input["version"].trim()
        ? input["version"].trim().slice(0, 20)
        : "1.0.0";

    const scope =
      typeof input["scope"] === "string" && VALID_SCOPES.has(input["scope"])
        ? (input["scope"] as CloneDocumentTemplate["scope"])
        : "company_custom";

    const agent_slug =
      typeof input["agent_slug"] === "string"
        ? input["agent_slug"].trim().slice(0, 60) || null
        : null;

    const description =
      sanitizeString(input["description"], MAX_DESCRIPTION_CHARS, true) ?? "";

    const audience =
      typeof input["audience"] === "string" &&
      VALID_AUDIENCES.has(input["audience"])
        ? (input["audience"] as CloneDocumentTemplate["audience"])
        : "internal";

    const default_format =
      typeof input["default_format"] === "string" &&
      VALID_FORMATS.has(input["default_format"])
        ? (input["default_format"] as CloneDocumentTemplate["default_format"])
        : "html";

    const tone =
      typeof input["tone"] === "string" && VALID_TONES.has(input["tone"])
        ? (input["tone"] as CloneDocumentTemplate["tone"])
        : "formal";

    const risk_level =
      typeof input["risk_level"] === "string" &&
      VALID_RISK_LEVELS.has(input["risk_level"])
        ? (input["risk_level"] as CloneDocumentTemplate["risk_level"])
        : "low";

    const validation_mode =
      typeof input["validation_mode"] === "string" &&
      VALID_VALIDATION_MODES.has(input["validation_mode"])
        ? (input["validation_mode"] as CloneDocumentTemplate["validation_mode"])
        : "recommended";

    // Variables
    const rawVariables = Array.isArray(input["variables"])
      ? input["variables"]
      : [];
    const variables = rawVariables
      .map(sanitizeVariable)
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .slice(0, MAX_VARIABLES);

    // Blocks
    const rawBlocks = Array.isArray(input["blocks"]) ? input["blocks"] : [];
    const blocks = rawBlocks
      .map(sanitizeBlock)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .slice(0, MAX_BLOCKS);

    // Theme
    const theme = sanitizeTheme(input["theme"]);

    // Signature
    const signature = sanitizeSignature(input["signature"]);

    // Tags
    const rawTags = Array.isArray(input["tags"]) ? input["tags"] : [];
    const tags = rawTags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase().slice(0, MAX_TAG_CHARS))
      .filter(Boolean)
      .slice(0, MAX_TAGS);

    const now = new Date().toISOString();
    const created_at =
      typeof input["created_at"] === "string" ? input["created_at"] : now;
    const updated_at = now;

    return {
      id,
      version,
      scope,
      agent_slug,
      document_type,
      title,
      description,
      audience,
      default_format,
      tone,
      risk_level,
      validation_mode,
      variables,
      blocks,
      theme,
      signature,
      tags,
      created_at,
      updated_at,
    };
  } catch {
    return null;
  }
}

export function sanitizeCompanyDocumentTemplateList(
  input: unknown,
): CloneDocumentTemplate[] {
  try {
    if (!Array.isArray(input)) return [];
    return input
      .map(sanitizeCompanyDocumentTemplate)
      .filter((t): t is CloneDocumentTemplate => t !== null)
      .slice(0, MAX_TEMPLATES_PER_COMPANY);
  } catch {
    return [];
  }
}

// ── Merge with defaults ───────────────────────────────────────────────────────

export function mergeCompanyTemplatesWithDefaults(params: {
  defaults: CloneDocumentTemplate[];
  companyTemplates: CloneDocumentTemplate[];
}): CloneDocumentTemplate[] {
  try {
    const { defaults, companyTemplates } = params;

    const safeDefaults = Array.isArray(defaults) ? defaults : [];
    const safeCompany = Array.isArray(companyTemplates) ? companyTemplates : [];

    // Company templates override defaults with matching id
    const companyById = new Map<string, CloneDocumentTemplate>(
      safeCompany.map((t) => [t.id, t]),
    );

    const merged: CloneDocumentTemplate[] = [];
    const seenIds = new Set<string>();

    for (const def of safeDefaults) {
      const override = companyById.get(def.id);
      if (override) {
        merged.push(override);
      } else {
        merged.push(def);
      }
      seenIds.add(def.id);
    }

    // Append company-only templates (not in defaults)
    for (const ct of safeCompany) {
      if (!seenIds.has(ct.id)) {
        merged.push(ct);
        seenIds.add(ct.id);
      }
    }

    return merged;
  } catch {
    return Array.isArray(params?.defaults) ? params.defaults : [];
  }
}

// ── Upsert ────────────────────────────────────────────────────────────────────

export function upsertCompanyDocumentTemplate(params: {
  existing: CloneDocumentTemplate[];
  template: CloneDocumentTemplate;
}): CloneDocumentTemplate[] {
  try {
    const { existing, template } = params;
    const safeExisting = Array.isArray(existing) ? existing : [];

    const index = safeExisting.findIndex((t) => t.id === template.id);
    if (index >= 0) {
      const next = [...safeExisting];
      next[index] = template;
      return next;
    }

    if (safeExisting.length >= MAX_TEMPLATES_PER_COMPANY) {
      return safeExisting;
    }

    return [...safeExisting, template];
  } catch {
    return Array.isArray(params?.existing) ? params.existing : [];
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function deleteCompanyDocumentTemplate(params: {
  existing: CloneDocumentTemplate[];
  templateId: string;
}): CloneDocumentTemplate[] {
  try {
    const { existing, templateId } = params;
    const safeExisting = Array.isArray(existing) ? existing : [];
    if (typeof templateId !== "string" || !templateId.trim()) return safeExisting;
    return safeExisting.filter((t) => t.id !== templateId.trim());
  } catch {
    return Array.isArray(params?.existing) ? params.existing : [];
  }
}

// ── Storage patch builder ─────────────────────────────────────────────────────

export function buildCompanyTemplateStoragePatch(params: {
  reusableRhContextJson: Record<string, unknown>;
  templates: CloneDocumentTemplate[];
}): Record<string, unknown> {
  try {
    const { reusableRhContextJson, templates } = params;

    if (!isPlainObject(reusableRhContextJson)) {
      return { document_templates: templates };
    }

    // CRITICAL: never touch employees key
    const patch: Record<string, unknown> = { ...reusableRhContextJson };
    patch["document_templates"] = Array.isArray(templates) ? templates : [];

    // Guarantee employees key is never modified
    if ("employees" in reusableRhContextJson) {
      patch["employees"] = reusableRhContextJson["employees"];
    }

    return patch;
  } catch {
    return { document_templates: [] };
  }
}

// ── Helpers for route layer ───────────────────────────────────────────────────

export function readCompanyDocumentTemplates(
  reusableRhContextJson: unknown,
): CloneDocumentTemplate[] {
  try {
    if (!isPlainObject(reusableRhContextJson)) return [];
    const raw = reusableRhContextJson["document_templates"];
    return sanitizeCompanyDocumentTemplateList(raw);
  } catch {
    return [];
  }
}

export function getCompanyDocumentTemplateById(
  reusableRhContextJson: unknown,
  templateId: string,
): CloneDocumentTemplate | null {
  try {
    const templates = readCompanyDocumentTemplates(reusableRhContextJson);
    return templates.find((t) => t.id === templateId) ?? null;
  } catch {
    return null;
  }
}

export function buildAllAvailableTemplates(
  reusableRhContextJson: unknown,
): CloneDocumentTemplate[] {
  try {
    const defaults = buildCloneDocumentTemplateRegistry();
    const companyTemplates = readCompanyDocumentTemplates(reusableRhContextJson);
    return mergeCompanyTemplatesWithDefaults({ defaults, companyTemplates });
  } catch {
    return buildCloneDocumentTemplateRegistry();
  }
}
