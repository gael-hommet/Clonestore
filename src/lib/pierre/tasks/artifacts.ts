// ═══════════════════════════════════════════════════════════
// Pure HR artifact builders — no DB, no async
// ═══════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────

export type PierreArtifactKind =
  | "document"
  | "email_draft"
  | "email_send"
  | "followup"
  | "missing_info"
  | "pdf_ready"
  | "internal_note";

export type PierreArtifactStatus =
  | "generated"
  | "draft"
  | "sent"
  | "blocked"
  | "pending";

export type PierreTaskExecutionInput = {
  task: {
    id: string;
    type?: string | null;
    title?: string | null;
    payload_json?: Record<string, unknown> | null;
    mission_id?: string | null;
    scheduled_for?: string | null;
  };
  employee?: {
    id?: string | null;
    name?: string | null;
    role?: string | null;
    email?: string | null;
    department?: string | null;
    [key: string]: unknown;
  } | null;
  mission?: Record<string, unknown> | null;
  company_memory?: Record<string, unknown> | null;
  now?: Date;
};

export type PierreArtifactQuality = {
  score: number;
  has_content: boolean;
  has_title: boolean;
  has_recipient: boolean;
  has_employee_context: boolean;
  is_complete: boolean;
  warnings: string[];
};

export type PierreArtifact = {
  kind: PierreArtifactKind;
  status: PierreArtifactStatus;
  title: string;
  content_text: string;
  content_html: string;
  doc_type: string;
  to_json: string[];
  cc_json: string[];
  bcc_json: string[];
  subject: string | null;
  scheduled_for: string | null;
  missing_fields: string[];
  tags: string[];
  domain: string | null;
};

export type PierreTaskExecutionResult = {
  ok: boolean;
  artifact_kind: PierreArtifactKind | null;
  artifact_status: PierreArtifactStatus;
  artifact: PierreArtifact | null;
  quality: PierreArtifactQuality;
  meta: {
    task_id: string;
    task_type: string | null;
    generated_at: string;
    has_employee_context: boolean;
    domain: string | null;
  };
};

// ── Internal helpers ──────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const s = asString(value);
    return s ? [s] : [];
  }
  return value.map((v) => asString(v)).filter((v): v is string => v !== null);
}

function collectEmails(payload: Record<string, unknown>, ...keys: string[]): string[] {
  const result: string[] = [];
  for (const key of keys) {
    const val = payload[key];
    if (typeof val === "string" && val.includes("@")) {
      result.push(val.trim());
    } else if (Array.isArray(val)) {
      for (const item of val) {
        const s = asString(item);
        if (s && s.includes("@")) result.push(s);
      }
    }
  }
  return [...new Set(result)];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToHtml(text: string, title: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `<p>${escapeHtml(b).replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  return `<article>\n  <h1>${escapeHtml(title)}</h1>\n  ${paragraphs}\n</article>`;
}

// ── Domain detection ──────────────────────────────────────────

type HRDomain =
  | "onboarding"
  | "recruitment"
  | "absence"
  | "payroll"
  | "disciplinary"
  | "followup"
  | "general";

function detectHRDomain(input: PierreTaskExecutionInput): HRDomain {
  const payload = input.task.payload_json ?? {};
  const combined = [
    asString(input.task.title),
    asString(input.task.type),
    asString(payload.instructions),
    asString(payload.context),
    asString(payload.doc_type),
    asString(payload.text_content),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/onboarding|accueil|int[eé]gration|bienvenu/.test(combined)) return "onboarding";
  if (/candidat|recrutement|offre.?emploi|entretien|convocation|hiring|recruitment/.test(combined))
    return "recruitment";
  if (/absence|cong[eé]|arr[eê]t.?travail|maladie/.test(combined)) return "absence";
  if (/salaire|paie|bulletin|fiche.?paie|payroll|r[eé]mun[eé]ration/.test(combined)) return "payroll";
  if (/avertissement|sanction|licenci|faute|disciplin|mise.?pied/.test(combined)) return "disciplinary";
  if (/relance|suivi|follow.?up|rappel/.test(combined)) return "followup";
  return "general";
}

function domainToDocType(domain: HRDomain, payload: Record<string, unknown>): string {
  const explicit = asString(payload.doc_type);
  if (explicit) return explicit;

  const map: Record<HRDomain, string> = {
    onboarding: "document_onboarding",
    recruitment: "document_recrutement",
    absence: "document_absence",
    payroll: "document_paie",
    disciplinary: "document_disciplinaire",
    followup: "relance_rh",
    general: "document_rh",
  };
  return map[domain];
}

// ── Content builders (internal) ───────────────────────────────

function buildDocumentBody(input: PierreTaskExecutionInput, domain: HRDomain): string {
  const payload = input.task.payload_json ?? {};
  const employee = input.employee;

  const existing =
    asString(payload.text_content) ||
    asString(payload.body_text) ||
    asString(payload.document_text) ||
    asString(payload.generated_document_text) ||
    asString(payload.raw_input) ||
    asString(payload.content);

  if (existing) return existing;

  const instructions =
    asString(payload.instructions) || asString(payload.context) || null;

  const employeeLine = employee?.name
    ? `Concernant : ${employee.name}${employee.role ? `, ${employee.role}` : ""}${employee.department ? ` (${employee.department})` : ""}.`
    : null;

  const bodyLines: (string | null)[] = [];

  switch (domain) {
    case "onboarding":
      bodyLines.push(
        "Bienvenue dans notre entreprise.",
        employeeLine,
        instructions
          ? `Instructions d'intégration : ${instructions}`
          : "Ce document présente votre parcours d'intégration. Vous trouverez ci-après les informations nécessaires à votre prise de poste.",
        "Pierre a préparé ce document comme base opérationnelle. Merci de le compléter avant validation finale.",
      );
      break;

    case "recruitment":
      bodyLines.push(
        employeeLine,
        instructions
          ? `Objet du document : ${instructions}`
          : "Ce document concerne un dossier de recrutement. Il est préparé par Pierre comme brouillon opérationnel.",
        "Ce document est soumis à validation humaine avant tout envoi ou utilisation officielle.",
      );
      break;

    case "absence":
      bodyLines.push(
        employeeLine,
        instructions
          ? `Détail de la demande : ${instructions}`
          : "Ce document concerne une demande d'absence ou de congé. Les détails seront complétés lors de la validation.",
        "Validation RH requise avant toute décision officielle.",
      );
      break;

    case "payroll":
      bodyLines.push(
        employeeLine,
        instructions
          ? `Contexte : ${instructions}`
          : "Ce document RH concerne un élément de rémunération. Les données exactes sont à vérifier avec le service paie.",
        "Ce document est confidentiel et soumis à validation avant diffusion.",
      );
      break;

    case "disciplinary":
      bodyLines.push(
        employeeLine,
        instructions
          ? `Faits : ${instructions}`
          : "Ce document disciplinaire est préparé par Pierre comme base de travail. Une validation juridique est obligatoire.",
        "IMPORTANT : Tout document disciplinaire nécessite une validation humaine et un avis juridique avant utilisation.",
      );
      break;

    case "followup":
      bodyLines.push(
        employeeLine,
        instructions
          ? `Objet de la relance : ${instructions}`
          : "Ce document de relance RH est préparé par Pierre. Les destinataires et le contenu sont à préciser.",
        "Pierre a programmé ce suivi pour assurer la continuité du traitement du dossier.",
      );
      break;

    default:
      bodyLines.push(
        "Ce document RH a été préparé par Pierre comme brouillon opérationnel premium.",
        employeeLine,
        instructions ? `Instructions : ${instructions}` : null,
        "Ce brouillon doit rester modifiable, traçable et soumis à validation humaine quand nécessaire.",
      );
  }

  return bodyLines.filter(Boolean).join("\n\n");
}

function buildEmailParts(input: PierreTaskExecutionInput): {
  subject: string;
  body_text: string;
  body_html: string;
  to: string[];
  cc: string[];
  bcc: string[];
} {
  const payload = input.task.payload_json ?? {};
  const employee = input.employee;
  const memory = isObject(input.company_memory) ? input.company_memory : {};

  const subject =
    asString(payload.subject) ||
    asString(payload.email_subject) ||
    asString(payload.objet) ||
    asString(input.task.title) ||
    "Email RH";

  const existingBody =
    asString(payload.body_text) ||
    asString(payload.text_content) ||
    asString(payload.document_text) ||
    asString(payload.generated_document_text) ||
    asString(payload.message) ||
    asString(payload.content);

  const language =
    asString(payload.language) ||
    asString(memory.preferred_language) ||
    "fr";

  const tone =
    asString(payload.tone) ||
    asString(memory.tone_guide) ||
    asString(memory.communication_style) ||
    "professionnel";

  const body_text =
    existingBody ||
    (language === "en"
      ? [
          "Hello,",
          "",
          "This is an HR email prepared by Pierre.",
          `Tone: ${tone}.`,
          employee?.name ? `Regarding: ${employee.name}.` : null,
          "",
          "Please review and adjust before sending.",
          "",
          "Best regards,",
        ]
          .filter((l) => l !== null)
          .join("\n")
      : [
          "Bonjour,",
          "",
          "Cet email RH a été préparé par Pierre.",
          `Ton : ${tone}.`,
          employee?.name ? `Concernant : ${employee.name}.` : null,
          "",
          "Merci de vérifier et d'ajuster avant envoi.",
          "",
          "Bien cordialement,",
        ]
          .filter((l) => l !== null)
          .join("\n"));

  const body_html =
    asString(payload.body_html) ||
    asString(payload.html_content) ||
    `<div><p>${escapeHtml(body_text).replace(/\n/g, "<br />")}</p></div>`;

  const to = collectEmails(
    payload,
    "to",
    "recipient_email",
    "recipient_emails",
    "destinataire_email",
    "destinataires",
  );

  const employeeEmail = asString(employee?.email);
  if (employeeEmail && !to.includes(employeeEmail)) to.push(employeeEmail);

  const cc = collectEmails(payload, "cc", "cc_emails");
  const bcc = collectEmails(payload, "bcc", "bcc_emails");

  return { subject, body_text, body_html, to, cc, bcc };
}

// ── Exported artifact builders ────────────────────────────────

export function inferPierreArtifactKind(
  taskType: string | null | undefined,
  payload_json?: Record<string, unknown> | null,
): PierreArtifactKind {
  const type = (taskType ?? "").toLowerCase().trim();

  if (type === "email.send" || type === "send_email") return "email_send";
  if (type === "email.draft" || type === "prepare_email") return "email_draft";
  if (type === "pdf.generate" || type === "generate_pdf") return "pdf_ready";
  if (
    type === "followup.schedule" ||
    type === "reminder.create" ||
    type === "schedule_follow_up"
  )
    return "followup";
  if (type === "request_missing_info" || type === "ask_missing_info")
    return "missing_info";
  if (
    type === "doc.generate" ||
    type === "doc.rewrite" ||
    type === "generate_document"
  )
    return "document";

  if (payload_json) {
    if (
      Array.isArray(payload_json.missing_info) &&
      (payload_json.missing_info as unknown[]).length > 0
    )
      return "missing_info";
    if (
      payload_json.subject ||
      payload_json.email_subject ||
      payload_json.recipient_email
    )
      return "email_draft";
    if (payload_json.scheduled_for || payload_json.follow_up_date) return "followup";
    if (payload_json.pdf_url || payload_json.pdf_ready) return "pdf_ready";
  }

  return "document";
}

export function buildPierreDocumentArtifact(input: PierreTaskExecutionInput): PierreArtifact {
  const payload = input.task.payload_json ?? {};
  const domain = detectHRDomain(input);
  const docType = domainToDocType(domain, payload);

  const title =
    asString(payload.title) ||
    asString(payload.document_title) ||
    asString(input.task.title) ||
    "Document RH";

  const content_text = buildDocumentBody(input, domain);
  const content_html =
    asString(payload.html_content) ||
    asString(payload.body_html) ||
    asString(payload.document_html) ||
    textToHtml(content_text, title);

  const tags = ["pierre", "document_rh", domain, docType].filter(
    (t, i, arr) => Boolean(t) && arr.indexOf(t) === i,
  );

  return {
    kind: "document",
    status: "generated",
    title,
    content_text,
    content_html,
    doc_type: docType,
    to_json: [],
    cc_json: [],
    bcc_json: [],
    subject: null,
    scheduled_for: null,
    missing_fields: asStringArray(payload.missing_info),
    tags,
    domain,
  };
}

export function buildPierreEmailDraftArtifact(input: PierreTaskExecutionInput): PierreArtifact {
  const { subject, body_text, body_html, to, cc, bcc } = buildEmailParts(input);
  const payload = input.task.payload_json ?? {};
  const isSend = input.task.type === "email.send" || input.task.type === "send_email";

  return {
    kind: isSend ? "email_send" : "email_draft",
    status: "draft",
    title: subject,
    content_text: body_text,
    content_html: body_html,
    doc_type: isSend ? "email_send" : "email_draft",
    to_json: to,
    cc_json: cc,
    bcc_json: bcc,
    subject,
    scheduled_for: null,
    missing_fields: asStringArray(payload.missing_info),
    tags: ["pierre", "email", isSend ? "email_send" : "email_draft"],
    domain: null,
  };
}

export function buildPierreFollowupArtifact(input: PierreTaskExecutionInput): PierreArtifact {
  const payload = input.task.payload_json ?? {};
  const employee = input.employee;

  const scheduledFor =
    asString(payload.scheduled_for) ||
    asString(payload.follow_up_date) ||
    asString(payload.relance_date) ||
    asString(input.task.scheduled_for) ||
    null;

  const title =
    asString(payload.title) ||
    asString(input.task.title) ||
    (employee?.name ? `Suivi — ${employee.name}` : "Relance RH");

  const note =
    asString(payload.message) ||
    asString(payload.note) ||
    asString(payload.instructions) ||
    asString(payload.context) ||
    "Pierre a programmé une relance. Merci de compléter les détails.";

  const content_text = [
    title,
    employee?.name ? `Concernant : ${employee.name}` : null,
    scheduledFor ? `Planifiée pour : ${scheduledFor}` : null,
    note,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    kind: "followup",
    status: "pending",
    title,
    content_text,
    content_html: textToHtml(content_text, title),
    doc_type: "relance_rh",
    to_json: [],
    cc_json: [],
    bcc_json: [],
    subject: null,
    scheduled_for: scheduledFor,
    missing_fields: asStringArray(payload.missing_info),
    tags: ["pierre", "relance", "followup"],
    domain: "followup",
  };
}

export function buildPierreMissingInfoArtifact(input: PierreTaskExecutionInput): PierreArtifact {
  const payload = input.task.payload_json ?? {};
  const employee = input.employee;

  const missingFields = [
    ...asStringArray(payload.missing_info),
    ...asStringArray(payload.missing_fields),
    ...asStringArray(payload.champs_manquants),
  ].filter((f, i, arr) => arr.indexOf(f) === i);

  const title =
    asString(payload.title) ||
    asString(input.task.title) ||
    (employee?.name
      ? `Informations manquantes — ${employee.name}`
      : "Informations manquantes");

  const content_text = [
    "Pierre a identifié les informations suivantes comme manquantes pour continuer le traitement du dossier.",
    employee?.name ? `Dossier : ${employee.name}` : null,
    missingFields.length > 0
      ? `Éléments manquants :\n${missingFields.map((f) => `- ${f}`).join("\n")}`
      : "Des informations complémentaires sont requises. Merci de préciser.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    kind: "missing_info",
    status: "blocked",
    title,
    content_text,
    content_html: textToHtml(content_text, title),
    doc_type: "note_manque_info",
    to_json: [],
    cc_json: [],
    bcc_json: [],
    subject: null,
    scheduled_for: null,
    missing_fields: missingFields,
    tags: ["pierre", "missing_info", "blocked"],
    domain: null,
  };
}

export function buildPierrePdfReadyArtifact(input: PierreTaskExecutionInput): PierreArtifact {
  const payload = input.task.payload_json ?? {};
  const domain = detectHRDomain(input);

  const title =
    asString(payload.title) ||
    asString(payload.document_title) ||
    asString(input.task.title) ||
    "Document Pierre PDF";

  const content_text =
    asString(payload.text_content) ||
    asString(payload.body_text) ||
    asString(payload.document_text) ||
    buildDocumentBody(input, domain);

  const content_html =
    asString(payload.html_content) ||
    asString(payload.body_html) ||
    textToHtml(content_text, title);

  return {
    kind: "pdf_ready",
    status: "generated",
    title,
    content_text,
    content_html,
    doc_type: "pdf_export",
    to_json: [],
    cc_json: [],
    bcc_json: [],
    subject: null,
    scheduled_for: null,
    missing_fields: asStringArray(payload.missing_info),
    tags: ["pierre", "pdf", "pdf_export", domain],
    domain,
  };
}

// ── Quality scoring ───────────────────────────────────────────

const GENERIC_TITLES = new Set([
  "document rh",
  "document pierre",
  "document pierre pdf",
  "email rh",
  "relance rh",
  "informations manquantes",
]);

export function scorePierreArtifactQuality(
  artifact: PierreArtifact,
  input: PierreTaskExecutionInput,
): PierreArtifactQuality {
  const warnings: string[] = [];

  const hasContent = artifact.content_text.trim().length > 50;
  if (!hasContent) warnings.push("Le contenu du document est trop court ou vide.");

  const hasTitle =
    artifact.title.trim().length > 0 &&
    !GENERIC_TITLES.has(artifact.title.trim().toLowerCase());
  if (!hasTitle)
    warnings.push("Le titre est générique. Un titre spécifique améliorerait la qualité.");

  const isEmail = artifact.kind === "email_draft" || artifact.kind === "email_send";
  const hasRecipient = isEmail ? artifact.to_json.length > 0 : true;
  if (isEmail && !hasRecipient) warnings.push("Aucun destinataire email renseigné.");

  const hasEmployeeContext =
    input.employee !== null &&
    input.employee !== undefined &&
    (Boolean(input.employee.name) || Boolean(input.employee.id));
  if (!hasEmployeeContext)
    warnings.push("Aucun contexte salarié lié à cet artefact.");

  let score = 0;
  if (hasContent) score += 45;
  if (hasTitle) score += 20;
  if (isEmail && hasRecipient) score += 20;
  if (hasEmployeeContext) score += 15;
  score = Math.min(100, score);

  return {
    score,
    has_content: hasContent,
    has_title: hasTitle,
    has_recipient: hasRecipient,
    has_employee_context: hasEmployeeContext,
    is_complete: score >= 75,
    warnings,
  };
}

// ── Central dispatcher ────────────────────────────────────────

export function buildPierreTaskExecutionResult(
  input: PierreTaskExecutionInput,
): PierreTaskExecutionResult {
  const now = input.now ?? new Date();
  const taskType = asString(input.task.type);
  const payload = input.task.payload_json ?? {};

  const kind = inferPierreArtifactKind(taskType, payload);

  let artifact: PierreArtifact;

  switch (kind) {
    case "email_draft":
    case "email_send":
      artifact = buildPierreEmailDraftArtifact(input);
      break;
    case "followup":
      artifact = buildPierreFollowupArtifact(input);
      break;
    case "missing_info":
      artifact = buildPierreMissingInfoArtifact(input);
      break;
    case "pdf_ready":
      artifact = buildPierrePdfReadyArtifact(input);
      break;
    default:
      artifact = buildPierreDocumentArtifact(input);
  }

  const quality = scorePierreArtifactQuality(artifact, input);
  const domain = detectHRDomain(input);

  const hasEmployeeContext =
    input.employee !== null &&
    input.employee !== undefined &&
    (Boolean(input.employee.name) || Boolean(input.employee.id));

  return {
    ok: artifact.status !== "blocked",
    artifact_kind: kind,
    artifact_status: artifact.status,
    artifact,
    quality,
    meta: {
      task_id: input.task.id,
      task_type: taskType,
      generated_at: now.toISOString(),
      has_employee_context: hasEmployeeContext,
      domain: domain === "general" ? null : domain,
    },
  };
}
