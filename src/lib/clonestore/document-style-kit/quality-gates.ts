// B45 — Document quality gates
// Hard fails for forbidden patterns, safety checks, and quality scoring.
// Pure: no async, no Supabase, no Next.js, no side effects. No throw.

import type { DocumentQualityResult, QualityGateIssue, DocumentRenderContext } from "./types";
import { DEFAULT_FORBIDDEN_PHRASES } from "./defaults";
import { containsScriptTag, containsEventHandler } from "./sanitize";

// ── Hard fail detection ───────────────────────────────────────────────────────

const UGLY_PLACEHOLDER_PATTERN = /\[[A-ZÀ-Ü][^\]]{0,59}\]/;
const UNRESOLVED_TOKEN_PATTERN = /\{\{[a-zA-Z0-9_]+\}\}/;
const LEGAL_FINALITY_PHRASES = [
  "décision définitive",
  "conseil juridique",
  "je vous conseille juridiquement",
  "force exécutoire",
  "valeur légale définitive",
];
const MARKDOWN_IN_HTML_PATTERN = /^#+\s+\w/m; // markdown heading in html context

export function assertNoGenericChatGptPhrasing(text: string): QualityGateIssue | null {
  const lower = text.toLowerCase();
  for (const phrase of DEFAULT_FORBIDDEN_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return {
        code: "GENERIC_CHATGPT_PHRASE",
        severity: "hard_fail",
        message: `Phrase générique interdite détectée : "${phrase}"`,
        context: phrase,
      };
    }
  }
  return null;
}

export function assertNoUglyPlaceholders(text: string): QualityGateIssue | null {
  const match = text.match(UGLY_PLACEHOLDER_PATTERN);
  if (match) {
    return {
      code: "UGLY_PLACEHOLDER",
      severity: "hard_fail",
      message: `Placeholder moche détecté : "${match[0]}" — utiliser {{variable_name}}`,
      context: match[0],
    };
  }
  return null;
}

export function assertClientVisibleQuality(
  rendered: string,
  companyName: string | null,
): QualityGateIssue | null {
  if (!companyName || companyName.trim().length === 0) {
    if (!rendered.toLowerCase().includes("service rh")) {
      return {
        code: "NO_COMPANY_IDENTITY",
        severity: "hard_fail",
        message: "Document client-visible sans identité entreprise (company_name manquant).",
        context: null,
      };
    }
  }
  return null;
}

export function assertOfficialDocumentGuardrails(
  officialDocument: boolean,
  validationRequirement: string,
  rendered: string,
): QualityGateIssue | null {
  if (!officialDocument) return null;
  const safe = ["required", "required_before_send", "required_before_export", "blocked_without_human"];
  if (!safe.includes(validationRequirement)) {
    return {
      code: "OFFICIAL_NO_VALIDATION",
      severity: "hard_fail",
      message: "Document officiel sans validation humaine requise.",
      context: validationRequirement,
    };
  }
  // Must have the disclaimer
  if (!rendered.toLowerCase().includes("brouillon") && !rendered.toLowerCase().includes("valider")) {
    return {
      code: "OFFICIAL_NO_DISCLAIMER",
      severity: "error",
      message: "Document officiel sans mention de validation obligatoire dans le rendu.",
      context: null,
    };
  }
  return null;
}

export function assertPayrollDocumentGuardrails(
  documentType: string,
  rendered: string,
): QualityGateIssue | null {
  const isPayroll =
    documentType.includes("prepayroll") ||
    documentType.includes("payslip") ||
    documentType.includes("pay_");
  if (!isPayroll) return null;

  const lower = rendered.toLowerCase();
  if (!lower.includes("dsn") && !lower.includes("paie") && !lower.includes("avertissement")) {
    return {
      code: "PAYROLL_NO_DISCLAIMER",
      severity: "hard_fail",
      message: "Document pré-paie sans disclaimer DSN/paie requis.",
      context: null,
    };
  }
  return null;
}

export function assertDocumentHasStructure(
  html: string,
  text: string,
): QualityGateIssue | null {
  if (text.trim().length < 50) {
    return {
      code: "TOO_SHORT",
      severity: "hard_fail",
      message: `Contenu du document trop court (${text.trim().length} chars). Minimum 50.`,
      context: null,
    };
  }
  if (!html.includes("<div") && !html.includes("<p") && !html.includes("<h1")) {
    return {
      code: "NO_STRUCTURE",
      severity: "error",
      message: "Rendu HTML sans structure (pas de div/p/h1).",
      context: null,
    };
  }
  return null;
}

export function assertDocumentHasEnterpriseIdentity(
  rendered: string,
  companyName: string | null,
): QualityGateIssue | null {
  if (!companyName) return null;
  if (!rendered.toLowerCase().includes(companyName.toLowerCase())) {
    return {
      code: "MISSING_ENTERPRISE_IDENTITY",
      severity: "warning",
      message: `Nom d'entreprise "${companyName}" absent du rendu.`,
      context: companyName,
    };
  }
  return null;
}

// ── Score rendered document quality ──────────────────────────────────────────

export function scoreRenderedDocumentQuality(params: {
  ctx: DocumentRenderContext;
  html: string;
  text: string;
  unresolved_tokens: string[];
  missing_variables: string[];
}): DocumentQualityResult {
  const { ctx, html, text, unresolved_tokens, missing_variables } = params;
  const issues: QualityGateIssue[] = [];

  // Hard fail checks
  const checks = [
    assertNoGenericChatGptPhrasing(text),
    assertNoUglyPlaceholders(text),
    assertDocumentHasStructure(html, text),
    assertOfficialDocumentGuardrails(
      ctx.template.official_document,
      ctx.template.default_validation_requirement,
      html,
    ),
    assertPayrollDocumentGuardrails(ctx.template.document_type, text),
  ];

  for (const issue of checks) {
    if (issue) issues.push(issue);
  }

  // Script tag check
  if (containsScriptTag(html)) {
    issues.push({
      code: "SCRIPT_TAG",
      severity: "hard_fail",
      message: "Script tag détecté dans le rendu HTML — injection XSS bloquée.",
      context: null,
    });
  }

  // Event handler check
  if (containsEventHandler(html)) {
    issues.push({
      code: "EVENT_HANDLER",
      severity: "hard_fail",
      message: "Event handler HTML détecté dans le rendu — injection bloquée.",
      context: null,
    });
  }

  // Legal finality claim
  const lowerText = text.toLowerCase();
  for (const phrase of LEGAL_FINALITY_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      issues.push({
        code: "LEGAL_FINALITY_CLAIM",
        severity: "hard_fail",
        message: `Revendication de finalité légale détectée : "${phrase}"`,
        context: phrase,
      });
    }
  }

  // Raw markdown in HTML
  if (MARKDOWN_IN_HTML_PATTERN.test(html)) {
    issues.push({
      code: "MARKDOWN_IN_HTML",
      severity: "error",
      message: "Markdown brut détecté dans le rendu HTML (titres ## non rendus).",
      context: null,
    });
  }

  // Unresolved tokens
  if (unresolved_tokens.length > 0) {
    issues.push({
      code: "UNRESOLVED_TOKENS",
      severity: "hard_fail",
      message: `${unresolved_tokens.length} token(s) non résolu(s) : ${unresolved_tokens.slice(0, 3).join(", ")}`,
      context: unresolved_tokens.join(", "),
    });
  }

  // Missing required variables
  if (missing_variables.length > 0) {
    issues.push({
      code: "MISSING_REQUIRED_VARS",
      severity: "error",
      message: `${missing_variables.length} variable(s) requise(s) manquante(s) : ${missing_variables.slice(0, 3).join(", ")}`,
      context: missing_variables.join(", "),
    });
  }

  // Enterprise identity warning
  const identityIssue = assertDocumentHasEnterpriseIdentity(text, ctx.company_name);
  if (identityIssue) issues.push(identityIssue);

  // Score computation
  const hard_fails = issues.filter((i) => i.severity === "hard_fail");
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  let score = 100;
  score -= hard_fails.length * 30;
  score -= errors.length * 10;
  score -= warnings.length * 3;
  score -= missing_variables.length * 5;
  score -= unresolved_tokens.length * 8;

  // Bonus for well-structured document
  if (text.length > 300) score = Math.min(100, score + 5);
  if (ctx.style_kit.signature.enabled) score = Math.min(100, score + 5);
  if (ctx.company_name) score = Math.min(100, score + 3);

  score = Math.max(0, Math.min(100, score));

  const passed = hard_fails.length === 0 && errors.length === 0;
  const client_visible_safe = hard_fails.length === 0;

  return { score, passed, issues, hard_fails, warnings, client_visible_safe };
}
