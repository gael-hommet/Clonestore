// TECH-11 — Technology Readiness Final Gate — Validation
// 35 règles de validation pour le rapport de readiness.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  TechnologyReadinessReport,
  TechnologyReadinessSnapshot,
  TechnologyReadinessValidationIssue,
  TechnologyReadinessValidationReport,
} from "./technology-readiness-types";
import type { GlobalTechnologyKey } from "../technologies/global-tech-config";

// ── Helper ────────────────────────────────────────────────────────────────────

function issue(
  code: string,
  field: string,
  message: string,
  severity: "error" | "warning" | "info" = "error",
): TechnologyReadinessValidationIssue {
  return { code, field, message, severity };
}

// ── Règles de validation ──────────────────────────────────────────────────────

const REQUIRED_TECHNOLOGY_KEYS: GlobalTechnologyKey[] = [
  "cloneos", "cloneadn", "cloneguard", "clonetrace", "clonevoice",
  "clonechat", "clonepolicy", "clonecontinuum", "clonetrust",
  "clonereview", "clonesignals", "clonelearn", "clonebrief",
];

const FORBIDDEN_PHRASES = [
  "lancement public go",
  "public launch go",
  "public launch ready",
  "conformité garantie",
  "conformite garantie",
  "zéro erreur",
  "zero erreur",
  "clonevoice est actif en production",
  "clonevoice actif production",
  "voice active in production",
  "clonetrust zero-trust",
  "clonetrust est zero-trust",
  "clonechat est cloneos",
  "clonechat is cloneos",
  "pierre est cloneos",
  "pierre is cloneos",
  "supabase.from",
  "openai.chat",
  "anthropic.messages",
  "stripe.charges.create",
  "resend.emails.send",
  "proofs.validated = true",
  "go_live_flags",
];

/**
 * Valide le rapport complet de readiness — 35 règles TR01-TR35.
 */
export function validateTechnologyReadinessReport(
  report: TechnologyReadinessReport,
): TechnologyReadinessValidationReport {
  const issues: Array<TechnologyReadinessValidationIssue | null> = [];

  // TR01 — report_id non vide
  issues.push(
    !report.report_id || report.report_id.trim().length === 0
      ? issue("TR01", "report_id", "report_id ne peut pas être vide.")
      : null,
  );

  // TR02 — generated_at présent
  issues.push(
    !report.generated_at || report.generated_at.trim().length === 0
      ? issue("TR02", "generated_at", "generated_at ne peut pas être vide.")
      : null,
  );

  // TR03 — technologies count >= 13
  issues.push(
    report.technologies.length < 13
      ? issue(
          "TR03",
          "technologies",
          `technologies.length (${report.technologies.length}) doit être >= 13.`,
        )
      : null,
  );

  // TR04–TR16 — présence des 13 technologies
  for (let i = 0; i < REQUIRED_TECHNOLOGY_KEYS.length; i++) {
    const key = REQUIRED_TECHNOLOGY_KEYS[i];
    const ruleCode = `TR${(i + 4).toString().padStart(2, "0")}`;
    const found = report.technologies.some((t) => t.key === key);
    issues.push(
      !found
        ? issue(ruleCode, "technologies", `La technologie '${key}' doit être présente dans le rapport.`)
        : null,
    );
  }

  // TR17 — public_launch_ready false si external blockers
  issues.push(
    report.external_blockers.length > 0 && report.public_launch_ready !== false
      ? issue(
          "TR17",
          "public_launch_ready",
          "public_launch_ready doit être false tant que des blockers externes existent.",
        )
      : null,
  );

  // TR18 — public_launch_ready toujours false
  issues.push(
    report.public_launch_ready !== false
      ? issue("TR18", "public_launch_ready", "public_launch_ready doit toujours être false (TECH-11).")
      : null,
  );

  // TR19–TR35 — phrases interdites dans le rapport markdown/executive summary
  const reportText = JSON.stringify(report).toLowerCase();

  const forbiddenChecks: [string, string][] = [
    ["TR19", "no public launch GO claim"],
    ["TR20", "no conformité garantie"],
    ["TR21", "no zéro erreur"],
    ["TR22", "CloneVoice not production active"],
    ["TR23", "CloneTrust not zero-trust"],
    ["TR24", "CloneChat not CloneOS"],
    ["TR25", "Pierre not CloneOS"],
    ["TR26", "no Supabase write pattern"],
    ["TR27", "no OpenAI call"],
    ["TR28", "no Anthropic call"],
    ["TR29", "no Stripe live"],
    ["TR30", "no resend.emails.send"],
    ["TR31", "no proofs auto-verified"],
    ["TR32", "no go-live flags modified"],
  ];

  const forbiddenPhraseMap: Record<string, string[]> = {
    "TR19": ["lancement public go", "public launch go"],
    "TR20": ["conformité garantie", "conformite garantie"],
    "TR21": ["zéro erreur", "zero erreur"],
    "TR22": ["clonevoice est actif en production", "clonevoice actif production", "voice active in production"],
    "TR23": ["clonetrust zero-trust", "clonetrust est zero-trust"],
    "TR24": ["clonechat est cloneos", "clonechat is cloneos"],
    "TR25": ["pierre est cloneos", "pierre is cloneos"],
    "TR26": ["supabase.from"],
    "TR27": ["openai.chat"],
    "TR28": ["anthropic.messages"],
    "TR29": ["stripe.charges.create"],
    "TR30": ["resend.emails.send"],
    "TR31": ["proofs.validated = true"],
    "TR32": ["go_live_flags"],
  };

  for (const [code, label] of forbiddenChecks) {
    const phrases = forbiddenPhraseMap[code] ?? [];
    const found = phrases.find((p) => reportText.includes(p));
    issues.push(
      found
        ? issue(code, label, `Phrase interdite détectée dans le rapport : "${found}".`, "error")
        : null,
    );
  }

  // TR33 — Pierre est dans employees
  issues.push(
    !report.employees.some((e) => e.employee_slug === "pierre")
      ? issue("TR33", "employees", "Pierre doit être dans employees[].", "error")
      : null,
  );

  // TR34 — Pas de Emma/Lucas/Sophie actifs
  const fakeActive = report.employees.filter(
    (e) => ["emma", "lucas", "sophie"].includes(e.employee_slug) && e.is_active,
  );
  issues.push(
    fakeActive.length > 0
      ? issue(
          "TR34",
          "employees",
          `Employés fictifs actifs détectés : ${fakeActive.map((e) => e.employee_slug).join(", ")}.`,
        )
      : null,
  );

  // TR35 — Invariants présents
  issues.push(
    report.invariants.length === 0
      ? issue("TR35", "invariants", "Le rapport doit contenir au moins un invariant.")
      : null,
  );

  const allIssues = issues.filter((i): i is TechnologyReadinessValidationIssue => i !== null);
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Valide le snapshot.
 */
export function validateTechnologyReadinessSnapshot(
  snapshot: TechnologyReadinessSnapshot,
): TechnologyReadinessValidationReport {
  const issues: Array<TechnologyReadinessValidationIssue | null> = [];

  issues.push(
    snapshot.total_technologies < 13
      ? issue("TS01", "total_technologies", `total_technologies (${snapshot.total_technologies}) doit être >= 13.`)
      : null,
  );

  issues.push(
    snapshot.public_launch_ready !== false
      ? issue("TS02", "public_launch_ready", "public_launch_ready doit être false dans le snapshot.")
      : null,
  );

  issues.push(
    snapshot.external_blockers_count < 1
      ? issue("TS03", "external_blockers_count", "Au moins 1 blocker externe attendu.", "warning")
      : null,
  );

  issues.push(
    snapshot.ready_count + snapshot.partial_count + snapshot.roadmap_count + snapshot.blocked_count >
      snapshot.total_technologies
      ? issue("TS04", "counts", "La somme des statuts ne peut pas dépasser total_technologies.")
      : null,
  );

  const allIssues = issues.filter((i): i is TechnologyReadinessValidationIssue => i !== null);
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Obtient le rapport de validation complet.
 */
export function getTechnologyReadinessValidationReport(
  report: TechnologyReadinessReport,
): TechnologyReadinessValidationReport {
  return validateTechnologyReadinessReport(report);
}
