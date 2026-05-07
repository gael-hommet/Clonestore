"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bell,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  Eye,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  User2,
  Users2,
  WandSparkles,
  Waypoints,
  Workflow,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import {
  applyCloneAppearance,
  type CloneAppearance,
} from "@/lib/appearance";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { AGENTS } from "@/lib/agent-catalog";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type OrderRow = {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

type TabKey =
  | "overview"
  | "account"
  | "company"
  | "billing"
  | "employees"
  | "technologies"
  | "footprint"
  | "privacy"
  | "notifications"
  | "appearance";

type Feedback = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type CompanySettings = {
  companyName: string;
  sector: string;
  size: string;
  userRole: string;
  mainObjective: string;
  operatingMode: string;
};

type FootprintSettings = {
  tone: string;
  validationRules: string;
  sensitiveTopics: string;
  signature: string;
  referenceContext: string;
};

type NotificationSettings = {
  internalNotifications: boolean;
  emailNotifications: boolean;
  employeeReports: boolean;
  billingAlerts: boolean;
  securityAlerts: boolean;
};

type TechnologySettings = {
  cloneOsMode: string;
  cloneAdnLearning: string;
  cloneGuardStrictness: string;
  cloneTraceLevel: string;
  cloneVoiceAccess: string;
  cloneChatRole: string;
};

type AppearanceSettings = {
  theme: string;
  accent: string;
  density: string;
  motion: string;
};

const tabs: Array<{
  key: TabKey;
  label: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "overview", label: "Vue dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ensemble", eyebrow: "Global", icon: Waypoints },
  { key: "account", label: "Compte", eyebrow: "AccÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s", icon: User2 },
  { key: "company", label: "Entreprise", eyebrow: "IdentitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©", icon: Building2 },
  { key: "billing", label: "Abonnement", eyebrow: "Paiement", icon: CreditCard },
  { key: "employees", label: "EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA", eyebrow: "Postes", icon: Users2 },
  { key: "technologies", label: "Technologies", eyebrow: "SystÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me", icon: BrainCircuit },
  { key: "footprint", label: "Empreinte", eyebrow: "ADN", icon: Fingerprint },
  { key: "privacy", label: "ConfidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©", eyebrow: "DonnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es", icon: ShieldCheck },
  { key: "notifications", label: "Notifications", eyebrow: "Alertes", icon: Bell },
  { key: "appearance", label: "Apparence", eyebrow: "Interface", icon: Palette },
];

const defaultCompanySettings: CompanySettings = {
  companyName: "",
  sector: "",
  size: "",
  userRole: "",
  mainObjective: "",
  operatingMode: "pilotage",
};

const defaultFootprintSettings: FootprintSettings = {
  tone: "Professionnel, clair, humain et direct.",
  validationRules:
    "Les dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cisions sensibles, juridiques, disciplinaires ou financiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨res doivent rester ÃƒÆ’Ã†â€™  validation humaine.",
  sensitiveTopics:
    "Juridique, discipline, licenciement, santÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es sensibles, dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cisions engageantes.",
  signature: "",
  referenceContext: "",
};

const defaultNotificationSettings: NotificationSettings = {
  internalNotifications: true,
  emailNotifications: true,
  employeeReports: true,
  billingAlerts: true,
  securityAlerts: true,
};

const defaultTechnologySettings: TechnologySettings = {
  cloneOsMode: "Orchestration contrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e",
  cloneAdnLearning: "Apprentissage progressif aprÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s validation",
  cloneGuardStrictness: "ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°levÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e",
  cloneTraceLevel: "Complet",
  cloneVoiceAccess: "Disponible globalement",
  cloneChatRole: "Orientation, support et explication systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me",
};

const defaultAppearanceSettings: AppearanceSettings = {
  theme: "Ivoire premium",
  accent: "Bleu graphite",
  density: "Confortable",
  motion: "Subtile",
};

const STORAGE_KEYS = {
  company: "clonestore.company-settings.v1",
  footprint: "clonestore.footprint-settings.v1",
  notifications: "clonestore.notification-settings.v1",
  technologies: "clonestore.technology-settings.v1",
  appearance: "clonestore.appearance-settings.v1",
};

const THEME_TO_CLONE_APPEARANCE: Record<string, CloneAppearance> = {
  "Ivoire premium": "signature",
  "Graphite clair": "graphite",
  "CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me champagne": "aura",
};

const ACCENT_TO_DATASET: Record<string, string> = {
  "Bleu graphite": "graphite-blue",
  "Bleu froid": "cold-blue",
  Champagne: "champagne",
  "Violet discret": "soft-violet",
};

const DENSITY_TO_DATASET: Record<string, string> = {
  Confortable: "comfortable",
  Compacte: "compact",
  "TrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e": "airy",
};

const MOTION_TO_DATASET: Record<string, string> = {
  "Subtile": "subtle",
  "RÃ©duite": "reduced",
  "DÃ©sactivÃ©e": "off",
};

function getCloneAppearanceFromSettings(settings: AppearanceSettings): CloneAppearance {
  return THEME_TO_CLONE_APPEARANCE[settings.theme] ?? "signature";
}

function applyFullAppearanceSettings(settings: AppearanceSettings, persist = true) {
  if (typeof window === "undefined") return;

  const appearance = getCloneAppearanceFromSettings(settings);
  const accent = ACCENT_TO_DATASET[settings.accent] ?? "graphite-blue";
  const density = DENSITY_TO_DATASET[settings.density] ?? "comfortable";
  const motion = MOTION_TO_DATASET[settings.motion] ?? "subtle";

  document.documentElement.dataset.cloneAppearance = appearance;
  document.documentElement.dataset.cloneAccent = accent;
  document.documentElement.dataset.cloneDensity = density;
  document.documentElement.dataset.cloneMotion = motion;
  document.documentElement.style.colorScheme = "light";

  applyCloneAppearance(appearance, {
    persist,
    emit: true,
  });

  if (persist) {
    window.localStorage.setItem("clonestore:appearance", appearance);
    saveJson(STORAGE_KEYS.appearance, settings);
  }
}

function safeTrim(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
}

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "active") return "Actif";
  if (normalized === "cancelled") return "RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©siliÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©";
  if (normalized === "past_due") return "Paiement en attente";
  if (normalized === "trialing") return "Essai";
  if (normalized === "incomplete") return "Incomplet";

  return status || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬";
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "active") return "cs-status cs-status--success";
  if (normalized === "trialing") return "cs-status cs-status--info";
  if (normalized === "past_due" || normalized === "incomplete") {
    return "cs-status cs-status--warn";
  }

  return "cs-status";
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const cleanName = safeTrim(name);

  if (cleanName) {
    const initials = cleanName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    if (initials) return initials;
  }

  const cleanEmail = safeTrim(email);
  if (cleanEmail) return cleanEmail.slice(0, 2).toUpperCase();

  return "CS";
}

function getAgentMeta(slug: string) {
  const normalized = slug.toLowerCase();
  const agent = AGENTS.find((item) => item.slug === normalized);

  return {
    name: agent?.name ?? titleCaseSlug(normalized),
    role: agent?.role ?? "EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© IA CloneStore",
    description:
      agent?.does?.[0] ??
      "EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© IA rattachÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© ÃƒÆ’Ã†â€™  lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢environnement CloneStore de lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise.",
    href: `/agents/${normalized}`,
    cockpitHref: `/agents/${normalized}/use`,
    setupHref: `/agents/${normalized}/setup`,
  };
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    return {
      ...fallback,
      ...(JSON.parse(raw) as Partial<T>),
    };
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: ReactNode;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
        {label}
      </span>

      <div className="flex min-h-12 items-center gap-3 rounded-[1.25rem] border border-white/50 bg-white/35 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_38px_rgba(38,32,22,0.06)] backdrop-blur-xl">
        {icon ? <span className="shrink-0 text-[#667cff]">{icon}</span> : null}

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full border-0 bg-transparent text-sm font-medium text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
        />
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  minHeight = "min-h-[104px]",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none rounded-[1.25rem] border border-white/50 bg-white/35 px-4 py-3 text-sm font-medium leading-6 text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_38px_rgba(38,32,22,0.06)] outline-none backdrop-blur-xl placeholder:text-[var(--cs-ink-4)]",
          minHeight
        )}
      />
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
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-[1.25rem] border border-white/50 bg-white/35 px-4 text-sm font-medium text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_38px_rgba(38,32,22,0.06)] outline-none backdrop-blur-xl"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  href,
  primary = false,
  disabled = false,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition",
    primary ? "clone-liquid-button clone-liquid-button--dark" : "clone-liquid-button",
    disabled && "pointer-events-none opacity-55"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        <span>{children}</span>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <span>{children}</span>
      {icon}
    </button>
  );
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;

  const Icon =
    feedback.type === "success"
      ? CheckCircle2
      : feedback.type === "error"
        ? AlertCircle
        : Sparkles;

  return (
    <div
      className={cn(
        "rounded-[1.35rem] border px-4 py-3 backdrop-blur-xl",
        feedback.type === "success" &&
          "border-[rgba(21,130,96,0.16)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]",
        feedback.type === "error" &&
          "border-[rgba(184,74,74,0.18)] bg-[rgba(184,74,74,0.07)] text-[var(--cs-danger)]",
        feedback.type === "info" &&
          "border-[rgba(84,119,255,0.16)] bg-[rgba(84,119,255,0.07)] text-[#4f63d5]"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm font-medium leading-6">{feedback.message}</p>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <LiquidGlass variant="clear" intensity="soft" interactive className="rounded-[1.55rem] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
            {title}
          </p>
          <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-3)]">{helper}</p>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/38 p-2.5 text-[#667cff] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          {icon}
        </div>
      </div>
    </LiquidGlass>
  );
}

function ControlCard({
  title,
  text,
  icon,
  right,
}: {
  title: string;
  text: string;
  icon: ReactNode;
  right?: ReactNode;
}) {
  return (
    <LiquidGlass variant="clear" intensity="soft" interactive className="rounded-[1.55rem] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-white/50 bg-white/38 p-2.5 text-[#667cff]">
            {icon}
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--cs-ink-1)]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">{text}</p>
          </div>
        </div>

        {right}
      </div>
    </LiquidGlass>
  );
}

function ToggleRow({
  label,
  text,
  checked,
  onChange,
}: {
  label: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-[1.35rem] border border-white/50 bg-white/30 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.66)] backdrop-blur-xl transition hover:bg-white/42"
    >
      <span>
        <span className="block text-sm font-semibold text-[var(--cs-ink-1)]">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--cs-ink-3)]">{text}</span>
      </span>

      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked
            ? "border-[#4f63d5]/20 bg-[linear-gradient(135deg,#20242d,#303645_64%,#4f63d5)]"
            : "border-white/60 bg-white/50"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_6px_16px_rgba(18,24,36,0.16)] transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function PanelShell({
  eyebrow,
  title,
  text,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LiquidGlass variant="panel" intensity="medium" className="min-h-[620px] rounded-[2rem] p-5 md:p-6">
      <div className="flex h-full flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="cs-eyebrow">{eyebrow}</p>
            <h2 className="cs-heading mt-3 text-[clamp(1.55rem,2.3vw,2.65rem)] leading-[1]">
              {title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)]">
              {text}
            </p>
          </div>

          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </LiquidGlass>
  );
}

function EmployeeMiniCard({ order }: { order: OrderRow }) {
  const meta = getAgentMeta(order.agent_slug);

  return (
    <LiquidGlass variant="clear" intensity="soft" interactive className="rounded-[1.65rem] p-4">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                {meta.name}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
                {meta.role}
              </p>
            </div>

            <span className={statusClass(order.status)}>{statusLabel(order.status)}</span>
          </div>

          <p className="text-sm leading-6 text-[var(--cs-ink-3)]">{meta.description}</p>

          <div className="grid gap-1 text-xs text-[var(--cs-ink-4)]">
            <span>DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©but : {formatDate(order.started_at)}</span>
            <span>Fin : {formatDate(order.ended_at)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton href={meta.cockpitHref} primary icon={<ArrowRight className="h-4 w-4" />}>
            Ouvrir
          </ActionButton>
          <ActionButton href={meta.setupHref}>Configurer</ActionButton>
        </div>
      </div>
    </LiquidGlass>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [feedback, setFeedback] = useState<Feedback>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [fullNameDraft, setFullNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordConfirmDraft, setPasswordConfirmDraft] = useState("");

  const [company, setCompany] = useState<CompanySettings>(defaultCompanySettings);
  const [footprint, setFootprint] = useState<FootprintSettings>(defaultFootprintSettings);
  const [notifications, setNotifications] =
    useState<NotificationSettings>(defaultNotificationSettings);
  const [technologies, setTechnologies] =
    useState<TechnologySettings>(defaultTechnologySettings);
  const [appearance, setAppearance] =
    useState<AppearanceSettings>(defaultAppearanceSettings);

  const [dangerConfirm, setDangerConfirm] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setFeedback(null);

      if (!supabase) {
        setFeedback({
          type: "error",
          message:
            "Configuration Supabase manquante. VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifie les variables publiques puis redÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©marre le projet.",
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authData.user) {
          setUserId(null);
          setAuthEmail(null);
          setProfile(null);
          setOrders([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const currentUserId = authData.user.id;
        const currentEmail = authData.user.email ?? null;

        setUserId(currentUserId);
        setAuthEmail(currentEmail);
        setEmailDraft(currentEmail ?? "");

        const [profileResult, ordersResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, email, full_name")
            .eq("id", currentUserId)
            .maybeSingle(),
          supabase
            .from("orders")
            .select("id, agent_slug, status, started_at, ended_at")
            .eq("user_id", currentUserId)
            .order("started_at", { ascending: false }),
        ]);

        if (!profileResult.error && profileResult.data) {
          const nextProfile = profileResult.data as ProfileRow;
          setProfile(nextProfile);
          setFullNameDraft(nextProfile.full_name ?? "");
          setEmailDraft(nextProfile.email ?? currentEmail ?? "");
        } else {
          setProfile(null);
          setFullNameDraft("");
        }

        if (ordersResult.error) throw ordersResult.error;
        setOrders((ordersResult.data ?? []) as OrderRow[]);
      } catch (error) {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Impossible de charger Mon CloneStore pour le moment.",
        });
        setOrders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    setCompany(loadJson(STORAGE_KEYS.company, defaultCompanySettings));
    setFootprint(loadJson(STORAGE_KEYS.footprint, defaultFootprintSettings));
    setNotifications(loadJson(STORAGE_KEYS.notifications, defaultNotificationSettings));
    setTechnologies(loadJson(STORAGE_KEYS.technologies, defaultTechnologySettings));

    const storedAppearance = loadJson(STORAGE_KEYS.appearance, defaultAppearanceSettings);
    setAppearance(storedAppearance);
    applyFullAppearanceSettings(storedAppearance, true);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const displayEmail = profile?.email || authEmail || "";
  const displayName =
    safeTrim(profile?.full_name) || safeTrim(displayEmail) || "Compte CloneStore";

  const initials = getInitials(displayName, displayEmail);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status.toLowerCase() === "active"),
    [orders]
  );

  const inactiveOrders = useMemo(
    () => orders.filter((order) => order.status.toLowerCase() !== "active"),
    [orders]
  );

  const ownedAgentSlugs = useMemo(
    () => new Set(orders.map((order) => order.agent_slug.toLowerCase())),
    [orders]
  );

  const availableAgentCount = AGENTS.length;
  const ownedEmployeesCount = ownedAgentSlugs.size;

  const passwordChecks = useMemo(
    () => ({
      length: passwordDraft.length >= 8,
      upper: /\p{Lu}/u.test(passwordDraft),
      lower: /[a-zÃƒÆ’Ã†â€™ -ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¶ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¸-ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¿]/.test(passwordDraft),
      number: /\d/.test(passwordDraft),
      match: passwordDraft.length > 0 && passwordDraft === passwordConfirmDraft,
    }),
    [passwordDraft, passwordConfirmDraft]
  );

  const passwordValid =
    passwordChecks.length &&
    passwordChecks.upper &&
    passwordChecks.lower &&
    passwordChecks.number &&
    passwordChecks.match;

  async function saveProfile() {
    if (!supabase || !userId) return;

    setFeedback(null);

    const nextName = fullNameDraft.trim();
    const nextEmail = emailDraft.trim();

    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email: displayEmail || nextEmail || null,
        full_name: nextName || null,
      });

      if (profileError) throw profileError;

      setProfile({
        id: userId,
        email: displayEmail || nextEmail || null,
        full_name: nextName || null,
      });

      setFeedback({
        type: "success",
        message: "Informations de compte enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢enregistrer les informations de compte.",
      });
    }
  }

  async function updateEmail() {
    if (!supabase) return;

    const nextEmail = emailDraft.trim();

    if (!nextEmail || nextEmail === displayEmail) {
      setFeedback({
        type: "info",
        message: "Aucun nouvel email ÃƒÆ’Ã†â€™  enregistrer.",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;

      setFeedback({
        type: "success",
        message:
          "Demande de changement dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢email envoyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e. VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifie lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢adresse concernÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e pour confirmer la modification.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de modifier lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢adresse email.",
      });
    }
  }

  async function updatePassword() {
    if (!supabase || !passwordValid) return;

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordDraft,
      });

      if (error) throw error;

      setPasswordDraft("");
      setPasswordConfirmDraft("");

      setFeedback({
        type: "success",
        message: "Mot de passe mis ÃƒÆ’Ã†â€™  jour.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de modifier le mot de passe.",
      });
    }
  }

  function saveCompany() {
    saveJson(STORAGE_KEYS.company, company);
    setFeedback({ type: "success", message: "Configuration entreprise enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e." });
  }

  function saveFootprint() {
    saveJson(STORAGE_KEYS.footprint, footprint);
    setFeedback({ type: "success", message: "Empreinte Entreprise enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e." });
  }

  function saveNotifications() {
    saveJson(STORAGE_KEYS.notifications, notifications);
    setFeedback({ type: "success", message: "PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rences de notifications enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es." });
  }

  function saveTechnologies() {
    saveJson(STORAGE_KEYS.technologies, technologies);
    setFeedback({ type: "success", message: "PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rences technologies enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es." });
  }

  function updateAppearanceSetting<K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K]
  ) {
    setAppearance((prev) => {
      const nextAppearance = {
        ...prev,
        [key]: value,
      };

      applyFullAppearanceSettings(nextAppearance, true);
      return nextAppearance;
    });
  }

  function saveAppearance() {
    applyFullAppearanceSettings(appearance, true);

    setFeedback({
      type: "success",
      message: "PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rences dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢apparence enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es.",
    });
  }

  async function openBillingPortal() {
    setFeedback(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Le portail de paiement nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢est pas encore disponible."
        );
      }

      const url = data?.url || data?.portalUrl || data?.billingPortalUrl;

      if (!url) {
        throw new Error("Aucune URL de portail de paiement nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢a ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© renvoyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e.");
      }

      window.location.href = url;
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ouvrir le portail de paiement.",
      });
    }
  }

  function exportAccountData() {
    const payload = {
      generated_at: new Date().toISOString(),
      account: {
        user_id: userId,
        email: displayEmail,
        full_name: profile?.full_name ?? null,
      },
      company,
      footprint,
      notifications,
      technologies,
      appearance,
      orders,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `clonestore-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();

    URL.revokeObjectURL(url);

    setFeedback({
      type: "success",
      message: "Export gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© sur cet appareil.",
    });
  }

  async function requestAccountDeletion() {
    if (dangerConfirm.trim().toUpperCase() !== "SUPPRIMER") {
      setFeedback({
        type: "error",
        message: "ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°cris SUPPRIMER pour confirmer la demande.",
      });
      return;
    }

    try {
      const response = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ||
            data?.message ||
            "La demande de suppression nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢a pas pu ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre envoyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e."
        );
      }

      setDangerConfirm("");
      setFeedback({
        type: "success",
        message: "Demande de suppression envoyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢envoyer la demande de suppression.",
      });
    }
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="cs-page">
        <div className="cs-page-shell">
          <LiquidGlass variant="panel" intensity="medium" className="rounded-[2rem] p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[#667cff]" />
              <p className="text-sm font-medium text-[var(--cs-ink-3)]">
                Chargement de Mon CloneStoreÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦
              </p>
            </div>
          </LiquidGlass>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="cs-page">
        <div className="cs-page-shell">
          <LiquidGlass variant="panel" intensity="strong" refractive className="rounded-[2.2rem] p-6 md:p-10">
            <div className="grid gap-8 xl:grid-cols-[1fr_0.8fr] xl:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="cs-pill">
                    <User2 className="h-3.5 w-3.5 text-[#667cff]" />
                    Mon CloneStore
                  </span>
                  <span className="cs-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    AccÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©
                  </span>
                </div>

                <h1 className="cs-heading mt-6 max-w-3xl text-[clamp(2.2rem,5vw,5rem)] leading-[0.96]">
                  Connectez-vous pour piloter votre environnement CloneStore.
                </h1>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                  Mon CloneStore regroupe le compte, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢abonnement, les
                  employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA, les technologies, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢Empreinte Entreprise, la confidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©,
                  les notifications et lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢apparence.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <ActionButton href="/signup" primary icon={<ArrowRight className="h-4 w-4" />}>
                    CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©er un compte
                  </ActionButton>
                  <ActionButton href="/login">Connexion</ActionButton>
                  <ActionButton href="/assistant">Ouvrir CloneChat</ActionButton>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  title="Compte"
                  value="PrivÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                  helper="AccÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s personnel et sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                  icon={<LockKeyhole className="h-5 w-5" />}
                />
                <MetricCard
                  title="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA"
                  value="Pilotage"
                  helper="Gestion des postes actifs"
                  icon={<Users2 className="h-5 w-5" />}
                />
                <MetricCard
                  title="Technologies"
                  value="RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©glages"
                  helper="CloneOS, Guard, Trace, Voice"
                  icon={<BrainCircuit className="h-5 w-5" />}
                />
                <MetricCard
                  title="DonnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es"
                  value="ContrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´le"
                  helper="Export, confidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                  icon={<Database className="h-5 w-5" />}
                />
              </div>
            </div>
          </LiquidGlass>
        </div>
      </main>
    );
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <div className="grid gap-5 xl:grid-cols-[278px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-[118px] xl:self-start">
            <LiquidGlass
              variant="panel"
              intensity="strong"
              refractive
              className="rounded-[2rem] p-3"
            >
              <div className="flex items-center gap-3 rounded-[1.55rem] border border-white/50 bg-white/32 p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/50 text-sm font-bold text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  {initials}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--cs-ink-1)]">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-[var(--cs-ink-4)]">
                    {displayEmail || "Compte CloneStore"}
                  </p>
                </div>
              </div>

              <div className="mt-3 hidden gap-2 xl:grid">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "flex items-center gap-3 rounded-[1.35rem] border px-3 py-2.5 text-left transition",
                        active
                          ? "border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_14px_38px_rgba(38,32,22,0.08)]"
                          : "border-white/35 bg-white/18 hover:border-white/55 hover:bg-white/34"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/50 bg-white/35",
                          active ? "text-[#667cff]" : "text-[var(--cs-ink-3)]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0">
                        <span className="block text-[0.64rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
                          {tab.eyebrow}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-[var(--cs-ink-1)]">
                          {tab.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-xl",
                        active
                          ? "border-white/70 bg-white/58 text-[var(--cs-ink-1)]"
                          : "border-white/42 bg-white/28 text-[var(--cs-ink-3)]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-2">
                <ActionButton
                  href="/profile/agents"
                  primary
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Cockpit
                </ActionButton>
                <ActionButton onClick={signOut} icon={<LogOut className="h-4 w-4" />}>
                  DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©connexion
                </ActionButton>
              </div>
            </LiquidGlass>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="cs-eyebrow">Centre de contrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´le</p>
                <h1 className="cs-heading mt-2 text-[clamp(2rem,3.2vw,3.8rem)] leading-[0.96]">
                  Mon CloneStore
                </h1>
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  onClick={() => void load(true)}
                  disabled={refreshing}
                  icon={
                    refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )
                  }
                >
                  Actualiser
                </ActionButton>
                <ActionButton href="/assistant">CloneChat</ActionButton>
              </div>
            </div>

            <FeedbackBanner feedback={feedback} />

            {activeTab === "overview" ? (
              <PanelShell
                eyebrow="Vue dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ensemble"
                title="Tout lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢environnement CloneStore, sans bruit inutile."
                text="Cette page centralise le compte, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢abonnement, les employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA, les technologies, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢Empreinte Entreprise, la confidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, les notifications et lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢apparence."
                actions={
                  <>
                    <ActionButton href="/profile/agents" primary icon={<ArrowRight className="h-4 w-4" />}>
                      Ouvrir le cockpit
                    </ActionButton>
                    <ActionButton href="/agents">Boutique</ActionButton>
                  </>
                }
              >
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetricCard
                      title="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s actifs"
                      value={activeOrders.length}
                      helper="Postes actuellement exploitables"
                      icon={<BadgeCheck className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s liÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s"
                      value={orders.length}
                      helper="Historique du compte"
                      icon={<BriefcaseBusiness className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="Catalogue"
                      value={availableAgentCount}
                      helper="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA visibles"
                      icon={<Users2 className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="Session"
                      value="ConnectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                      helper="Compte CloneStore actif"
                      icon={<ShieldCheck className="h-5 w-5" />}
                    />
                  </div>

                  <div className="grid gap-3">
                    <ControlCard
                      icon={<Waypoints className="h-4 w-4" />}
                      title="Cockpit"
                      text="AccÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s aux employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s, aux missions, aux messages, aux validations et aux actions opÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rationnelles."
                      right={<ChevronRight className="h-4 w-4 text-[var(--cs-ink-4)]" />}
                    />
                    <ControlCard
                      icon={<BrainCircuit className="h-4 w-4" />}
                      title="Technologies"
                      text="RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©glages globaux de CloneOS, CloneADN, CloneGuard, CloneTrace, CloneVoice et CloneChat."
                    />
                    <ControlCard
                      icon={<Fingerprint className="h-4 w-4" />}
                      title="Empreinte Entreprise"
                      text="Ton, rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨gles, validations, contexte, signature et habitudes de lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise."
                    />
                    <ControlCard
                      icon={<CreditCard className="h-4 w-4" />}
                      title="Abonnement & paiement"
                      text="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s achetÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s, statut dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s, facturation et portail de paiement sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                    />
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "account" ? (
              <PanelShell
                eyebrow="Compte"
                title="IdentitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s et sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                text="Modifiez les informations essentielles du compte, lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢email, le mot de passe et les accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s de sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                actions={
                  <ActionButton onClick={saveProfile} primary icon={<Save className="h-4 w-4" />}>
                    Enregistrer
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="grid gap-4">
                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/60 bg-white/55 text-lg font-bold text-[var(--cs-ink-1)]">
                          {initials}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                            {displayName}
                          </p>
                          <p className="truncate text-sm text-[var(--cs-ink-3)]">{displayEmail}</p>
                          <p className="mt-2 text-xs text-[var(--cs-ink-4)]">
                            ID : <span className="font-mono">{userId}</span>
                          </p>
                        </div>
                      </div>
                    </LiquidGlass>

                    <Field
                      label="Nom complet"
                      value={fullNameDraft}
                      onChange={setFullNameDraft}
                      placeholder="PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nom Nom"
                      icon={<User2 className="h-4 w-4" />}
                    />

                    <Field
                      label="Adresse email"
                      value={emailDraft}
                      onChange={setEmailDraft}
                      placeholder="vous@entreprise.com"
                      type="email"
                      autoComplete="email"
                      icon={<Mail className="h-4 w-4" />}
                    />

                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={saveProfile} primary icon={<Save className="h-4 w-4" />}>
                        Enregistrer le profil
                      </ActionButton>
                      <ActionButton onClick={updateEmail}>Changer lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢email</ActionButton>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="Nouveau mot de passe"
                        value={passwordDraft}
                        onChange={setPasswordDraft}
                        placeholder="Minimum 8 caractÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨res"
                        type="password"
                        autoComplete="new-password"
                        icon={<KeyRound className="h-4 w-4" />}
                      />
                      <Field
                        label="Confirmation"
                        value={passwordConfirmDraft}
                        onChange={setPasswordConfirmDraft}
                        placeholder="Retapez le mot de passe"
                        type="password"
                        autoComplete="new-password"
                        icon={<LockKeyhole className="h-4 w-4" />}
                      />
                    </div>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          ["8 caractÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨res", passwordChecks.length],
                          ["Une majuscule", passwordChecks.upper],
                          ["Une minuscule", passwordChecks.lower],
                          ["Un chiffre", passwordChecks.number],
                          ["Confirmation identique", passwordChecks.match],
                        ].map(([label, ok]) => (
                          <div key={String(label)} className="flex items-center gap-2 text-sm">
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full",
                                ok ? "bg-[var(--cs-success)]" : "bg-[rgba(21,25,34,0.18)]"
                              )}
                            />
                            <span className={ok ? "text-[var(--cs-ink-1)]" : "text-[var(--cs-ink-4)]"}>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </LiquidGlass>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        onClick={updatePassword}
                        disabled={!passwordValid}
                        primary
                        icon={<KeyRound className="h-4 w-4" />}
                      >
                        Mettre ÃƒÆ’Ã†â€™  jour le mot de passe
                      </ActionButton>
                      <ActionButton onClick={signOut} icon={<LogOut className="h-4 w-4" />}>
                        DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©connexion
                      </ActionButton>
                    </div>

                    <ControlCard
                      icon={<ShieldCheck className="h-4 w-4" />}
                      title="SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© du compte"
                      text="Les changements dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢email peuvent nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cessiter une confirmation par email selon la configuration Supabase."
                    />
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "company" ? (
              <PanelShell
                eyebrow="Entreprise"
                title="IdentitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© et contexte gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ral."
                text="Ces informations servent ÃƒÆ’Ã†â€™  rendre CloneStore plus cohÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rent avec lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise, ses prioritÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s et son fonctionnement."
                actions={
                  <ActionButton onClick={saveCompany} primary icon={<Save className="h-4 w-4" />}>
                    Enregistrer
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Nom de lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise"
                      value={company.companyName}
                      onChange={(value) => setCompany((prev) => ({ ...prev, companyName: value }))}
                      placeholder="Nom de votre entreprise"
                      icon={<Building2 className="h-4 w-4" />}
                    />
                    <Field
                      label="Secteur"
                      value={company.sector}
                      onChange={(value) => setCompany((prev) => ({ ...prev, sector: value }))}
                      placeholder="RH, BTP, commerce, servicesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                      icon={<BriefcaseBusiness className="h-4 w-4" />}
                    />
                    <SelectField
                      label="Taille"
                      value={company.size}
                      onChange={(value) => setCompany((prev) => ({ ...prev, size: value }))}
                      options={["", "1-10", "11-50", "51-200", "201-1000", "1000+"]}
                    />
                    <Field
                      label="Votre rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´le"
                      value={company.userRole}
                      onChange={(value) => setCompany((prev) => ({ ...prev, userRole: value }))}
                      placeholder="Dirigeant, RH, managerÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                      icon={<User2 className="h-4 w-4" />}
                    />
                  </div>

                  <div className="grid gap-4">
                    <TextArea
                      label="Objectif principal"
                      value={company.mainObjective}
                      onChange={(value) =>
                        setCompany((prev) => ({ ...prev, mainObjective: value }))
                      }
                      placeholder="Ex : gagner du temps sur le RH, structurer les relances, rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©duire la charge adminÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                    />
                    <SelectField
                      label="Mode de pilotage prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                      value={company.operatingMode}
                      onChange={(value) =>
                        setCompany((prev) => ({ ...prev, operatingMode: value }))
                      }
                      options={[
                        "pilotage",
                        "contrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´le strict",
                        "autonomie progressive",
                        "validation systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matique",
                      ]}
                    />
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "billing" ? (
              <PanelShell
                eyebrow="Abonnement & paiement"
                title="Offres, employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s actifs, facturation et carte bancaire."
                text="CloneStore ne stocke pas directement les numÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ros de carte. La gestion bancaire doit passer par un portail de paiement sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                actions={
                  <ActionButton onClick={openBillingPortal} primary icon={<CreditCard className="h-4 w-4" />}>
                    GÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rer le paiement
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="grid gap-4">
                    <MetricCard
                      title="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s actifs"
                      value={activeOrders.length}
                      helper="Souscriptions actuellement exploitables"
                      icon={<BadgeCheck className="h-5 w-5" />}
                    />
                    <MetricCard
                      title="Autres statuts"
                      value={inactiveOrders.length}
                      helper="Incomplets, rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©siliÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s ou en attente"
                      icon={<AlertCircle className="h-5 w-5" />}
                    />
                    <ControlCard
                      icon={<CreditCard className="h-4 w-4" />}
                      title="Carte bancaire"
                      text="La modification de carte doit se faire depuis le portail Stripe ou le portail de paiement configurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                    />
                  </div>

                  <div className="grid gap-3">
                    {orders.length === 0 ? (
                      <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                        <p className="text-base font-semibold text-[var(--cs-ink-1)]">
                          Aucun abonnement actif
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                          Les employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA achetÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s apparaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â®tront ici avec leur statut et leur accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s.
                        </p>
                        <div className="mt-4">
                          <ActionButton href="/agents" primary icon={<ArrowRight className="h-4 w-4" />}>
                            Voir la boutique
                          </ActionButton>
                        </div>
                      </LiquidGlass>
                    ) : (
                      orders.map((order) => {
                        const meta = getAgentMeta(order.agent_slug);

                        return (
                          <LiquidGlass
                            key={order.id}
                            variant="clear"
                            intensity="soft"
                            interactive
                            className="rounded-[1.65rem] p-4"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-[var(--cs-ink-1)]">
                                    {meta.name}
                                  </p>
                                  <span className={statusClass(order.status)}>
                                    {statusLabel(order.status)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-[var(--cs-ink-3)]">{meta.role}</p>
                                <p className="mt-2 text-xs text-[var(--cs-ink-4)]">
                                  DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©but : {formatDate(order.started_at)} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Fin :{" "}
                                  {formatDate(order.ended_at)}
                                </p>
                              </div>

                              <ActionButton href={meta.href}>Voir</ActionButton>
                            </div>
                          </LiquidGlass>
                        );
                      })
                    )}
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "employees" ? (
              <PanelShell
                eyebrow="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA"
                title="Postes possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s, configurables et futurs."
                text="LÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢objectif est de gÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rer les employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA au pluriel, sans centrer lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢interface sur un seul poste."
                actions={
                  <>
                    <ActionButton href="/profile/agents" primary icon={<ArrowRight className="h-4 w-4" />}>
                      Ouvrir le cockpit
                    </ActionButton>
                    <ActionButton href="/agents">Boutique</ActionButton>
                  </>
                }
              >
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricCard
                        title="PossÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s"
                        value={ownedEmployeesCount}
                        helper="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s liÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s au compte"
                        icon={<Users2 className="h-5 w-5" />}
                      />
                      <MetricCard
                        title="Catalogue"
                        value={AGENTS.length}
                        helper="EmployÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s visibles dans CloneStore"
                        icon={<BriefcaseBusiness className="h-5 w-5" />}
                      />
                    </div>

                    <div className="grid gap-3">
                      {AGENTS.map((agent) => {
                        const owned = ownedAgentSlugs.has(agent.slug);

                        return (
                          <ControlCard
                            key={agent.slug}
                            icon={<Sparkles className="h-4 w-4" />}
                            title={agent.name}
                            text={`${agent.role} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${owned ? "LiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© au compte" : "Visible dans la boutique"}`}
                            right={
                              <span className={owned ? "cs-status cs-status--success" : "cs-status"}>
                                {owned ? "PossÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©" : "Catalogue"}
                              </span>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {activeOrders.length > 0 ? (
                      activeOrders.map((order) => <EmployeeMiniCard key={order.id} order={order} />)
                    ) : (
                      <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                        <p className="text-base font-semibold text-[var(--cs-ink-1)]">
                          Aucun employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© actif
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                          Activez un employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© IA depuis la boutique pour voir son cockpit et sa configuration ici.
                        </p>
                        <div className="mt-4">
                          <ActionButton href="/agents" primary>
                            Voir la boutique
                          </ActionButton>
                        </div>
                      </LiquidGlass>
                    )}
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "technologies" ? (
              <PanelShell
                eyebrow="Technologies CloneStore"
                title="RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gler le comportement global du systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me."
                text="Ces prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rences cadrent la maniÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re dont CloneStore orchestre, apprend, trace, protÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ge et assiste."
                actions={
                  <ActionButton onClick={saveTechnologies} primary icon={<Save className="h-4 w-4" />}>
                    Enregistrer
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      label="CloneOS"
                      value={technologies.cloneOsMode}
                      onChange={(value) =>
                        setTechnologies((prev) => ({ ...prev, cloneOsMode: value }))
                      }
                      options={[
                        "Orchestration contrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e",
                        "Orchestration rapide",
                        "Orchestration trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s prudente",
                      ]}
                    />
                    <SelectField
                      label="CloneADN"
                      value={technologies.cloneAdnLearning}
                      onChange={(value) =>
                        setTechnologies((prev) => ({ ...prev, cloneAdnLearning: value }))
                      }
                      options={[
                        "Apprentissage progressif aprÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s validation",
                        "Apprentissage conservateur",
                        "Apprentissage accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©",
                      ]}
                    />
                    <SelectField
                      label="CloneGuard"
                      value={technologies.cloneGuardStrictness}
                      onChange={(value) =>
                        setTechnologies((prev) => ({ ...prev, cloneGuardStrictness: value }))
                      }
                      options={["Standard", "ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°levÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e", "TrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s stricte"]}
                    />
                    <SelectField
                      label="CloneTrace"
                      value={technologies.cloneTraceLevel}
                      onChange={(value) =>
                        setTechnologies((prev) => ({ ...prev, cloneTraceLevel: value }))
                      }
                      options={["Essentiel", "Complet", "Audit renforcÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"]}
                    />
                    <SelectField
                      label="CloneVoice"
                      value={technologies.cloneVoiceAccess}
                      onChange={(value) =>
                        setTechnologies((prev) => ({ ...prev, cloneVoiceAccess: value }))
                      }
                      options={[
                        "Disponible globalement",
                        "Seulement dans les espaces privÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s",
                        "DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sactivÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©",
                      ]}
                    />
                    <SelectField
                      label="CloneChat"
                      value={technologies.cloneChatRole}
                      onChange={(value) =>
                        setTechnologies((prev) => ({ ...prev, cloneChatRole: value }))
                      }
                      options={[
                        "Orientation, support et explication systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me",
                        "Support uniquement",
                        "Assistant discret",
                      ]}
                    />
                  </div>

                  <div className="grid gap-3">
                    <ControlCard
                      icon={<BrainCircuit className="h-4 w-4" />}
                      title="CloneOS"
                      text="Noyau qui transforme les demandes en missions, tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ches, prioritÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s et coordination."
                    />
                    <ControlCard
                      icon={<WandSparkles className="h-4 w-4" />}
                      title="CloneADN"
                      text="MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©moire comportementale : ton, habitudes, validations, prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rences et cohÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rence."
                    />
                    <ControlCard
                      icon={<LockKeyhole className="h-4 w-4" />}
                      title="CloneGuard"
                      text="Gouvernance : limites, refus, validation humaine et protection du sensible."
                    />
                    <ControlCard
                      icon={<Workflow className="h-4 w-4" />}
                      title="CloneTrace"
                      text="TraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§abilitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© : historique, statuts, dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cisions, actions et continuitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                    />
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "footprint" ? (
              <PanelShell
                eyebrow="Empreinte Entreprise"
                title="LÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ADN opÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rationnel de votre entreprise."
                text="LÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢Empreinte Entreprise doit aider les employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA ÃƒÆ’Ã†â€™  respecter le ton, les rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨gles, les validations et les habitudes de travail."
                actions={
                  <ActionButton onClick={saveFootprint} primary icon={<Save className="h-4 w-4" />}>
                    Enregistrer
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-4">
                    <TextArea
                      label="Ton de lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢entreprise"
                      value={footprint.tone}
                      onChange={(value) => setFootprint((prev) => ({ ...prev, tone: value }))}
                      placeholder="Ex : professionnel, direct, humain, haut de gammeÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                    />
                    <TextArea
                      label="RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨gles de validation"
                      value={footprint.validationRules}
                      onChange={(value) =>
                        setFootprint((prev) => ({ ...prev, validationRules: value }))
                      }
                      placeholder="Ce qui doit ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre validÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© par un humainÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                    />
                    <TextArea
                      label="Sujets sensibles"
                      value={footprint.sensitiveTopics}
                      onChange={(value) =>
                        setFootprint((prev) => ({ ...prev, sensitiveTopics: value }))
                      }
                      placeholder="Ce qui doit ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre bloquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, remontÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© ou traitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© avec prudenceÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                    />
                  </div>

                  <div className="grid gap-4">
                    <TextArea
                      label="Signature / identitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                      value={footprint.signature}
                      onChange={(value) =>
                        setFootprint((prev) => ({ ...prev, signature: value }))
                      }
                      placeholder="Signature email, formulation prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e, identitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢envoiÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                    />
                    <TextArea
                      label="Contexte de rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rence"
                      value={footprint.referenceContext}
                      onChange={(value) =>
                        setFootprint((prev) => ({ ...prev, referenceContext: value }))
                      }
                      placeholder="Infos importantes ÃƒÆ’Ã†â€™  respecter dans les missionsÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦"
                      minHeight="min-h-[168px]"
                    />
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "privacy" ? (
              <PanelShell
                eyebrow="ConfidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                title="ContrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´le des donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es et demandes sensibles."
                text="Cette zone regroupe export, visibilitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, confidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, suppression et demandes liÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es au compte."
                actions={
                  <ActionButton onClick={exportAccountData} primary icon={<Download className="h-4 w-4" />}>
                    Exporter mes donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="grid gap-3">
                    <ControlCard
                      icon={<Database className="h-4 w-4" />}
                      title="Export local"
                      text="GÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re un fichier JSON avec les informations disponibles cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© compte et prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rences enregistrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es."
                    />
                    <ControlCard
                      icon={<Eye className="h-4 w-4" />}
                      title="VisibilitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                      text="Les missions, historiques, configurations et traces doivent rester lisibles et contrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´lables."
                    />
                    <ControlCard
                      icon={<ShieldCheck className="h-4 w-4" />}
                      title="Protection"
                      text="Les actions sensibles doivent ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre encadrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es par CloneGuard et les validations humaines."
                    />
                    <ControlCard
                      icon={<LifeBuoy className="h-4 w-4" />}
                      title="Assistance"
                      text="CloneChat et le support doivent pouvoir orienter clairement sur les sujets de confidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©."
                    />
                  </div>

                  <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                    <div className="space-y-4">
                      <div>
                        <p className="text-base font-semibold text-[var(--cs-ink-1)]">
                          Suppression du compte
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                          La suppression dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢un compte entreprise doit ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre traitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e proprement :
                          accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s, facturation, donnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es, historiques et obligations ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ventuelles.
                        </p>
                      </div>

                      <Field
                        label="Confirmation"
                        value={dangerConfirm}
                        onChange={setDangerConfirm}
                        placeholder="ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°crivez SUPPRIMER"
                        icon={<Trash2 className="h-4 w-4" />}
                      />

                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          onClick={requestAccountDeletion}
                          disabled={dangerConfirm.trim().toUpperCase() !== "SUPPRIMER"}
                          icon={<Trash2 className="h-4 w-4" />}
                        >
                          Demander la suppression
                        </ActionButton>
                        <ActionButton href="/legal/confidentialite">
                          Politique de confidentialitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©
                        </ActionButton>
                      </div>
                    </div>
                  </LiquidGlass>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "notifications" ? (
              <PanelShell
                eyebrow="Notifications"
                title="Alertes internes, emails et rapports."
                text="Les notifications doivent rester utiles, discrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨tes et orientÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es action."
                actions={
                  <ActionButton onClick={saveNotifications} primary icon={<Save className="h-4 w-4" />}>
                    Enregistrer
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-3">
                    <ToggleRow
                      label="Notifications internes"
                      text="Alertes premium dans lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢interface CloneStore."
                      checked={notifications.internalNotifications}
                      onChange={(value) =>
                        setNotifications((prev) => ({ ...prev, internalNotifications: value }))
                      }
                    />
                    <ToggleRow
                      label="Notifications email"
                      text="Recevoir les informations importantes par email."
                      checked={notifications.emailNotifications}
                      onChange={(value) =>
                        setNotifications((prev) => ({ ...prev, emailNotifications: value }))
                      }
                    />
                    <ToggleRow
                      label="Rapports employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA"
                      text="SynthÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ses dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢activitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© et missions terminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es."
                      checked={notifications.employeeReports}
                      onChange={(value) =>
                        setNotifications((prev) => ({ ...prev, employeeReports: value }))
                      }
                    />
                    <ToggleRow
                      label="Alertes facturation"
                      text="Paiement, abonnement, carte et portail."
                      checked={notifications.billingAlerts}
                      onChange={(value) =>
                        setNotifications((prev) => ({ ...prev, billingAlerts: value }))
                      }
                    />
                    <ToggleRow
                      label="Alertes sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©curitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                      text="Connexion, accÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s, changement dÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢email ou mot de passe."
                      checked={notifications.securityAlerts}
                      onChange={(value) =>
                        setNotifications((prev) => ({ ...prev, securityAlerts: value }))
                      }
                    />
                  </div>

                  <div className="grid gap-3">
                    <ControlCard
                      icon={<Bell className="h-4 w-4" />}
                      title="Notification interne"
                      text="Exemple : un employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© IA a terminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© un rapport, attend une validation ou signale un blocage."
                    />
                    <ControlCard
                      icon={<MessageCircle className="h-4 w-4" />}
                      title="Messagerie"
                      text="Les messages internes seront liÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s au cockpit et aux employÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s IA possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s."
                    />
                    <ControlCard
                      icon={<FileCheck2 className="h-4 w-4" />}
                      title="Rapports"
                      text="Les synthÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨ses doivent permettre de comprendre rapidement ce qui a ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© fait."
                    />
                  </div>
                </div>
              </PanelShell>
            ) : null}

            {activeTab === "appearance" ? (
              <PanelShell
                eyebrow="Apparence"
                title="Interface, densitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, couleur et confort."
                text="Cette zone personnalise lÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢environnement CloneStore sans casser la homepage ni son Liquid Glass original."
                actions={
                  <ActionButton onClick={saveAppearance} primary icon={<Save className="h-4 w-4" />}>
                    Enregistrer
                  </ActionButton>
                }
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      label="ThÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me"
                      value={appearance.theme}
                      onChange={(value) => updateAppearanceSetting("theme", value)}
                      options={["Ivoire premium", "Graphite clair", "CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me champagne"]}
                    />
                    <SelectField
                      label="Accent"
                      value={appearance.accent}
                      onChange={(value) => updateAppearanceSetting("accent", value)}
                      options={["Bleu graphite", "Bleu froid", "Champagne", "Violet discret"]}
                    />
                    <SelectField
                      label="DensitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©"
                      value={appearance.density}
                      onChange={(value) => updateAppearanceSetting("density", value)}
                      options={["Confortable", "Compacte", "TrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e"]}
                    />
                    <SelectField
                      label="Animations"
                      value={appearance.motion}
                      onChange={(value) => updateAppearanceSetting("motion", value)}
                      options={["Subtile", "RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©duite", "DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sactivÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e"]}
                    />
                  </div>

                  <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                    <div className="space-y-5">
                      <div>
                        <p className="text-base font-semibold text-[var(--cs-ink-1)]">
                          AperÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§u interface
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                          La personnalisation reste premium : ivoire, graphite,
                          champagne et accents froids subtils.
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-[1.4rem] border border-white/55 bg-white/38 p-4">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            {appearance.theme}
                          </p>
                          <p className="mt-1 text-xs text-[var(--cs-ink-3)]">
                            Accent : {appearance.accent} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· DensitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© : {appearance.density} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Animations : {appearance.motion}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => updateAppearanceSetting("accent", "Bleu graphite")}
                            className="h-8 w-8 rounded-full border border-white/70 bg-[#536cff] shadow-[0_10px_22px_rgba(83,108,255,0.18)]"
                            aria-label="Accent bleu graphite"
                          />
                          <button
                            type="button"
                            onClick={() => updateAppearanceSetting("accent", "Bleu froid")}
                            className="h-8 w-8 rounded-full border border-white/70 bg-[#4f7dff] shadow-[0_10px_22px_rgba(79,125,255,0.18)]"
                            aria-label="Accent bleu froid"
                          />
                          <button
                            type="button"
                            onClick={() => updateAppearanceSetting("accent", "Champagne")}
                            className="h-8 w-8 rounded-full border border-white/70 bg-[#d6a85f] shadow-[0_10px_22px_rgba(214,168,95,0.18)]"
                            aria-label="Accent champagne"
                          />
                          <button
                            type="button"
                            onClick={() => updateAppearanceSetting("accent", "Violet discret")}
                            className="h-8 w-8 rounded-full border border-white/70 bg-[#7d76ff] shadow-[0_10px_22px_rgba(125,118,255,0.18)]"
                            aria-label="Accent violet discret"
                          />
                        </div>
                      </div>
                    </div>
                  </LiquidGlass>
                </div>
              </PanelShell>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
