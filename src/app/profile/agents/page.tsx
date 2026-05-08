"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bell,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Command,
  FileText,
  GitBranch,
  Inbox,
  Layers3,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareQuote,
  Mic,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  User2,
  Users2,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";

import { AGENTS } from "@/lib/agent-catalog";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type OrderRow = {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

type NotificationTone = "info" | "success" | "warning" | "critical";

type MissionStatus =
  | "now"
  | "today"
  | "scheduled"
  | "waiting_validation"
  | "blocked"
  | "done";

type MissionRisk = "low" | "medium" | "high";

type MissionItem = {
  id: string;
  title: string;
  summary: string;
  status: MissionStatus;
  employees: string[];
  risk: MissionRisk;
  urgency: "normal" | "important" | "urgent";
  nextAction: string;
  due: string;
  trace: string;
};

type ValidationStatus =
  | "pending"
  | "approved"
  | "refused"
  | "modified"
  | "blocked";

type ValidationItem = {
  id: string;
  title: string;
  description: string;
  employee: string;
  risk: MissionRisk;
  status: ValidationStatus;
  time: string;
};

type MessageCategory =
  | "reception"
  | "suivis"
  | "validation"
  | "preparation"
  | "briefings"
  | "livraisons"
  | "alertes"
  | "envoyes";

type MessageItem = {
  id: string;
  title: string;
  body: string;
  owner: string;
  source: string;
  time: string;
  tone: NotificationTone;
  unread: boolean;
  categories: MessageCategory[];
  relatedEmployees: string[];
  summary: string;
};

type SalonMessage = {
  id: string;
  author: string;
  role: string;
  body: string;
  time: string;
  mine?: boolean;
  tone?: NotificationTone;
};

type RuleScope = "global" | "employee" | "technology";
type RuleStatus = "active" | "paused";
type RuleSensitivity = "normal" | "sensitive" | "critical";

type RuleItem = {
  id: string;
  title: string;
  body: string;
  targetType: RuleScope;
  target: string;
  status: RuleStatus;
  sensitivity: RuleSensitivity;
  createdFrom: "cockpit" | "salon" | "system";
  time: string;
};

type TraceItem = {
  id: string;
  title: string;
  detail: string;
  actor: string;
  time: string;
  tone: NotificationTone;
};

type BriefingItem = {
  id: string;
  title: string;
  summary: string;
  period: string;
  blockers: number;
  delivered: number;
  validations: number;
};

type AlertItem = {
  id: string;
  title: string;
  detail: string;
  tone: NotificationTone;
  action: string;
};

type TechnologyItem = {
  id: string;
  name: string;
  role: string;
  state: "active" | "watching" | "needs_attention";
  lastEvent: string;
  rules: number;
};

type AgentMeta = {
  slug: string;
  name: string;
  role: string;
  description: string;
  href: string;
  setupHref: string;
  useHref: string;
  active: boolean;
  status: string;
};

type CloneOsPlan = {
  summary: string;
  employees: AgentMeta[];
  unavailable: string[];
  tasks: string[];
  risk: MissionRisk;
  validationRequired: boolean;
  nextStatus: MissionStatus;
};

const MESSAGE_CATEGORY_LABELS: Record<MessageCategory, string> = {
  reception: "Réception",
  suivis: "Suivis",
  validation: "À valider",
  preparation: "En préparation",
  briefings: "Briefings",
  livraisons: "Livraisons",
  alertes: "Alertes",
  envoyes: "Envoyés / suivi",
};

const MISSION_COLUMNS: Array<{
  status: MissionStatus;
  label: string;
  helper: string;
}> = [
  {
    status: "now",
    label: "Maintenant",
    helper: "Actions immédiates.",
  },
  {
    status: "today",
    label: "Aujourd’hui",
    helper: "Travail prévu dans la journée.",
  },
  {
    status: "scheduled",
    label: "Programmé",
    helper: "Missions planifiées.",
  },
  {
    status: "waiting_validation",
    label: "À valider",
    helper: "En pause avant décision humaine.",
  },
  {
    status: "blocked",
    label: "Bloqué",
    helper: "Friction ou risque détecté.",
  },
  {
    status: "done",
    label: "Terminé",
    helper: "Livré récemment.",
  },
];

const ROUTING_KEYWORDS: Array<{
  slug: string;
  keywords: string[];
  reason: string;
}> = [
  {
    slug: "pierre",
    keywords: [
      "pierre",
      "rh",
      "salarié",
      "salarie",
      "contrat",
      "candidat",
      "onboarding",
      "offboarding",
      "absence",
      "congé",
      "conge",
      "convocation",
      "document rh",
      "mail rh",
      "ressources humaines",
    ],
    reason:
      "Mission RH opérationnelle, document, email, suivi salarié ou validation RH.",
  },
  {
    slug: "clara",
    keywords: [
      "clara",
      "recrutement",
      "cv",
      "candidature",
      "shortlist",
      "entretien",
      "poste",
      "fiche de poste",
      "pipeline candidat",
    ],
    reason:
      "Mission recrutement, candidature, shortlist ou coordination d’entretien.",
  },
  {
    slug: "emma",
    keywords: [
      "emma",
      "support",
      "client",
      "sav",
      "ticket",
      "réclamation",
      "reclamation",
      "service client",
      "message client",
    ],
    reason: "Mission support, relation client, réponse ou suivi de ticket.",
  },
  {
    slug: "adrien",
    keywords: [
      "adrien",
      "commande",
      "livraison",
      "stock",
      "expédition",
      "expedition",
      "retour produit",
      "suivi commande",
    ],
    reason: "Mission commandes, flux opérationnel, livraison ou back-office.",
  },
  {
    slug: "lucas",
    keywords: [
      "lucas",
      "finance",
      "facture",
      "facturation",
      "paiement",
      "relance paiement",
      "trésorerie",
      "tresorerie",
      "devis",
      "impayé",
      "impaye",
    ],
    reason: "Mission finance, facturation, paiement ou relance.",
  },
  {
    slug: "sophie",
    keywords: [
      "sophie",
      "administratif",
      "dossier",
      "procédure",
      "procedure",
      "back-office",
      "secrétariat",
      "secretariat",
      "organisation interne",
    ],
    reason: "Mission administrative, coordination interne ou dossier opérationnel.",
  },
  {
    slug: "alex",
    keywords: [
      "alex",
      "opérations",
      "operations",
      "opération",
      "operation",
      "planning",
      "coordination",
      "process",
      "workflow",
      "tâches",
      "taches",
    ],
    reason: "Mission opérations, planning, process ou coordination transverse.",
  },
];

function nowLabel() {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusLabel(status: string) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "active") return "Actif";
  if (normalized === "cancelled") return "Résilié";
  if (normalized === "past_due") return "Paiement en attente";
  if (normalized === "trialing") return "Essai";
  if (normalized === "incomplete") return "Incomplet";

  return status || "—";
}

function isActiveOrder(order: OrderRow) {
  return (order.status || "").toLowerCase() === "active";
}

function getInitials(email: string | null) {
  const cleanEmail = (email ?? "").trim();
  if (!cleanEmail) return "CS";
  return cleanEmail.slice(0, 2).toUpperCase();
}

function getToneStyle(tone: NotificationTone): CSSProperties {
  if (tone === "critical") {
    return {
      background:
        "linear-gradient(135deg, rgba(184,74,74,0.14), rgba(184,74,74,0.26))",
      borderColor: "rgba(184,74,74,0.28)",
      color: "#b84a4a",
    };
  }

  if (tone === "warning") {
    return {
      background:
        "linear-gradient(135deg, rgba(211,159,67,0.14), rgba(211,159,67,0.26))",
      borderColor: "rgba(211,159,67,0.28)",
      color: "#b98522",
    };
  }

  if (tone === "success") {
    return {
      background:
        "linear-gradient(135deg, rgba(37,183,139,0.14), rgba(37,183,139,0.26))",
      borderColor: "rgba(37,183,139,0.28)",
      color: "var(--cs-success)",
    };
  }

  return {
    background:
      "linear-gradient(135deg, var(--clone-accent-soft), rgba(255,255,255,0.46))",
    borderColor: "var(--clone-accent-border)",
    color: "var(--clone-accent)",
  };
}

function getRiskTone(risk: MissionRisk): NotificationTone {
  if (risk === "high") return "critical";
  if (risk === "medium") return "warning";
  return "info";
}

function toneIcon(tone: NotificationTone) {
  if (tone === "critical") return <AlertCircle className="h-4 w-4" />;
  if (tone === "warning") return <Clock3 className="h-4 w-4" />;
  if (tone === "success") return <CheckCircle2 className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

function getAgentMetaFromSlug(
  slug: string,
  active = false,
  status = "inactive"
): AgentMeta {
  const normalized = slug.toLowerCase();
  const agent = AGENTS.find((item) => item.slug === normalized);

  return {
    slug: normalized,
    name: agent?.name ?? titleCaseSlug(normalized),
    role: agent?.role ?? "Employé IA CloneStore",
    description:
      agent?.does?.[0] ??
      "Employé IA rattaché à l’environnement CloneStore de l’entreprise.",
    href: `/agents/${normalized}`,
    setupHref: `/agents/${normalized}/setup`,
    useHref:
      normalized === "pierre"
        ? `/agents/${normalized}/use`
        : `/agents/${normalized}`,
    active,
    status,
  };
}

function missionStatusLabel(status: MissionStatus) {
  if (status === "now") return "Maintenant";
  if (status === "today") return "Aujourd’hui";
  if (status === "scheduled") return "Programmé";
  if (status === "waiting_validation") return "À valider";
  if (status === "blocked") return "Bloqué";
  return "Terminé";
}

function missionStatusTone(status: MissionStatus): NotificationTone {
  if (status === "blocked") return "critical";
  if (status === "waiting_validation") return "warning";
  if (status === "done") return "success";
  return "info";
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(184,74,74,0.18)] bg-[rgba(184,74,74,0.07)] px-4 py-3 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-danger)]" />
        <p className="text-sm font-medium leading-6 text-[var(--cs-danger)]">
          {message}
        </p>
      </div>
    </div>
  );
}

function StatCard({
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
    <article className="cs-card cs-card-tight">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
            {title}
          </p>
          <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-3)]">
            {helper}
          </p>
        </div>

        <div className="rounded-2xl border border-white/55 bg-white/38 p-2.5 text-[var(--cs-violet)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
          {icon}
        </div>
      </div>
    </article>
  );
}

function TopCircleButton({
  label,
  icon,
  count,
  active,
  onClick,
  href,
  small = false,
  style,
}: {
  label: string;
  icon: ReactNode;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  small?: boolean;
  style?: CSSProperties;
}) {
  const className = cn(
    "relative inline-flex items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition",
    small ? "h-10 w-10" : "h-12 w-12",
    active
      ? "border-[var(--clone-accent-border)] bg-[var(--clone-accent-soft)] text-[var(--clone-accent)]"
      : "border-white/55 bg-white/38 text-[var(--cs-ink-2)] hover:bg-white/56"
  );

  const content = (
    <>
      {icon}
      {typeof count === "number" && count > 0 ? (
        <span
          className="absolute -right-1 -top-1 flex h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[0.64rem] font-bold text-white shadow-[0_10px_22px_rgba(24,28,36,0.18)]"
          style={{
            background:
              "linear-gradient(135deg, var(--clone-accent), var(--cs-violet-2))",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        className={className}
        style={style}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}

function RailButton({
  open,
  label,
  icon,
  target,
}: {
  open: boolean;
  label: string;
  icon: ReactNode;
  target: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById(target)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
      className={cn(
        "group flex min-h-11 w-full items-center rounded-full border border-white/48 bg-white/28 text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.64)] backdrop-blur-xl transition hover:bg-white/46",
        open ? "justify-start gap-3 px-3" : "justify-center px-0"
      )}
      title={label}
    >
      <span className="text-[var(--cs-violet)]">{icon}</span>
      {open ? <span className="truncate text-xs font-bold">{label}</span> : null}
    </button>
  );
}

function EmployeeCard({
  employee,
  missions,
  validations,
}: {
  employee: AgentMeta;
  missions: number;
  validations: number;
}) {
  return (
    <article className="cs-panel cs-hover-lift p-5">
      <div className="flex h-full flex-col justify-between gap-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
                  style={getToneStyle(employee.active ? "success" : "warning")}
                >
                  {employee.active ? "Actif" : statusLabel(employee.status)}
                </span>
                <span className="rounded-full border border-white/55 bg-white/42 px-2.5 py-1 text-[0.68rem] font-bold text-[var(--cs-ink-3)]">
                  Possédé
                </span>
              </div>

              <h3 className="mt-4 text-[1.28rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                {employee.name}
              </h3>

              <p className="mt-1 text-sm font-semibold text-[var(--cs-ink-2)]">
                {employee.role}
              </p>
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] border border-white/60 bg-white/45 text-[var(--cs-violet)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] backdrop-blur-xl">
              <Bot className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-[var(--cs-ink-3)]">
            {employee.description}
          </p>

          <div className="mt-4 grid gap-2 rounded-[1.35rem] border border-white/50 bg-white/28 p-3 text-xs text-[var(--cs-ink-4)] shadow-[inset_0_1px_0_rgba(255,255,255,0.66)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <span>Charge active</span>
              <span className="font-semibold text-[var(--cs-ink-2)]">
                {missions} mission{missions > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Validations</span>
              <span className="font-semibold text-[var(--cs-ink-2)]">
                {validations}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Dernier signal</span>
              <span className="font-semibold text-[var(--cs-ink-2)]">
                Synchro cockpit
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={employee.useHref}
            className="clone-liquid-button clone-liquid-button--dark min-h-10 px-4"
          >
            Ouvrir
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={employee.setupHref}
            className="clone-liquid-button min-h-10 px-4"
          >
            Configurer
          </Link>
          <button type="button" className="clone-liquid-button min-h-10 px-4">
            Règles
          </button>
          <button type="button" className="clone-liquid-button min-h-10 px-4">
            Autonomie
          </button>
        </div>
      </div>
    </article>
  );
}

function MissionCard({
  mission,
  onInsert,
}: {
  mission: MissionItem;
  onInsert: () => void;
}) {
  return (
    <article className="rounded-[1.35rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
          style={getToneStyle(missionStatusTone(mission.status))}
        >
          {missionStatusLabel(mission.status)}
        </span>
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
          style={getToneStyle(getRiskTone(mission.risk))}
        >
          Risque{" "}
          {mission.risk === "high"
            ? "élevé"
            : mission.risk === "medium"
              ? "moyen"
              : "faible"}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[var(--cs-ink-1)]">
        {mission.title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
        {mission.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {mission.employees.map((employee) => (
          <span
            key={`${mission.id}-${employee}`}
            className="rounded-full border border-white/55 bg-white/42 px-2.5 py-1 text-[0.68rem] font-bold text-[var(--cs-ink-3)]"
          >
            {employee}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-[1.1rem] border border-white/50 bg-white/30 p-3">
        <p className="text-xs font-bold text-[var(--cs-ink-2)]">
          Prochaine action
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-3)]">
          {mission.nextAction}
        </p>
        <p className="mt-2 text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
          {mission.due}
        </p>
      </div>

      <button
        type="button"
        onClick={onInsert}
        className="clone-liquid-button mt-4 min-h-10 px-4"
      >
        Envoyer au salon
        <MessageSquareQuote className="h-4 w-4" />
      </button>
    </article>
  );
}

function ValidationCard({
  item,
  onUpdate,
  onInsert,
}: {
  item: ValidationItem;
  onUpdate: (status: ValidationStatus) => void;
  onInsert: () => void;
}) {
  return (
    <article className="rounded-[1.45rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
          style={getToneStyle(item.status === "pending" ? "warning" : "success")}
        >
          {item.status === "pending"
            ? "En attente"
            : item.status === "approved"
              ? "Approuvée"
              : item.status === "refused"
                ? "Refusée"
                : item.status === "modified"
                  ? "À modifier"
                  : "Bloquée"}
        </span>
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
          style={getToneStyle(getRiskTone(item.risk))}
        >
          {item.employee}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[var(--cs-ink-1)]">
        {item.title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
        {item.description}
      </p>

      <p className="mt-2 text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
        {item.time}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onUpdate("approved")}
          className="clone-liquid-button clone-liquid-button--dark min-h-10 px-4"
        >
          Approuver
        </button>
        <button
          type="button"
          onClick={() => onUpdate("refused")}
          className="clone-liquid-button min-h-10 px-4"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => onUpdate("modified")}
          className="clone-liquid-button min-h-10 px-4"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={() => onUpdate("blocked")}
          className="clone-liquid-button min-h-10 px-4"
        >
          Bloquer
        </button>
        <button
          type="button"
          onClick={onInsert}
          className="clone-liquid-button min-h-10 px-4"
        >
          Salon
        </button>
      </div>
    </article>
  );
}

function MessageCard({
  item,
  onSelect,
  onDragStart,
}: {
  item: MessageItem;
  onSelect: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <article
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      className="cursor-pointer rounded-[1.35rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl transition hover:bg-white/42"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
          style={getToneStyle(item.tone)}
        >
          {toneIcon(item.tone)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--cs-ink-1)]">
              {item.title}
            </p>
            {item.unread ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--clone-accent)]" />
            ) : null}
          </div>

          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
            {item.owner} · {item.source}
          </p>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--cs-ink-3)]">
            {item.body}
          </p>
        </div>
      </div>
    </article>
  );
}

function RuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: RuleItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-[1.35rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
          style={getToneStyle(rule.status === "active" ? "success" : "warning")}
        >
          {rule.status === "active" ? "Active" : "En pause"}
        </span>
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
          style={getToneStyle(
            rule.sensitivity === "critical"
              ? "critical"
              : rule.sensitivity === "sensitive"
                ? "warning"
                : "info"
          )}
        >
          {rule.target}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[var(--cs-ink-1)]">
        {rule.title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
        {rule.body}
      </p>

      <p className="mt-2 text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
        Source : {rule.createdFrom} · {rule.time}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="clone-liquid-button min-h-10 px-4"
        >
          {rule.status === "active" ? "Mettre en pause" : "Activer"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="clone-liquid-button min-h-10 px-4"
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}

function TechnologyCard({
  item,
  onConfigure,
}: {
  item: TechnologyItem;
  onConfigure: () => void;
}) {
  const tone =
    item.state === "needs_attention"
      ? "warning"
      : item.state === "active"
        ? "success"
        : "info";

  return (
    <article className="cs-card cs-card-tight">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold"
              style={getToneStyle(tone)}
            >
              {item.state === "active"
                ? "Actif"
                : item.state === "watching"
                  ? "Surveillance"
                  : "Attention"}
            </span>
            <span className="rounded-full border border-white/55 bg-white/42 px-2.5 py-1 text-[0.68rem] font-bold text-[var(--cs-ink-3)]">
              {item.rules} règle{item.rules > 1 ? "s" : ""}
            </span>
          </div>

          <h3 className="mt-3 text-sm font-semibold text-[var(--cs-ink-1)]">
            {item.name}
          </h3>

          <p className="mt-2 text-xs leading-6 text-[var(--cs-ink-3)]">
            {item.role}
          </p>

          <p className="mt-2 text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
            {item.lastEvent}
          </p>
        </div>

        <button
          type="button"
          onClick={onConfigure}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/40 text-[var(--cs-violet)]"
          aria-label={`Configurer ${item.name}`}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function ProfileAgentsPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabase() as SupabaseClient;
    } catch {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [railOpen, setRailOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<SalonMessage[]>([
    {
      id: "command-welcome",
      author: "CloneOS",
      role: "Centre de commandement",
      body:
        "Écrivez une demande libre. CloneOS comprend, découpe, vérifie vos employés actifs, crée les tâches, détecte le risque et remonte les validations.",
      time: nowLabel(),
      tone: "info",
    },
  ]);

  const [missions, setMissions] = useState<MissionItem[]>([
    {
      id: "mission-onboarding",
      title: "Pack onboarding salarié",
      summary:
        "Préparation d’un email d’accueil, d’une checklist manager et d’un document RH prêt à validation.",
      status: "today",
      employees: ["Pierre"],
      risk: "medium",
      urgency: "important",
      nextAction: "Attendre validation du document RH avant envoi externe.",
      due: "Aujourd’hui · 18:30",
      trace: "Créée par CloneOS depuis le cockpit.",
    },
    {
      id: "mission-brief",
      title: "Briefing opérationnel du soir",
      summary:
        "Synthèse des missions avancées, validations restantes, blocages et priorités de demain.",
      status: "scheduled",
      employees: ["CloneOS"],
      risk: "low",
      urgency: "normal",
      nextAction: "Générer automatiquement le briefing à 22h.",
      due: "Ce soir · 22:00",
      trace: "Tâche récurrente pilotée par CloneOS.",
    },
    {
      id: "mission-sensitive",
      title: "Email sensible en pause",
      summary:
        "Un email préparé demande une approbation humaine avant reprise de l’exécution.",
      status: "waiting_validation",
      employees: ["Pierre", "CloneGuard"],
      risk: "high",
      urgency: "urgent",
      nextAction: "Approuver, refuser, modifier ou bloquer durablement.",
      due: "Action requise",
      trace: "Bloqué par CloneGuard.",
    },
  ]);

  const [validations, setValidations] = useState<ValidationItem[]>([
    {
      id: "validation-sensitive-email",
      title: "Autorisation d’envoi externe",
      description:
        "Pierre a préparé un email RH externe. CloneGuard bloque l’exécution tant qu’une validation humaine n’est pas donnée.",
      employee: "Pierre / CloneGuard",
      risk: "high",
      status: "pending",
      time: "Aujourd’hui · 17:24",
    },
    {
      id: "validation-rule",
      title: "Nouvelle règle à confirmer",
      description:
        "CloneOS propose d’ajouter une règle durable : tout document sensible passe en validation humaine.",
      employee: "CloneOS",
      risk: "medium",
      status: "pending",
      time: "Aujourd’hui · 16:50",
    },
  ]);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "message-validation",
      title: "Validation requise avant envoi",
      body:
        "Une action sensible est prête, mais CloneGuard demande une validation humaine avant reprise.",
      owner: "CloneGuard",
      source: "Contrôle",
      time: "Aujourd’hui · 17:24",
      tone: "critical",
      unread: true,
      categories: ["reception", "validation", "alertes", "suivis"],
      relatedEmployees: ["Pierre", "CloneOS"],
      summary:
        "Action sensible en pause. Le client doit approuver, refuser, modifier ou bloquer.",
    },
    {
      id: "message-preparation",
      title: "Mission RH longue en préparation",
      body:
        "Pierre prépare un pack onboarding avec documents, email, checklist et suivi.",
      owner: "Pierre",
      source: "Mission RH",
      time: "Aujourd’hui · 16:58",
      tone: "info",
      unread: true,
      categories: ["reception", "preparation", "suivis"],
      relatedEmployees: ["Pierre"],
      summary:
        "Travail en préparation. Le livrable passera ensuite en livraison puis en suivi.",
    },
    {
      id: "message-brief",
      title: "Briefing quotidien disponible",
      body:
        "CloneOS a généré un résumé des actions du jour, blocages et priorités.",
      owner: "CloneOS",
      source: "Briefing",
      time: "Aujourd’hui · 18:00",
      tone: "success",
      unread: false,
      categories: ["briefings", "suivis"],
      relatedEmployees: ["CloneOS"],
      summary:
        "Compte rendu autonome prêt. Peut être inséré dans le salon pour précision.",
    },
    {
      id: "message-delivery",
      title: "Document prêt à validation",
      body:
        "Un livrable est terminé. Il peut être relu, validé, exporté ou placé sous suivi.",
      owner: "CloneTrace",
      source: "Livrable",
      time: "Aujourd’hui · 17:02",
      tone: "info",
      unread: true,
      categories: ["livraisons", "envoyes", "suivis"],
      relatedEmployees: ["Pierre", "CloneTrace"],
      summary:
        "Document terminé, traçable, retrouvable et prêt pour décision.",
    },
  ]);

  const [selectedMessageId, setSelectedMessageId] = useState(
    messages[0]?.id ?? ""
  );
  const [activeMessageCategory, setActiveMessageCategory] = useState<
    MessageCategory | "all"
  >("all");

  const [salonMessages, setSalonMessages] = useState<SalonMessage[]>([
    {
      id: "salon-welcome",
      author: "CloneOS",
      role: "Orchestrateur central",
      body:
        "Salon CloneStore ouvert. Parlez naturellement : “Pierre, tu peux envoyer”, “non, stop”, “à 22h fais-moi un brief”, “ajoute cette règle”. CloneOS route, contrôle et trace.",
      time: nowLabel(),
      tone: "info",
    },
  ]);
  const [salonInput, setSalonInput] = useState("");

  const [rules, setRules] = useState<RuleItem[]>([
    {
      id: "rule-sensitive-human-validation",
      title: "Validation humaine sur actions sensibles",
      body:
        "Tout document sensible, email externe RH ou action à risque doit passer par CloneGuard avant exécution.",
      targetType: "global",
      target: "CloneStore",
      status: "active",
      sensitivity: "critical",
      createdFrom: "system",
      time: "Initial",
    },
    {
      id: "rule-evening-brief",
      title: "Briefing du soir",
      body:
        "CloneOS prépare un briefing opérationnel du soir avec blocages, livraisons, validations et priorités.",
      targetType: "technology",
      target: "CloneOS",
      status: "active",
      sensitivity: "normal",
      createdFrom: "cockpit",
      time: "Aujourd’hui",
    },
  ]);

  const [quickRuleText, setQuickRuleText] = useState("");
  const [quickRuleTargetType, setQuickRuleTargetType] =
    useState<RuleScope>("global");
  const [quickRuleTarget, setQuickRuleTarget] = useState("CloneStore");
  const [quickRuleSensitivity, setQuickRuleSensitivity] =
    useState<RuleSensitivity>("normal");

  const [traceItems, setTraceItems] = useState<TraceItem[]>([
    {
      id: "trace-validation",
      title: "Validation demandée",
      detail: "CloneGuard a mis une action sensible en pause.",
      actor: "CloneGuard",
      time: "17:24",
      tone: "warning",
    },
    {
      id: "trace-document",
      title: "Document livré",
      detail: "Un livrable a été marqué prêt à validation.",
      actor: "CloneTrace",
      time: "17:02",
      tone: "success",
    },
    {
      id: "trace-mission",
      title: "Mission créée",
      detail: "CloneOS a créé une mission RH longue.",
      actor: "CloneOS",
      time: "16:58",
      tone: "info",
    },
  ]);

  const [briefings] = useState<BriefingItem[]>([
    {
      id: "brief-day",
      title: "Briefing du jour",
      summary:
        "3 missions actives, 2 validations restantes, 1 action sensible en pause, aucun incident critique non traité.",
      period: "Aujourd’hui",
      blockers: 1,
      delivered: 2,
      validations: 2,
    },
    {
      id: "brief-evening",
      title: "Briefing du soir programmé",
      summary:
        "CloneOS préparera à 22h une synthèse de ce qui a avancé, ce qui bloque et ce qui doit être priorisé demain.",
      period: "Ce soir · 22:00",
      blockers: 0,
      delivered: 0,
      validations: 0,
    },
  ]);

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: "alert-sensitive",
      title: "Action sensible en pause",
      detail: "Une autorisation est requise avant reprise d’exécution.",
      tone: "critical",
      action: "Ouvrir validations",
    },
    {
      id: "alert-config",
      title: "Règles d’autonomie à contrôler",
      detail:
        "Vérifiez les règles actives avant de déléguer plus d’actions autonomes.",
      tone: "warning",
      action: "Configurer",
    },
  ]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      if (!supabase) {
        setError(
          "Configuration Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        setError(authError.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!authData.user) {
        setUserId(null);
        setUserEmail(null);
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setUserId(authData.user.id);
      setUserEmail(authData.user.email ?? null);

      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("id, agent_slug, status, started_at, ended_at")
        .eq("user_id", authData.user.id)
        .order("started_at", { ascending: false });

      if (ordersError) {
        setError(ordersError.message);
        setOrders([]);
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [supabase]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const ownedEmployees = useMemo(() => {
    const bySlug = new Map<string, OrderRow>();

    orders.forEach((order) => {
      const slug = order.agent_slug.toLowerCase();
      if (!bySlug.has(slug)) bySlug.set(slug, order);
    });

    return Array.from(bySlug.values());
  }, [orders]);

  const activeEmployees = useMemo(
    () => ownedEmployees.filter(isActiveOrder),
    [ownedEmployees]
  );

  const activeAgentMetas = useMemo(
    () =>
      ownedEmployees.map((order) =>
        getAgentMetaFromSlug(order.agent_slug, isActiveOrder(order), order.status)
      ),
    [ownedEmployees]
  );

  const activeOnlyAgentMetas = useMemo(
    () => activeAgentMetas.filter((agent) => agent.active),
    [activeAgentMetas]
  );

  const participantNames = useMemo(
    () => ["CloneOS", ...activeOnlyAgentMetas.map((agent) => agent.name)],
    [activeOnlyAgentMetas]
  );

  const unreadMessagesCount = useMemo(
    () => messages.filter((message) => message.unread).length,
    [messages]
  );

  const notificationsCount = useMemo(
    () =>
      alerts.filter(
        (alert) => alert.tone === "critical" || alert.tone === "warning"
      ).length +
      validations.filter((item) => item.status === "pending").length,
    [alerts, validations]
  );

  const selectedMessage = useMemo(
    () =>
      messages.find((message) => message.id === selectedMessageId) ??
      messages[0] ??
      null,
    [messages, selectedMessageId]
  );

  const filteredMessages = useMemo(() => {
    const query = normalizeText(searchQuery.trim());

    return messages.filter((message) => {
      const categoryOk =
        activeMessageCategory === "all" ||
        message.categories.includes(activeMessageCategory);

      if (!categoryOk) return false;
      if (!query) return true;

      return normalizeText(
        [
          message.title,
          message.body,
          message.owner,
          message.source,
          message.summary,
          message.relatedEmployees.join(" "),
          message.categories
            .map((category) => MESSAGE_CATEGORY_LABELS[category])
            .join(" "),
        ].join(" ")
      ).includes(query);
    });
  }, [activeMessageCategory, messages, searchQuery]);

  const filteredRules = useMemo(() => {
    const query = normalizeText(searchQuery.trim());
    if (!query) return rules;

    return rules.filter((rule) =>
      normalizeText(
        [rule.title, rule.body, rule.target, rule.targetType].join(" ")
      ).includes(query)
    );
  }, [rules, searchQuery]);

  const filteredMissions = useMemo(() => {
    const query = normalizeText(searchQuery.trim());
    if (!query) return missions;

    return missions.filter((mission) =>
      normalizeText(
        [
          mission.title,
          mission.summary,
          mission.employees.join(" "),
          mission.nextAction,
          mission.trace,
          mission.status,
        ].join(" ")
      ).includes(query)
    );
  }, [missions, searchQuery]);

  const technologies = useMemo<TechnologyItem[]>(
    () => [
      {
        id: "cloneos",
        name: "CloneOS",
        role: "Comprend, découpe, route, coordonne et réunit les résultats.",
        state: "active",
        lastEvent: "Dernière orchestration : mission RH longue.",
        rules: rules.filter(
          (rule) => rule.target === "CloneOS" || rule.target === "CloneStore"
        ).length,
      },
      {
        id: "cloneguard",
        name: "CloneGuard",
        role: "Contrôle les risques, validations, blocages et permissions.",
        state: validations.some((item) => item.status === "pending")
          ? "needs_attention"
          : "active",
        lastEvent: "Dernier blocage : action sensible avant envoi.",
        rules: rules.filter(
          (rule) => rule.target === "CloneGuard" || rule.target === "CloneStore"
        ).length,
      },
      {
        id: "clonetrace",
        name: "CloneTrace",
        role: "Historise les missions, décisions, livraisons et événements.",
        state: "active",
        lastEvent: "Dernière trace : document livré.",
        rules: rules.filter(
          (rule) => rule.target === "CloneTrace" || rule.target === "CloneStore"
        ).length,
      },
      {
        id: "cloneadn",
        name: "CloneADN",
        role: "Aligne le système avec les habitudes et règles de l’entreprise.",
        state: rules.length > 0 ? "active" : "watching",
        lastEvent: "Alignement actif sur les règles validées.",
        rules: rules.filter(
          (rule) => rule.target === "CloneADN" || rule.target === "CloneStore"
        ).length,
      },
      {
        id: "clonevoice",
        name: "CloneVoice",
        role: "Permet de commander CloneStore à la voix.",
        state: "watching",
        lastEvent: "Entrée vocale prête côté interface.",
        rules: rules.filter(
          (rule) => rule.target === "CloneVoice" || rule.target === "CloneStore"
        ).length,
      },
    ],
    [rules, validations]
  );

  const targetOptions = useMemo(
    () => [
      "CloneStore",
      "CloneOS",
      "CloneGuard",
      "CloneTrace",
      "CloneADN",
      "CloneVoice",
      ...activeOnlyAgentMetas.map((agent) => agent.name),
    ],
    [activeOnlyAgentMetas]
  );

  const overviewStats = useMemo(
    () => [
      {
        title: "Employés possédés",
        value: ownedEmployees.length,
        helper: "Reliés au compte.",
        icon: <Users2 className="h-5 w-5" />,
      },
      {
        title: "Employés actifs",
        value: activeEmployees.length,
        helper: "Mobilisables par CloneOS.",
        icon: <BadgeCheck className="h-5 w-5" />,
      },
      {
        title: "Missions",
        value: missions.length,
        helper: "Queue d’exécution.",
        icon: <GitBranch className="h-5 w-5" />,
      },
      {
        title: "Validations",
        value: validations.filter((item) => item.status === "pending").length,
        helper: "Décisions humaines.",
        icon: <ShieldCheck className="h-5 w-5" />,
      },
    ],
    [activeEmployees.length, missions.length, ownedEmployees.length, validations]
  );

  function detectRecipients(text: string) {
    const normalized = normalizeText(text);

    const asksAll =
      normalized.includes("tous mes employes") ||
      normalized.includes("tous les employes") ||
      normalized.includes("toute l equipe") ||
      normalized.includes("tous mes clones") ||
      normalized.includes("tous les clones");

    if (asksAll) return activeOnlyAgentMetas;

    const slugs = ROUTING_KEYWORDS.filter((rule) =>
      rule.keywords.some((keyword) =>
        normalized.includes(normalizeText(keyword))
      )
    ).map((rule) => rule.slug);

    const uniqueSlugs = Array.from(new Set(slugs));

    return activeOnlyAgentMetas.filter((agent) =>
      uniqueSlugs.includes(agent.slug)
    );
  }

  function buildPlan(text: string): CloneOsPlan {
    const recipients = detectRecipients(text);
    const normalized = normalizeText(text);

    const validationRequired =
      normalized.includes("envoie") ||
      normalized.includes("envoyer") ||
      normalized.includes("externe") ||
      normalized.includes("sensible") ||
      normalized.includes("contrat") ||
      normalized.includes("document");

    const risk: MissionRisk = validationRequired
      ? normalized.includes("sensible") || normalized.includes("contrat")
        ? "high"
        : "medium"
      : "low";

    const unavailable = ROUTING_KEYWORDS.filter((rule) =>
      rule.keywords.some((keyword) =>
        normalized.includes(normalizeText(keyword))
      )
    )
      .map((rule) => rule.slug)
      .filter(
        (slug) => !activeOnlyAgentMetas.some((agent) => agent.slug === slug)
      )
      .map((slug) => getAgentMetaFromSlug(slug).name);

    return {
      summary:
        recipients.length > 1
          ? "CloneOS a détecté une mission multi-employés. La demande est découpée en sous-missions, routée aux employés actifs, puis réunifiée."
          : recipients.length === 1
            ? `CloneOS a détecté ${recipients[0].name} comme employé principal.`
            : "CloneOS garde la mission en cadrage : aucun employé actif clairement mobilisable n’a été détecté.",
      employees: recipients,
      unavailable,
      tasks: [
        "Comprendre la demande libre.",
        "Identifier les employés IA requis.",
        "Vérifier les employés possédés et actifs.",
        "Créer les sous-missions spécialisées.",
        "Contrôler les risques avec CloneGuard.",
        "Tracer les décisions avec CloneTrace.",
        "Réunifier le résultat dans le cockpit.",
      ],
      risk,
      validationRequired,
      nextStatus: validationRequired
        ? "waiting_validation"
        : recipients.length > 0
          ? "today"
          : "now",
    };
  }

  function pushTrace(
    title: string,
    detail: string,
    actor: string,
    tone: NotificationTone
  ) {
    setTraceItems((previous) => [
      {
        id: `trace-${Date.now()}`,
        title,
        detail,
        actor,
        time: nowLabel(),
        tone,
      },
      ...previous,
    ]);
  }

  function insertToSalon(
    label: string,
    body: string,
    tone: NotificationTone = "info"
  ) {
    setSalonMessages((previous) => [
      ...previous,
      {
        id: `salon-insert-${Date.now()}`,
        author: "CloneOS",
        role: label,
        body,
        time: nowLabel(),
        tone,
      },
    ]);
  }

  function submitCommand() {
    const text = commandInput.trim();
    if (!text) return;

    const plan = buildPlan(text);

    setCommandHistory((previous) => [
      ...previous,
      {
        id: `command-user-${Date.now()}`,
        author: "Vous",
        role: "Direction",
        body: text,
        time: nowLabel(),
        mine: true,
      },
      {
        id: `command-plan-${Date.now()}`,
        author: "CloneOS",
        role: "Plan d’exécution",
        body: [
          plan.summary,
          "",
          `Employés mobilisés : ${
            plan.employees.length > 0
              ? plan.employees.map((employee) => employee.name).join(", ")
              : "aucun pour l’instant"
          }.`,
          plan.unavailable.length > 0
            ? `Employés requis mais non actifs : ${plan.unavailable.join(", ")}.`
            : null,
          `Risque : ${plan.risk}.`,
          plan.validationRequired
            ? "Validation humaine requise avant exécution sensible."
            : "Aucune validation sensible détectée à ce stade.",
          "",
          `Tâches créées : ${plan.tasks.join(" → ")}.`,
        ]
          .filter(Boolean)
          .join("\n"),
        time: nowLabel(),
        tone: getRiskTone(plan.risk),
      },
    ]);

    const mission: MissionItem = {
      id: `mission-${Date.now()}`,
      title: text.length > 88 ? `${text.slice(0, 88)}…` : text,
      summary: plan.summary,
      status: plan.nextStatus,
      employees:
        plan.employees.length > 0
          ? plan.employees.map((employee) => employee.name)
          : ["CloneOS"],
      risk: plan.risk,
      urgency:
        plan.risk === "high"
          ? "urgent"
          : plan.risk === "medium"
            ? "important"
            : "normal",
      nextAction: plan.validationRequired
        ? "Attendre une validation humaine avant reprise."
        : "Continuer le traitement et remonter le prochain statut.",
      due: plan.validationRequired ? "Action requise" : "Aujourd’hui",
      trace: "Mission créée depuis le centre de commandement CloneOS.",
    };

    setMissions((previous) => [mission, ...previous]);

    if (plan.validationRequired) {
      setValidations((previous) => [
        {
          id: `validation-${Date.now()}`,
          title: "Validation requise depuis le command center",
          description:
            "CloneOS a détecté une action potentiellement sensible. CloneGuard bloque l’exécution jusqu’à décision humaine.",
          employee:
            plan.employees.length > 0
              ? `${plan.employees.map((employee) => employee.name).join(", ")} / CloneGuard`
              : "CloneGuard",
          risk: plan.risk,
          status: "pending",
          time: nowLabel(),
        },
        ...previous,
      ]);
    }

    setMessages((previous) => [
      {
        id: `message-command-${Date.now()}`,
        title: plan.validationRequired
          ? "Mission créée avec validation"
          : "Mission créée",
        body: plan.summary,
        owner: "CloneOS",
        source: "Command center",
        time: nowLabel(),
        tone: getRiskTone(plan.risk),
        unread: true,
        categories: plan.validationRequired
          ? ["reception", "validation", "suivis"]
          : ["reception", "preparation", "suivis"],
        relatedEmployees:
          plan.employees.length > 0
            ? plan.employees.map((employee) => employee.name)
            : ["CloneOS"],
        summary: "Mission générée depuis la demande libre du cockpit principal.",
      },
      ...previous,
    ]);

    pushTrace(
      "Mission créée",
      "CloneOS a transformé une demande libre en mission structurée.",
      "CloneOS",
      "info"
    );

    setCommandInput("");
  }

  function addRuleFromText(
    body: string,
    source: RuleItem["createdFrom"] = "cockpit",
    target = quickRuleTarget
  ) {
    const cleanBody = body.trim();
    if (!cleanBody) return;

    const title =
      cleanBody.length > 62 ? `${cleanBody.slice(0, 62)}…` : cleanBody;

    const rule: RuleItem = {
      id: `rule-${Date.now()}`,
      title,
      body: cleanBody,
      targetType: quickRuleTargetType,
      target,
      status: "active",
      sensitivity: quickRuleSensitivity,
      createdFrom: source,
      time: nowLabel(),
    };

    setRules((previous) => [rule, ...previous]);

    pushTrace(
      "Règle ajoutée",
      `${target} reçoit une nouvelle règle : ${cleanBody}`,
      "CloneADN",
      "success"
    );

    setSalonMessages((previous) => [
      ...previous,
      {
        id: `salon-rule-${Date.now()}`,
        author: "CloneADN",
        role: "Mémoire et règles",
        body: `Règle enregistrée pour ${target} : ${cleanBody}`,
        time: nowLabel(),
        tone: "success",
      },
    ]);

    setQuickRuleText("");
  }

  function toggleRule(ruleId: string) {
    setRules((previous) =>
      previous.map((rule) =>
        rule.id === ruleId
          ? { ...rule, status: rule.status === "active" ? "paused" : "active" }
          : rule
      )
    );
  }

  function deleteRule(ruleId: string) {
    setRules((previous) => previous.filter((rule) => rule.id !== ruleId));
  }

  function updateValidation(id: string, status: ValidationStatus) {
    const target = validations.find((item) => item.id === id);
    if (!target) return;

    setValidations((previous) =>
      previous.map((item) => (item.id === id ? { ...item, status } : item))
    );

    const tone: NotificationTone =
      status === "approved"
        ? "success"
        : status === "blocked" || status === "refused"
          ? "critical"
          : "warning";

    setMessages((previous) => [
      {
        id: `message-validation-${Date.now()}`,
        title:
          status === "approved"
            ? "Validation approuvée"
            : status === "blocked"
              ? "Action bloquée"
              : status === "modified"
                ? "Modification demandée"
                : "Validation refusée",
        body: `${target.title} — décision : ${status}.`,
        owner: "CloneGuard",
        source: "Validation",
        time: nowLabel(),
        tone,
        unread: true,
        categories: ["reception", "validation", "suivis"],
        relatedEmployees: [target.employee],
        summary: "Décision humaine enregistrée dans CloneTrace.",
      },
      ...previous,
    ]);

    pushTrace(
      "Validation mise à jour",
      `${target.title} : ${status}.`,
      "CloneGuard",
      tone
    );
  }

  function selectMessage(id: string) {
    setSelectedMessageId(id);
    setMessages((previous) =>
      previous.map((message) =>
        message.id === id ? { ...message, unread: false } : message
      )
    );
  }

  function handleDragStart(event: DragEvent<HTMLElement>, messageId: string) {
    event.dataTransfer.setData("text/plain", messageId);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleSalonDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();

    const messageId = event.dataTransfer.getData("text/plain");
    const message = messages.find((item) => item.id === messageId);

    if (!message) return;

    insertToSalon(
      "Contexte glissé",
      [
        `Élément ajouté au salon : ${message.title}`,
        `Résumé : ${message.summary}`,
        `Catégories : ${message.categories
          .map((category) => MESSAGE_CATEGORY_LABELS[category])
          .join(", ")}`,
        "",
        "Vous pouvez répondre : oui, non, bloque, modifie, envoie, ajoute une règle, ou demande une alternative.",
      ].join("\n"),
      message.tone
    );
  }

  function sendSalonMessage() {
    const text = salonInput.trim();
    if (!text) return;

    const normalized = normalizeText(text);
    const recipients = detectRecipients(text);

    const isStop =
      normalized.includes("non") ||
      normalized.includes("stop") ||
      normalized.includes("bloque") ||
      normalized.includes("arrete") ||
      normalized.includes("arrête") ||
      normalized.includes("ne l envoie pas") ||
      normalized.includes("ne l'envoie pas");

    const isApproval =
      normalized.includes("oui") ||
      normalized.includes("tu peux") ||
      normalized.includes("envoyer") ||
      normalized.includes("valide") ||
      normalized.includes("reprend");

    const isRule =
      normalized.includes("regle") ||
      normalized.includes("règle") ||
      normalized.includes("desormais") ||
      normalized.includes("désormais") ||
      normalized.includes("a l avenir") ||
      normalized.includes("à l’avenir") ||
      normalized.includes("toujours");

    const isBrief =
      normalized.includes("brief") ||
      normalized.includes("resume") ||
      normalized.includes("résumé") ||
      normalized.includes("22h") ||
      normalized.includes("22 h");

    const userMessage: SalonMessage = {
      id: `salon-user-${Date.now()}`,
      author: "Vous",
      role: "Direction",
      body: text,
      time: nowLabel(),
      mine: true,
    };

    const responses: SalonMessage[] = [];

    if (isStop) {
      responses.push({
        id: `salon-stop-${Date.now()}`,
        author: "CloneOS",
        role: "Orchestrateur central",
        body:
          "Instruction comprise. L’action associée reste arrêtée ou bloquée. Aucune exécution sensible ne reprend sans validation claire.",
        time: nowLabel(),
        tone: "critical",
      });

      setAlerts((previous) => [
        {
          id: `alert-stop-${Date.now()}`,
          title: "Action bloquée depuis le salon",
          detail: "L’utilisateur a donné une instruction d’arrêt ou de blocage.",
          tone: "critical",
          action: "Voir salon",
        },
        ...previous,
      ]);

      pushTrace(
        "Action bloquée",
        "Instruction de blocage donnée dans le salon.",
        "CloneOS",
        "critical"
      );
    } else if (isRule) {
      const target = recipients[0]?.name ?? "CloneStore";

      responses.push({
        id: `salon-rule-response-${Date.now()}`,
        author: "CloneADN",
        role: "Règles et mémoire",
        body: `Règle comprise. Elle est enregistrée pour ${target} et restera visible dans la configuration rapide.`,
        time: nowLabel(),
        tone: "success",
      });

      const rule: RuleItem = {
        id: `rule-salon-${Date.now()}`,
        title: text.length > 62 ? `${text.slice(0, 62)}…` : text,
        body: text,
        targetType: recipients[0] ? "employee" : "global",
        target,
        status: "active",
        sensitivity:
          normalized.includes("sensible") || normalized.includes("validation")
            ? "sensitive"
            : "normal",
        createdFrom: "salon",
        time: nowLabel(),
      };

      setRules((previous) => [rule, ...previous]);
      pushTrace("Règle ajoutée depuis le salon", text, "CloneADN", "success");
    } else if (isBrief) {
      responses.push({
        id: `salon-brief-${Date.now()}`,
        author: recipients[0]?.name ?? "CloneOS",
        role: recipients[0]?.role ?? "Briefing automatisé",
        body:
          "C’est noté. CloneOS prépare la tâche de briefing avec horaire, contenu attendu, validations restantes, blocages et livraisons.",
        time: nowLabel(),
        tone: "success",
      });

      setMissions((previous) => [
        {
          id: `mission-brief-${Date.now()}`,
          title: "Briefing demandé depuis le salon",
          summary: text,
          status: "scheduled",
          employees: [recipients[0]?.name ?? "CloneOS"],
          risk: "low",
          urgency: "normal",
          nextAction: "Générer le briefing au moment demandé.",
          due: normalized.includes("22") ? "Ce soir · 22:00" : "Programmé",
          trace: "Créé depuis le Salon CloneStore.",
        },
        ...previous,
      ]);

      pushTrace("Briefing programmé", text, "CloneOS", "info");
    } else if (isApproval) {
      responses.push({
        id: `salon-approval-${Date.now()}`,
        author: recipients[0]?.name ?? "CloneOS",
        role: recipients[0]?.role ?? "Reprise d’exécution",
        body:
          "Validation reçue. CloneOS reprend la mission en pause si le contexte est clair et si CloneGuard ne détecte aucun blocage restant.",
        time: nowLabel(),
        tone: "success",
      });

      pushTrace(
        "Validation donnée",
        "Instruction de reprise donnée dans le salon.",
        "CloneOS",
        "success"
      );
    } else if (recipients.length > 0) {
      recipients.forEach((agent, index) => {
        responses.push({
          id: `salon-agent-${agent.slug}-${Date.now()}-${index}`,
          author: agent.name,
          role: agent.role,
          body:
            recipients.length > 1
              ? "CloneOS m’a transmis ma partie de la demande. Je traite uniquement mon périmètre, puis CloneOS réunira les réponses."
              : "CloneOS m’a transmis votre demande. Je traite mon périmètre avec traçabilité et validation humaine si nécessaire.",
          time: nowLabel(),
          tone: "info",
        });
      });

      pushTrace("Message routé", text, "CloneOS", "info");
    } else {
      responses.push({
        id: `salon-default-${Date.now()}`,
        author: "CloneOS",
        role: "Orchestrateur central",
        body:
          activeOnlyAgentMetas.length > 0
            ? "Demande reçue. Je peux la cadrer, détecter les employés nécessaires ou demander une précision avant distribution."
            : "Demande reçue. Aucun employé IA actif n’est détecté sur ce compte, donc je garde la demande au niveau CloneOS.",
        time: nowLabel(),
        tone: "info",
      });
    }

    setSalonMessages((previous) => [...previous, userMessage, ...responses]);
    setSalonInput("");
  }

  function configureTechnology(name: string) {
    setQuickRuleTargetType("technology");
    setQuickRuleTarget(name);
    setQuickRuleText(`${name} doit appliquer la règle suivante : `);

    document.getElementById("rules")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  if (loading) {
    return (
      <main className="cs-page">
        <div className="cs-page-shell">
          <section className="cs-panel p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--cs-violet)]" />
              <p className="text-sm font-medium text-[var(--cs-ink-3)]">
                Chargement du cockpit CloneStore…
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="cs-page">
        <div className="cs-page-shell">
          <section className="cs-command-surface">
            <div className="grid gap-8 xl:grid-cols-[1fr_0.72fr] xl:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="cs-pill">
                    <LayoutDashboard className="h-4 w-4 text-[var(--cs-violet)]" />
                    Cockpit CloneStore
                  </span>
                  <span className="cs-pill">
                    <Network className="h-4 w-4 text-[var(--cs-success)]" />
                    CloneOS
                  </span>
                </div>

                <h1 className="cs-display mt-6 max-w-4xl text-[clamp(2.35rem,5.4vw,5.7rem)] leading-[0.92]">
                  Connectez-vous pour piloter votre organisation IA.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--cs-ink-3)]">
                  Le cockpit réunit la commande CloneOS, les employés possédés,
                  les missions, validations, messages, règles, traces, briefings
                  et technologies visibles.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="clone-liquid-button clone-liquid-button--dark"
                  >
                    Connexion
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/signup" className="clone-liquid-button">
                    Créer un compte
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  title="Commande"
                  value="CloneOS"
                  helper="Une requête, plusieurs employés."
                  icon={<Command className="h-5 w-5" />}
                />
                <StatCard
                  title="Contrôle"
                  value="CloneGuard"
                  helper="Validations et blocages."
                  icon={<ShieldCheck className="h-5 w-5" />}
                />
                <StatCard
                  title="Trace"
                  value="CloneTrace"
                  helper="Historique et audit."
                  icon={<Inbox className="h-5 w-5" />}
                />
                <StatCard
                  title="Salon"
                  value="Vivant"
                  helper="Parlez au système entier."
                  icon={<MessageSquareQuote className="h-5 w-5" />}
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <div className="grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)]">
          <aside
            className={cn(
              "sticky top-24 hidden h-[calc(100vh-7rem)] shrink-0 overflow-hidden rounded-[2rem] border border-white/58 bg-white/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_24px_70px_rgba(38,32,22,0.08)] backdrop-blur-2xl transition-all xl:block",
              railOpen ? "w-[238px]" : "w-[70px]"
            )}
          >
            <div className="flex h-full flex-col gap-3">
              <button
                type="button"
                onClick={() => setRailOpen((previous) => !previous)}
                className={cn(
                  "flex min-h-11 items-center rounded-full border border-white/55 bg-white/34 text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] transition hover:bg-white/48",
                  railOpen ? "justify-between gap-3 px-3" : "justify-center"
                )}
              >
                {railOpen ? (
                  <>
                    <span className="text-xs font-bold">Navigation cockpit</span>
                    <PanelLeftClose className="h-4 w-4 text-[var(--cs-violet)]" />
                  </>
                ) : (
                  <PanelLeftOpen className="h-4 w-4 text-[var(--cs-violet)]" />
                )}
              </button>

              <div className="grid gap-2">
                <RailButton
                  open={railOpen}
                  label="Commande CloneOS"
                  icon={<Command className="h-4 w-4" />}
                  target="command"
                />
                <RailButton
                  open={railOpen}
                  label="Employés actifs"
                  icon={<Users2 className="h-4 w-4" />}
                  target="employees"
                />
                <RailButton
                  open={railOpen}
                  label="Missions"
                  icon={<GitBranch className="h-4 w-4" />}
                  target="missions"
                />
                <RailButton
                  open={railOpen}
                  label="Validations"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  target="validations"
                />
                <RailButton
                  open={railOpen}
                  label="Messagerie"
                  icon={<Mail className="h-4 w-4" />}
                  target="messages"
                />
                <RailButton
                  open={railOpen}
                  label="Salon"
                  icon={<MessageSquareQuote className="h-4 w-4" />}
                  target="salon"
                />
                <RailButton
                  open={railOpen}
                  label="Règles"
                  icon={<Settings2 className="h-4 w-4" />}
                  target="rules"
                />
                <RailButton
                  open={railOpen}
                  label="CloneTrace"
                  icon={<Inbox className="h-4 w-4" />}
                  target="trace"
                />
                <RailButton
                  open={railOpen}
                  label="Briefings"
                  icon={<MessageCircle className="h-4 w-4" />}
                  target="briefings"
                />
                <RailButton
                  open={railOpen}
                  label="Technologies"
                  icon={<Network className="h-4 w-4" />}
                  target="technologies"
                />
              </div>

              <div className="mt-auto grid gap-2">
                <Link
                  href="/profile"
                  className={cn(
                    "flex min-h-11 items-center rounded-full border border-white/55 bg-white/34 text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] hover:bg-white/48",
                    railOpen ? "justify-start gap-3 px-3" : "justify-center px-0"
                  )}
                >
                  <User2 className="h-4 w-4 text-[var(--cs-violet)]" />
                  {railOpen ? (
                    <span className="text-xs font-bold">Profil / réglages</span>
                  ) : null}
                </Link>

                <Link
                  href="/agents"
                  className={cn(
                    "flex min-h-11 items-center rounded-full border border-white/55 bg-white/34 text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] hover:bg-white/48",
                    railOpen ? "justify-start gap-3 px-3" : "justify-center px-0"
                  )}
                >
                  <BriefcaseBusiness className="h-4 w-4 text-[var(--cs-violet)]" />
                  {railOpen ? (
                    <span className="text-xs font-bold">Boutique</span>
                  ) : null}
                </Link>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <section className="cs-command-surface overflow-visible">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="cs-pill">
                        <LayoutDashboard className="h-4 w-4 text-[var(--cs-violet)]" />
                        Cockpit global
                      </span>
                      <span className="cs-pill">
                        <Network className="h-4 w-4 text-[var(--cs-violet)]" />
                        CloneOS actif
                      </span>
                      <span className="cs-pill">
                        <ShieldCheck className="h-4 w-4 text-[var(--cs-success)]" />
                        Employés possédés uniquement
                      </span>
                      {refreshing ? (
                        <span className="cs-pill">
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--cs-violet)]" />
                          Sync
                        </span>
                      ) : null}
                    </div>

                    <h1 className="mt-5 max-w-6xl text-[clamp(2.25rem,4.8vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.075em] text-[var(--cs-ink-1)]">
                      Pilotez votre système
                      <br />
                      <span className="cs-gradient-text">d’employés IA.</span>
                    </h1>

                    <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--cs-ink-3)]">
                      Parlez à CloneOS, supervisez les employés possédés, validez
                      les actions sensibles, suivez les missions, configurez les
                      règles, lisez les messages et retrouvez toute la trace
                      d’exécution.
                    </p>
                  </div>

                  <div className="relative flex items-start justify-end">
                    <div className="flex items-center gap-2">
                      <TopCircleButton
                        label="Recherche"
                        icon={
                          searchOpen ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )
                        }
                        active={searchOpen}
                        onClick={() => setSearchOpen((previous) => !previous)}
                      />

                      <TopCircleButton
                        label="Messagerie"
                        icon={<Mail className="h-4 w-4" />}
                        count={unreadMessagesCount}
                        href="/profile/messages"
                      />

                      <TopCircleButton
                        label="Notifications"
                        icon={<Bell className="h-4 w-4" />}
                        count={notificationsCount}
                        small
                        active={notificationsOpen}
                        onClick={() =>
                          setNotificationsOpen((previous) => !previous)
                        }
                        style={getToneStyle(
                          alerts.some((alert) => alert.tone === "critical")
                            ? "critical"
                            : notificationsCount > 0
                              ? "warning"
                              : "info"
                        )}
                      />

                      <Link
                        href="/profile"
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/55 bg-white/38 text-sm font-bold text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl"
                      >
                        {getInitials(userEmail)}
                      </Link>
                    </div>

                    {notificationsOpen ? (
                      <div className="absolute right-0 top-[3.7rem] z-20 w-[min(440px,92vw)] rounded-[1.6rem] border border-white/60 bg-white/62 p-4 shadow-[0_24px_70px_rgba(24,28,36,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                              Notifications cockpit
                            </p>
                            <p className="mt-1 text-xs text-[var(--cs-ink-4)]">
                              Alertes, validations, risques et points critiques.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setNotificationsOpen(false)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-white/38 text-[var(--cs-ink-2)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                          {[
                            ...alerts,
                            ...validations
                              .filter((item) => item.status === "pending")
                              .map<AlertItem>((item) => ({
                                id: `validation-alert-${item.id}`,
                                title: item.title,
                                detail: item.description,
                                tone: getRiskTone(item.risk),
                                action: "Valider",
                              })),
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                document
                                  .getElementById("validations")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                                setNotificationsOpen(false);
                              }}
                              className="w-full rounded-[1.25rem] border border-white/50 bg-white/34 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                                  style={getToneStyle(item.tone)}
                                >
                                  {toneIcon(item.tone)}
                                </div>

                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                                    {item.title}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-3)]">
                                    {item.detail}
                                  </p>
                                  <p className="mt-2 text-[0.68rem] font-semibold text-[var(--cs-ink-4)]">
                                    {item.action}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {searchOpen ? (
                  <div className="flex min-h-12 items-center gap-3 rounded-[1.45rem] border border-white/55 bg-white/34 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                    <Search className="h-4 w-4 shrink-0 text-[var(--cs-violet)]" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Recherche universelle : mission, employé, document, email, validation, trace, règle, briefing…"
                      className="w-full border-0 bg-transparent text-sm font-medium text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-4">
                  {overviewStats.map((item) => (
                    <StatCard
                      key={item.title}
                      title={item.title}
                      value={item.value}
                      helper={item.helper}
                      icon={item.icon}
                    />
                  ))}
                </div>
              </div>

              {error ? (
                <div className="mt-5">
                  <ErrorBanner message={error} />
                </div>
              ) : null}
            </section>

            <section
              id="command"
              className="cs-command-surface scroll-mt-24 overflow-hidden p-0"
            >
              <div className="border-b border-white/40 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="cs-eyebrow">Centre de commandement CloneOS</p>
                    <h2 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                      Parlez au système entier, pas à un seul agent.
                    </h2>
                    <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--cs-ink-3)]">
                      Une requête libre peut devenir une mission simple, une mission
                      multi-employés, une règle, une validation, un briefing ou une
                      action programmée.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="cs-pill">
                      <Mic className="h-4 w-4 text-[var(--cs-violet)]" />
                      CloneVoice prêt
                    </span>
                    <span className="cs-pill">
                      <FileText className="h-4 w-4 text-[var(--cs-violet)]" />
                      Fichiers prêts
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[560px] grid-rows-[minmax(0,1fr)_auto]">
                <div className="max-h-[440px] space-y-3 overflow-y-auto p-5">
                  {commandHistory.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.mine ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[980px] whitespace-pre-line rounded-[1.55rem] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl",
                          message.mine
                            ? "border-[rgba(30,34,44,0.14)] bg-[linear-gradient(135deg,#171b25,#303747_62%,var(--cs-violet))] text-white"
                            : "border-white/55 bg-white/38 text-[var(--cs-ink-1)]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-bold uppercase tracking-[0.14em] opacity-75">
                            {message.author} · {message.role}
                          </span>
                          <span className="text-xs font-semibold opacity-45">
                            {message.time}
                          </span>
                        </div>

                        <p
                          className={cn(
                            "mt-2 text-sm leading-7",
                            message.mine
                              ? "text-white/90"
                              : "text-[var(--cs-ink-3)]"
                          )}
                        >
                          {message.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/40 px-4 pb-4 pt-3">
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {[
                      "Prépare un mail RH et fais-le valider avant envoi.",
                      "Pierre, prépare les documents d’onboarding pour demain.",
                      "À 22h, envoie-moi un briefing complet.",
                      "Ajoute la règle : tout document sensible passe en validation humaine.",
                      "Dis-moi ce qui est bloqué aujourd’hui.",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setCommandInput(suggestion)}
                        className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-white/55 bg-white/36 px-3 text-xs font-semibold text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl transition hover:bg-white/52"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-end gap-2 rounded-[1.7rem] border border-white/60 bg-white/34 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_18px_52px_rgba(38,32,22,0.07)] backdrop-blur-xl">
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-white/38 text-[var(--cs-ink-3)]"
                      aria-label="Micro"
                    >
                      <Mic className="h-4 w-4" />
                    </button>

                    <textarea
                      value={commandInput}
                      onChange={(event) => setCommandInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          submitCommand();
                        }
                      }}
                      placeholder="Demandez une mission à CloneOS : action, validation, règle, briefing, programmation, blocage…"
                      rows={1}
                      className="max-h-32 min-h-11 resize-none border-0 bg-transparent px-2 py-3 text-sm font-medium leading-5 text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
                    />

                    <button
                      type="button"
                      className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-white/38 text-[var(--cs-ink-3)] sm:flex"
                      aria-label="Actions"
                    >
                      <WandSparkles className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={submitCommand}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(30,34,44,0.14)] bg-[linear-gradient(135deg,#171b25,#303747_62%,var(--cs-violet))] text-white shadow-[0_16px_42px_rgba(45,56,128,0.2),inset_0_1px_0_rgba(255,255,255,0.22)]"
                      aria-label="Envoyer"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section id="employees" className="cs-panel scroll-mt-24 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="cs-eyebrow">Mes employés IA</p>
                  <h2 className="mt-3 text-[1.75rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                    Force de travail possédée par ce compte.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                    CloneOS ne mobilise que les employés IA actifs du client.
                    Chaque carte donne accès au cockpit, à la configuration, aux
                    règles, permissions et autonomie.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/agents" className="clone-liquid-button">
                    Boutique
                  </Link>
                  <Link
                    href="/profile"
                    className="clone-liquid-button clone-liquid-button--dark"
                  >
                    Réglages globaux
                  </Link>
                </div>
              </div>

              {activeAgentMetas.length === 0 ? (
                <div className="mt-5 rounded-[1.7rem] border border-white/55 bg-white/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                  <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                    Aucun employé IA détecté sur ce compte.
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">
                    Le cockpit reste disponible au niveau CloneOS, mais la force
                    de travail prendra toute sa valeur dès qu’un employé IA sera
                    actif.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {activeAgentMetas.map((employee) => (
                    <EmployeeCard
                      key={employee.slug}
                      employee={employee}
                      missions={
                        missions.filter((mission) =>
                          mission.employees.includes(employee.name)
                        ).length
                      }
                      validations={
                        validations.filter((validation) =>
                          normalizeText(validation.employee).includes(
                            normalizeText(employee.name)
                          )
                        ).length
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section id="missions" className="cs-panel scroll-mt-24 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="cs-eyebrow">Board missions / exécution</p>
                  <h2 className="mt-3 text-[1.75rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                    File de travail vivante.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                    Le board montre ce qui est immédiat, prévu, programmé, en
                    attente, bloqué ou livré récemment.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
                {MISSION_COLUMNS.map((column) => {
                  const columnMissions = filteredMissions.filter(
                    (mission) => mission.status === column.status
                  );

                  return (
                    <div
                      key={column.status}
                      className="rounded-[1.55rem] border border-white/55 bg-white/22 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.66)] backdrop-blur-xl"
                    >
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                          {column.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-4)]">
                          {column.helper}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        {columnMissions.length > 0 ? (
                          columnMissions.map((mission) => (
                            <MissionCard
                              key={mission.id}
                              mission={mission}
                              onInsert={() =>
                                insertToSalon(
                                  "Mission insérée",
                                  `${mission.title}\n${mission.summary}\nProchaine action : ${mission.nextAction}`,
                                  getRiskTone(mission.risk)
                                )
                              }
                            />
                          ))
                        ) : (
                          <div className="rounded-[1.25rem] border border-white/50 bg-white/28 p-4 text-xs leading-5 text-[var(--cs-ink-4)]">
                            Aucun élément.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              id="validations"
              className="grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"
            >
              <section className="cs-panel p-5">
                <div>
                  <p className="cs-eyebrow">CloneGuard</p>
                  <h2 className="mt-3 text-[1.75rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                    Validations, blocages et arbitrages.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                    Chaque action sensible peut être approuvée, refusée, modifiée,
                    reportée, bloquée durablement ou transformée en règle.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {validations.map((item) => (
                    <ValidationCard
                      key={item.id}
                      item={item}
                      onUpdate={(status) => updateValidation(item.id, status)}
                      onInsert={() =>
                        insertToSalon(
                          "Validation insérée",
                          `${item.title}\n${item.description}`,
                          getRiskTone(item.risk)
                        )
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="cs-panel p-5">
                <p className="cs-eyebrow">Alertes critiques</p>
                <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
                  Points qui exigent attention.
                </h2>

                <div className="mt-5 grid gap-3">
                  {alerts.map((alert) => (
                    <article
                      key={alert.id}
                      className="rounded-[1.35rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                          style={getToneStyle(alert.tone)}
                        >
                          {toneIcon(alert.tone)}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            {alert.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                            {alert.detail}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .getElementById("validations")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                            }
                            className="mt-3 text-xs font-bold text-[var(--clone-accent)]"
                          >
                            {alert.action}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section
              id="messages"
              className="grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(360px,0.75fr)_minmax(0,1fr)]"
            >
              <section className="cs-panel overflow-hidden p-0">
                <div className="border-b border-white/40 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="cs-eyebrow">Messagerie structurée</p>
                      <h2 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
                        Flux opérationnel.
                      </h2>
                    </div>

                    <Link
                      href="/profile/messages"
                      className="clone-liquid-button min-h-10 px-4"
                    >
                      Ouvrir page complète
                    </Link>
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {(
                      [
                        "all",
                        "reception",
                        "validation",
                        "preparation",
                        "briefings",
                        "livraisons",
                        "alertes",
                        "envoyes",
                      ] as const
                    ).map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveMessageCategory(category)}
                        className={cn(
                          "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
                          activeMessageCategory === category
                            ? "border-[var(--clone-accent-border)] bg-[var(--clone-accent-soft)] text-[var(--clone-accent)]"
                            : "border-white/55 bg-white/34 text-[var(--cs-ink-2)] hover:bg-white/52"
                        )}
                      >
                        {category === "all"
                          ? "Tous"
                          : MESSAGE_CATEGORY_LABELS[category]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[560px] min-h-[460px] space-y-3 overflow-y-auto p-4">
                  {filteredMessages.map((message) => (
                    <MessageCard
                      key={message.id}
                      item={message}
                      onSelect={() => selectMessage(message.id)}
                      onDragStart={(event) =>
                        handleDragStart(event, message.id)
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="cs-panel overflow-hidden p-0">
                {selectedMessage ? (
                  <>
                    <div className="border-b border-white/40 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
                            style={getToneStyle(selectedMessage.tone)}
                          >
                            {toneIcon(selectedMessage.tone)}
                          </div>

                          <div>
                            <h2 className="text-[1.45rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                              {selectedMessage.title}
                            </h2>
                            <p className="mt-2 text-xs text-[var(--cs-ink-4)]">
                              {selectedMessage.owner} · {selectedMessage.source} ·{" "}
                              {selectedMessage.time}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            insertToSalon(
                              "Message inséré",
                              `${selectedMessage.title}\n${selectedMessage.summary}`,
                              selectedMessage.tone
                            )
                          }
                          className="clone-liquid-button clone-liquid-button--dark min-h-10 px-4"
                        >
                          Insérer salon
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 p-5">
                      <article className="rounded-[1.45rem] border border-white/55 bg-white/28 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
                        <p className="text-[0.72rem] font-bold uppercase tracking-[0.15em] text-[var(--cs-ink-4)]">
                          Contenu
                        </p>
                        <p className="mt-3 text-sm leading-8 text-[var(--cs-ink-3)]">
                          {selectedMessage.body}
                        </p>
                      </article>

                      <article className="rounded-[1.45rem] border border-white/55 bg-white/28 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                          <Layers3 className="h-4 w-4 text-[var(--cs-violet)]" />
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            Classement
                          </p>
                        </div>

                        <p className="mt-3 text-sm leading-7 text-[var(--cs-ink-3)]">
                          {selectedMessage.summary}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedMessage.categories.map((category) => (
                            <span
                              key={`${selectedMessage.id}-${category}`}
                              className="rounded-full border border-white/55 bg-white/42 px-3 py-1.5 text-xs font-semibold text-[var(--cs-ink-2)]"
                            >
                              {MESSAGE_CATEGORY_LABELS[category]}
                            </span>
                          ))}
                        </div>
                      </article>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="clone-liquid-button min-h-10 px-4"
                          onClick={() =>
                            insertToSalon(
                              "Demande d’examen",
                              `Examine cet élément : ${selectedMessage.title}`,
                              selectedMessage.tone
                            )
                          }
                        >
                          Examiner
                        </button>
                        <button
                          type="button"
                          className="clone-liquid-button min-h-10 px-4"
                          onClick={() =>
                            insertToSalon(
                              "Alternative demandée",
                              `Propose une alternative pour : ${selectedMessage.title}`,
                              "info"
                            )
                          }
                        >
                          Alternative
                        </button>
                        <button
                          type="button"
                          className="clone-liquid-button min-h-10 px-4"
                          onClick={() =>
                            addRuleFromText(
                              `Règle issue du message "${selectedMessage.title}" : à formaliser.`,
                              "cockpit",
                              selectedMessage.relatedEmployees[0] ?? "CloneStore"
                            )
                          }
                        >
                          Transformer en règle
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-5 text-sm text-[var(--cs-ink-3)]">
                    Aucun message sélectionné.
                  </div>
                )}
              </section>
            </section>

            <section
              id="salon"
              className="cs-panel scroll-mt-24 overflow-hidden p-0"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleSalonDrop}
            >
              <div className="relative overflow-hidden border-b border-white/40 px-6 py-5">
                <div
                  className="pointer-events-none absolute inset-0 opacity-80"
                  aria-hidden="true"
                  style={{
                    background:
                      "radial-gradient(circle at 14% 20%, rgba(102,124,255,0.10), transparent 30%), radial-gradient(circle at 86% 18%, rgba(216,193,152,0.18), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.08))",
                  }}
                />

                <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="cs-pill">
                        <MessageSquareQuote className="h-4 w-4 text-[var(--cs-violet)]" />
                        Salon CloneStore
                      </span>
                      <span className="cs-pill">
                        <Sparkles className="h-4 w-4 text-[var(--cs-success)]" />
                        Groupe de travail orchestré
                      </span>
                    </div>

                    <h2 className="mt-4 text-[1.62rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                      Discutez avec CloneOS et vos employés actifs.
                    </h2>

                    <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--cs-ink-3)]">
                      Écrivez, parlez, glissez une fiche, validez, refusez,
                      corrigez, créez une règle ou programmez une demande. CloneOS
                      comprend et route uniquement aux employés disponibles.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    {participantNames.map((name) => (
                      <span
                        key={`participant-${name}`}
                        className="rounded-full border border-white/55 bg-white/44 px-3 py-1.5 text-xs font-semibold text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.66)]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-h-[700px] grid-rows-[minmax(0,1fr)_auto]">
                  <div
                    className="relative max-h-[590px] min-h-[590px] overflow-y-auto px-4 py-5 sm:px-6"
                    style={{
                      background:
                        "radial-gradient(circle at 18% 8%, rgba(255,255,255,0.62), transparent 30%), radial-gradient(circle at 82% 20%, rgba(102,124,255,0.055), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.08))",
                    }}
                  >
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                      {salonMessages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex w-full",
                            message.mine ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "group flex max-w-[min(760px,88%)] items-end gap-2",
                              message.mine ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            {!message.mine ? (
                              <div
                                className="mb-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/48 text-[var(--cs-violet)] shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_12px_26px_rgba(38,32,22,0.06)] backdrop-blur-xl sm:flex"
                                style={
                                  message.tone
                                    ? getToneStyle(message.tone)
                                    : undefined
                                }
                              >
                                {message.author === "CloneOS" ? (
                                  <Bot className="h-4 w-4" />
                                ) : (
                                  <User2 className="h-4 w-4" />
                                )}
                              </div>
                            ) : null}

                            <div
                              className={cn(
                                "relative rounded-[1.55rem] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_38px_rgba(38,32,22,0.06)] backdrop-blur-2xl",
                                message.mine
                                  ? "rounded-br-[0.55rem] border-[rgba(30,34,44,0.16)] bg-[linear-gradient(135deg,#171b25,#303747_58%,var(--cs-violet))] text-white"
                                  : "rounded-bl-[0.55rem] border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(255,255,255,0.36))]"
                              )}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-[0.72rem] font-bold uppercase tracking-[0.13em]",
                                      message.mine
                                        ? "text-white/74"
                                        : "text-[var(--cs-ink-4)]"
                                    )}
                                  >
                                    {message.author}
                                  </span>

                                  <span
                                    className={cn(
                                      "max-w-[220px] truncate text-[0.72rem] font-medium",
                                      message.mine
                                        ? "text-white/56"
                                        : "text-[var(--cs-ink-4)]"
                                    )}
                                  >
                                    {message.role}
                                  </span>
                                </div>

                                <span
                                  className={cn(
                                    "text-[0.7rem] font-semibold",
                                    message.mine
                                      ? "text-white/44"
                                      : "text-[var(--cs-ink-4)]"
                                  )}
                                >
                                  {message.time}
                                </span>
                              </div>

                              <p
                                className={cn(
                                  "mt-2 whitespace-pre-line text-[0.92rem] leading-7",
                                  message.mine
                                    ? "text-white/92"
                                    : "text-[var(--cs-ink-3)]"
                                )}
                              >
                                {message.body}
                              </p>

                              {message.mine ? (
                                <div className="mt-2 flex justify-end text-white/52">
                                  <CheckCheck className="h-3.5 w-3.5" />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/40 px-4 pb-5 pt-4 sm:px-6">
                    <div className="mx-auto w-full max-w-5xl">
                      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                        {[
                          "Pierre, tu peux envoyer.",
                          "Non, bloque cette action.",
                          "Dis CloneStore, ce soir à 22h précise, fais-moi un brief.",
                          "Ajoute la règle : toujours valider avant envoi externe.",
                          "Route ça à Sophie plutôt qu’à Pierre.",
                        ].map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => setSalonInput(example)}
                            className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-white/55 bg-white/40 px-3 text-xs font-semibold text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl transition hover:bg-white/56"
                          >
                            {example}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-[2rem] border border-white/64 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.34))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_24px_74px_rgba(38,32,22,0.10)] backdrop-blur-2xl">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2">
                          <button
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/58 bg-white/46 text-[var(--cs-ink-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                            aria-label="Micro"
                          >
                            <Mic className="h-4 w-4" />
                          </button>

                          <textarea
                            value={salonInput}
                            onChange={(event) => setSalonInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                sendSalonMessage();
                              }
                            }}
                            placeholder="Écrivez à CloneStore… Ex. “Pierre, tu peux envoyer.” / “Non, stop.” / “À 22h, fais-moi un brief.”"
                            rows={2}
                            className="max-h-44 min-h-[3.4rem] resize-none border-0 bg-transparent px-2 py-3 text-[0.94rem] leading-6 text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
                          />

                          <button
                            type="button"
                            onClick={sendSalonMessage}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(30,34,44,0.14)] bg-[linear-gradient(135deg,#171b25,#303747_62%,var(--cs-violet))] text-white shadow-[0_16px_42px_rgba(45,56,128,0.2),inset_0_1px_0_rgba(255,255,255,0.22)]"
                            aria-label="Envoyer"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/55 bg-white/44 px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--cs-ink-3)]">
                            <FileText className="h-3.5 w-3.5" />
                            Glissez une fiche ici
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full border border-white/55 bg-white/44 px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--cs-ink-3)]">
                            <Volume2 className="h-3.5 w-3.5" />
                            CloneVoice prêt
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full border border-white/55 bg-white/44 px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--cs-ink-3)]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            CloneOS contrôle les accès
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-white/40 xl:border-l xl:border-t-0">
                  <div className="grid gap-4 p-5">
                    <div className="rounded-[1.45rem] border border-white/55 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/42 text-[var(--cs-violet)]">
                          <Bot className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            Logique du salon
                          </p>
                          <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">
                            Vous parlez à CloneStore. CloneOS comprend, route,
                            bloque, reprend ou transforme vos messages en règles.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.45rem] border border-white/55 bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl">
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        Participants actifs
                      </p>

                      <div className="mt-3 grid gap-2">
                        {participantNames.map((name) => (
                          <div
                            key={`salon-participant-${name}`}
                            className="rounded-[1rem] border border-white/55 bg-white/46 px-3 py-2.5"
                          >
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--cs-ink-4)]">
                              {name}
                            </p>
                            <p className="mt-1 text-sm text-[var(--cs-ink-3)]">
                              {name === "CloneOS"
                                ? "Orchestrateur central"
                                : activeOnlyAgentMetas.find(
                                    (agent) => agent.name === name
                                  )?.role}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>

            <section
              id="rules"
              className="grid scroll-mt-24 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]"
            >
              <section className="cs-panel p-5">
                <p className="cs-eyebrow">Configuration rapide</p>
                <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                  Règles, autonomie et permissions.
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">
                  Créez une règle globale, une règle employé ou une règle
                  technologie sans quitter le cockpit.
                </p>

                <div className="mt-5 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                      Cible
                    </span>
                    <select
                      value={quickRuleTargetType}
                      onChange={(event) => {
                        const value = event.target.value as RuleScope;
                        setQuickRuleTargetType(value);
                        if (value === "global") setQuickRuleTarget("CloneStore");
                        if (value === "technology") setQuickRuleTarget("CloneOS");
                        if (value === "employee") {
                          setQuickRuleTarget(
                            activeOnlyAgentMetas[0]?.name ?? "CloneStore"
                          );
                        }
                      }}
                      className="min-h-11 rounded-[1.1rem] border border-white/55 bg-white/36 px-3 text-sm text-[var(--cs-ink-1)] outline-none backdrop-blur-xl"
                    >
                      <option value="global">Globale CloneStore</option>
                      <option value="technology">Technologie</option>
                      <option value="employee">Employé IA</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                      Nom de la cible
                    </span>
                    <select
                      value={quickRuleTarget}
                      onChange={(event) => setQuickRuleTarget(event.target.value)}
                      className="min-h-11 rounded-[1.1rem] border border-white/55 bg-white/36 px-3 text-sm text-[var(--cs-ink-1)] outline-none backdrop-blur-xl"
                    >
                      {targetOptions.map((target) => (
                        <option key={target} value={target}>
                          {target}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                      Sensibilité
                    </span>
                    <select
                      value={quickRuleSensitivity}
                      onChange={(event) =>
                        setQuickRuleSensitivity(
                          event.target.value as RuleSensitivity
                        )
                      }
                      className="min-h-11 rounded-[1.1rem] border border-white/55 bg-white/36 px-3 text-sm text-[var(--cs-ink-1)] outline-none backdrop-blur-xl"
                    >
                      <option value="normal">Normale</option>
                      <option value="sensitive">Sensible</option>
                      <option value="critical">Critique</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                      Règle
                    </span>
                    <textarea
                      value={quickRuleText}
                      onChange={(event) => setQuickRuleText(event.target.value)}
                      rows={4}
                      placeholder="Ex. Pierre doit toujours demander validation avant envoi externe."
                      className="resize-none rounded-[1.2rem] border border-white/55 bg-white/36 px-3 py-3 text-sm leading-6 text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)] backdrop-blur-xl"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => addRuleFromText(quickRuleText)}
                    className="clone-liquid-button clone-liquid-button--dark min-h-11 px-5"
                  >
                    Ajouter la règle
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <section className="cs-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="cs-eyebrow">Règles actives</p>
                    <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                      Configuration vivante.
                    </h2>
                  </div>

                  <span className="cs-pill">
                    <Settings2 className="h-4 w-4 text-[var(--cs-violet)]" />
                    {rules.filter((rule) => rule.status === "active").length}{" "}
                    actives
                  </span>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {filteredRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onToggle={() => toggleRule(rule.id)}
                      onDelete={() => deleteRule(rule.id)}
                    />
                  ))}
                </div>
              </section>
            </section>

            <section
              id="trace"
              className="grid scroll-mt-24 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]"
            >
              <section className="cs-panel p-5">
                <p className="cs-eyebrow">CloneTrace</p>
                <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                  Timeline de traçabilité.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                  Le client doit comprendre qui a fait quoi, quand, pourquoi,
                  avec quel statut et quel résultat.
                </p>

                <div className="mt-5 grid gap-3">
                  {traceItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[1.35rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                          style={getToneStyle(item.tone)}
                        >
                          {toneIcon(item.tone)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                              {item.title}
                            </p>
                            <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                              {item.actor} · {item.time}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section id="briefings" className="cs-panel scroll-mt-24 p-5">
                <p className="cs-eyebrow">Briefings</p>
                <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
                  Résumés intelligents.
                </h2>

                <div className="mt-5 grid gap-3">
                  {briefings.map((briefing) => (
                    <article
                      key={briefing.id}
                      className="rounded-[1.35rem] border border-white/55 bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl"
                    >
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        {briefing.title}
                      </p>
                      <p className="mt-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        {briefing.period}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-[var(--cs-ink-3)]">
                        {briefing.summary}
                      </p>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-[1rem] border border-white/55 bg-white/36 p-2 text-center">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            {briefing.blockers}
                          </p>
                          <p className="text-[0.66rem] font-bold text-[var(--cs-ink-4)]">
                            Blocages
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-white/55 bg-white/36 p-2 text-center">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            {briefing.delivered}
                          </p>
                          <p className="text-[0.66rem] font-bold text-[var(--cs-ink-4)]">
                            Livrés
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-white/55 bg-white/36 p-2 text-center">
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            {briefing.validations}
                          </p>
                          <p className="text-[0.66rem] font-bold text-[var(--cs-ink-4)]">
                            Validations
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section id="technologies" className="cs-panel scroll-mt-24 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="cs-eyebrow">Technologies visibles</p>
                  <h2 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.055em] text-[var(--cs-ink-1)]">
                    Couches vivantes du système.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                    Elles ne sont pas décoratives : elles affichent un état, un
                    rôle, une activité récente et peuvent recevoir des règles.
                  </p>
                </div>

                <Link
                  href="/profile"
                  className="clone-liquid-button clone-liquid-button--dark"
                >
                  Réglages profonds
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
                {technologies.map((technology) => (
                  <TechnologyCard
                    key={technology.id}
                    item={technology}
                    onConfigure={() => configureTechnology(technology.name)}
                  />
                ))}
              </div>
            </section>

            <section className="cs-panel p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="cs-eyebrow">Accès rapides</p>
                  <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.05em] text-[var(--cs-ink-1)]">
                    Naviguer sans casser le flux de travail.
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/profile/messages" className="clone-liquid-button">
                    Messagerie complète
                  </Link>
                  <Link href="/profile" className="clone-liquid-button">
                    Mon espace
                  </Link>
                  <Link href="/agents" className="clone-liquid-button">
                    Boutique
                  </Link>
                  <Link href="/questions" className="clone-liquid-button">
                    Support
                  </Link>
                  <button
                    type="button"
                    onClick={() => void load(true)}
                    className="clone-liquid-button clone-liquid-button--dark"
                  >
                    Rafraîchir
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
