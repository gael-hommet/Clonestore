// src/lib/pierre/release-candidate/invariant-auditor.ts
// Pierre Release Candidate — Global invariant auditor.
// Detects forbidden patterns: scheduled_for, old log schema, email auto-send, etc.
// Pure module: no Supabase, no Next, no async, no side effects. Never throws.

import { buildRCCheck, buildRCFail, buildRCWarning } from "./checks";
import type { PierreReleaseCandidateCheck } from "./types";

// ══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

// ══════════════════════════════════════════════════════════════
// 1. GENERIC KEY SCANNER
// ══════════════════════════════════════════════════════════════

export function scanObjectForForbiddenKeys(
  value: unknown,
  forbiddenKeys: string[],
  _path = "",
): Array<{ path: string; key: string }> {
  const results: Array<{ path: string; key: string }> = [];
  if (!isObject(value) && !Array.isArray(value)) return results;

  function walk(node: unknown, currentPath: string): void {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${currentPath}[${i}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const key of Object.keys(node)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (forbiddenKeys.includes(key)) {
        results.push({ path: childPath, key });
      }
      walk(node[key], childPath);
    }
  }

  walk(value, _path);
  return results;
}

// ══════════════════════════════════════════════════════════════
// 2. TASK SAFETY AUDIT
// ══════════════════════════════════════════════════════════════

export function auditPierreTaskSafety(
  tasks: Record<string, unknown>[],
): PierreReleaseCandidateCheck[] {
  const checks: PierreReleaseCandidateCheck[] = [];
  if (!Array.isArray(tasks)) tasks = [];

  // scheduled_for forbidden (use execute_at)
  const scheduledForHits = tasks.filter(
    (t) =>
      "scheduled_for" in t ||
      (isObject(t.payload_json) && "scheduled_for" in t.payload_json),
  );
  checks.push(
    buildRCCheck({
      id: "task_no_scheduled_for",
      area: "schema",
      label: "Aucune tâche n'utilise scheduled_for (execute_at requis)",
      pass: scheduledForHits.length === 0,
      expected: "0 tasks avec scheduled_for",
      actual: `${scheduledForHits.length} tasks avec scheduled_for`,
      severity: "critical",
      recommendation: scheduledForHits.length > 0
        ? "Remplacer scheduled_for par execute_at dans toutes les tâches."
        : null,
    }),
  );

  // email.send never auto-safe
  const emailSendAutoSafe = tasks.filter((t) => {
    const taskType = asStr(t.type || t.task_type || "");
    const isEmailSend =
      taskType === "email.send" || taskType === "send_email" || taskType === "email_send";
    const isAutoSafe = t.approval_required === false && !t.approval_required;
    return isEmailSend && isAutoSafe;
  });
  checks.push(
    buildRCCheck({
      id: "task_no_email_send_auto",
      area: "security",
      label: "email.send n'est jamais auto-exécuté (approval_required)",
      pass: emailSendAutoSafe.length === 0,
      expected: "0 tasks email.send sans approval_required",
      actual: `${emailSendAutoSafe.length} tasks email.send potentiellement auto`,
      severity: "critical",
      recommendation: emailSendAutoSafe.length > 0
        ? "Définir approval_required=true sur toutes les tâches email.send."
        : null,
    }),
  );

  // approval_required tasks not auto-safe
  const approvalTasks = tasks.filter(
    (t) => t.approval_required === true,
  );
  const approvalAutoSafe = approvalTasks.filter(
    (t) => t.status === "ready" || t.status === "auto_executed",
  );
  checks.push(
    buildRCCheck({
      id: "task_approval_required_not_auto",
      area: "security",
      label: "Tâches approval_required ne sont pas auto-exécutées",
      pass: approvalAutoSafe.length === 0,
      expected: "0 tasks approval_required en status auto-exécuté",
      actual: `${approvalAutoSafe.length} tasks approval_required en status ready/auto`,
      severity: "critical",
      recommendation: approvalAutoSafe.length > 0
        ? "Les tâches approval_required doivent avoir status awaiting_approval, pas ready."
        : null,
    }),
  );

  return checks;
}

// ══════════════════════════════════════════════════════════════
// 3. LOG SCHEMA AUDIT
// ══════════════════════════════════════════════════════════════

export function auditPierreLogSchema(
  logs: Record<string, unknown>[],
): PierreReleaseCandidateCheck[] {
  const checks: PierreReleaseCandidateCheck[] = [];
  if (!Array.isArray(logs)) logs = [];

  // Must not use old "level" field
  const withLevel = logs.filter((l) => "level" in l);
  checks.push(
    buildRCCheck({
      id: "log_no_level_field",
      area: "schema",
      label: "Logs n'utilisent pas le champ 'level' (old schema)",
      pass: withLevel.length === 0,
      expected: "0 logs avec champ level",
      actual: `${withLevel.length} logs avec champ level`,
      severity: "critical",
      recommendation: withLevel.length > 0
        ? "Remplacer level par event_type + message + meta_json."
        : null,
    }),
  );

  // Must not use old "event" field
  const withEvent = logs.filter((l) => "event" in l);
  checks.push(
    buildRCCheck({
      id: "log_no_event_field",
      area: "schema",
      label: "Logs n'utilisent pas le champ 'event' (old schema)",
      pass: withEvent.length === 0,
      expected: "0 logs avec champ event",
      actual: `${withEvent.length} logs avec champ event`,
      severity: "critical",
      recommendation: withEvent.length > 0
        ? "Remplacer event par event_type dans les logs."
        : null,
    }),
  );

  // Must not use old "payload" field
  const withPayload = logs.filter((l) => "payload" in l);
  checks.push(
    buildRCCheck({
      id: "log_no_payload_field",
      area: "schema",
      label: "Logs n'utilisent pas le champ 'payload' (old schema)",
      pass: withPayload.length === 0,
      expected: "0 logs avec champ payload",
      actual: `${withPayload.length} logs avec champ payload`,
      severity: "critical",
      recommendation: withPayload.length > 0
        ? "Remplacer payload par meta_json dans les logs."
        : null,
    }),
  );

  // Should have event_type
  const withoutEventType = logs.filter((l) => !("event_type" in l) && logs.length > 0);
  if (logs.length > 0) {
    checks.push(
      buildRCCheck({
        id: "log_has_event_type",
        area: "schema",
        label: "Logs utilisent le champ event_type (schema correct)",
        pass: withoutEventType.length === 0,
        expected: "Tous les logs avec event_type",
        actual: `${withoutEventType.length}/${logs.length} logs sans event_type`,
        severity: "error",
        recommendation: withoutEventType.length > 0
          ? "Ajouter event_type à tous les logs."
          : null,
      }),
    );
  }

  return checks;
}

// ══════════════════════════════════════════════════════════════
// 4. STORAGE SHAPE AUDIT
// ══════════════════════════════════════════════════════════════

export function auditPierreStorageShape(
  memory: Record<string, unknown> | null,
): PierreReleaseCandidateCheck[] {
  const checks: PierreReleaseCandidateCheck[] = [];

  const ctx = isObject(memory?.reusable_rh_context_json)
    ? (memory?.reusable_rh_context_json as Record<string, unknown>)
    : null;

  // employees under reusable_rh_context_json.employees
  const hasEmployeesInCtx = ctx !== null && Array.isArray(ctx.employees);
  checks.push(
    buildRCCheck({
      id: "storage_employees_location",
      area: "schema",
      label: "Salariés stockés dans reusable_rh_context_json.employees",
      pass: memory === null || hasEmployeesInCtx,
      expected: "employees[] dans reusable_rh_context_json",
      actual: hasEmployeesInCtx ? "employees[] trouvé" : memory === null ? "null (no memory)" : "employees manquant ou mal placé",
      severity: "error",
      recommendation: !hasEmployeesInCtx && memory !== null
        ? "Vérifier que les salariés sont dans pierre_company_memory.reusable_rh_context_json.employees."
        : null,
    }),
  );

  // document_templates under reusable_rh_context_json.document_templates
  const hasTemplatesInCtx = ctx !== null && Array.isArray(ctx.document_templates);
  checks.push(
    buildRCCheck({
      id: "storage_templates_location",
      area: "schema",
      label: "Templates dans reusable_rh_context_json.document_templates",
      pass: memory === null || hasTemplatesInCtx,
      expected: "document_templates[] dans reusable_rh_context_json",
      actual: hasTemplatesInCtx ? "document_templates[] trouvé" : memory === null ? "null (no memory)" : "document_templates manquant ou mal placé",
      severity: "error",
      recommendation: !hasTemplatesInCtx && memory !== null
        ? "Les templates doivent être dans reusable_rh_context_json.document_templates."
        : null,
    }),
  );

  // clone_adn under reusable_rh_context_json.clone_adn (not memory_json)
  const hasADNInCtx = ctx !== null && isObject(ctx.clone_adn);
  const hasADNInMemoryJson = isObject(memory?.memory_json) && isObject((memory?.memory_json as Record<string, unknown>).clone_adn);
  checks.push(
    buildRCCheck({
      id: "storage_cloneadn_location",
      area: "schema",
      label: "CloneADN dans reusable_rh_context_json.clone_adn (pas memory_json)",
      pass: !hasADNInMemoryJson,
      expected: "clone_adn dans reusable_rh_context_json (pas memory_json)",
      actual: hasADNInMemoryJson ? "clone_adn trouvé dans memory_json (ERREUR)" : hasADNInCtx ? "clone_adn dans reusable_rh_context_json ✓" : "clone_adn absent (acceptable si non configuré)",
      severity: "error",
      recommendation: hasADNInMemoryJson
        ? "Déplacer clone_adn de memory_json vers reusable_rh_context_json.clone_adn."
        : null,
    }),
  );

  // Employees must not be in memory_json
  const hasEmployeesInMemoryJson =
    isObject(memory?.memory_json) &&
    Array.isArray((memory?.memory_json as Record<string, unknown>).employees);
  checks.push(
    buildRCCheck({
      id: "storage_no_employees_in_memory_json",
      area: "schema",
      label: "Salariés absents de memory_json (usage interdit)",
      pass: !hasEmployeesInMemoryJson,
      expected: "employees pas dans memory_json",
      actual: hasEmployeesInMemoryJson ? "employees trouvés dans memory_json (ERREUR)" : "OK",
      severity: "error",
      recommendation: hasEmployeesInMemoryJson
        ? "Ne pas utiliser memory_json pour stocker les salariés."
        : null,
    }),
  );

  return checks;
}

// ══════════════════════════════════════════════════════════════
// 5. DOCUMENT SAFETY AUDIT
// ══════════════════════════════════════════════════════════════

const SENSITIVE_DOC_TYPES = [
  "sensitive_case_note",
  "offboarding_checklist",
  "hr_contract_draft",
  "hr_amendment_draft",
  "prepay_summary",
];

export function auditPierreDocumentsSafety(
  documents: Record<string, unknown>[],
): PierreReleaseCandidateCheck[] {
  const checks: PierreReleaseCandidateCheck[] = [];
  if (!Array.isArray(documents)) documents = [];

  const sensitiveAutoApproved = documents.filter((d) => {
    const docType = asStr(d.document_type || d.doc_type || d.kind || "");
    const isSensitive = SENSITIVE_DOC_TYPES.includes(docType);
    const isAutoApproved = d.requires_human_validation === false && d.status !== "blocked";
    return isSensitive && isAutoApproved;
  });
  checks.push(
    buildRCCheck({
      id: "docs_sensitive_validation",
      area: "documents",
      label: "Documents sensibles requièrent validation humaine",
      pass: sensitiveAutoApproved.length === 0,
      expected: "0 documents sensibles sans validation humaine",
      actual: `${sensitiveAutoApproved.length} documents sensibles potentiellement auto-approuvés`,
      severity: "critical",
      recommendation: sensitiveAutoApproved.length > 0
        ? "Les documents contrats/prépay/offboarding/sensibles doivent avoir requires_human_validation=true."
        : null,
    }),
  );

  return checks;
}

// ══════════════════════════════════════════════════════════════
// 6. AI RUNTIME STATUS AUDIT
// ══════════════════════════════════════════════════════════════

export function auditPierreAIRuntimeShape(status: unknown): PierreReleaseCandidateCheck[] {
  const checks: PierreReleaseCandidateCheck[] = [];

  if (!isObject(status)) {
    checks.push(
      buildRCFail({
        id: "ai_runtime_status_shape",
        area: "ai_runtime",
        label: "AI runtime status disponible",
        expected: "Objet status valide",
        actual: "Status null ou invalide",
        severity: "error",
        recommendation: "Vérifier que getCloneAIRuntimeStatus() retourne un objet valide.",
      }),
    );
    return checks;
  }

  // No secrets exposed
  try {
    const serialized = JSON.stringify(status);
    const hasSecrets =
      /sk-[A-Za-z0-9]{10,}/.test(serialized) ||
      /Bearer [A-Za-z0-9+/=]{20,}/.test(serialized) ||
      /api_key.*:.*"[A-Za-z0-9_-]{20,}/.test(serialized);
    checks.push(
      buildRCCheck({
        id: "ai_runtime_no_secrets",
        area: "security",
        label: "AI runtime status n'expose pas de secrets/clés API",
        pass: !hasSecrets,
        expected: "Aucun secret dans le status",
        actual: hasSecrets ? "Pattern de secret détecté dans le status" : "OK — aucun secret",
        severity: "critical",
        recommendation: hasSecrets
          ? "Supprimer immédiatement les clés API du status runtime."
          : null,
      }),
    );
  } catch {
    // ignore JSON serialization errors
  }

  // Mock provider always configured
  const providers = Array.isArray(status.providers) ? status.providers : [];
  const mockProvider = providers.find(
    (p: unknown) => isObject(p) && p.provider === "mock",
  );
  const mockConfigured = isObject(mockProvider) && mockProvider.configured === true;
  checks.push(
    buildRCCheck({
      id: "ai_runtime_mock_configured",
      area: "ai_runtime",
      label: "Provider mock toujours configuré (fallback garanti)",
      pass: mockConfigured,
      expected: "mock.configured = true",
      actual: mockConfigured ? "mock.configured = true ✓" : "mock provider absent ou non configuré",
      severity: "error",
      recommendation: !mockConfigured
        ? "Le provider mock doit toujours être configuré pour garantir le fallback."
        : null,
    }),
  );

  // Prompt contracts count — warning (coverage metric, not a hard error)
  const contractsCount =
    typeof status.prompt_contracts_count === "number" ? status.prompt_contracts_count : 0;
  if (contractsCount >= 10) {
    checks.push(
      buildRCCheck({
        id: "ai_runtime_contracts_count",
        area: "ai_runtime",
        label: "Prompt contracts >= 10 (tous les use cases couverts)",
        pass: true,
        expected: ">= 10 prompt contracts",
        actual: `${contractsCount} prompt contracts`,
        severity: "info",
        recommendation: null,
      }),
    );
  } else {
    checks.push(
      buildRCWarning({
        id: "ai_runtime_contracts_count",
        area: "ai_runtime",
        label: "Prompt contracts >= 10 (tous les use cases couverts)",
        expected: ">= 10 prompt contracts",
        actual: `${contractsCount} prompt contracts`,
        severity: "warning",
        recommendation: "Vérifier que tous les use cases pierre.* sont couverts par des prompt contracts.",
      }),
    );
  }

  return checks;
}

// ══════════════════════════════════════════════════════════════
// 7. GOLDEN SCENARIO SUITE AUDIT
// ══════════════════════════════════════════════════════════════

export function auditPierreGoldenScenarioSuiteShape(
  suite: unknown,
): PierreReleaseCandidateCheck[] {
  const checks: PierreReleaseCandidateCheck[] = [];

  if (!isObject(suite)) {
    checks.push(
      buildRCFail({
        id: "scenarios_suite_shape",
        area: "golden_scenarios",
        label: "Golden scenario suite disponible",
        expected: "Objet suite valide",
        actual: "Suite null ou invalide",
        severity: "error",
        recommendation: "Vérifier que runGoldenScenarioSuite() retourne un résultat valide.",
      }),
    );
    return checks;
  }

  // Score 0-100
  const score =
    typeof suite.score === "number" ? suite.score :
    typeof suite.scenarios_passed === "number" && typeof suite.scenarios_total === "number"
      ? Math.round((suite.scenarios_passed / Math.max(1, suite.scenarios_total)) * 100)
      : -1;
  checks.push(
    buildRCCheck({
      id: "scenarios_suite_score",
      area: "golden_scenarios",
      label: "Score scénarios golden dans [0, 100]",
      pass: score >= 0 && score <= 100,
      expected: "Score 0–100",
      actual: `Score: ${score}`,
      severity: "error",
      recommendation: score < 0 ? "Le rapport de suite doit inclure un score numérique." : null,
    }),
  );

  // Scenarios total >= 13
  const total =
    typeof suite.scenarios_total === "number" ? suite.scenarios_total : 0;
  checks.push(
    buildRCCheck({
      id: "scenarios_count_min",
      area: "golden_scenarios",
      label: "Suite contient au moins 13 scénarios",
      pass: total >= 13,
      expected: ">= 13 scénarios",
      actual: `${total} scénarios`,
      severity: "error",
      recommendation: total < 13
        ? "Ajouter les scénarios manquants jusqu'à atteindre les 13 IDs officiels."
        : null,
    }),
  );

  return checks;
}

// ══════════════════════════════════════════════════════════════
// 8. GLOBAL INVARIANTS ORCHESTRATOR
// ══════════════════════════════════════════════════════════════

export function auditPierreGlobalInvariants(params: {
  tasks?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  memory?: Record<string, unknown> | null;
  documents?: Record<string, unknown>[];
  aiStatus?: unknown;
  scenarioSuite?: unknown;
}): PierreReleaseCandidateCheck[] {
  try {
    const checks: PierreReleaseCandidateCheck[] = [];

    checks.push(...auditPierreTaskSafety(params.tasks ?? []));
    checks.push(...auditPierreLogSchema(params.logs ?? []));
    checks.push(...auditPierreStorageShape(params.memory ?? null));
    checks.push(...auditPierreDocumentsSafety(params.documents ?? []));

    if (params.aiStatus !== undefined) {
      checks.push(...auditPierreAIRuntimeShape(params.aiStatus));
    } else {
      checks.push(
        buildRCWarning({
          id: "ai_runtime_not_provided",
          area: "ai_runtime",
          label: "AI runtime status non fourni pour audit",
          expected: "AI status fourni",
          actual: "AI status absent — audit partiel",
          severity: "info",
          recommendation: "Passer aiStatus pour un audit AI complet.",
        }),
      );
    }

    if (params.scenarioSuite !== undefined) {
      checks.push(...auditPierreGoldenScenarioSuiteShape(params.scenarioSuite));
    } else {
      checks.push(
        buildRCWarning({
          id: "scenarios_suite_not_provided",
          area: "golden_scenarios",
          label: "Suite scénarios non fournie pour audit",
          expected: "Suite fournie",
          actual: "Suite absente — audit partiel",
          severity: "info",
          recommendation: "Passer scenarioSuite pour un audit scénarios complet.",
        }),
      );
    }

    return checks;
  } catch {
    return [];
  }
}
