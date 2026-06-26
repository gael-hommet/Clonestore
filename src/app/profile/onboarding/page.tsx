"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileText,
  Fingerprint,
  LayoutDashboard,
  MessageCircle,
  MessagesSquare,
  Network,
  ShieldCheck,
  Sparkles,
  Users2,
  Waypoints,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ── PHASE 3.5 / 3.6 / 3.7 — Persistence onboarding ──────────────────────────
// localStorage first — persistence serveur via feature flag uniquement.
// PHASE 3.7 : restore serveur safe (read-only, compare updated_at).
// Aucune écriture DB directe depuis cette page.
import {
  loadGlobalOnboardingDraftFromLocalStorage,
  clearGlobalOnboardingDraftLocalStorage,
  persistGlobalOnboardingWithFallback,
  restoreGlobalOnboardingWithFallback,
} from "@/lib/clonestore/onboarding";
import type {
  GlobalOnboardingRuntimeResult,
  GlobalOnboardingTechnologyDraft,
} from "@/lib/clonestore/onboarding";
// PHASE 3.5 — Clé localStorage : "clonestore.globalOnboarding.draft.v1"
// PHASE 3.6 — Runtime bridge : localStorage first → health check → write best-effort
// PHASE 3.7 — Restore : localStorage immédiat → serveur (si flag) après userId

// ── PHASE 3.8 / 3.14 — Empreinte Entreprise ──────────────────────────────────
// Aperçu read-only calculé depuis le draft onboarding.
// PHASE 3.14 : sync serveur best-effort via persistEnterpriseFootprintWithFallback.
//   - localStorage TOUJOURS sauvegardé en premier
//   - serveur uniquement si flag true + auth + table disponible
//   - aucun crash si serveur KO
//   - statut discret affiché dans le panneau Empreinte
import {
  mapGlobalOnboardingDraftToEnterpriseFootprint,
  persistEnterpriseFootprintWithFallback,
  // PHASE 3.18 — observabilité UI restore/sync (module pur, pas de write)
  buildEnterpriseFootprintRestoreUiSnapshot,
  buildEnterpriseFootprintRestoreUiBadges,
  buildEnterpriseFootprintRestoreUiCards,
  buildEnterpriseFootprintRestoreUiTimeline,
  isEnterpriseFootprintServerPersistenceEnabled,
} from "@/lib/clonestore/enterprise-footprint";
import type {
  EnterpriseFootprint,
  EnterpriseFootprintSafeApplyUiStatus,
  EnterpriseFootprintSafeApplyResult,
} from "@/lib/clonestore/enterprise-footprint";

// ── PHASE 3.6 — Auth pour persistence serveur ─────────────────────────────────
// Pattern identique à /profile/agents — try/catch si env Supabase absent.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionClient } from "@/lib/auth/session-client";

// ── PHASE 2.6 — Imports TECH en lecture locale ─────────────────────────────
// Aucune exécution, aucune écriture DB.
import {
  buildEmptyGlobalEnterpriseMemory,
  computeCoverageScore,
  validateGlobalEnterpriseMemory,
} from "@/lib/clonestore/adn";
import type {
  EnterpriseIdentityProfile,
  EnterpriseHumanProfile,
  EnterpriseDocumentProfile,
  EnterpriseRuleProfile,
  GlobalEnterpriseMemory,
} from "@/lib/clonestore/adn";
import {
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
  EMPLOYEE_RUNTIME_REGISTRY,
} from "@/lib/clonestore/employees/employee-registry";
import {
  DEFAULT_GLOBAL_TECH_CONFIGS,
  DEFAULT_GLOBAL_TECH_CONFIG_LIST,
} from "@/lib/clonestore/technologies/global-tech-defaults";

// ── PHASE 2.6 — Types onboarding global ──────────────────────────────────────
// Configuration locale guidée — pas de DB, pas de Supabase, pas d'exécution.

type GlobalOnboardingStepId =
  | "company_identity"
  | "team_humans"
  | "documents"
  | "rules_validations"
  | "technologies"
  | "first_pierre_mission";

type GlobalOnboardingStepStatus = "pending" | "in_progress" | "done" | "skipped";

type GlobalOnboardingCompanyDraft = {
  company_name: string;
  industry: string;
  size_range: string;
  country: string;
  language: string;
  timezone: string;
  description: string;
};

type GlobalOnboardingHumanDraft = {
  id: string;
  full_name: string;
  role_title: string;
  department: string;
  is_approver: boolean;
  validation_scope: string[];
};

type GlobalOnboardingDocumentDraft = {
  id: string;
  title: string;
  document_type: string;
  is_official: boolean;
  applies_to_domains: string[];
  status: "planned" | "uploaded_later" | "missing";
};

type GlobalOnboardingRuleDraft = {
  id: string;
  title: string;
  domain: string;
  risk_level: "low" | "medium" | "high" | "critical";
  requires_validation: boolean;
  description: string;
};

type GlobalOnboardingFirstMissionDraft = {
  mission_type: string;
  prompt: string;
  employee_slug: "pierre";
  plan_only: true;
};

type GlobalOnboardingState = {
  currentStep: GlobalOnboardingStepId;
  stepStatuses: Record<GlobalOnboardingStepId, GlobalOnboardingStepStatus>;
  company: GlobalOnboardingCompanyDraft;
  humans: GlobalOnboardingHumanDraft[];
  documents: GlobalOnboardingDocumentDraft[];
  rules: GlobalOnboardingRuleDraft[];
  firstMission: GlobalOnboardingFirstMissionDraft | null;
};

// ── Constantes ────────────────────────────────────────────────────────────────

const ONBOARDING_STEPS: Array<{
  id: GlobalOnboardingStepId;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "company_identity",
    label: "Identité entreprise",
    shortLabel: "Entreprise",
    description: "Nom, secteur, taille, pays, langue — prépare CloneADN Global.",
    icon: Building2,
  },
  {
    id: "team_humans",
    label: "Équipe & humains",
    shortLabel: "Équipe",
    description: "Qui valide quoi. Les humains qui travaillent avec les employés IA.",
    icon: Users2,
  },
  {
    id: "documents",
    label: "Documents",
    shortLabel: "Docs",
    description: "Les documents types utilisés dans votre organisation.",
    icon: FileText,
  },
  {
    id: "rules_validations",
    label: "Règles & validations",
    shortLabel: "Règles",
    description: "Les règles de validation humaine pour les actions sensibles.",
    icon: ShieldCheck,
  },
  {
    id: "technologies",
    label: "Technologies CloneStore",
    shortLabel: "Techs",
    description: "Aperçu des couches actives — CloneOS, CloneADN, CloneGuard, CloneTrace.",
    icon: Network,
  },
  {
    id: "first_pierre_mission",
    label: "Première mission Pierre",
    shortLabel: "Mission",
    description: "Lancez votre première mission guidée avec Pierre — plan-only.",
    icon: Sparkles,
  },
];

const STEP_ORDER: GlobalOnboardingStepId[] = [
  "company_identity",
  "team_humans",
  "documents",
  "rules_validations",
  "technologies",
  "first_pierre_mission",
];

const MISSION_TEMPLATES: GlobalOnboardingFirstMissionDraft[] = [
  {
    mission_type: "hr_email_onboarding",
    prompt: "Prépare un email d'accueil pour un nouveau salarié.",
    employee_slug: "pierre",
    plan_only: true,
  },
  {
    mission_type: "absence_followup",
    prompt: "Qualifie une absence et identifie les informations manquantes.",
    employee_slug: "pierre",
    plan_only: true,
  },
  {
    mission_type: "hr_document_simple",
    prompt: "Prépare un document RH simple prêt à validation.",
    employee_slug: "pierre",
    plan_only: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildMemoryFromDraft(state: GlobalOnboardingState): GlobalEnterpriseMemory {
  const base = buildEmptyGlobalEnterpriseMemory("onboarding_local");

  // Mappage sécurisé risk_level → EnterpriseRuleSeverity
  function toRuleSeverity(riskLevel: string): EnterpriseRuleProfile["severity"] {
    if (riskLevel === "critical") return "critical";
    if (riskLevel === "high") return "block";
    if (riskLevel === "medium") return "warning";
    return "info";
  }

  // Mappage sécurisé document_type → EnterpriseDocumentType
  function toDocType(dt: string): EnterpriseDocumentProfile["document_type"] {
    const valid: EnterpriseDocumentProfile["document_type"][] = [
      "template", "policy", "contract", "guide", "procedure",
    ];
    return valid.includes(dt as EnterpriseDocumentProfile["document_type"])
      ? (dt as EnterpriseDocumentProfile["document_type"])
      : "template";
  }

  return {
    ...base,
    identity: {
      ...base.identity,
      company_name: state.company.company_name || base.identity.company_name,
      industry: state.company.industry || null,
      size_range: state.company.size_range || null,
      country: (state.company.country || "FR") as EnterpriseIdentityProfile["country"],
      language: (state.company.language || "fr") as EnterpriseIdentityProfile["language"],
      timezone: state.company.timezone || "Europe/Paris",
      public_description: state.company.description || null,
    },
    humans: {
      ...base.humans,
      humans: state.humans.map(
        (h): EnterpriseHumanProfile => ({
          human_id: h.id,
          full_name: h.full_name,
          role_title: h.role_title || null,
          department_id: h.department || null,
          employment_status: "active" as const,
          email: null,
          phone: null,
          permissions: h.is_approver ? ["approve_actions", ...h.validation_scope] : h.validation_scope,
          sensitive_notes_allowed: false,
          context_notes: null,
          document_refs: [],
          tags: h.validation_scope,
        }),
      ),
      total_count: state.humans.length,
      active_count: state.humans.length,
    },
    documents: state.documents.map(
      (d): EnterpriseDocumentProfile => ({
        document_id: d.id,
        title: d.title,
        document_type: toDocType(d.document_type),
        source: "onboarding_draft",
        file_ref: null,
        applies_to_domains: d.applies_to_domains,
        is_official: d.is_official,
        version: "1.0",
        style_notes: null,
        extraction_status: "not_extracted" as const,
        sensitivity: d.is_official ? "confidential" as const : "internal" as const,
      }),
    ),
    rules: state.rules.map(
      (r): EnterpriseRuleProfile => ({
        rule_id: r.id,
        label: r.title,
        category: r.domain,
        condition: r.description || r.title,
        action: r.requires_validation ? "require_human_validation" : "allow_with_notice",
        severity: toRuleSeverity(r.risk_level),
        active: true,
        applies_to_domains: [r.domain],
        applies_to_employee_slugs: ["pierre"],
      }),
    ),
  };
}

function getStepCompleteness(state: GlobalOnboardingState): Record<GlobalOnboardingStepId, number> {
  return {
    company_identity:
      state.company.company_name && state.company.industry && state.company.size_range
        ? 100
        : state.company.company_name
          ? 60
          : 0,
    team_humans: state.humans.length > 0 ? Math.min(100, state.humans.length * 33) : 0,
    documents: state.documents.length > 0 ? Math.min(100, state.documents.length * 34) : 0,
    rules_validations: state.rules.length > 0 ? Math.min(100, state.rules.length * 34) : 0,
    technologies: 100, // lecture seule, toujours complet
    first_pierre_mission: state.firstMission ? 100 : 0,
  };
}

function generateId(): string {
  return `ob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Composants UI internes ────────────────────────────────────────────────────

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[1.55rem] border border-white/55 bg-white/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "neutral" | "warning" | "violet" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
        tone === "success" && "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.10)] text-[var(--cs-success)]",
        tone === "warning" && "border-[#c99a4d]/24 bg-[#c99a4d]/12 text-[#8f682d]",
        tone === "violet" && "border-[var(--clone-accent-border)] bg-[var(--clone-accent-soft)] text-[var(--clone-accent)]",
        tone === "neutral" && "border-white/55 bg-white/38 text-[var(--cs-ink-3)]",
      )}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-white/40 bg-white/24">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--clone-accent)] to-[var(--cs-violet)] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function StepIndicator({
  step,
  index,
  status,
  active,
  completeness,
  onClick,
}: {
  step: (typeof ONBOARDING_STEPS)[0];
  index: number;
  status: GlobalOnboardingStepStatus;
  active: boolean;
  completeness: number;
  onClick: () => void;
}) {
  const Icon = step.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-[1.25rem] border p-3 text-left transition",
        active
          ? "border-[var(--clone-accent-border)] bg-[var(--clone-accent-soft)]"
          : "border-white/45 bg-white/18 hover:bg-white/28",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
          completeness === 100
            ? "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.10)] text-[var(--cs-success)]"
            : active
              ? "border-[var(--clone-accent-border)] bg-[var(--clone-accent-soft)] text-[var(--clone-accent)]"
              : "border-white/45 bg-white/24 text-[var(--cs-ink-3)]",
        )}
      >
        {completeness === 100 ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          index + 1
        )}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-xs font-bold",
            active ? "text-[var(--clone-accent)]" : "text-[var(--cs-ink-2)]",
          )}
        >
          {step.shortLabel}
        </p>
        {completeness > 0 && completeness < 100 ? (
          <p className="text-[0.62rem] text-[var(--cs-ink-4)]">{completeness}%</p>
        ) : null}
      </div>
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  textarea?: boolean;
}) {
  const cls =
    "w-full rounded-[1.1rem] border border-white/55 bg-white/34 px-3 py-2.5 text-sm font-medium text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)] backdrop-blur-xl focus:border-[var(--clone-accent-border)]";
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cn(cls, "resize-none")}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {helper ? (
        <span className="text-[0.64rem] text-[var(--cs-ink-4)]">{helper}</span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[1.1rem] border border-white/55 bg-white/34 px-3 py-2.5 text-sm font-medium text-[var(--cs-ink-1)] outline-none backdrop-blur-xl focus:border-[var(--clone-accent-border)]"
      >
        <option value="">— Sélectionner —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded accent-[var(--clone-accent)]"
      />
      <span className="text-sm font-medium text-[var(--cs-ink-2)]">{label}</span>
    </label>
  );
}

function ActionBtn({
  children,
  onClick,
  href,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const cls = cn(
    "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition",
    primary ? "clone-liquid-button clone-liquid-button--dark" : "clone-liquid-button",
    disabled && "pointer-events-none opacity-50",
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileOnboardingPage() {
  // ── State onboarding global ───────────────────────────────────────────────
  const [state, setState] = useState<GlobalOnboardingState>({
    currentStep: "company_identity",
    stepStatuses: {
      company_identity: "in_progress",
      team_humans: "pending",
      documents: "pending",
      rules_validations: "pending",
      technologies: "pending",
      first_pierre_mission: "pending",
    },
    company: {
      company_name: "",
      industry: "",
      size_range: "",
      country: "FR",
      language: "fr",
      timezone: "Europe/Paris",
      description: "",
    },
    humans: [],
    documents: [],
    rules: [],
    firstMission: null,
  });

  // ── Formulaires locaux ────────────────────────────────────────────────────
  const [humanForm, setHumanForm] = useState({
    full_name: "", role_title: "", department: "", is_approver: false, validation_scope: "",
  });
  const [docForm, setDocForm] = useState({
    title: "", document_type: "", is_official: false, applies_to_domains: "",
  });
  const [ruleForm, setRuleForm] = useState({
    title: "", domain: "hr", risk_level: "medium" as GlobalOnboardingRuleDraft["risk_level"],
    requires_validation: true, description: "",
  });

  // ── PHASE 3.6 — Auth Supabase (pattern agents/page.tsx) ──────────────────
  // try/catch si env Supabase absent — jamais bloquant.
  const supabase = useMemo(() => {
    try {
      return getSessionClient() as SupabaseClient;
    } catch {
      return null;
    }
  }, []);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null))
      .catch(() => setUserId(null));
  }, [supabase]);

  // PHASE 3.7 — Restore serveur safe (après obtention userId)
  // Déclenché une seule fois par userId. Read-only — pas de write DB.
  // Ne remplace le state que si le draft serveur est plus récent que le local.
  useEffect(() => {
    if (!userId) return;
    if (serverRestoreAttempted.current) return;
    serverRestoreAttempted.current = true;

    restoreGlobalOnboardingWithFallback({ supabase, userId })
      .then((result) => {
        if (
          result.outcome === "server_draft_restored" &&
          result.draft
        ) {
          const d = result.draft;
          // Mapper draft serveur vers state page (prudent — champs optionnels gérés)
          setState((prev) => ({
            currentStep: (d.current_step as GlobalOnboardingStepId) ?? prev.currentStep,
            stepStatuses:
              (d.step_statuses as typeof prev.stepStatuses) ?? prev.stepStatuses,
            company: d.company ?? prev.company,
            humans: Array.isArray(d.humans) ? d.humans : prev.humans,
            documents: Array.isArray(d.documents) ? d.documents : prev.documents,
            rules: Array.isArray(d.rules) ? d.rules : prev.rules,
            firstMission: d.first_mission ?? prev.firstMission,
          }));
          setOnboardingPersistenceStatus("server_restored");
          setLocalDraftSaved(true);
        } else if (result.outcome === "local_draft_preferred") {
          setOnboardingPersistenceStatus("local_preferred");
        }
        // Autres outcomes : pas de changement d'état page
      })
      .catch(() => {
        /* Silent fail — localStorage est déjà actif */
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── PHASE 3.5 / 3.6 / 3.7 — Persistence onboarding ─────────────────────
  // localStorage first — DB write best-effort via runtime bridge.
  // PHASE 3.7 — Restore serveur safe après obtention userId.

  type OnboardingPersistenceStatus =
    | "local_only"        // localStorage seul (flag désactivé)
    | "server_disabled"   // serveur non configuré
    | "server_saving"     // tentative write en cours
    | "server_ok"         // localStorage + serveur OK
    | "auth_required"     // connexion requise pour serveur
    | "fallback"          // fallback localStorage après tentative serveur
    | "server_restored"   // brouillon restauré depuis serveur (PHASE 3.7)
    | "local_preferred";  // brouillon local plus récent que serveur (PHASE 3.7)

  const [localDraftSaved, setLocalDraftSaved] = useState(false);
  const [onboardingPersistenceStatus, setOnboardingPersistenceStatus] =
    useState<OnboardingPersistenceStatus>("local_only");
  const [lastRuntimeResult, setLastRuntimeResult] =
    useState<GlobalOnboardingRuntimeResult | null>(null);

  // Ref pour s'assurer que le restore serveur n'est tenté qu'une seule fois par session
  const serverRestoreAttempted = useRef(false);

  // Restauration au montage du composant
  useEffect(() => {
    try {
      const raw = loadGlobalOnboardingDraftFromLocalStorage();
      if (raw && typeof raw === "object") {
        const p = raw as Record<string, unknown>;
        // Vérification minimale : payload contient des données onboarding
        if (p.currentStep || p.company) {
          setState((prev) => ({
            currentStep: (p.currentStep as GlobalOnboardingStepId) ?? prev.currentStep,
            stepStatuses: (p.stepStatuses as typeof prev.stepStatuses) ?? prev.stepStatuses,
            company: (p.company as typeof prev.company) ?? prev.company,
            humans: Array.isArray(p.humans) ? (p.humans as typeof prev.humans) : prev.humans,
            documents: Array.isArray(p.documents) ? (p.documents as typeof prev.documents) : prev.documents,
            rules: Array.isArray(p.rules) ? (p.rules as typeof prev.rules) : prev.rules,
            firstMission: (p.firstMission as typeof prev.firstMission) ?? prev.firstMission,
          }));
          setLocalDraftSaved(true);
        }
      }
    } catch {
      /* Silent fail — localStorage peut être indisponible */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sauvegarde via runtime bridge PHASE 3.6 — localStorage first + DB best-effort
  useEffect(() => {
    const now = new Date().toISOString();
    // Draft minimal depuis l'état page — compatible GlobalOnboardingDraft
    const draftPayload = {
      id: `local:${now}`,
      company_id: "local_company",
      status: "local_draft" as const,
      current_step: state.currentStep,
      completion_score: 0,
      step_statuses: state.stepStatuses,
      company: state.company,
      humans: state.humans,
      documents: state.documents,
      rules: state.rules,
      technologies: [] as GlobalOnboardingTechnologyDraft[],
      first_mission: state.firstMission,
      cloneadn_preview: {} as Record<string, unknown>,
      created_at: now,
      updated_at: now,
      source: "localstorage" as const,
      read_only: false,
      metadata: { persistence_mode: "localstorage_only", phase: "3.6" } as Record<string, unknown>,
    };

    setOnboardingPersistenceStatus("server_saving");

    persistGlobalOnboardingWithFallback({
      supabase,
      userId,
      draft: draftPayload,
    })
      .then((result) => {
        setLocalDraftSaved(result.local_saved);
        setLastRuntimeResult(result);
        if (result.outcome === "local_and_server_persisted") {
          setOnboardingPersistenceStatus("server_ok");
        } else if (result.outcome === "local_persisted") {
          setOnboardingPersistenceStatus("local_only");
        } else if (result.outcome === "local_persisted_auth_required") {
          setOnboardingPersistenceStatus("auth_required");
        } else if (result.outcome === "local_persisted_server_unavailable") {
          setOnboardingPersistenceStatus("fallback");
        } else {
          setOnboardingPersistenceStatus("fallback");
        }
      })
      .catch(() => {
        setLocalDraftSaved(true);
        setOnboardingPersistenceStatus("local_only");
      });
  }, [state, supabase, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handler effacement brouillon local
  function handleClearLocalDraft() {
    try {
      clearGlobalOnboardingDraftLocalStorage();
      setLocalDraftSaved(false);
      setOnboardingPersistenceStatus("local_only");
      setLastRuntimeResult(null);
    } catch {
      /* Silent fail */
    }
  }

  // ── CloneADN Global — score depuis draft ─────────────────────────────────
  const memoryDraft = useMemo(
    () => buildMemoryFromDraft(state),
    [state],
  );
  const adnCoverageScore = useMemo(
    () => computeCoverageScore(memoryDraft),
    [memoryDraft],
  );
  const adnValidation = useMemo(
    () => validateGlobalEnterpriseMemory(memoryDraft),
    [memoryDraft],
  );

  const stepCompleteness = useMemo(
    () => getStepCompleteness(state),
    [state],
  );

  const totalProgress = useMemo(() => {
    const vals = Object.values(stepCompleteness);
    return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
  }, [stepCompleteness]);

  // ── PHASE 3.8 — Empreinte Entreprise (read-only preview) ─────────────────
  // Calculée depuis le state page — aperçu local, aucune écriture DB.
  const enterpriseFootprint = useMemo((): EnterpriseFootprint | null => {
    try {
      const now = new Date().toISOString();
      const draft = {
        id: `local:preview`,
        company_id: "local_company",
        status: "local_draft" as const,
        current_step: state.currentStep,
        completion_score: totalProgress,
        step_statuses: state.stepStatuses,
        company: state.company,
        humans: state.humans,
        documents: state.documents,
        rules: state.rules,
        technologies: [] as GlobalOnboardingTechnologyDraft[],
        first_mission: state.firstMission,
        cloneadn_preview: {} as Record<string, unknown>,
        created_at: now,
        updated_at: now,
        source: "localstorage" as const,
        read_only: false,
        metadata: { persistence_mode: "localstorage_only", phase: "3.8" } as Record<string, unknown>,
      };
      return mapGlobalOnboardingDraftToEnterpriseFootprint(draft);
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, totalProgress]);

  // ── PHASE 3.14 — Sauvegarde Empreinte safe-apply (localStorage FIRST) ───────
  // localStorage sauvegardé TOUJOURS en premier.
  // Sync serveur best-effort si flag true + auth + table disponible.
  // Aucun crash si serveur KO.
  const [footprintSyncStatus, setFootprintSyncStatus] =
    useState<EnterpriseFootprintSafeApplyUiStatus>("idle");

  // ── PHASE 3.18 — Observabilité UI restore/sync ──────────────────────────────
  // Stocke le résultat complet + l'horodatage de tentative pour construire un
  // snapshot UI lisible. Aucune logique métier modifiée — purement observabilité.
  const [lastPersistResult, setLastPersistResult] =
    useState<EnterpriseFootprintSafeApplyResult | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enterpriseFootprint) return;
    setFootprintSyncStatus("saving");
    setLastAttemptAt(new Date().toISOString());
    persistEnterpriseFootprintWithFallback({
      supabase,
      userId,
      footprint: enterpriseFootprint,
    })
      .then((result) => {
        setFootprintSyncStatus(result.ui_status);
        setLastPersistResult(result);
      })
      .catch(() => {
        setFootprintSyncStatus("local_saved");
        setLastPersistResult(null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterpriseFootprint]);

  // ── PHASE 3.18 — Snapshot UI restore/sync (render-time, module pur) ─────────
  const restoreUiSnapshot = useMemo(
    () =>
      buildEnterpriseFootprintRestoreUiSnapshot({
        lastPersistResult,
        currentFootprint: enterpriseFootprint
          ? {
              company_id: enterpriseFootprint.company_id,
              updated_at: enterpriseFootprint.updated_at,
            }
          : null,
        featureFlagEnabled: isEnterpriseFootprintServerPersistenceEnabled(),
        lastAttemptAt,
        localUpdatedAt: enterpriseFootprint?.updated_at ?? null,
      }),
    [lastPersistResult, enterpriseFootprint, lastAttemptAt]
  );

  const restoreUiBadges = useMemo(
    () => buildEnterpriseFootprintRestoreUiBadges(restoreUiSnapshot),
    [restoreUiSnapshot]
  );
  const restoreUiCards = useMemo(
    () => buildEnterpriseFootprintRestoreUiCards(restoreUiSnapshot),
    [restoreUiSnapshot]
  );
  const restoreUiTimeline = useMemo(
    () => buildEnterpriseFootprintRestoreUiTimeline(restoreUiSnapshot),
    [restoreUiSnapshot]
  );

  // ── Tech summary ──────────────────────────────────────────────────────────
  const techSummary = useMemo(() => {
    const all = DEFAULT_GLOBAL_TECH_CONFIG_LIST;
    return {
      total: all.length,
      active: all.filter((c) => c.status === "active").length,
      partial: all.filter((c) => c.status === "partial").length,
      roadmap: all.filter((c) => c.status === "roadmap").length,
    };
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  function goToStep(stepId: GlobalOnboardingStepId) {
    setState((prev) => ({
      ...prev,
      currentStep: stepId,
      stepStatuses: {
        ...prev.stepStatuses,
        [stepId]: prev.stepStatuses[stepId] === "pending" ? "in_progress" : prev.stepStatuses[stepId],
      },
    }));
  }

  function markStepDone(stepId: GlobalOnboardingStepId) {
    const idx = STEP_ORDER.indexOf(stepId);
    const next = idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
    setState((prev) => ({
      ...prev,
      currentStep: next ?? prev.currentStep,
      stepStatuses: {
        ...prev.stepStatuses,
        [stepId]: "done",
        ...(next ? { [next]: "in_progress" } : {}),
      },
    }));
  }

  // ── Étape 1 — Identité entreprise ─────────────────────────────────────────

  function StepCompanyIdentity() {
    return (
      <div className="grid gap-4">
        <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
          Ces informations préparent <strong>CloneADN Global</strong> — la mémoire entreprise
          de CloneStore. La persistance complète sera branchée plus tard.
          Configuration locale guidée — aucune donnée envoyée.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            label="Nom de l'entreprise"
            value={state.company.company_name}
            onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, company_name: v } }))}
            placeholder="Aurexia SAS"
          />
          <SelectField
            label="Secteur"
            value={state.company.industry}
            onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, industry: v } }))}
            options={[
              { value: "tech", label: "Technologie / SaaS" },
              { value: "retail", label: "Commerce / Retail" },
              { value: "services", label: "Services professionnels" },
              { value: "manufacturing", label: "Industrie / Production" },
              { value: "healthcare", label: "Santé" },
              { value: "finance", label: "Finance / Assurance" },
              { value: "education", label: "Éducation" },
              { value: "other", label: "Autre" },
            ]}
          />
          <SelectField
            label="Taille"
            value={state.company.size_range}
            onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, size_range: v } }))}
            options={[
              { value: "1-10", label: "1 – 10 personnes" },
              { value: "11-50", label: "11 – 50 personnes" },
              { value: "51-200", label: "51 – 200 personnes" },
              { value: "201-1000", label: "201 – 1000 personnes" },
              { value: "1000+", label: "1000+ personnes" },
            ]}
          />
          <SelectField
            label="Langue principale"
            value={state.company.language}
            onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, language: v } }))}
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "Anglais" },
              { value: "de", label: "Allemand" },
              { value: "es", label: "Espagnol" },
            ]}
          />
          <InputField
            label="Pays"
            value={state.company.country}
            onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, country: v } }))}
            placeholder="FR"
          />
          <InputField
            label="Fuseau horaire"
            value={state.company.timezone}
            onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, timezone: v } }))}
            placeholder="Europe/Paris"
          />
        </div>
        <InputField
          label="Contexte / description (optionnel)"
          value={state.company.description}
          onChange={(v) => setState((p) => ({ ...p, company: { ...p.company, description: v } }))}
          placeholder="Courte description du contexte entreprise pour CloneADN."
          textarea
        />
        <ActionBtn
          primary
          onClick={() => markStepDone("company_identity")}
          disabled={!state.company.company_name}
        >
          Continuer
          <ChevronRight className="h-4 w-4" />
        </ActionBtn>
      </div>
    );
  }

  // ── Étape 2 — Équipe & humains ────────────────────────────────────────────

  function StepTeamHumans() {
    return (
      <div className="grid gap-5">
        <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
          Définissez les humains qui travaillent avec les employés IA.
          Ce sont les vrais humains clients (pas des employés IA CloneStore).
          Ces données restent locales — configuration guidée, aucune persistance DB.
        </p>

        {/* Liste */}
        {state.humans.length > 0 ? (
          <div className="grid gap-2">
            {state.humans.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/50 bg-white/24 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{h.full_name}</p>
                  <p className="text-[0.68rem] text-[var(--cs-ink-4)]">
                    {h.role_title} {h.department ? `· ${h.department}` : ""}
                    {h.is_approver ? " · Validateur" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((p) => ({ ...p, humans: p.humans.filter((x) => x.id !== h.id) }))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/28 text-[var(--cs-ink-3)] hover:text-[var(--cs-danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Formulaire ajout */}
        <Card>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
            Ajouter une personne
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField
              label="Nom complet"
              value={humanForm.full_name}
              onChange={(v) => setHumanForm((f) => ({ ...f, full_name: v }))}
              placeholder="Sophie Martin"
            />
            <InputField
              label="Poste / titre"
              value={humanForm.role_title}
              onChange={(v) => setHumanForm((f) => ({ ...f, role_title: v }))}
              placeholder="DRH"
            />
            <InputField
              label="Département"
              value={humanForm.department}
              onChange={(v) => setHumanForm((f) => ({ ...f, department: v }))}
              placeholder="RH"
            />
            <InputField
              label="Périmètre de validation (séparés par virgule)"
              value={humanForm.validation_scope}
              onChange={(v) => setHumanForm((f) => ({ ...f, validation_scope: v }))}
              placeholder="contrats, documents sensibles"
            />
          </div>
          <div className="mt-3">
            <CheckboxField
              label="Est validateur (peut approuver les actions sensibles)"
              checked={humanForm.is_approver}
              onChange={(v) => setHumanForm((f) => ({ ...f, is_approver: v }))}
            />
          </div>
          <ActionBtn
            primary
            disabled={!humanForm.full_name}
            onClick={() => {
              if (!humanForm.full_name) return;
              const newH: GlobalOnboardingHumanDraft = {
                id: generateId(),
                full_name: humanForm.full_name,
                role_title: humanForm.role_title,
                department: humanForm.department,
                is_approver: humanForm.is_approver,
                validation_scope: humanForm.validation_scope
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              setState((p) => ({ ...p, humans: [...p.humans, newH] }));
              setHumanForm({ full_name: "", role_title: "", department: "", is_approver: false, validation_scope: "" });
            }}
          >
            Ajouter
          </ActionBtn>
        </Card>

        <div className="flex gap-2">
          <ActionBtn onClick={() => markStepDone("team_humans")} primary>
            Continuer
            <ChevronRight className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => setState((p) => ({ ...p, stepStatuses: { ...p.stepStatuses, team_humans: "skipped" }, currentStep: "documents" }))}>
            Passer cette étape
          </ActionBtn>
        </div>
      </div>
    );
  }

  // ── Étape 3 — Documents ───────────────────────────────────────────────────

  function StepDocuments() {
    return (
      <div className="grid gap-5">
        <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
          Listez les types de documents utilisés dans votre organisation.
          Ces données préparent CloneADN pour personnaliser les livrables Pierre.
          Configuration locale uniquement.
        </p>

        {state.documents.length > 0 ? (
          <div className="grid gap-2">
            {state.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/50 bg-white/24 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{d.title}</p>
                  <p className="text-[0.68rem] text-[var(--cs-ink-4)]">
                    {d.document_type} {d.is_official ? "· Officiel" : ""} {d.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((p) => ({ ...p, documents: p.documents.filter((x) => x.id !== d.id) }))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/28 text-[var(--cs-ink-3)] hover:text-[var(--cs-danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Card>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
            Ajouter un document type
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField
              label="Titre"
              value={docForm.title}
              onChange={(v) => setDocForm((f) => ({ ...f, title: v }))}
              placeholder="Contrat de travail CDI"
            />
            <SelectField
              label="Type"
              value={docForm.document_type}
              onChange={(v) => setDocForm((f) => ({ ...f, document_type: v }))}
              options={[
                { value: "contract", label: "Contrat" },
                { value: "amendment", label: "Avenant" },
                { value: "onboarding_checklist", label: "Checklist onboarding" },
                { value: "offboarding_checklist", label: "Checklist offboarding" },
                { value: "hr_policy", label: "Politique RH" },
                { value: "payroll_summary", label: "Résumé paie" },
                { value: "hr_letter", label: "Courrier RH" },
                { value: "internal_note", label: "Note interne" },
                { value: "other", label: "Autre" },
              ]}
            />
            <InputField
              label="Domaines (ex: hr, legal)"
              value={docForm.applies_to_domains}
              onChange={(v) => setDocForm((f) => ({ ...f, applies_to_domains: v }))}
              placeholder="hr, legal"
            />
            <div className="flex items-end">
              <CheckboxField
                label="Document officiel (signature requise)"
                checked={docForm.is_official}
                onChange={(v) => setDocForm((f) => ({ ...f, is_official: v }))}
              />
            </div>
          </div>
          <ActionBtn
            primary
            disabled={!docForm.title || !docForm.document_type}
            onClick={() => {
              if (!docForm.title || !docForm.document_type) return;
              const newD: GlobalOnboardingDocumentDraft = {
                id: generateId(),
                title: docForm.title,
                document_type: docForm.document_type,
                is_official: docForm.is_official,
                applies_to_domains: docForm.applies_to_domains
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                status: "planned",
              };
              setState((p) => ({ ...p, documents: [...p.documents, newD] }));
              setDocForm({ title: "", document_type: "", is_official: false, applies_to_domains: "" });
            }}
          >
            Ajouter
          </ActionBtn>
        </Card>

        <div className="flex gap-2">
          <ActionBtn onClick={() => markStepDone("documents")} primary>
            Continuer
            <ChevronRight className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => setState((p) => ({ ...p, stepStatuses: { ...p.stepStatuses, documents: "skipped" }, currentStep: "rules_validations" }))}>
            Passer cette étape
          </ActionBtn>
        </div>
      </div>
    );
  }

  // ── Étape 4 — Règles & validations ────────────────────────────────────────

  function StepRulesValidations() {
    return (
      <div className="grid gap-5">
        <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
          Définissez les règles de validation humaine.
          Ces règles configurent CloneGuard pour savoir quand demander votre approbation.
          <strong> Validation humaine obligatoire sur les actions sensibles</strong> — c'est
          le principe de base de CloneStore.
        </p>

        {state.rules.length > 0 ? (
          <div className="grid gap-2">
            {state.rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/50 bg-white/24 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{r.title}</p>
                  <p className="text-[0.68rem] text-[var(--cs-ink-4)]">
                    {r.domain} · risque {r.risk_level}
                    {r.requires_validation ? " · Validation requise" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState((p) => ({ ...p, rules: p.rules.filter((x) => x.id !== r.id) }))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/28 text-[var(--cs-ink-3)] hover:text-[var(--cs-danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <Card>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
            Ajouter une règle
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField
              label="Titre"
              value={ruleForm.title}
              onChange={(v) => setRuleForm((f) => ({ ...f, title: v }))}
              placeholder="Documents sensibles → validation humaine"
            />
            <SelectField
              label="Domaine"
              value={ruleForm.domain}
              onChange={(v) => setRuleForm((f) => ({ ...f, domain: v }))}
              options={[
                { value: "hr", label: "RH" },
                { value: "legal", label: "Légal" },
                { value: "finance", label: "Finance" },
                { value: "communication", label: "Communication" },
                { value: "global", label: "Global" },
              ]}
            />
            <SelectField
              label="Niveau de risque"
              value={ruleForm.risk_level}
              onChange={(v) => setRuleForm((f) => ({ ...f, risk_level: v as GlobalOnboardingRuleDraft["risk_level"] }))}
              options={[
                { value: "low", label: "Faible" },
                { value: "medium", label: "Moyen" },
                { value: "high", label: "Élevé" },
                { value: "critical", label: "Critique" },
              ]}
            />
            <div className="flex items-end">
              <CheckboxField
                label="Validation humaine requise"
                checked={ruleForm.requires_validation}
                onChange={(v) => setRuleForm((f) => ({ ...f, requires_validation: v }))}
              />
            </div>
          </div>
          <div className="mt-3">
            <InputField
              label="Description (optionnel)"
              value={ruleForm.description}
              onChange={(v) => setRuleForm((f) => ({ ...f, description: v }))}
              placeholder="Ex. Tout contrat doit être validé par la DRH avant envoi."
              textarea
            />
          </div>
          <ActionBtn
            primary
            disabled={!ruleForm.title}
            onClick={() => {
              if (!ruleForm.title) return;
              const newR: GlobalOnboardingRuleDraft = {
                id: generateId(),
                ...ruleForm,
              };
              setState((p) => ({ ...p, rules: [...p.rules, newR] }));
              setRuleForm({ title: "", domain: "hr", risk_level: "medium", requires_validation: true, description: "" });
            }}
          >
            Ajouter la règle
          </ActionBtn>
        </Card>

        <div className="flex gap-2">
          <ActionBtn onClick={() => markStepDone("rules_validations")} primary>
            Continuer
            <ChevronRight className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => setState((p) => ({ ...p, stepStatuses: { ...p.stepStatuses, rules_validations: "skipped" }, currentStep: "technologies" }))}>
            Passer cette étape
          </ActionBtn>
        </div>
      </div>
    );
  }

  // ── Étape 5 — Technologies ────────────────────────────────────────────────

  function StepTechnologies() {
    const cockpitTechs = ["cloneos", "cloneadn", "cloneguard", "clonetrace", "clonebrief"] as const;
    return (
      <div className="grid gap-5">
        <p className="text-sm leading-7 text-[var(--cs-ink-3)]">
          Aperçu lecture seule des technologies CloneStore actives.
          {techSummary.active} technologies actives sur {techSummary.total} au total.
          Pour configurer : <Link href="/profile/technologies" className="font-semibold text-[var(--clone-accent)] underline underline-offset-2">voir la page Technologies</Link>.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {cockpitTechs.map((key) => {
            const cfg = DEFAULT_GLOBAL_TECH_CONFIGS[key];
            if (!cfg) return null;
            const isVoice = key === "clonevoice" as string;
            return (
              <div
                key={key}
                className="rounded-[1.25rem] border border-white/50 bg-white/22 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{cfg.display_name}</p>
                    <p className="mt-1 text-[0.68rem] leading-5 text-[var(--cs-ink-3)]">
                      {cfg.short_description}
                    </p>
                  </div>
                  <Badge tone={isVoice ? "warning" : cfg.status === "active" ? "success" : "neutral"}>
                    {isVoice ? "Préparation" : cfg.status}
                  </Badge>
                </div>
                <div className="mt-3">
                  <ProgressBar value={cfg.readiness_score} />
                  <p className="mt-1 text-[0.62rem] text-[var(--cs-ink-4)]">
                    Prêt à {cfg.readiness_score}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-[1.1rem] border border-[#c99a4d]/22 bg-[#c99a4d]/08 p-3">
          <p className="text-[0.68rem] font-semibold text-[#8f682d]">
            CloneVoice n'est pas actif en production — préparation uniquement.
          </p>
        </div>

        <div className="flex gap-2">
          <ActionBtn onClick={() => markStepDone("technologies")} primary>
            Continuer
            <ChevronRight className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn href="/profile/technologies">
            Configurer les technologies
            <ArrowRight className="h-4 w-4" />
          </ActionBtn>
        </div>
      </div>
    );
  }

  // ── Étape 6 — Première mission Pierre ─────────────────────────────────────

  function StepFirstPierreMission() {
    return (
      <div className="grid gap-5">
        <div className="rounded-[1.25rem] border border-white/50 bg-white/22 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/55 bg-white/38 text-[var(--cs-violet)]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--cs-ink-1)]">Pierre — Employé IA RH</p>
              <p className="text-[0.68rem] text-[var(--cs-ink-4)]">
                Seul employé IA actif en V1 · Domaine RH · Launch candidate
              </p>
            </div>
            <Badge tone="success">Actif</Badge>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cs-ink-3)]">
            {PIERRE_EMPLOYEE_RUNTIME_CONTRACT.public_positioning}
          </p>
          <p className="mt-2 text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
            Pierre préparera un plan et des brouillons. Aucune action sensible ne part sans
            validation humaine.
          </p>
        </div>

        <p className="text-sm font-semibold text-[var(--cs-ink-2)]">
          Choisissez votre première mission guidée :
        </p>

        <div className="grid gap-3">
          {MISSION_TEMPLATES.map((template) => {
            const selected = state.firstMission?.mission_type === template.mission_type;
            return (
              <button
                key={template.mission_type}
                type="button"
                onClick={() => setState((p) => ({ ...p, firstMission: template }))}
                className={cn(
                  "rounded-[1.35rem] border p-4 text-left transition",
                  selected
                    ? "border-[var(--clone-accent-border)] bg-[var(--clone-accent-soft)]"
                    : "border-white/50 bg-white/22 hover:bg-white/32",
                )}
              >
                <div className="flex items-start gap-3">
                  {selected ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clone-accent)]" />
                  ) : (
                    <Waypoints className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      {template.prompt}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="violet">Plan-only</Badge>
                      <Badge tone="neutral">Pierre (RH)</Badge>
                      <Badge tone="neutral">Validation humaine</Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <ActionBtn
            href="/agents/pierre/use"
            primary
          >
            Ouvrir le cockpit Pierre
            <Sparkles className="h-4 w-4" />
          </ActionBtn>
          <ActionBtn onClick={() => markStepDone("first_pierre_mission")}>
            Terminer l'onboarding
            <CheckCircle2 className="h-4 w-4" />
          </ActionBtn>
        </div>
      </div>
    );
  }

  // ── Résumé final ──────────────────────────────────────────────────────────

  const allDone = STEP_ORDER.every(
    (id) => state.stepStatuses[id] === "done" || state.stepStatuses[id] === "skipped",
  );

  // ── Rendu principal ───────────────────────────────────────────────────────

  const currentStepMeta = ONBOARDING_STEPS.find((s) => s.id === state.currentStep)!;

  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-5">
          {/* Hero */}
          <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="cs-pill">
                  <Fingerprint className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  CloneADN Global
                </span>
                <span className="cs-pill">
                  <BadgeCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  Pierre actif — RH
                </span>
                <span className="cs-pill">
                  <Cpu className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  Configuration guidée
                </span>
                <span className="cs-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-ink-3)]" />
                  Aucune action exécutée
                </span>
              </div>

              <h1 className="cs-heading mt-4 text-[clamp(2.1rem,4vw,4.7rem)] leading-[0.94]">
                Configurer votre entreprise
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                Préparez CloneStore à comprendre votre entreprise, vos règles et vos premiers
                employés IA. Pierre est le seul employé IA actif en V1 — domaine RH.
                Configuration locale guidée — aucune donnée persistée à ce stade.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionBtn href="/profile/agents">
                <LayoutDashboard className="h-4 w-4" />
                Mon espace
              </ActionBtn>
              <ActionBtn href="/profile/messages">
                <MessagesSquare className="h-4 w-4" />
                Messages
              </ActionBtn>
            </div>
          </section>

          {/* Progression globale */}
          <div className="rounded-[1.55rem] border border-white/55 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
                  Progression onboarding
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--cs-ink-1)]">
                  {totalProgress}% complété
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[0.68rem] text-[var(--cs-ink-4)]">
                  Score CloneADN : {adnCoverageScore}/100
                </p>
                {adnValidation.ok ? (
                  <Badge tone="success">Valide</Badge>
                ) : (
                  <Badge tone="warning">Incomplet</Badge>
                )}
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={totalProgress} />
            </div>
            {/* PHASE 3.6 / 3.7 — Statut persistence dynamique */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/28 pt-3">
              {/* Badge principal — statut persistence */}
              {onboardingPersistenceStatus === "server_ok" || onboardingPersistenceStatus === "server_restored" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.10)] px-2.5 py-1 text-[0.62rem] font-bold text-[var(--cs-success)]">
                  {onboardingPersistenceStatus === "server_restored"
                    ? "Brouillon restauré depuis serveur"
                    : "Brouillon local + serveur"}
                </span>
              ) : onboardingPersistenceStatus === "server_saving" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-bold text-[var(--cs-ink-3)]">
                  Brouillon local · Sauvegarde…
                </span>
              ) : onboardingPersistenceStatus === "local_preferred" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(21,130,96,0.18)] bg-[rgba(21,130,96,0.08)] px-2.5 py-1 text-[0.62rem] font-bold text-[var(--cs-success)]">
                  Brouillon local plus récent
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#c99a4d]/24 bg-[#c99a4d]/10 px-2.5 py-1 text-[0.62rem] font-bold text-[#8f682d]">
                  Brouillon local
                </span>
              )}
              {/* Sous-label contextuel */}
              <span className="text-[0.62rem] text-[var(--cs-ink-4)]">
                {onboardingPersistenceStatus === "server_ok"
                  ? "Sauvegarde serveur active · Aucune action exécutée"
                  : onboardingPersistenceStatus === "server_restored"
                    ? "Données restaurées depuis serveur · Aucune action exécutée"
                    : onboardingPersistenceStatus === "local_preferred"
                      ? "Brouillon local plus récent que serveur · Aucune action exécutée"
                      : onboardingPersistenceStatus === "auth_required"
                        ? "Fallback localStorage · Connexion pour serveur · Aucune action exécutée"
                        : onboardingPersistenceStatus === "fallback"
                          ? "Fallback localStorage · Serveur indisponible · Aucune action exécutée"
                          : "Non persisté serveur · Aucune action exécutée"}
              </span>
              {/* Warning discret si dernière tentative serveur a échoué */}
              {lastRuntimeResult?.warning && onboardingPersistenceStatus === "fallback" && (
                <span className="w-full text-[0.59rem] text-[var(--cs-ink-4)] opacity-70">
                  {lastRuntimeResult.warning}
                </span>
              )}
              <button
                type="button"
                onClick={handleClearLocalDraft}
                className="ml-auto rounded-full border border-white/45 bg-white/24 px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cs-ink-3)] hover:bg-white/38 transition"
                aria-label="Effacer le brouillon local localStorage"
              >
                Effacer le brouillon local
              </button>
            </div>
          </div>

          {/* Layout principal : étapes + contenu */}
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            {/* Navigation étapes */}
            <aside className="grid gap-2">
              {ONBOARDING_STEPS.map((step, i) => (
                <StepIndicator
                  key={step.id}
                  step={step}
                  index={i}
                  status={state.stepStatuses[step.id]}
                  active={state.currentStep === step.id}
                  completeness={stepCompleteness[step.id]}
                  onClick={() => goToStep(step.id)}
                />
              ))}
            </aside>

            {/* Contenu étape active */}
            <div className="rounded-[1.55rem] border border-white/55 bg-white/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/55 bg-white/38 text-[var(--cs-violet)]">
                  <currentStepMeta.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                    {currentStepMeta.label}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--cs-ink-4)]">
                    {currentStepMeta.description}
                  </p>
                </div>
              </div>

              {state.currentStep === "company_identity" && <StepCompanyIdentity />}
              {state.currentStep === "team_humans" && <StepTeamHumans />}
              {state.currentStep === "documents" && <StepDocuments />}
              {state.currentStep === "rules_validations" && <StepRulesValidations />}
              {state.currentStep === "technologies" && <StepTechnologies />}
              {state.currentStep === "first_pierre_mission" && <StepFirstPierreMission />}
            </div>
          </div>

          {/* Résumé CloneADN */}
          <div className="rounded-[1.55rem] border border-white/55 bg-white/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
            <p className="cs-eyebrow">Aperçu CloneADN Global</p>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.045em] text-[var(--cs-ink-1)]">
              Mémoire entreprise en cours de préparation.
            </h2>
            <p className="mt-2 text-sm text-[var(--cs-ink-3)]">
              Cette configuration prépare CloneADN. La persistance complète sera branchée plus tard.
              Aucune donnée n'est envoyée à ce stade.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[1.1rem] border border-white/50 bg-white/22 p-3">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">Identité</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cs-ink-1)]">
                  {state.company.company_name || "Non renseignée"}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-white/50 bg-white/22 p-3">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">Humains</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cs-ink-1)]">
                  {state.humans.length} personne{state.humans.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-white/50 bg-white/22 p-3">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">Documents</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cs-ink-1)]">
                  {state.documents.length} type{state.documents.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-white/50 bg-white/22 p-3">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">Règles</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cs-ink-1)]">
                  {state.rules.length} règle{state.rules.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
                  Score CloneADN : {adnCoverageScore}/100
                </p>
              </div>
              <div className="mt-2">
                <ProgressBar value={adnCoverageScore} />
              </div>
            </div>

            {/* PHASE 3.8 — Empreinte Entreprise — aperçu read-only */}
            {enterpriseFootprint && (
              <div className="mt-4 rounded-[1.1rem] border border-white/40 bg-white/16 p-3">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
                  Empreinte Entreprise
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold",
                    enterpriseFootprint.status === "ready"
                      ? "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.10)] text-[var(--cs-success)]"
                      : "border-[#c99a4d]/24 bg-[#c99a4d]/10 text-[#8f682d]"
                  )}>
                    {enterpriseFootprint.status === "ready" ? "Prête" : enterpriseFootprint.status === "incomplete" ? "Incomplète" : "Brouillon"}
                  </span>
                  <span className="text-[0.6rem] text-[var(--cs-ink-4)]">
                    Readiness {enterpriseFootprint.readiness_score.score}%
                  </span>
                  {enterpriseFootprint.missing_items.length > 0 && (
                    <span className="text-[0.6rem] text-[var(--cs-ink-4)]">
                      · {enterpriseFootprint.missing_items.length} élément{enterpriseFootprint.missing_items.length !== 1 ? "s" : ""} manquant{enterpriseFootprint.missing_items.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {/* PHASE 3.14 — Statut sync local/server */}
                  <span className="ml-auto text-[0.58rem] text-[var(--cs-ink-4)] opacity-60">
                    {footprintSyncStatus === "saving" ? "Sauvegarde en cours…"
                      : footprintSyncStatus === "server_synced" ? "Empreinte sauvegardée localement et serveur · Aucune action exécutée"
                      : footprintSyncStatus === "server_disabled" ? "Empreinte sauvegardée localement · Synchronisation serveur uniquement si activée"
                      : footprintSyncStatus === "server_unavailable" ? "Serveur indisponible — localStorage reste le fallback actif"
                      : footprintSyncStatus === "local_saved" ? "Empreinte sauvegardée localement · localStorage reste le fallback actif"
                      : footprintSyncStatus === "auth_required" ? "Empreinte sauvegardée localement · Aucune action exécutée"
                      : "Aperçu local · Synchronisation serveur uniquement si activée"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── PHASE 3.18 — Statut Empreinte (observabilité restore/sync) ─────
              UI polish read-only. Aucune logique métier modifiée.
              localStorage reste le fallback actif. Aucune action exécutée. */}
          <div className="rounded-[1.55rem] border border-white/55 bg-white/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="cs-eyebrow">Statut Empreinte</p>
                <h2 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                  {restoreUiSnapshot.title}
                </h2>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
                  restoreUiSnapshot.tone === "success"
                    ? "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.10)] text-[var(--cs-success)]"
                    : restoreUiSnapshot.tone === "warning"
                    ? "border-[#c99a4d]/24 bg-[#c99a4d]/10 text-[#8f682d]"
                    : restoreUiSnapshot.tone === "info"
                    ? "border-[#6f83ff]/22 bg-[#6f83ff]/08 text-[#4f63d5]"
                    : "border-white/55 bg-white/30 text-[var(--cs-ink-3)]"
                )}
              >
                {restoreUiSnapshot.status_label}
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
              {restoreUiSnapshot.body}
            </p>

            {/* Badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {restoreUiBadges.map((badge) => (
                <span
                  key={badge.id}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold",
                    badge.tone === "success"
                      ? "border-[rgba(21,130,96,0.20)] bg-[rgba(21,130,96,0.08)] text-[var(--cs-success)]"
                      : badge.tone === "warning"
                      ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                      : badge.tone === "info"
                      ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                      : "border-white/50 bg-white/26 text-[var(--cs-ink-4)]"
                  )}
                >
                  {badge.label}
                </span>
              ))}
            </div>

            {/* Cards */}
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {restoreUiCards.map((card) => (
                <div
                  key={card.id}
                  className={cn(
                    "rounded-[1.1rem] border p-3",
                    card.tone === "success"
                      ? "border-[rgba(21,130,96,0.18)] bg-[rgba(21,130,96,0.06)]"
                      : card.tone === "warning"
                      ? "border-[#c99a4d]/20 bg-[#c99a4d]/05"
                      : card.tone === "info"
                      ? "border-[#6f83ff]/18 bg-[#6f83ff]/05"
                      : "border-white/50 bg-white/20"
                  )}
                >
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">
                    {card.label}
                  </p>
                  <p className="mt-1 text-[0.78rem] font-semibold text-[var(--cs-ink-1)]">
                    {card.value}
                  </p>
                  {card.sub_label ? (
                    <p className="mt-0.5 text-[0.6rem] leading-4 text-[var(--cs-ink-4)]">
                      {card.sub_label}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="mt-4 grid gap-2">
              {restoreUiTimeline.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-[1rem] border px-3 py-2",
                    item.tone === "success"
                      ? "border-[rgba(21,130,96,0.16)] bg-[rgba(21,130,96,0.05)]"
                      : item.tone === "warning"
                      ? "border-[#c99a4d]/18 bg-[#c99a4d]/05"
                      : item.tone === "info"
                      ? "border-[#6f83ff]/16 bg-[#6f83ff]/05"
                      : "border-white/48 bg-white/20"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      item.tone === "success"
                        ? "bg-[var(--cs-success)]"
                        : item.tone === "warning"
                        ? "bg-[#c99a4d]"
                        : item.tone === "info"
                        ? "bg-[#6f83ff]"
                        : "bg-[var(--cs-ink-4)]"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[0.72rem] font-semibold text-[var(--cs-ink-2)]">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[0.64rem] leading-4 text-[var(--cs-ink-4)]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning table/RLS si présent */}
            {restoreUiSnapshot.warning ? (
              <div className="mt-3 flex items-start gap-2 rounded-[1rem] border border-[#c99a4d]/22 bg-[#c99a4d]/07 px-3 py-2">
                <span className="mt-0.5 text-[#8f682d]">⚠</span>
                <p className="text-[0.66rem] leading-5 text-[#8f682d]">
                  {restoreUiSnapshot.warning} SQL/RLS à vérifier manuellement.
                </p>
              </div>
            ) : null}

            <p className="mt-3 text-[0.62rem] text-[var(--cs-ink-4)]">
              localStorage reste le fallback actif · Synchronisation serveur uniquement si activée ·
              Aucune action exécutée.
            </p>
          </div>

          {/* Navigation finale */}
          <div className="rounded-[1.55rem] border border-white/55 bg-white/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
            <p className="cs-eyebrow">Accès rapides</p>
            <h2 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
              Continuer sur CloneStore
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionBtn href="/agents/pierre/use" primary>
                Cockpit Pierre
                <Sparkles className="h-4 w-4" />
              </ActionBtn>
              <ActionBtn href="/profile/agents">
                Mon espace
                <LayoutDashboard className="h-4 w-4" />
              </ActionBtn>
              <ActionBtn href="/agents/pierre/setup">
                Configurer Pierre
                <ArrowRight className="h-4 w-4" />
              </ActionBtn>
              <ActionBtn href="/profile/technologies">
                Technologies
                <Network className="h-4 w-4" />
              </ActionBtn>
              <ActionBtn href="/profile/messages">
                Messages
                <MessageCircle className="h-4 w-4" />
              </ActionBtn>
            </div>
            <p className="mt-4 text-xs text-[var(--cs-ink-4)]">
              Pierre est le seul employé IA actif en V1 — domaine RH. Aucune action exécutée depuis cet onboarding. Validation humaine obligatoire sur les actions sensibles.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
