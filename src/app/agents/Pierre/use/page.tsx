"use client";

/* =========================================================
Pierre Use — Premium Monolith Page (Ultimate+)

- Single file, premium UX aligned with CloneStore
- Compat legacy Pierre response + new brain schema
- Robust generation flow with abort + stale guard
- Premium History / Memory
- Email wired to /api/pierre/action
- PDF wired to /api/pierre/action
- PDF premium states:
    - Exporter PDF
    - Voir PDF
    - Télécharger PDF
    - Envoyer PDF en pièce jointe
- Result content editable with safe plain-text editor + live preview
- All actions use the saved edited version when present
- No debug panel
========================================================= */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  BadgeCheck,
  Copy,
  Download,
  Eye,
  FileText,
  FolderClock,
  History,
  Languages,
  Mail,
  Pencil,
  Paperclip,
  Pin,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase";

/* =========================================================
Types — legacy + new
========================================================= */

type LegacyPierreResponse = {
  status?: string;
  kind?: string;
  task?: string;
  document?: {
    title?: string;
    body?: string;
    sections?: { title?: string; content?: string }[];
  };
  summary?: string;
  checks?: string[];
  next_actions?: string[];
  meta?: {
    language?: string;
    tone?: string;
    estimated_read_time_minutes?: number;
  };
};

type BrainPierreResponse = {
  schema_version?: string;
  doc_type?: string;
  doc_title?: string;
  tone_used?: "pro" | "convivial" | string;
  language?: string;
  final_text_html?: string;
  missing_info_questions?: Array<{
    id: string;
    question: string;
    priority: "high" | "medium" | "low";
    expected_format: "text" | "number" | "date" | "email" | "phone" | "choice";
    choices?: string[];
  }>;
  confidence_score?: number;
  safety_flags?: {
    legal_risk?: boolean;
    discrimination_risk?: boolean;
    pii_risk?: boolean;
  };
  actions?: Array<{
    type: "doc.generate" | "email.send";
    payload?: unknown;
  }>;
};

type AnyPierreResponse = LegacyPierreResponse | BrainPierreResponse;

type PresetId =
  | "rejection"
  | "mail_rh"
  | "announcement"
  | "job_posting"
  | "procedure"
  | "report"
  | "free";

type Tone = "pro" | "convivial";
type Language = "fr" | "en";

type ProOptions = {
  include: string;
  constraints: string;
  signature: string;
  recipient_email: string;
  subject_override: string;
  company_name: string;
};

type HistorySort = "newest" | "oldest" | "title_az" | "title_za";
type HistoryFilter = "all" | "ok" | "err" | "fav" | "pinned";

type MemoryItem = {
  id: string;
  ts: number;
  preset: PresetId;
  tone: Tone;
  language: Language;
  input: string;
  response?: AnyPierreResponse;
  title?: string;
  html?: string;
  text?: string;
  docType?: string;
  confidence?: number;
  ok: boolean;
  error?: string;
  favorite?: boolean;
  pinned?: boolean;
  tags?: string[];
  note?: string;
  last_opened_ts?: number;
  open_count?: number;
};

type UIResultView = {
  title: string;
  html: string;
  text: string;
  docType: string;
  language: string;
  tone: string;
  confidence?: number;
  missingQuestions: BrainPierreResponse["missing_info_questions"];
  actions: BrainPierreResponse["actions"];
  raw: AnyPierreResponse;
};

type PierreActionApiResponse = {
  ok?: boolean;
  action_type?: "email.send" | "doc.generate";
  make_status?: number;
  make_response?: unknown;
  make_response_parsed?: Record<string, unknown> | null;
  identity?: unknown;
  onboarding_exists?: boolean;
  error?: string;
  url?: string;
  pdf_url?: string | null;
  attachments_count?: number;
};

type LastPdfState = {
  url: string;
  filename: string;
  generatedAt: number;
  signature: string;
};

type ResultOverride = {
  title: string;
  html: string;
  text: string;
  editedAt: number;
  sourceSignature: string;
};

/* =========================================================
Small utils
========================================================= */

function safeStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

function safeNum(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function nowMs() {
  return Date.now();
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function normalizeSpaces(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function short(s: string, max = 140) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function isBrain(r: AnyPierreResponse): r is BrainPierreResponse {
  return Boolean(
    r &&
      typeof r === "object" &&
      ("final_text_html" in (r as Record<string, unknown>) ||
        "doc_title" in (r as Record<string, unknown>) ||
        "doc_type" in (r as Record<string, unknown>))
  );
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlToText(html: string) {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body?.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}

function textToHtml(text: string) {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const parts = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`);

  return parts.join("\n");
}

function legacyToHtml(legacy: LegacyPierreResponse) {
  const title = safeStr(legacy.document?.title);
  const body = safeStr(legacy.document?.body);
  const sections = Array.isArray(legacy.document?.sections) ? legacy.document.sections : [];

  const parts: string[] = [];

  if (title) parts.push(`<h2>${escapeHtml(title)}</h2>`);
  if (body) parts.push(`<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`);

  if (sections.length) {
    parts.push("<hr/>");
    for (const s of sections) {
      const st = escapeHtml(s?.title || "");
      const sc = escapeHtml(s?.content || "").replace(/\n/g, "<br/>");
      if (st) parts.push(`<h3>${st}</h3>`);
      if (sc) parts.push(`<p>${sc}</p>`);
    }
  }

  return parts.join("\n");
}

function looksEmptyResponse(r: AnyPierreResponse) {
  if (!r || typeof r !== "object") return true;

  if (isBrain(r)) {
    return !safeStr(r.final_text_html).trim();
  }

  const legacy = r as LegacyPierreResponse;
  const body = safeStr(legacy.document?.body).trim();
  const sections = Array.isArray(legacy.document?.sections) ? legacy.document.sections : [];
  return !body && sections.length === 0;
}

function normalizeToView(r: AnyPierreResponse): UIResultView {
  if (isBrain(r)) {
    const title = safeStr(r.doc_title) || "Document RH — Pierre";
    const html = safeStr(r.final_text_html) || "";
    const text = htmlToText(html) || "";
    const docType = safeStr(r.doc_type) || "UNKNOWN";
    const language = safeStr(r.language) || "fr-FR";
    const tone = safeStr(r.tone_used) || "pro";
    const confidence = safeNum(r.confidence_score);
    const missingQuestions = Array.isArray(r.missing_info_questions) ? r.missing_info_questions : [];
    const actions = Array.isArray(r.actions) ? r.actions : [];

    return {
      title,
      html,
      text,
      docType,
      language,
      tone,
      confidence,
      missingQuestions,
      actions,
      raw: r,
    };
  }

  const legacy = r as LegacyPierreResponse;
  const title = safeStr(legacy.document?.title) || "Document RH — Pierre";
  const html = legacyToHtml(legacy);
  const text = safeStr(legacy.document?.body) || htmlToText(html);
  const docType = "LEGACY";
  const language = safeStr(legacy.meta?.language) || "fr";
  const tone = safeStr(legacy.meta?.tone) || "pro";

  return {
    title,
    html,
    text,
    docType,
    language,
    tone,
    confidence: undefined,
    missingQuestions: [],
    actions: [],
    raw: r,
  };
}

function normalizeMemoryItemToView(item: MemoryItem): UIResultView | null {
  const fromResponse = item.response ? normalizeToView(item.response) : null;

  const title = safeStr(item.title) || fromResponse?.title || "Document RH — Pierre";
  const html = safeStr(item.html) || fromResponse?.html || textToHtml(safeStr(item.text));
  const text = safeStr(item.text) || fromResponse?.text || htmlToText(html);

  if (!title && !html && !text && !fromResponse) return null;

  return {
    title,
    html,
    text,
    docType: safeStr(item.docType) || fromResponse?.docType || "—",
    language: item.language || fromResponse?.language || "fr",
    tone: item.tone || fromResponse?.tone || "pro",
    confidence: typeof item.confidence === "number" ? item.confidence : fromResponse?.confidence,
    missingQuestions: fromResponse?.missingQuestions || [],
    actions: fromResponse?.actions || [],
    raw: item.response || fromResponse?.raw || {},
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeFilename(raw: string) {
  const base =
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\-_. ]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
      .toLowerCase() || "document-pierre";

  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

function extractPdfUrl(data: PierreActionApiResponse): string {
  const direct = safeStr(data?.pdf_url) || safeStr(data?.url);
  if (direct) return direct;

  const parsed = data?.make_response_parsed;
  if (parsed && typeof parsed === "object") {
    return (
      safeStr(parsed.url) ||
      safeStr(parsed.pdf_url) ||
      safeStr(parsed.file_url) ||
      safeStr(parsed.output) ||
      safeStr(parsed.link) ||
      ""
    );
  }

  const mr = data?.make_response;

  if (typeof mr === "string") {
    try {
      const parsedString = JSON.parse(mr) as Record<string, unknown>;
      return (
        safeStr(parsedString.url) ||
        safeStr(parsedString.pdf_url) ||
        safeStr(parsedString.file_url) ||
        safeStr(parsedString.output) ||
        safeStr(parsedString.link) ||
        ""
      );
    } catch {
      return "";
    }
  }

  if (mr && typeof mr === "object") {
    const record = mr as Record<string, unknown>;
    return (
      safeStr(record.url) ||
      safeStr(record.pdf_url) ||
      safeStr(record.file_url) ||
      safeStr(record.output) ||
      safeStr(record.link) ||
      ""
    );
  }

  return "";
}

function makeContentSignature(title: string, html: string, text: string) {
  const raw = `${title}::${html}::${text}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `${raw.length}:${hash}`;
}

function countWords(text: string) {
  const clean = normalizeSpaces(text);
  if (!clean) return 0;
  return clean.split(" ").filter(Boolean).length;
}

function estimateReadMinutes(text: string) {
  const words = countWords(text);
  if (!words) return 0;
  return Math.max(1, Math.ceil(words / 180));
}

/* =========================================================
Presets
========================================================= */

const PRESETS: Record<PresetId, { label: string; hint: string; seed: (opts: ProOptions) => string }> = {
  rejection: {
    label: "Refus candidat",
    hint: "Refus pro + shortlist",
    seed: (opts) =>
      [
        "Mail de refus candidat (dev front).",
        opts.include
          ? `À inclure: ${opts.include}`
          : "Ton pro, humain. On garde le profil en shortlist.",
        opts.constraints
          ? `Contraintes: ${opts.constraints}`
          : "Contraintes: pas de salaire, pas de date, pas de lieu.",
        opts.signature ? `Signature: \"${opts.signature}\".` : 'Signature: "L’équipe RH".',
        "Objet + corps.",
      ].join(" "),
  },
  mail_rh: {
    label: "Mail RH",
    hint: "Mail RH générique",
    seed: (opts) =>
      [
        "Rédige un email RH.",
        opts.include ? `À inclure: ${opts.include}` : "Ton pro, clair, actionnable.",
        opts.constraints ? `Contraintes: ${opts.constraints}` : "",
        opts.signature ? `Signature: \"${opts.signature}\".` : "",
        "Objet + corps. HTML simple.",
      ]
        .filter(Boolean)
        .join(" "),
  },
  announcement: {
    label: "Annonce",
    hint: "Annonce interne",
    seed: (opts) =>
      [
        "Rédige une annonce interne RH.",
        opts.include ? `À inclure: ${opts.include}` : "Infos essentielles + call-to-action.",
        opts.constraints ? `Contraintes: ${opts.constraints}` : "",
        opts.signature ? `Signature: \"${opts.signature}\".` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  job_posting: {
    label: "Fiche de poste",
    hint: "Job description",
    seed: (opts) =>
      [
        "Rédige une fiche de poste (job description) structurée.",
        opts.include
          ? `À inclure: ${opts.include}`
          : "Missions, profil, compétences, conditions, process.",
        opts.constraints ? `Contraintes: ${opts.constraints}` : "Pas de blabla, concret, clair.",
      ]
        .filter(Boolean)
        .join(" "),
  },
  procedure: {
    label: "Procédure",
    hint: "Process RH",
    seed: (opts) =>
      [
        "Rédige une procédure RH (pas à pas) très claire.",
        opts.include
          ? `À inclure: ${opts.include}`
          : "Étapes numérotées + responsabilités + délais + check-list.",
        opts.constraints ? `Contraintes: ${opts.constraints}` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  report: {
    label: "Compte rendu",
    hint: "Compte rendu",
    seed: (opts) =>
      [
        "Rédige un compte rendu structuré.",
        opts.include
          ? `À inclure: ${opts.include}`
          : "Contexte, faits, décisions, actions, responsables, échéances.",
        opts.constraints ? `Contraintes: ${opts.constraints}` : "",
      ]
        .filter(Boolean)
        .join(" "),
  },
  free: {
    label: "Libre",
    hint: "Brief libre",
    seed: () => "",
  },
};

/* =========================================================
Local storage keys
========================================================= */

function memoryKey(userId: string) {
  return `clonestore:pierre:history:${userId}`;
}

function draftKey(userId: string) {
  return `clonestore:pierre:draft:${userId}`;
}

function uiKey(userId: string) {
  return `clonestore:pierre:ui:${userId}`;
}

/* =========================================================
Optional Supabase sync (best-effort)
========================================================= */

async function trySupabaseHistoryInsert(
  supabase: SupabaseClient,
  userId: string,
  item: MemoryItem
) {
  try {
    await supabase.from("agent_history").insert({
      user_id: userId,
      agent_slug: "pierre",
      created_at: new Date(item.ts).toISOString(),
      input: item.input,
      preset: item.preset,
      tone: item.tone,
      language: item.language,
      title: item.title || null,
      doc_type: item.docType || null,
      ok: item.ok,
      favorite: Boolean(item.favorite),
      pinned: Boolean(item.pinned),
      tags: item.tags ? JSON.stringify(item.tags) : null,
      note: item.note || null,
      error: item.error || null,
      response: item.response ? JSON.stringify(item.response) : null,
    });
  } catch {
    // ignore
  }
}

/* =========================================================
UI atoms
========================================================= */

function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warn" | "violet";
}) {
  const styles =
    variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : variant === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : variant === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : "border-border bg-background/80 text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${styles}`}>
      {children}
    </span>
  );
}

function Pill({
  active,
  children,
  onClick,
  subtle,
}: {
  active?: boolean;
  subtle?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
        "hover:bg-background",
        subtle ? "bg-background/40" : "bg-background/80",
        active
          ? "border-violet-300 bg-violet-50 text-violet-700"
          : "border-border text-muted-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

function Helper({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Card({
  title,
  subtitle,
  right,
  children,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  tone?: "default" | "violet";
}) {
  return (
    <section
      className={[
        "overflow-hidden rounded-[24px] border p-6 shadow-sm",
        tone === "violet"
          ? "bg-gradient-to-br from-background via-violet-50/40 to-background"
          : "bg-background/70",
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-base font-semibold tracking-tight">{title}</p>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoStrip({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/70 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-violet-700">{icon}</div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "w-full max-h-[90vh] overflow-hidden rounded-[24px] border bg-background shadow-2xl",
            wide ? "max-w-5xl" : "max-w-2xl",
          ].join(" ")}
        >
          <div className="border-b p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-base font-semibold tracking-tight">{title}</p>
                {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-auto p-5">{children}</div>

          {footer ? <div className="border-t bg-background/50 p-5">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* =========================================================
Pierre Use Page
========================================================= */

export default function PierreUsePage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  /* -------------------------
  Access gate
  ------------------------- */
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /* -------------------------
  Brief controls
  ------------------------- */
  const [preset, setPreset] = useState<PresetId>("free");
  const [tone, setTone] = useState<Tone>("pro");
  const [language, setLanguage] = useState<Language>("fr");
  const [rawNotes, setRawNotes] = useState("");

  /* -------------------------
  Pro options
  ------------------------- */
  const [proOpen, setProOpen] = useState(true);
  const [pro, setPro] = useState<ProOptions>({
    include: "Objet + corps. Ton pro, humain. On garde en shortlist.",
    constraints: "Pas de date, pas de salaire, pas de lieu.",
    signature: "L’équipe RH",
    recipient_email: "",
    subject_override: "",
    company_name: "",
  });

  /* -------------------------
  Result / errors
  ------------------------- */
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailWithPdfBusy, setEmailWithPdfBusy] = useState(false);
  const [statusBadge, setStatusBadge] = useState<"idle" | "ready" | "error" | "working">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [resultRaw, setResultRaw] = useState<AnyPierreResponse | null>(null);
  const [resultView, setResultView] = useState<UIResultView | null>(null);
  const [resultOverride, setResultOverride] = useState<ResultOverride | null>(null);
  const [resultSourceHistoryId, setResultSourceHistoryId] = useState<string | null>(null);

  const [copyOk, setCopyOk] = useState(false);
  const [copyHtmlOk, setCopyHtmlOk] = useState(false);

  const [lastPdf, setLastPdf] = useState<LastPdfState | null>(null);

  /* -------------------------
  Editable result state
  ------------------------- */
  const [isEditingResult, setIsEditingResult] = useState(false);
  const [editResultTitle, setEditResultTitle] = useState("");
  const [editResultText, setEditResultText] = useState("");

  /* -------------------------
  Memory (history)
  ------------------------- */
  const [historyOpen, setHistoryOpen] = useState(true);
  const [history, setHistory] = useState<MemoryItem[]>([]);
  const [historyLimit, setHistoryLimit] = useState(60);

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySort, setHistorySort] = useState<HistorySort>("newest");

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds]
  );

  /* -------------------------
  History Viewer Modal
  ------------------------- */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  /* -------------------------
  History Editor Modal
  ------------------------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  /* -------------------------
  Import / Export Modal
  ------------------------- */
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState<"export" | "import">("export");
  const [ioText, setIoText] = useState("");

  /* -------------------------
  UI persistence
  ------------------------- */
  const [uiLoaded, setUiLoaded] = useState(false);

  /* -------------------------
  Editor state
  ------------------------- */
  const [editTitleDraft, setEditTitleDraft] = useState("");
  const [editNoteDraft, setEditNoteDraft] = useState("");
  const [editTagsDraft, setEditTagsDraft] = useState("");

  /* -------------------------
  Abort / stale guard
  ------------------------- */
  const abortRef = useRef<AbortController | null>(null);
  const lastReqIdRef = useRef(0);

  /* =========================================================
  Access check
  ========================================================= */

  const checkAccessOnce = useCallback(async () => {
    if (!supabase) {
      setAllowed(false);
      setChecking(false);
      setGateError("Supabase navigateur non configuré.");
      return;
    }

    setGateError(null);
    setChecking(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      setAllowed(false);
      setChecking(false);
      setGateError(userErr.message);
      return;
    }

    const user = userRes.user;
    if (!user) {
      setAllowed(false);
      setChecking(false);
      setUserId(null);
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .maybeSingle();

    if (orderErr) {
      setAllowed(false);
      setChecking(false);
      setGateError(orderErr.message);
      return;
    }

    setAllowed(Boolean(order));
    setChecking(false);
  }, [router, supabase]);

  useEffect(() => {
    if (!supabase) {
      setAllowed(false);
      setChecking(false);
      setGateError("Supabase navigateur non configuré.");
      return;
    }

    checkAccessOnce();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkAccessOnce();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [checkAccessOnce, supabase]);

  useEffect(() => {
    if (!supabase) return;

    const onVis = async () => {
      if (document.visibilityState === "visible") {
        try {
          await supabase.auth.getSession();
        } catch {
          // ignore
        }
        checkAccessOnce();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [checkAccessOnce, supabase]);

  /* =========================================================
  Load draft + history + ui
  ========================================================= */

  useEffect(() => {
    if (!userId) return;

    try {
      const raw = localStorage.getItem(draftKey(userId));
      if (raw) {
        const d = JSON.parse(raw) as Partial<{
          preset: PresetId;
          tone: Tone;
          language: Language;
          rawNotes: string;
          pro: Partial<ProOptions>;
        }>;

        if (d && typeof d === "object") {
          if (d.preset) setPreset(d.preset);
          if (d.tone) setTone(d.tone);
          if (d.language) setLanguage(d.language);
          if (typeof d.rawNotes === "string") setRawNotes(d.rawNotes);
          if (d.pro && typeof d.pro === "object") {
            setPro((prev) => ({ ...prev, ...d.pro }));
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const raw = localStorage.getItem(memoryKey(userId));
      if (raw) {
        const arr = JSON.parse(raw) as unknown[];
        if (Array.isArray(arr)) {
          const clean = arr
            .filter(Boolean)
            .map((x) => x as MemoryItem)
            .filter(
              (x) =>
                typeof x?.id === "string" &&
                typeof x?.ts === "number" &&
                typeof x?.input === "string"
            );
          setHistory(clean.slice(0, 400));
        }
      }
    } catch {
      // ignore
    }

    try {
      const raw = localStorage.getItem(uiKey(userId));
      if (raw) {
        const u = JSON.parse(raw) as Partial<{
          historyOpen: boolean;
          proOpen: boolean;
          historyLimit: number;
          historySort: HistorySort;
          historyFilter: HistoryFilter;
        }>;

        if (u && typeof u === "object") {
          if (typeof u.historyOpen === "boolean") setHistoryOpen(u.historyOpen);
          if (typeof u.proOpen === "boolean") setProOpen(u.proOpen);
          if (typeof u.historyLimit === "number") setHistoryLimit(u.historyLimit);
          if (typeof u.historySort === "string") setHistorySort(u.historySort);
          if (typeof u.historyFilter === "string") setHistoryFilter(u.historyFilter);
        }
      }
    } catch {
      // ignore
    }

    setUiLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(userId),
          JSON.stringify({ preset, tone, language, rawNotes, pro, ts: nowMs() })
        );
      } catch {
        // ignore
      }
    }, 250);

    return () => clearTimeout(t);
  }, [userId, preset, tone, language, rawNotes, pro]);

  useEffect(() => {
    if (!userId) return;

    try {
      localStorage.setItem(memoryKey(userId), JSON.stringify(history.slice(0, 400)));
    } catch {
      // ignore
    }
  }, [history, userId]);

  useEffect(() => {
    if (!userId || !uiLoaded) return;

    try {
      localStorage.setItem(
        uiKey(userId),
        JSON.stringify({
          historyOpen,
          proOpen,
          historyLimit,
          historySort,
          historyFilter,
          ts: nowMs(),
        })
      );
    } catch {
      // ignore
    }
  }, [userId, uiLoaded, historyOpen, proOpen, historyLimit, historySort, historyFilter]);

  /* =========================================================
  Derived input
  ========================================================= */

  const presetSeed = useMemo(() => PRESETS[preset]?.seed(pro) || "", [preset, pro]);

  const composedInput = useMemo(() => {
    const base = rawNotes.trim() ? rawNotes.trim() : presetSeed.trim();
    const langHint = language === "en" ? "Language: English." : "Langue: Français.";

    const extra: string[] = [];
    if (pro.include.trim()) extra.push(`À inclure: ${pro.include.trim()}`);
    if (pro.constraints.trim()) extra.push(`Contraintes: ${pro.constraints.trim()}`);
    if (pro.signature.trim()) extra.push(`Signature: \"${pro.signature.trim()}\"`);

    const tail = extra.length ? `\n\n---\n${extra.join("\n")}` : "";
    return `${base}\n\n${langHint}${tail}`.trim();
  }, [language, presetSeed, pro.constraints, pro.include, pro.signature, rawNotes]);

  const canGenerate = useMemo(() => {
    if (!allowed) return false;
    return composedInput.trim().length >= 3;
  }, [allowed, composedInput]);

  /* =========================================================
  Status helpers
  ========================================================= */

  const statusText = useMemo(() => {
    if (statusBadge === "working") return "Génération…";
    if (statusBadge === "ready") return "Prêt";
    if (statusBadge === "error") return "Erreur";
    return "—";
  }, [statusBadge]);

  const statusClassText = useMemo(() => {
    if (statusBadge === "working") return "text-muted-foreground";
    if (statusBadge === "ready") return "text-emerald-700";
    if (statusBadge === "error") return "text-red-700";
    return "text-muted-foreground";
  }, [statusBadge]);

  const baseResultSignature = useMemo(() => {
    if (!resultView) return "";
    return makeContentSignature(resultView.title, resultView.html, resultView.text);
  }, [resultView]);

  const activeResult = useMemo<UIResultView | null>(() => {
    if (!resultView) return null;
    if (!resultOverride) return resultView;

    return {
      ...resultView,
      title: resultOverride.title,
      html: resultOverride.html,
      text: resultOverride.text,
    };
  }, [resultOverride, resultView]);

  const currentResultSignature = useMemo(() => {
    if (!activeResult) return "";
    return makeContentSignature(activeResult.title, activeResult.html, activeResult.text);
  }, [activeResult]);

  const hasContent = Boolean(activeResult && activeResult.html.trim());
  const contentEmpty = Boolean(activeResult && !activeResult.html.trim());
  const hasEditedVersion = Boolean(resultOverride);
  const lastPdfFresh = Boolean(lastPdf && currentResultSignature && lastPdf.signature === currentResultSignature);

  const currentWordCount = useMemo(() => countWords(activeResult?.text || ""), [activeResult]);
  const currentCharCount = useMemo(() => (activeResult?.text || "").length, [activeResult]);
  const currentReadMinutes = useMemo(
    () => estimateReadMinutes(activeResult?.text || ""),
    [activeResult]
  );

  const isResultEditorDirty = useMemo(() => {
    if (!isEditingResult || !activeResult) return false;
    return (
      normalizeSpaces(editResultTitle) !== normalizeSpaces(activeResult.title) ||
      editResultText.replace(/\r\n/g, "\n") !== activeResult.text.replace(/\r\n/g, "\n")
    );
  }, [activeResult, editResultText, editResultTitle, isEditingResult]);

  const isWorkingAny = busy || emailBusy || pdfBusy || emailWithPdfBusy;

  /* =========================================================
  History derived / filtering / sorting
  ========================================================= */

  const allTags = useMemo(() => {
    const tags = history.flatMap((h) => (Array.isArray(h.tags) ? h.tags : []));
    return uniq(tags.map((t) => normalizeSpaces(t)).filter(Boolean)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = normalizeSpaces(historyQuery).toLowerCase();
    const qClean = q.startsWith("#") ? q.slice(1) : q;

    const base = history.filter((it) => {
      if (historyFilter === "ok" && !it.ok) return false;
      if (historyFilter === "err" && it.ok) return false;
      if (historyFilter === "fav" && !it.favorite) return false;
      if (historyFilter === "pinned" && !it.pinned) return false;

      if (!qClean) return true;

      const hay = [
        it.title || "",
        it.docType || "",
        it.input || "",
        it.text || "",
        (it.tags || []).join(" "),
        it.note || "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qClean);
    });

    const sorted = [...base].sort((a, b) => {
      if (historySort === "newest") return b.ts - a.ts;
      if (historySort === "oldest") return a.ts - b.ts;

      const ta = (a.title || "").toLowerCase();
      const tb = (b.title || "").toLowerCase();

      if (historySort === "title_az") return ta.localeCompare(tb);
      if (historySort === "title_za") return tb.localeCompare(ta);
      return b.ts - a.ts;
    });

    const pinned = sorted.filter((x) => x.pinned);
    const rest = sorted.filter((x) => !x.pinned);

    return [...pinned, ...rest].slice(0, clamp(historyLimit, 5, 400));
  }, [history, historyFilter, historyLimit, historyQuery, historySort]);

  /* =========================================================
  Viewer / Editor helpers
  ========================================================= */

  const viewerItem = useMemo(() => {
    if (!viewerId) return null;
    return history.find((h) => h.id === viewerId) || null;
  }, [history, viewerId]);

  const editItem = useMemo(() => {
    if (!editId) return null;
    return history.find((h) => h.id === editId) || null;
  }, [history, editId]);

  const openViewer = useCallback((id: string) => {
    setViewerId(id);
    setViewerOpen(true);

    setHistory((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              last_opened_ts: nowMs(),
              open_count: (x.open_count || 0) + 1,
            }
          : x
      )
    );
  }, []);

  const openEditor = useCallback((id: string) => {
    setEditId(id);
    setEditOpen(true);
  }, []);

  useEffect(() => {
    if (!editOpen || !editItem) return;

    setEditTitleDraft(editItem.title || "");
    setEditNoteDraft(editItem.note || "");
    setEditTagsDraft((editItem.tags || []).join(", "));
  }, [editOpen, editItem]);

  /* =========================================================
  Reset / Sync draft now
  ========================================================= */

  const resetAll = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
    setStatusBadge("idle");
    setResultRaw(null);
    setResultView(null);
    setResultOverride(null);
    setResultSourceHistoryId(null);
    setIsEditingResult(false);
    setEditResultTitle("");
    setEditResultText("");
    setCopyOk(false);
    setCopyHtmlOk(false);
    setLastPdf(null);

    setPreset("free");
    setTone("pro");
    setLanguage("fr");
    setRawNotes("");

    setPro({
      include: "Objet + corps. Ton pro, humain. On garde en shortlist.",
      constraints: "Pas de date, pas de salaire, pas de lieu.",
      signature: "L’équipe RH",
      recipient_email: "",
      subject_override: "",
      company_name: "",
    });
  }, []);

  const syncDraftNow = useCallback(() => {
    if (!userId) return;

    try {
      localStorage.setItem(
        draftKey(userId),
        JSON.stringify({ preset, tone, language, rawNotes, pro, ts: nowMs() })
      );
      setSuccessMessage("Brouillon synchronisé.");
      setStatusBadge((s) => (s === "error" ? s : "ready"));
    } catch {
      // ignore
    }
  }, [userId, preset, tone, language, rawNotes, pro]);

  /* =========================================================
  History mutations
  ========================================================= */

  const upsertHistory = useCallback((items: MemoryItem[]) => {
    setHistory((prev) => {
      const map = new Map<string, MemoryItem>();
      for (const x of prev) map.set(x.id, x);
      for (const x of items) map.set(x.id, x);
      return Array.from(map.values())
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 400);
    });
  }, []);

  const pushToHistory = useCallback(
    async (item: MemoryItem) => {
      setHistory((prev) => [item, ...prev].slice(0, 400));

      if (userId && supabase) {
        await trySupabaseHistoryInsert(supabase, userId, item);
      }
    },
    [supabase, userId]
  );

  const toggleFavorite = useCallback((id: string) => {
    setHistory((prev) => prev.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x)));
  }, []);

  const togglePinned = useCallback((id: string) => {
    setHistory((prev) => prev.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
  }, []);

  const deleteHistoryItem = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((x) => x.id !== id));
      setSelectedIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      if (viewerId === id) {
        setViewerOpen(false);
        setViewerId(null);
      }

      if (editId === id) {
        setEditOpen(false);
        setEditId(null);
      }

      if (resultSourceHistoryId === id) {
        setResultSourceHistoryId(null);
      }
    },
    [viewerId, editId, resultSourceHistoryId]
  );

  const deleteSelected = useCallback(() => {
    const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    if (!ids.length) return;

    setHistory((prev) => prev.filter((x) => !ids.includes(x.id)));
    setSelectedIds({});
  }, [selectedIds]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setSelectedIds({});
    setViewerOpen(false);
    setViewerId(null);
    setEditOpen(false);
    setEditId(null);
  }, []);

  const selectAllVisible = useCallback(() => {
    const ids = filteredHistory.map((x) => x.id);
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });
  }, [filteredHistory]);

  const clearSelection = useCallback(() => {
    setSelectedIds({});
  }, []);

  const renameHistoryItem = useCallback((id: string, title: string) => {
    const t = normalizeSpaces(title);
    setHistory((prev) => prev.map((x) => (x.id === id ? { ...x, title: t } : x)));
  }, []);

  const updateNote = useCallback((id: string, note: string) => {
    setHistory((prev) => prev.map((x) => (x.id === id ? { ...x, note } : x)));
  }, []);

  const updateTags = useCallback((id: string, tags: string[]) => {
    const clean = uniq(tags.map((t) => normalizeSpaces(t)).filter(Boolean)).slice(0, 12);
    setHistory((prev) => prev.map((x) => (x.id === id ? { ...x, tags: clean } : x)));
  }, []);

  const setCurrentResultFromView = useCallback(
    (view: UIResultView | null, raw: AnyPierreResponse | null, sourceHistoryId: string | null) => {
      setResultRaw(raw);
      setResultView(view);
      setResultOverride(null);
      setResultSourceHistoryId(sourceHistoryId);
      setIsEditingResult(false);
      setEditResultTitle("");
      setEditResultText("");
      setCopyOk(false);
      setCopyHtmlOk(false);
      setLastPdf(null);
    },
    []
  );

  const saveEditedVersionToHistory = useCallback(
    async (view: UIResultView) => {
      const tags = uniq([...(history.find((x) => x.id === resultSourceHistoryId)?.tags || []), "edited"]);
      const itemId = uid();

      const item: MemoryItem = {
        id: itemId,
        ts: nowMs(),
        preset,
        tone,
        language,
        input: composedInput,
        response: resultRaw || undefined,
        title: view.title,
        html: view.html,
        text: view.text,
        docType: view.docType,
        confidence: view.confidence,
        ok: Boolean(view.html.trim() || view.text.trim()),
        favorite: false,
        pinned: false,
        tags,
        note: "Version modifiée manuellement depuis l’interface.",
      };

      await pushToHistory(item);
      setResultSourceHistoryId(itemId);
    },
    [composedInput, history, language, preset, pushToHistory, resultRaw, resultSourceHistoryId, tone]
  );

  /* =========================================================
  Result editor helpers
  ========================================================= */

  const openResultEditor = useCallback(() => {
    if (!activeResult) return;
    setEditResultTitle(activeResult.title || "Document Pierre");
    setEditResultText(activeResult.text || htmlToText(activeResult.html || ""));
    setIsEditingResult(true);
    setError(null);
    setSuccessMessage(null);
  }, [activeResult]);

  const cancelResultEditing = useCallback(() => {
    setIsEditingResult(false);
    setEditResultTitle(activeResult?.title || "");
    setEditResultText(activeResult?.text || "");
  }, [activeResult]);

  const restoreOriginalResult = useCallback(() => {
    if (!resultView) return;
    setResultOverride(null);
    setLastPdf(null);
    setIsEditingResult(false);
    setEditResultTitle(resultView.title || "");
    setEditResultText(resultView.text || htmlToText(resultView.html || ""));
    setSuccessMessage("Version d’origine restaurée. Le prochain PDF repartira de cette base.");
    setStatusBadge("ready");
  }, [resultView]);

  const saveResultEdits = useCallback(async () => {
    if (!resultView) return;

    const title = normalizeSpaces(editResultTitle) || activeResult?.title || resultView.title || "Document Pierre";
    const text = editResultText.replace(/\r\n/g, "\n").trim();

    if (!text) {
      setError("Le contenu modifié est vide. Ajoute du texte avant d’enregistrer.");
      setStatusBadge("error");
      return;
    }

    const html = textToHtml(text);
    const override: ResultOverride = {
      title,
      text,
      html,
      editedAt: nowMs(),
      sourceSignature: baseResultSignature,
    };

    setResultOverride(override);
    setIsEditingResult(false);
    setLastPdf(null);
    setStatusBadge("ready");
    setSuccessMessage(
      "Version modifiée enregistrée. Les actions Copier, Email et PDF utilisent maintenant ce contenu."
    );

    await saveEditedVersionToHistory({
      ...(resultView || activeResult || {
        title,
        html,
        text,
        docType: "—",
        language: language,
        tone,
        confidence: undefined,
        missingQuestions: [],
        actions: [],
        raw: resultRaw || {},
      }),
      title,
      html,
      text,
    });
  }, [
    activeResult,
    baseResultSignature,
    editResultText,
    editResultTitle,
    language,
    resultRaw,
    resultView,
    saveEditedVersionToHistory,
    tone,
  ]);

  useEffect(() => {
    if (!resultView) {
      setIsEditingResult(false);
      setEditResultTitle("");
      setEditResultText("");
      return;
    }

    if (!resultOverride && !isEditingResult) {
      setEditResultTitle(resultView.title || "");
      setEditResultText(resultView.text || htmlToText(resultView.html || ""));
    }
  }, [isEditingResult, resultOverride, resultView]);

  useEffect(() => {
    if (!resultView || !resultOverride) return;
    if (resultOverride.sourceSignature !== baseResultSignature) {
      setResultOverride(null);
      setLastPdf(null);
      setIsEditingResult(false);
    }
  }, [baseResultSignature, resultOverride, resultView]);

  /* =========================================================
  Apply preset
  ========================================================= */

  const applyPreset = useCallback(
    (p: PresetId) => {
      setPreset(p);

      setRawNotes((prev) => {
        if (prev.trim()) return prev;
        return PRESETS[p]?.seed(pro) || "";
      });

      setStatusBadge((s) => (s === "error" ? "idle" : s));
      setError(null);
      setSuccessMessage(null);
    },
    [pro]
  );

  /* =========================================================
  Generate
  ========================================================= */

  const generate = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setCopyOk(false);
    setCopyHtmlOk(false);
    setLastPdf(null);
    setResultOverride(null);
    setIsEditingResult(false);

    if (!allowed) {
      setError("Accès refusé : Pierre n’est pas actif sur ce compte.");
      setStatusBadge("error");
      return;
    }

    if (!canGenerate) {
      setError("Ajoute un brief (au moins 3 caractères).");
      setStatusBadge("error");
      return;
    }

    if (!supabase) {
      setError("Supabase navigateur non configuré.");
      setStatusBadge("error");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setStatusBadge("working");
    const reqId = ++lastReqIdRef.current;

    let token = "";

    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      token = sessionRes.session?.access_token || "";

      if (!token) {
        setError("Session manquante. Reconnecte-toi.");
        setBusy(false);
        setStatusBadge("error");
        return;
      }
    } catch {
      setError("Session manquante. Reconnecte-toi.");
      setBusy(false);
      setStatusBadge("error");
      return;
    }

    const payload = {
      input: composedInput,
      tone,
      company_name: pro.company_name?.trim() || undefined,
      answers: {
        signature: pro.signature?.trim() || undefined,
      },
    };

    const startedTs = nowMs();

    try {
      const res = await fetch("/api/pierre/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (reqId !== lastReqIdRef.current) return;

      if (!res.ok) {
        const msg =
          typeof json?.error === "string" ? json.error : `Erreur génération (${res.status}).`;

        setError(msg);
        setBusy(false);
        setStatusBadge("error");

        await pushToHistory({
          id: uid(),
          ts: startedTs,
          preset,
          tone,
          language,
          input: composedInput,
          ok: false,
          error: msg,
          favorite: false,
          pinned: false,
          tags: [],
          note: "",
        });

        return;
      }

      const rawResp = json as AnyPierreResponse;
      const view = normalizeToView(rawResp);
      const historyId = uid();

      setCurrentResultFromView(view, rawResp, historyId);

      if (looksEmptyResponse(rawResp)) {
        setError("Réponse vide (backend n’a pas produit de contenu).");
        setStatusBadge("error");
      } else {
        setSuccessMessage("Document généré.");
        setStatusBadge("ready");
      }

      setBusy(false);

      await pushToHistory({
        id: historyId,
        ts: startedTs,
        preset,
        tone,
        language,
        input: composedInput,
        response: rawResp,
        title: view.title,
        html: view.html,
        text: view.text,
        docType: view.docType,
        confidence: view.confidence,
        ok: !looksEmptyResponse(rawResp),
        error: looksEmptyResponse(rawResp) ? "empty_response" : undefined,
        favorite: false,
        pinned: false,
        tags: [],
        note: "",
      });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setBusy(false);
        setStatusBadge("idle");
        return;
      }

      const msg = e instanceof Error ? e.message : "Erreur génération.";
      setError(msg);
      setBusy(false);
      setStatusBadge("error");

      await pushToHistory({
        id: uid(),
        ts: startedTs,
        preset,
        tone,
        language,
        input: composedInput,
        ok: false,
        error: msg,
        favorite: false,
        pinned: false,
        tags: [],
        note: "",
      });
    }
  }, [
    allowed,
    canGenerate,
    composedInput,
    language,
    preset,
    pro.company_name,
    pro.signature,
    pushToHistory,
    setCurrentResultFromView,
    supabase,
    tone,
  ]);

  /* =========================================================
  Shared action helpers
  ========================================================= */

  const getUserToken = useCallback(async () => {
    if (!supabase) throw new Error("Supabase navigateur non configuré.");

    const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) throw new Error(sessionErr.message);

    const token = sessionRes.session?.access_token || "";
    if (!token) throw new Error("Session manquante. Reconnecte-toi.");
    return token;
  }, [supabase]);

  const createPdfForView = useCallback(
    async (view: UIResultView) => {
      const token = await getUserToken();
      const filename = sanitizeFilename(view.title || "document-pierre");

      const res = await fetch("/api/pierre/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action_type: "doc.generate",
          html: view.html || "",
          text: view.text || "",
          title: view.title || "Document Pierre",
          filename,
          metadata: {
            source: "pierre_use_page",
            doc_title: view.title || "",
            doc_type: view.docType || "",
            tone: view.tone || "",
            language: view.language || "",
            confidence: typeof view.confidence === "number" ? view.confidence : null,
            edited_from_ui: hasEditedVersion,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as PierreActionApiResponse;

      if (!res.ok) {
        throw new Error(
          safeStr(data?.error) ||
            (typeof data?.make_status === "number"
              ? `Export PDF refusé par Make (${data.make_status}).`
              : "Export PDF impossible.")
        );
      }

      const pdfUrl = extractPdfUrl(data);
      if (!pdfUrl) {
        throw new Error("PDF généré mais aucune URL n’a été renvoyée.");
      }

      const nextPdf: LastPdfState = {
        url: pdfUrl,
        filename,
        generatedAt: nowMs(),
        signature: makeContentSignature(view.title, view.html, view.text),
      };

      setLastPdf(nextPdf);
      return nextPdf;
    },
    [getUserToken, hasEditedVersion]
  );

  const ensureFreshPdf = useCallback(
    async (view: UIResultView) => {
      const signature = makeContentSignature(view.title, view.html, view.text);
      if (lastPdf && lastPdf.signature === signature) return lastPdf;
      return createPdfForView(view);
    },
    [createPdfForView, lastPdf]
  );

  /* =========================================================
  Copy / actions
  ========================================================= */

  const copyText = useCallback(async () => {
    if (!activeResult) return;

    try {
      await navigator.clipboard.writeText(activeResult.text || "");
      setCopyOk(true);
      setSuccessMessage(
        hasEditedVersion ? "Texte modifié copié." : "Texte copié."
      );
      setTimeout(() => setCopyOk(false), 1200);
    } catch {
      setError("Impossible de copier automatiquement. Copie manuellement.");
      setStatusBadge("error");
    }
  }, [activeResult, hasEditedVersion]);

  const copyHtml = useCallback(async () => {
    if (!activeResult) return;

    try {
      await navigator.clipboard.writeText(activeResult.html || "");
      setCopyHtmlOk(true);
      setSuccessMessage(hasEditedVersion ? "HTML modifié copié." : "HTML copié.");
      setTimeout(() => setCopyHtmlOk(false), 1200);
    } catch {
      setError("Impossible de copier le HTML. Copie manuellement.");
      setStatusBadge("error");
    }
  }, [activeResult, hasEditedVersion]);

  const exportPdf = useCallback(async () => {
    if (!activeResult) return;

    setError(null);
    setSuccessMessage(null);
    setPdfBusy(true);

    try {
      const pdf = await createPdfForView(activeResult);
      setPdfBusy(false);
      setSuccessMessage(
        hasEditedVersion
          ? "PDF généré depuis la version modifiée."
          : "PDF généré."
      );
      setStatusBadge("ready");
      return pdf;
    } catch (e: unknown) {
      setPdfBusy(false);
      setError(e instanceof Error ? e.message : "Erreur export PDF.");
      setStatusBadge("error");
      return null;
    }
  }, [activeResult, createPdfForView, hasEditedVersion]);

  const openPdf = useCallback(async () => {
    if (!activeResult) {
      setError("Aucun contenu disponible pour le PDF.");
      setStatusBadge("error");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setPdfBusy(true);

    try {
      const pdf = await ensureFreshPdf(activeResult);
      window.open(pdf.url, "_blank", "noopener,noreferrer");
      setPdfBusy(false);
      setSuccessMessage(lastPdfFresh ? "PDF ouvert." : "PDF régénéré puis ouvert.");
      setStatusBadge("ready");
    } catch (e: unknown) {
      setPdfBusy(false);
      setError(e instanceof Error ? e.message : "Impossible d’ouvrir le PDF.");
      setStatusBadge("error");
    }
  }, [activeResult, ensureFreshPdf, lastPdfFresh]);

  const downloadPdf = useCallback(async () => {
    if (!activeResult) {
      setError("Aucun contenu disponible pour le PDF.");
      setStatusBadge("error");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setPdfBusy(true);

    try {
      const pdf = await ensureFreshPdf(activeResult);
      const a = document.createElement("a");
      a.href = pdf.url;
      a.download = pdf.filename || "document-pierre.pdf";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPdfBusy(false);
      setSuccessMessage(lastPdfFresh ? "Téléchargement PDF lancé." : "PDF régénéré puis téléchargement lancé.");
      setStatusBadge("ready");
    } catch (e: unknown) {
      setPdfBusy(false);
      setError(e instanceof Error ? e.message : "Impossible de lancer le téléchargement du PDF.");
      setStatusBadge("error");
    }
  }, [activeResult, ensureFreshPdf, lastPdfFresh]);

  const sendEmail = useCallback(async () => {
    if (!activeResult) return;

    if (!supabase) {
      setError("Supabase navigateur non configuré.");
      setStatusBadge("error");
      return;
    }

    setError(null);
    setSuccessMessage(null);

    const to = pro.recipient_email.trim();
    if (!to) {
      setError("Ajoute un email destinataire dans Options pro.");
      setStatusBadge("error");
      return;
    }

    if (!isValidEmail(to)) {
      setError("Email destinataire invalide.");
      setStatusBadge("error");
      return;
    }

    const subject = normalizeSpaces(pro.subject_override.trim() || activeResult.title);
    const html = activeResult.html || "";
    const text = activeResult.text || htmlToText(html);

    if (!html && !text) {
      setError("Aucun contenu à envoyer par email.");
      setStatusBadge("error");
      return;
    }

    setEmailBusy(true);

    try {
      const token = await getUserToken();

      const res = await fetch("/api/pierre/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action_type: "email.send",
          to,
          subject,
          html,
          text,
          metadata: {
            source: "pierre-use-page",
            doc_title: activeResult.title,
            doc_type: activeResult.docType,
            tone: activeResult.tone,
            language: activeResult.language,
            confidence: typeof activeResult.confidence === "number" ? activeResult.confidence : null,
            edited_from_ui: hasEditedVersion,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as PierreActionApiResponse;

      if (!res.ok) {
        setEmailBusy(false);
        setError(
          safeStr(data?.error) ||
            (typeof data?.make_status === "number"
              ? `Envoi email refusé par Make (${data.make_status}).`
              : "Envoi email impossible.")
        );
        setStatusBadge("error");
        return;
      }

      setEmailBusy(false);
      setSuccessMessage(
        hasEditedVersion
          ? `Email envoyé à ${to} avec la version modifiée.`
          : `Email envoyé à ${to}.`
      );
      setStatusBadge("ready");
    } catch (e: unknown) {
      setEmailBusy(false);
      setError(e instanceof Error ? e.message : "Erreur lors de l’envoi email.");
      setStatusBadge("error");
    }
  }, [activeResult, getUserToken, hasEditedVersion, pro.recipient_email, pro.subject_override, supabase]);

  const sendEmailWithPdf = useCallback(async () => {
    if (!activeResult) return;

    if (!supabase) {
      setError("Supabase navigateur non configuré.");
      setStatusBadge("error");
      return;
    }

    const to = pro.recipient_email.trim();
    if (!to) {
      setError("Ajoute un email destinataire dans Options pro.");
      setStatusBadge("error");
      return;
    }

    if (!isValidEmail(to)) {
      setError("Email destinataire invalide.");
      setStatusBadge("error");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setEmailWithPdfBusy(true);

    try {
      const token = await getUserToken();
      const freshPdf = await ensureFreshPdf(activeResult);

      const subject = normalizeSpaces(pro.subject_override.trim() || activeResult.title);
      const html = activeResult.html || "";
      const text = activeResult.text || htmlToText(html);

      const res = await fetch("/api/pierre/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action_type: "email.send",
          to,
          subject,
          html,
          text,
          attachments: [
            {
              filename: freshPdf.filename || sanitizeFilename(activeResult.title || "document-pierre"),
              url: freshPdf.url,
              content_type: "application/pdf",
            },
          ],
          metadata: {
            source: "pierre-use-page",
            doc_title: activeResult.title,
            doc_type: activeResult.docType,
            tone: activeResult.tone,
            language: activeResult.language,
            confidence:
              typeof activeResult.confidence === "number" ? activeResult.confidence : null,
            attached_pdf: true,
            edited_from_ui: hasEditedVersion,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as PierreActionApiResponse;

      if (!res.ok) {
        setEmailWithPdfBusy(false);
        setError(
          safeStr(data?.error) ||
            (typeof data?.make_status === "number"
              ? `Envoi email + PDF refusé par Make (${data.make_status}).`
              : "Envoi email + PDF impossible.")
        );
        setStatusBadge("error");
        return;
      }

      setEmailWithPdfBusy(false);
      setSuccessMessage(
        hasEditedVersion
          ? `Email avec PDF envoyé à ${to} depuis la version modifiée.`
          : `Email avec PDF envoyé à ${to}.`
      );
      setStatusBadge("ready");
    } catch (e: unknown) {
      setEmailWithPdfBusy(false);
      setError(e instanceof Error ? e.message : "Erreur lors de l’envoi email + PDF.");
      setStatusBadge("error");
    }
  }, [
    activeResult,
    ensureFreshPdf,
    getUserToken,
    hasEditedVersion,
    pro.recipient_email,
    pro.subject_override,
    supabase,
  ]);

  /* =========================================================
  History actions
  ========================================================= */

  const loadFromHistory = useCallback(
    (item: MemoryItem) => {
      setPreset(item.preset);
      setTone(item.tone);
      setLanguage(item.language);
      setRawNotes(item.input);

      const view = normalizeMemoryItemToView(item);
      setCurrentResultFromView(view, item.response || null, item.id);

      setError(item.error || null);
      setSuccessMessage(null);
      setStatusBadge(item.ok ? "ready" : item.error ? "error" : "idle");

      setHistory((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? {
                ...x,
                last_opened_ts: nowMs(),
                open_count: (x.open_count || 0) + 1,
              }
            : x
        )
      );
    },
    [setCurrentResultFromView]
  );

  const rerunFromHistory = useCallback(
    async (item: MemoryItem) => {
      setPreset(item.preset);
      setTone(item.tone);
      setLanguage(item.language);
      setRawNotes(item.input);

      setTimeout(() => {
        generate();
      }, 30);
    },
    [generate]
  );

  const copyHistoryText = useCallback(async (item: MemoryItem) => {
    const view = normalizeMemoryItemToView(item);
    const txt = view?.text || "";

    try {
      await navigator.clipboard.writeText(txt);
      setCopyOk(true);
      setSuccessMessage("Texte copié.");
      setTimeout(() => setCopyOk(false), 900);
    } catch {
      setError("Copie impossible.");
      setStatusBadge("error");
    }
  }, []);

  const copyHistoryHtml = useCallback(async (item: MemoryItem) => {
    const view = normalizeMemoryItemToView(item);
    const html = view?.html || "";

    try {
      await navigator.clipboard.writeText(html);
      setCopyHtmlOk(true);
      setSuccessMessage("HTML copié.");
      setTimeout(() => setCopyHtmlOk(false), 900);
    } catch {
      setError("Copie HTML impossible.");
      setStatusBadge("error");
    }
  }, []);

  /* =========================================================
  Import / Export JSON
  ========================================================= */

  const openExport = useCallback(() => {
    setIoMode("export");
    setIoText(
      JSON.stringify(
        {
          version: "pierre_history_v1",
          exported_at: new Date().toISOString(),
          items: history,
        },
        null,
        2
      )
    );
    setIoOpen(true);
  }, [history]);

  const openImport = useCallback(() => {
    setIoMode("import");
    setIoText("");
    setIoOpen(true);
  }, []);

  const doImport = useCallback(() => {
    try {
      const parsed = JSON.parse(ioText || "{}") as { items?: unknown[] };
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      const clean: MemoryItem[] = items
        .filter(Boolean)
        .map((x) => x as MemoryItem)
        .filter(
          (x) =>
            typeof x?.id === "string" &&
            typeof x?.ts === "number" &&
            typeof x?.input === "string" &&
            typeof x?.preset === "string"
        )
        .slice(0, 400);

      if (!clean.length) {
        setError("Import: aucun item valide trouvé.");
        setStatusBadge("error");
        return;
      }

      upsertHistory(clean);
      setIoOpen(false);
      setError(null);
      setSuccessMessage("Historique importé.");
      setStatusBadge("ready");
    } catch {
      setError("Import: JSON invalide.");
      setStatusBadge("error");
    }
  }, [ioText, upsertHistory]);

  const copyIoText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ioText || "");
      setCopyOk(true);
      setSuccessMessage("Export copié.");
      setTimeout(() => setCopyOk(false), 900);
    } catch {
      setError("Copie impossible.");
      setStatusBadge("error");
    }
  }, [ioText]);

  /* =========================================================
  Selection helpers
  ========================================================= */

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setSelectedTagBulk = useCallback(
    (tag: string) => {
      const t = normalizeSpaces(tag);
      if (!t) return;

      const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
      if (!ids.length) return;

      setHistory((prev) =>
        prev.map((x) => {
          if (!ids.includes(x.id)) return x;
          const tags = Array.isArray(x.tags) ? x.tags : [];
          return { ...x, tags: uniq([...tags, t]).slice(0, 12) };
        })
      );
    },
    [selectedIds]
  );

  const setFavoriteBulk = useCallback(
    (fav: boolean) => {
      const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
      if (!ids.length) return;

      setHistory((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, favorite: fav } : x)));
    },
    [selectedIds]
  );

  const setPinnedBulk = useCallback(
    (pin: boolean) => {
      const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
      if (!ids.length) return;

      setHistory((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, pinned: pin } : x)));
    },
    [selectedIds]
  );

  /* =========================================================
  Save editor
  ========================================================= */

  const saveEditor = useCallback(() => {
    if (!editItem) return;

    renameHistoryItem(editItem.id, editTitleDraft);
    updateNote(editItem.id, editNoteDraft);

    const tags = (editTagsDraft || "")
      .split(",")
      .map((t) => normalizeSpaces(t))
      .filter(Boolean);

    updateTags(editItem.id, tags);

    setEditOpen(false);
    setEditId(null);
  }, [
    editItem,
    editTitleDraft,
    editNoteDraft,
    editTagsDraft,
    renameHistoryItem,
    updateNote,
    updateTags,
  ]);

  /* =========================================================
  Render helpers
  ========================================================= */

  const renderViewer = () => {
    const it = viewerItem;

    if (!it) {
      return (
        <Modal open={viewerOpen} title="Historique" onClose={() => setViewerOpen(false)}>
          <p className="text-sm text-muted-foreground">Item introuvable.</p>
        </Modal>
      );
    }

    const dt = new Date(it.ts);
    const view = normalizeMemoryItemToView(it);
    const html = view?.html || "";
    const text = view?.text || "";
    const title = view?.title || "(sans titre)";
    const docType = view?.docType || "—";

    return (
      <Modal
        open={viewerOpen}
        wide
        title={title}
        subtitle={`${dt.toLocaleString()} • ${it.preset} • ${it.tone}/${it.language} • ${docType}`}
        onClose={() => setViewerOpen(false)}
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => loadFromHistory(it)}>
                Restaurer dans la page
              </Button>
              <Button variant="outline" onClick={() => rerunFromHistory(it)}>
                Re-générer
              </Button>
              <Button variant="outline" onClick={() => copyHistoryText(it)}>
                Copier texte
              </Button>
              <Button variant="outline" onClick={() => copyHistoryHtml(it)}>
                Copier HTML
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => togglePinned(it.id)}>
                {it.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button variant="outline" onClick={() => toggleFavorite(it.id)}>
                {it.favorite ? "★ Favori" : "☆ Favori"}
              </Button>
              <Button variant="outline" onClick={() => openEditor(it.id)}>
                Modifier
              </Button>
              <Button variant="outline" onClick={() => deleteHistoryItem(it.id)}>
                Supprimer
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {it.tags && it.tags.length ? (
            <div className="flex flex-wrap gap-2">
              {it.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border px-2 py-1 text-xs text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun tag.</p>
          )}

          {it.note ? (
            <div className="rounded-xl border bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">Note</p>
              <p className="whitespace-pre-wrap text-sm">{it.note}</p>
            </div>
          ) : null}

          <SectionDivider label="Contenu (HTML rendu)" />

          {html ? (
            <div className="rounded-xl border p-4">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          ) : (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Aucun HTML dans cet item.
            </div>
          )}

          <SectionDivider label="Texte (plain)" />

          {text ? (
            <pre className="whitespace-pre-wrap rounded-xl border bg-background/60 p-4 text-xs leading-relaxed">
              {text}
            </pre>
          ) : (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Aucun texte dans cet item.
            </div>
          )}

          <SectionDivider label="Input (brief utilisé)" />

          <pre className="whitespace-pre-wrap rounded-xl border bg-background/60 p-4 text-xs leading-relaxed">
            {it.input}
          </pre>
        </div>
      </Modal>
    );
  };

  const renderEditorModal = () => {
    if (!editItem) return null;

    const dt = new Date(editItem.ts);

    return (
      <Modal
        open={editOpen}
        title="Modifier l’item"
        subtitle={`${dt.toLocaleString()} • ${editItem.preset} • ${editItem.docType || "—"}`}
        onClose={() => {
          setEditOpen(false);
          setEditId(null);
        }}
        footer={
          <div className="flex justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => togglePinned(editItem.id)}>
                {editItem.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button variant="outline" onClick={() => toggleFavorite(editItem.id)}>
                {editItem.favorite ? "★ Favori" : "☆ Favori"}
              </Button>
              <Button variant="outline" onClick={() => deleteHistoryItem(editItem.id)}>
                Supprimer
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditId(null);
                }}
              >
                Annuler
              </Button>
              <Button onClick={saveEditor}>Enregistrer</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Titre</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={editTitleDraft}
              onChange={(e) => setEditTitleDraft(e.target.value)}
              placeholder="Ex: Refus candidat — Dev Front"
            />
            <Helper>Le titre sert au tri et à la recherche.</Helper>
          </div>

          <div className="space-y-1">
            <Label>Tags (séparés par virgules)</Label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={editTagsDraft}
              onChange={(e) => setEditTagsDraft(e.target.value)}
              placeholder="ex: refus, shortlist, dev front"
            />
            <Helper>Max 12 tags. Utilise des tags courts.</Helper>
          </div>

          <div className="space-y-1">
            <Label>Note</Label>
            <textarea
              className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={editNoteDraft}
              onChange={(e) => setEditNoteDraft(e.target.value)}
              placeholder="Note interne: pourquoi ce doc est utile, contexte, version client, etc."
            />
          </div>

          <SectionDivider label="Aide tags" />

          {allTags.length ? (
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 40).map((t) => (
                <Pill
                  key={t}
                  subtle
                  onClick={() => {
                    const cur = (editTagsDraft || "")
                      .split(",")
                      .map((x) => normalizeSpaces(x))
                      .filter(Boolean);

                    if (cur.includes(t)) return;

                    const next = [...cur, t].slice(0, 12);
                    setEditTagsDraft(next.join(", "));
                  }}
                >
                  + #{t}
                </Pill>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun tag existant.</p>
          )}
        </div>
      </Modal>
    );
  };

  const renderIOModal = () => {
    const title = ioMode === "export" ? "Exporter l’historique" : "Importer l’historique";
    const subtitle =
      ioMode === "export"
        ? "Copie le JSON ci-dessous ou sauvegarde-le dans un fichier."
        : "Colle un JSON exporté. Il sera fusionné avec ton historique.";

    return (
      <Modal
        open={ioOpen}
        wide
        title={title}
        subtitle={subtitle}
        onClose={() => setIoOpen(false)}
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyIoText}>
                Copier
              </Button>

              {ioMode === "export" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIoMode("import");
                    setIoText("");
                  }}
                >
                  Passer en import
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIoMode("export");
                    setIoText(
                      JSON.stringify(
                        {
                          version: "pierre_history_v1",
                          exported_at: new Date().toISOString(),
                          items: history,
                        },
                        null,
                        2
                      )
                    );
                  }}
                >
                  Passer en export
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIoOpen(false)}>
                Fermer
              </Button>
              {ioMode === "import" ? <Button onClick={doImport}>Importer</Button> : null}
            </div>
          </div>
        }
      >
        <textarea
          className="min-h-[380px] w-full whitespace-pre-wrap rounded-xl border bg-background px-3 py-2 text-xs leading-relaxed"
          value={ioText}
          onChange={(e) => setIoText(e.target.value)}
          placeholder={ioMode === "import" ? "Colle ici ton JSON exporté..." : ""}
        />
      </Modal>
    );
  };

  /* =========================================================
  Conditional renders
  ========================================================= */

  if (checking) {
    return (
      <main className="mx-auto max-w-6xl space-y-3 px-4 py-12">
        <p className="text-sm text-muted-foreground">Vérification de l’accès…</p>
        {gateError && <p className="text-sm text-red-600">{gateError}</p>}
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Accès indisponible</h1>
          <p className="text-sm text-muted-foreground">Pierre n’est pas actif sur ce compte.</p>
        </header>

        {gateError && (
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-red-600">{gateError}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/paiement?agent=pierre">Activer Pierre</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents/pierre">Voir la fiche</Link>
          </Button>
          <Button variant="outline" onClick={checkAccessOnce}>
            Rafraîchir
          </Button>
        </div>
      </main>
    );
  }

  /* =========================================================
  Main Render
  ========================================================= */

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10">
      {renderViewer()}
      {renderEditorModal()}
      {renderIOModal()}

      <section className="relative overflow-hidden rounded-[28px] border bg-gradient-to-br from-background via-violet-50/50 to-background p-7 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-200/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-fuchsia-200/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="violet">
                <Sparkles className="h-3.5 w-3.5" />
                Pierre
              </Badge>
              <Badge>
                <Wand2 className="h-3.5 w-3.5" />
                Rédaction RH
              </Badge>
              <Badge>
                <History className="h-3.5 w-3.5" />
                Mémoire active
              </Badge>
              {hasEditedVersion ? (
                <Badge variant="violet">
                  <Pencil className="h-3.5 w-3.5" />
                  Version modifiée
                </Badge>
              ) : null}
              {lastPdf ? (
                <Badge variant={lastPdfFresh ? "success" : "warn"}>
                  <Paperclip className="h-3.5 w-3.5" />
                  {lastPdfFresh ? "PDF prêt" : "PDF à regénérer"}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pierre — Rédaction RH
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Brief, génération, édition, email, PDF et historique : tout depuis une seule
                interface, pensée pour produire vite, proprement, avec une vraie logique
                CloneStore.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/agents/pierre">Fiche Pierre</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile/agents">Mes clones</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/questions">Support</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 lg:w-[560px]">
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs text-muted-foreground">Statut</p>
              <p className={`mt-1 text-sm font-semibold ${statusClassText}`}>{statusText}</p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs text-muted-foreground">Historique</p>
              <p className="mt-1 text-sm font-semibold">{history.length} items</p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs text-muted-foreground">Contenu</p>
              <p className="mt-1 text-sm font-semibold">
                {hasContent ? "Prêt" : activeResult ? "Vide" : "—"}
              </p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs text-muted-foreground">Lecture</p>
              <p className="mt-1 text-sm font-semibold">
                {activeResult ? `${currentReadMinutes} min` : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
          <p className="whitespace-pre-wrap text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="whitespace-pre-wrap text-sm text-emerald-700">{successMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card
            title="Brief"
            subtitle="Décris simplement le document ou l’email à produire."
            tone="violet"
            right={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={syncDraftNow}
                  disabled={isWorkingAny}
                >
                  Sync
                </Button>
                <Button variant="outline" onClick={resetAll} disabled={isWorkingAny}>
                  Reset
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Langue</Label>
                <div className="relative">
                  <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Ton</Label>
                <div className="relative">
                  <BadgeCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                  >
                    <option value="pro">Professionnel</option>
                    <option value="convivial">Convivial</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Label>Présets (1 clic)</Label>
              <div className="flex flex-wrap gap-2">
                <Pill active={preset === "rejection"} onClick={() => applyPreset("rejection")}>
                  {PRESETS.rejection.label}
                </Pill>
                <Pill active={preset === "mail_rh"} onClick={() => applyPreset("mail_rh")}>
                  {PRESETS.mail_rh.label}
                </Pill>
                <Pill active={preset === "announcement"} onClick={() => applyPreset("announcement")}>
                  {PRESETS.announcement.label}
                </Pill>
                <Pill active={preset === "job_posting"} onClick={() => applyPreset("job_posting")}>
                  {PRESETS.job_posting.label}
                </Pill>
                <Pill active={preset === "procedure"} onClick={() => applyPreset("procedure")}>
                  {PRESETS.procedure.label}
                </Pill>
                <Pill active={preset === "report"} onClick={() => applyPreset("report")}>
                  {PRESETS.report.label}
                </Pill>
                <Pill active={preset === "free"} onClick={() => applyPreset("free")}>
                  {PRESETS.free.label}
                </Pill>
              </div>
              <Helper>{PRESETS[preset]?.hint || "—"}</Helper>
            </div>

            <div className="mt-5 space-y-1">
              <Label>Brief</Label>
              <textarea
                className="min-h-[280px] w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none"
                placeholder='Ex : Mail de refus candidat (dev front). Ton pro, humain. On garde le profil en shortlist. Pas de salaire, pas de date, pas de lieu. Objet + corps. Signature "L’équipe RH".'
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
              />
              <Helper>Contexte, contraintes, signature, ton, et objectif attendu.</Helper>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                onClick={generate}
                disabled={isWorkingAny || !canGenerate}
                className="gap-2"
              >
                {busy ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Générer
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setCurrentResultFromView(null, null, null);
                  setStatusBadge("idle");
                }}
                disabled={isWorkingAny}
              >
                Masquer résultat
              </Button>
            </div>
          </Card>

          <Card
            title="Options pro"
            subtitle="Personnalise le document sans alourdir le brief."
            right={
              <button
                type="button"
                onClick={() => setProOpen((v) => !v)}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
                {proOpen ? "Masquer" : "Afficher"}
              </button>
            }
          >
            {!proOpen ? null : (
              <div className="space-y-4">
                <InfoStrip
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Injection simple"
                  text="Ces champs servent à préciser l’écriture de Pierre sans rendre le brief brouillon."
                />

                <div className="space-y-1">
                  <Label>À inclure</Label>
                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                    value={pro.include}
                    onChange={(e) => setPro((p) => ({ ...p, include: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Contraintes</Label>
                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                    value={pro.constraints}
                    onChange={(e) => setPro((p) => ({ ...p, constraints: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Signature</Label>
                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                    value={pro.signature}
                    onChange={(e) => setPro((p) => ({ ...p, signature: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Email destinataire</Label>
                    <input
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                      value={pro.recipient_email}
                      onChange={(e) => setPro((p) => ({ ...p, recipient_email: e.target.value }))}
                      placeholder="ex: candidat@gmail.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Objet email (auto si vide)</Label>
                    <input
                      className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                      value={pro.subject_override}
                      onChange={(e) => setPro((p) => ({ ...p, subject_override: e.target.value }))}
                      placeholder="ex: Suite à votre candidature"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Nom entreprise (optionnel)</Label>
                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                    value={pro.company_name}
                    onChange={(e) => setPro((p) => ({ ...p, company_name: e.target.value }))}
                    placeholder="ex: Cultura / CloneStore"
                  />
                </div>

                <Helper>
                  Ces options sont injectées dans le brief, sans casser la logique actuelle.
                </Helper>
              </div>
            )}
          </Card>

          <Card
            title="Historique (mémoire)"
            subtitle="Retrouve, filtre, réutilise et organise les générations."
            right={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {historyOpen ? "Masquer" : "Afficher"}
                </button>

                <button
                  type="button"
                  onClick={openExport}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Export
                </button>

                <button
                  type="button"
                  onClick={openImport}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Import
                </button>

                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Vider
                </button>
              </div>
            }
          >
            {!historyOpen ? null : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Recherche</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-3 text-sm"
                        value={historyQuery}
                        onChange={(e) => setHistoryQuery(e.target.value)}
                        placeholder="titre, tag, input, docType…"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Filtre</Label>
                      <select
                        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value as HistoryFilter)}
                      >
                        <option value="all">Tout</option>
                        <option value="ok">OK</option>
                        <option value="err">Erreurs</option>
                        <option value="fav">Favoris</option>
                        <option value="pinned">Pinned</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Tri</Label>
                      <select
                        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                        value={historySort}
                        onChange={(e) => setHistorySort(e.target.value as HistorySort)}
                      >
                        <option value="newest">Plus récents</option>
                        <option value="oldest">Plus anciens</option>
                        <option value="title_az">Titre A→Z</option>
                        <option value="title_za">Titre Z→A</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Limite</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={historyLimit}
                      onChange={(e) => setHistoryLimit(Number(e.target.value))}
                    >
                      <option value={20}>20</option>
                      <option value={40}>40</option>
                      <option value={60}>60</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={400}>400</option>
                    </select>

                    <span className="text-xs text-muted-foreground">
                      {filteredHistory.length} affichés / {history.length} total
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={selectAllVisible}>
                      Tout sélectionner
                    </Button>
                    <Button variant="outline" onClick={clearSelection}>
                      Désélectionner
                    </Button>
                    <Button variant="outline" onClick={deleteSelected} disabled={!selectedCount}>
                      Supprimer ({selectedCount})
                    </Button>
                  </div>
                </div>

                {selectedCount ? (
                  <div className="rounded-2xl border bg-background/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Actions bulk sur {selectedCount} items
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setFavoriteBulk(true)}>
                          Mettre en favoris
                        </Button>
                        <Button variant="outline" onClick={() => setFavoriteBulk(false)}>
                          Retirer favoris
                        </Button>
                        <Button variant="outline" onClick={() => setPinnedBulk(true)}>
                          Pin
                        </Button>
                        <Button variant="outline" onClick={() => setPinnedBulk(false)}>
                          Unpin
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const t = prompt("Ajouter un tag aux sélectionnés (ex: refus)") || "";
                            if (t) setSelectedTagBulk(t);
                          }}
                        >
                          + Tag
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {allTags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {allTags.slice(0, 24).map((t) => (
                      <Pill
                        key={t}
                        subtle
                        onClick={() => {
                          setHistoryQuery(`#${t}`);
                        }}
                      >
                        #{t}
                      </Pill>
                    ))}
                  </div>
                ) : null}

                {filteredHistory.length === 0 ? (
                  <div className="rounded-2xl border p-5 text-sm text-muted-foreground">
                    Aucun historique pour l’instant.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((it) => {
                      const dt = new Date(it.ts);
                      const title = it.title || "(sans titre)";
                      const ok = it.ok;
                      const checked = Boolean(selectedIds[it.id]);

                      return (
                        <div
                          key={it.id}
                          className="w-full rounded-2xl border bg-background/80 p-4 transition hover:bg-background"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelected(it.id)}
                                className="mt-1"
                              />

                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openViewer(it.id)}
                                    className="text-left text-sm font-medium hover:underline"
                                    title="Ouvrir"
                                  >
                                    {title}
                                  </button>

                                  {it.pinned ? (
                                    <Badge>
                                      <Pin className="h-3 w-3" />
                                      PIN
                                    </Badge>
                                  ) : null}

                                  {it.favorite ? (
                                    <Badge variant="violet">
                                      <Star className="h-3 w-3" />
                                      Favori
                                    </Badge>
                                  ) : null}
                                </div>

                                <p className="text-xs text-muted-foreground">
                                  {dt.toLocaleString()} • preset: {it.preset} • {it.tone}/
                                  {it.language} • {it.docType || "—"} • {it.open_count || 0} open
                                </p>

                                {it.tags && it.tags.length ? (
                                  <div className="flex flex-wrap gap-2">
                                    {it.tags.slice(0, 6).map((t) => (
                                      <span
                                        key={t}
                                        className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
                                      >
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}

                                {it.note ? (
                                  <p className="text-xs text-muted-foreground">
                                    Note: {short(it.note, 120)}
                                  </p>
                                ) : null}

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {short(it.input, 170)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={[
                                  "rounded-full border px-2 py-1 text-xs",
                                  ok
                                    ? "border-emerald-200 bg-emerald-50/40 text-emerald-700"
                                    : "border-red-200 bg-red-50/40 text-red-700",
                                ].join(" ")}
                              >
                                {ok ? "OK" : "ERR"}
                              </span>

                              <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" onClick={() => loadFromHistory(it)}>
                                  Restaurer
                                </Button>
                                <Button variant="outline" onClick={() => rerunFromHistory(it)}>
                                  Re-run
                                </Button>
                                <Button variant="outline" onClick={() => togglePinned(it.id)}>
                                  {it.pinned ? "Unpin" : "Pin"}
                                </Button>
                                <Button variant="outline" onClick={() => toggleFavorite(it.id)}>
                                  {it.favorite ? "★" : "☆"}
                                </Button>
                                <Button variant="outline" onClick={() => openEditor(it.id)}>
                                  Edit
                                </Button>
                                <Button variant="outline" onClick={() => deleteHistoryItem(it.id)}>
                                  Del
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Résultat"
            subtitle="Document généré, prêt à copier, envoyer, exporter ou retravailler à la main."
            tone="violet"
            right={<span className={["text-xs font-medium", statusClassText].join(" ")}>{statusText}</span>}
          >
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Document</p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {activeResult?.title || "Document Pierre"}
              </h2>

              <div className="flex flex-wrap gap-2">
                <Badge>
                  <Languages className="h-3.5 w-3.5" />
                  {activeResult?.language || (language === "fr" ? "fr" : "en")}
                </Badge>
                <Badge>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Ton : {activeResult?.tone || tone}
                </Badge>
                <Badge>
                  <FileText className="h-3.5 w-3.5" />
                  Type : {activeResult?.docType || "—"}
                </Badge>
                <Badge variant={hasContent ? "success" : activeResult ? "warn" : "default"}>
                  Contenu : {hasContent ? "HTML OK" : activeResult ? "Vide" : "—"}
                </Badge>
                <Badge>
                  <FolderClock className="h-3.5 w-3.5" />
                  Confiance :{" "}
                  {typeof activeResult?.confidence === "number"
                    ? activeResult.confidence.toFixed(2)
                    : "—"}
                </Badge>
                <Badge>
                  <FileText className="h-3.5 w-3.5" />
                  {currentWordCount} mots
                </Badge>
                <Badge>
                  <FileText className="h-3.5 w-3.5" />
                  {currentCharCount} caractères
                </Badge>
                {hasEditedVersion ? (
                  <Badge variant="violet">
                    <Pencil className="h-3.5 w-3.5" />
                    Modifié
                  </Badge>
                ) : null}
                {lastPdf ? (
                  <Badge variant={lastPdfFresh ? "success" : "warn"}>
                    <Paperclip className="h-3.5 w-3.5" />
                    {lastPdfFresh ? "PDF synchro" : "PDF obsolète"}
                  </Badge>
                ) : null}
              </div>

              <div className="rounded-2xl border bg-background/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Actions client</p>
                    <p className="text-xs text-muted-foreground">
                      Tout part du contenu actuellement affiché. Si tu modifies puis enregistres,
                      c’est cette version qui est copiée, envoyée et exportée.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isEditingResult ? (
                      <Button variant="outline" onClick={openResultEditor} disabled={!activeResult || isWorkingAny}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={cancelResultEditing} disabled={isWorkingAny}>
                          <X className="mr-2 h-4 w-4" />
                          Annuler
                        </Button>
                        <Button onClick={saveResultEdits} disabled={isWorkingAny || !isResultEditorDirty}>
                          <Save className="mr-2 h-4 w-4" />
                          Enregistrer
                        </Button>
                      </>
                    )}

                    {hasEditedVersion && !isEditingResult ? (
                      <Button variant="outline" onClick={restoreOriginalResult} disabled={isWorkingAny}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Revenir à l’original
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyText} disabled={!activeResult || isWorkingAny}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copyOk ? "Copié ✅" : hasEditedVersion ? "Copier texte modifié" : "Copier"}
                </Button>

                <Button variant="outline" onClick={copyHtml} disabled={!activeResult || isWorkingAny}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copyHtmlOk ? "HTML ✅" : hasEditedVersion ? "Copier HTML modifié" : "Copier HTML"}
                </Button>

                <Button variant="outline" onClick={exportPdf} disabled={!activeResult || isWorkingAny}>
                  {pdfBusy ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      PDF…
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {hasEditedVersion ? "Exporter PDF modifié" : "Exporter PDF"}
                    </>
                  )}
                </Button>

                <Button variant="outline" onClick={openPdf} disabled={!activeResult || isWorkingAny}>
                  <Eye className="mr-2 h-4 w-4" />
                  Voir PDF
                </Button>

                <Button variant="outline" onClick={downloadPdf} disabled={!activeResult || isWorkingAny}>
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger PDF
                </Button>

                <Button variant="outline" onClick={sendEmail} disabled={!activeResult || isWorkingAny}>
                  {emailBusy ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Envoyer email
                    </>
                  )}
                </Button>

                <Button onClick={sendEmailWithPdf} disabled={!activeResult || isWorkingAny}>
                  {emailWithPdfBusy ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Envoi PDF…
                    </>
                  ) : (
                    <>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Envoyer PDF en PJ
                    </>
                  )}
                </Button>
              </div>
            </div>

            {lastPdf ? (
              <div className="mt-5 rounded-2xl border bg-background/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Dernier PDF généré</p>
                    <p className="text-xs text-muted-foreground">
                      {lastPdf.filename} • {new Date(lastPdf.generatedAt).toLocaleString()} •{" "}
                      {lastPdfFresh ? "aligné avec le contenu affiché" : "à régénérer si tu gardes cette version"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={openPdf}>
                      <Eye className="mr-2 h-4 w-4" />
                      Voir
                    </Button>
                    <Button variant="outline" onClick={downloadPdf}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
                    <Button onClick={sendEmailWithPdf} disabled={emailWithPdfBusy || pdfBusy}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Envoyer en PJ
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeResult?.missingQuestions && activeResult.missingQuestions.length > 0 ? (
              <div className="mt-5 space-y-2 rounded-2xl border p-4">
                <p className="text-sm font-medium">Infos manquantes</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {activeResult.missingQuestions.map((q) => (
                    <li key={q.id}>
                      <span className="font-medium text-foreground">{q.question}</span>{" "}
                      <span className="text-xs text-muted-foreground">({q.expected_format})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Contenu</p>
                {isEditingResult ? (
                  <Badge variant={isResultEditorDirty ? "warn" : "success"}>
                    {isResultEditorDirty ? "Modifs non enregistrées" : "Prêt à enregistrer"}
                  </Badge>
                ) : hasEditedVersion ? (
                  <Badge variant="violet">Version modifiée active</Badge>
                ) : null}
              </div>

              {!activeResult ? (
                <div className="rounded-2xl border p-5 text-sm text-muted-foreground">
                  Lance une génération pour voir le document.
                </div>
              ) : contentEmpty && !isEditingResult ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 text-sm text-amber-900">
                  Le backend n’a pas renvoyé de HTML exploitable pour ce document.
                </div>
              ) : isEditingResult ? (
                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-4 rounded-2xl border bg-background/80 p-4">
                    <div className="space-y-1">
                      <Label>Titre du document</Label>
                      <input
                        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"
                        value={editResultTitle}
                        onChange={(e) => setEditResultTitle(e.target.value)}
                        placeholder="Titre du document"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Contenu modifiable</Label>
                      <textarea
                        className="min-h-[420px] w-full rounded-2xl border bg-background px-4 py-3 text-sm leading-relaxed outline-none"
                        value={editResultText}
                        onChange={(e) => setEditResultText(e.target.value)}
                        placeholder="Modifie le contenu ici."
                      />
                      <Helper>
                        Éditeur simple, stable, vendable : tu modifies le texte, tu enregistres,
                        puis toutes les actions repartent de cette version.
                      </Helper>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Aperçu en direct</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{countWords(editResultText)} mots</span>
                        <span>•</span>
                        <span>{editResultText.length} caractères</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background p-5">
                      <p className="mb-4 text-xl font-semibold tracking-tight">
                        {normalizeSpaces(editResultTitle) || "Document Pierre"}
                      </p>
                      {editResultText.trim() ? (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: textToHtml(editResultText) }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          L’aperçu apparaîtra ici dès que tu saisis du contenu.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border bg-background/80 p-5">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: activeResult.html }}
                  />
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Conseils d’utilisation"
            subtitle="Quelques repères pour garder Pierre propre, cohérent et performant."
          >
            <div className="space-y-3">
              <InfoStrip
                icon={<Wand2 className="h-4 w-4" />}
                title="Sois précis dans le brief"
                text="Contexte, contraintes, ton, signature et objectif attendu : plus c’est clair, plus Pierre produit juste."
              />
              <InfoStrip
                icon={<Pencil className="h-4 w-4" />}
                title="Modification manuelle"
                text="Passe en mode Modifier pour ajuster le contenu à la main. Une fois enregistré, copier/email/PDF utiliseront cette version."
              />
              <InfoStrip
                icon={<Mail className="h-4 w-4" />}
                title="Email"
                text="L’envoi part du contenu affiché. Si tu as retouché le document, Pierre enverra automatiquement cette version mise à jour."
              />
              <InfoStrip
                icon={<Download className="h-4 w-4" />}
                title="PDF"
                text="Le PDF se régénère automatiquement si le contenu a changé, pour éviter les pièces jointes obsolètes."
              />
              <InfoStrip
                icon={<ArrowUpRight className="h-4 w-4" />}
                title="Historique"
                text="Pense à pinner, taguer et renommer les meilleurs documents pour les retrouver vite. Les versions modifiées sont aussi conservées."
              />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
