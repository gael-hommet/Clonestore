"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Filter,
  Inbox,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  PackageCheck,
  Pin,
  PinOff,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  User2,
  Waypoints,
  X,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
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

type MessageCategory =
  | "preparations"
  | "suivis"
  | "briefings"
  | "livraisons"
  | "alertes"
  | "envoyes";

type MessagePriority = "normal" | "important" | "critical";

type MessageStatus =
  | "new"
  | "in_progress"
  | "waiting_validation"
  | "delivered"
  | "sent"
  | "archived";

type MessageSource =
  | "CloneOS"
  | "CloneTrace"
  | "CloneGuard"
  | "CloneChat"
  | "Pierre"
  | "Clara"
  | "Emma"
  | "Alex"
  | "Noah"
  | "Adrien"
  | "Lucas"
  | "Sophie";

type MessageItem = {
  id: string;
  title: string;
  summary: string;
  body: string;
  source: MessageSource;
  categories: MessageCategory[];
  priority: MessagePriority;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  employees: string[];
  tags: string[];
  deliverables?: string[];
  actions: Array<{
    label: string;
    tone: "primary" | "neutral" | "danger";
  }>;
};

type CategoryDefinition = {
  key: MessageCategory;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STORAGE_KEYS = {
  read: "clonestore.messages.read.v1",
  pinned: "clonestore.messages.pinned.v1",
  archived: "clonestore.messages.archived.v1",
};

const categories: CategoryDefinition[] = [
  {
    key: "preparations",
    label: "Préparations",
    shortLabel: "Prépa",
    eyebrow: "En construction",
    description:
      "Tâches longues en préparation, brouillons, analyses en cours, missions pas encore livrées.",
    icon: Clock3,
  },
  {
    key: "suivis",
    label: "Suivis",
    shortLabel: "Suivis",
    eyebrow: "Dans le temps",
    description:
      "Missions persistantes, relances, dossiers ouverts, éléments à surveiller dans la durée.",
    icon: Waypoints,
  },
  {
    key: "briefings",
    label: "Briefings",
    shortLabel: "Briefs",
    eyebrow: "Synthèses",
    description:
      "Comptes rendus autonomes, résumés du jour, de la semaine ou du mois.",
    icon: MessageCircle,
  },
  {
    key: "livraisons",
    label: "Livraisons",
    shortLabel: "Livrés",
    eyebrow: "Prêt à exploiter",
    description:
      "Documents prêts, analyses terminées, livrables finaux, PDF, emails préparés.",
    icon: PackageCheck,
  },
  {
    key: "alertes",
    label: "Alertes",
    shortLabel: "Alertes",
    eyebrow: "À traiter",
    description:
      "Validations, risques, blocages, anomalies, permissions ou décisions humaines requises.",
    icon: ShieldAlert,
  },
  {
    key: "envoyes",
    label: "Envoyés / suivis",
    shortLabel: "Envoyés",
    eyebrow: "Traçabilité",
    description:
      "Documents importants envoyés, décisions déclenchées, éléments retrouvables et suivis.",
    icon: Send,
  },
];

function safeArrayFromStorage(key: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveArrayToStorage(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: MessageStatus) {
  if (status === "new") return "Nouveau";
  if (status === "in_progress") return "En cours";
  if (status === "waiting_validation") return "Validation requise";
  if (status === "delivered") return "Livré";
  if (status === "sent") return "Envoyé";
  if (status === "archived") return "Archivé";

  return "—";
}

function priorityLabel(priority: MessagePriority) {
  if (priority === "critical") return "Critique";
  if (priority === "important") return "Important";
  return "Normal";
}

function categoryTone(category: MessageCategory) {
  if (category === "preparations") return "border-[#6f83ff]/20 bg-[#6f83ff]/10 text-[#4f63d5]";
  if (category === "suivis") return "border-[#42a38a]/20 bg-[#42a38a]/10 text-[#158260]";
  if (category === "briefings") return "border-[#c99a4d]/24 bg-[#c99a4d]/12 text-[#8f682d]";
  if (category === "livraisons") return "border-[#7a6cff]/20 bg-[#7a6cff]/10 text-[#5c4ad3]";
  if (category === "alertes") return "border-[#b84a4a]/22 bg-[#b84a4a]/10 text-[#b84a4a]";
  return "border-[#303747]/14 bg-[#303747]/7 text-[#303747]";
}

function priorityTone(priority: MessagePriority) {
  if (priority === "critical") return "border-[#b84a4a]/24 bg-[#b84a4a]/10 text-[#b84a4a]";
  if (priority === "important") return "border-[#c99a4d]/24 bg-[#c99a4d]/12 text-[#8f682d]";
  return "border-white/60 bg-white/42 text-[var(--cs-ink-3)]";
}

function statusTone(status: MessageStatus) {
  if (status === "waiting_validation") {
    return "border-[#b84a4a]/24 bg-[#b84a4a]/10 text-[#b84a4a]";
  }

  if (status === "delivered" || status === "sent") {
    return "border-[rgba(21,130,96,0.18)] bg-[rgba(21,130,96,0.09)] text-[var(--cs-success)]";
  }

  if (status === "in_progress") {
    return "border-[#6f83ff]/20 bg-[#6f83ff]/10 text-[#4f63d5]";
  }

  return "border-white/60 bg-white/42 text-[var(--cs-ink-3)]";
}

function getAgentName(slug: string) {
  const normalized = slug.toLowerCase();
  return AGENTS.find((agent) => agent.slug === normalized)?.name ?? normalized;
}

function buildInitialMessages(ownedEmployees: string[]): MessageItem[] {
  const employees = ownedEmployees.length > 0 ? ownedEmployees : ["Pierre", "CloneOS"];

  return [
    {
      id: "msg-preparation-rh-001",
      title: "Préparation du dossier RH en cours",
      summary:
        "Pierre prépare les éléments demandés, vérifie les informations manquantes et garde la mission ouverte.",
      body:
        "La mission RH est en préparation. Pierre a structuré les étapes, identifié les informations utiles, préparé un premier brouillon et attend les derniers éléments avant livraison. CloneOS garde la mission active pour éviter toute perte de continuité.",
      source: "Pierre",
      categories: ["preparations", "suivis"],
      priority: "important",
      status: "in_progress",
      createdAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
      employees: employees.includes("Pierre") ? ["Pierre"] : employees.slice(0, 1),
      tags: ["RH", "mission longue", "brouillon", "continuité"],
      deliverables: ["Brouillon RH", "Liste des informations manquantes"],
      actions: [
        { label: "Ouvrir la préparation", tone: "primary" },
        { label: "Ajouter une information", tone: "neutral" },
      ],
    },
    {
      id: "msg-briefing-daily-001",
      title: "Briefing opérationnel du jour",
      summary:
        "Synthèse des actions terminées, des missions en cours et des points qui nécessitent votre attention.",
      body:
        "CloneOS a généré un briefing quotidien regroupant les actions utiles : missions actives, livraisons prêtes, validations nécessaires, éléments à surveiller et priorités du jour. Ce briefing doit permettre au dirigeant de comprendre rapidement ce qui avance sans ouvrir chaque employé IA séparément.",
      source: "CloneOS",
      categories: ["briefings", "suivis"],
      priority: "normal",
      status: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      employees,
      tags: ["briefing", "quotidien", "pilotage"],
      deliverables: ["Résumé du jour", "Points à surveiller"],
      actions: [
        { label: "Lire le briefing", tone: "primary" },
        { label: "Créer un suivi", tone: "neutral" },
      ],
    },
    {
      id: "msg-delivery-document-001",
      title: "Document prêt à validation",
      summary:
        "Un livrable est terminé. Il peut être relu, validé, exporté ou suivi dans le temps.",
      body:
        "Le document demandé est prêt. Il a été classé comme livrable final, rattaché à la mission d’origine et marqué comme élément important retrouvable. Vous pouvez le valider, demander une correction ou l’ajouter au suivi long terme.",
      source: "CloneTrace",
      categories: ["livraisons", "envoyes", "suivis"],
      priority: "important",
      status: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
      employees: employees.slice(0, 2),
      tags: ["livrable", "document", "validation", "trace"],
      deliverables: ["Document final", "Historique de mission"],
      actions: [
        { label: "Ouvrir le livrable", tone: "primary" },
        { label: "Marquer à suivre", tone: "neutral" },
      ],
    },
    {
      id: "msg-alert-risk-001",
      title: "Validation humaine requise",
      summary:
        "CloneGuard a détecté un sujet sensible. L’action ne doit pas partir sans accord humain.",
      body:
        "Une action demandée touche un sujet sensible. CloneGuard recommande une validation humaine avant exécution. La mission reste bloquée volontairement tant que la décision n’est pas confirmée.",
      source: "CloneGuard",
      categories: ["alertes", "suivis"],
      priority: "critical",
      status: "waiting_validation",
      createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      employees: employees.slice(0, 1),
      tags: ["risque", "validation", "sensible", "CloneGuard"],
      deliverables: ["Note de risque", "Action bloquée"],
      actions: [
        { label: "Examiner l’alerte", tone: "danger" },
        { label: "Demander une alternative", tone: "neutral" },
      ],
    },
    {
      id: "msg-sent-followup-001",
      title: "Élément envoyé et placé sous suivi",
      summary:
        "Un message important a été envoyé. Il reste visible dans Envoyés / suivis pour être retrouvé.",
      body:
        "L’élément envoyé a été rattaché à CloneTrace. Il restera retrouvable avec ses tags, son contexte, les employés concernés, la date d’envoi et les prochaines actions éventuelles.",
      source: "CloneTrace",
      categories: ["envoyes", "suivis"],
      priority: "normal",
      status: "sent",
      createdAt: new Date(Date.now() - 1000 * 60 * 380).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      employees: employees.slice(0, 2),
      tags: ["envoyé", "à suivre", "retrouvable", "historique"],
      deliverables: ["Message envoyé", "Trace de suivi"],
      actions: [
        { label: "Voir la trace", tone: "primary" },
        { label: "Planifier une relance", tone: "neutral" },
      ],
    },
    {
      id: "msg-multi-agent-001",
      title: "Mission multi-employés découpée par CloneOS",
      summary:
        "CloneOS a identifié plusieurs flux de travail et les a répartis entre les employés disponibles.",
      body:
        "La demande initiale nécessite plusieurs compétences. CloneOS a découpé la mission en workstreams, vérifié les employés disponibles sur le compte et préparé une coordination entre les postes concernés. Les employés non souscrits ne seront pas sollicités.",
      source: "CloneOS",
      categories: ["preparations", "suivis", "briefings"],
      priority: "important",
      status: "in_progress",
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
      employees,
      tags: ["CloneOS", "orchestration", "multi-employés", "coordination"],
      deliverables: ["Plan de mission", "Découpage des tâches"],
      actions: [
        { label: "Voir le découpage", tone: "primary" },
        { label: "Modifier la priorité", tone: "neutral" },
      ],
    },
  ];
}

function ActionButton({
  children,
  href,
  onClick,
  primary = false,
  danger = false,
  icon,
  disabled = false,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition",
    primary ? "clone-liquid-button clone-liquid-button--dark" : "clone-liquid-button",
    danger && "border-[#b84a4a]/20 bg-[#b84a4a]/8 text-[#b84a4a]",
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

function RoundNotification({
  category,
  count,
  active,
  onClick,
}: {
  category: CategoryDefinition;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      title={category.label}
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_34px_rgba(38,32,22,0.08)] backdrop-blur-xl transition hover:-translate-y-0.5",
        categoryTone(category.key),
        active && "ring-4 ring-white/44"
      )}
    >
      <Icon className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border border-white/70 bg-[var(--cs-ink-1)] px-1 text-[0.62rem] font-bold text-white shadow-[0_8px_18px_rgba(18,24,36,0.18)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function EmptyState({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.75rem] p-6">
      <div className="grid min-h-[280px] place-items-center text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[1.25rem] border border-white/60 bg-white/42 text-[#667cff] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            {icon}
          </div>
          <p className="text-lg font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
            {title}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">{text}</p>
        </div>
      </div>
    </LiquidGlass>
  );
}

export default function ProfileMessagesPage() {
  const supabase = useMemo(() => {
    try {
      return getSupabase() as SupabaseClient;
    } catch {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<MessageCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [readIds, setReadIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!supabase) {
      setLoading(false);
      setAuthReady(true);
      setError(
        "Configuration Supabase manquante. La messagerie s’affiche en aperçu local."
      );
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      if (!currentUserId) {
        setOrders([]);
        setLoading(false);
        setAuthReady(true);
        return;
      }

      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("id, agent_slug, status, started_at, ended_at")
        .eq("user_id", currentUserId)
        .order("started_at", { ascending: false });

      if (ordersError) throw ordersError;

      setOrders((data ?? []) as OrderRow[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger la messagerie CloneStore."
      );
      setOrders([]);
    } finally {
      setLoading(false);
      setAuthReady(true);
    }
  }, [supabase]);

  useEffect(() => {
    setReadIds(safeArrayFromStorage(STORAGE_KEYS.read));
    setPinnedIds(safeArrayFromStorage(STORAGE_KEYS.pinned));
    setArchivedIds(safeArrayFromStorage(STORAGE_KEYS.archived));
    void load();
  }, [load]);

  useEffect(() => {
    saveArrayToStorage(STORAGE_KEYS.read, readIds);
  }, [readIds]);

  useEffect(() => {
    saveArrayToStorage(STORAGE_KEYS.pinned, pinnedIds);
  }, [pinnedIds]);

  useEffect(() => {
    saveArrayToStorage(STORAGE_KEYS.archived, archivedIds);
  }, [archivedIds]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status.toLowerCase() === "active"),
    [orders]
  );

  const ownedEmployeeNames = useMemo(() => {
    const names = activeOrders.map((order) => getAgentName(order.agent_slug));
    return Array.from(new Set(names));
  }, [activeOrders]);

  const allMessages = useMemo(
    () => buildInitialMessages(ownedEmployeeNames),
    [ownedEmployeeNames]
  );

  const visibleMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return allMessages
      .filter((message) => !archivedIds.includes(message.id))
      .filter((message) =>
        activeCategory === "all" ? true : message.categories.includes(activeCategory)
      )
      .filter((message) => {
        if (!normalizedQuery) return true;

        const haystack = [
          message.title,
          message.summary,
          message.body,
          message.source,
          message.status,
          message.priority,
          ...message.categories,
          ...message.employees,
          ...message.tags,
          ...(message.deliverables ?? []),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const pinnedA = pinnedIds.includes(a.id) ? 1 : 0;
        const pinnedB = pinnedIds.includes(b.id) ? 1 : 0;

        if (pinnedA !== pinnedB) return pinnedB - pinnedA;

        const criticalA = a.priority === "critical" ? 1 : 0;
        const criticalB = b.priority === "critical" ? 1 : 0;

        if (criticalA !== criticalB) return criticalB - criticalA;

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [activeCategory, allMessages, archivedIds, pinnedIds, query]);

  const selectedMessage = useMemo(() => {
    if (selectedId) {
      const exact = visibleMessages.find((message) => message.id === selectedId);
      if (exact) return exact;
    }

    return visibleMessages[0] ?? null;
  }, [selectedId, visibleMessages]);

  useEffect(() => {
    if (!selectedMessage) return;
    setSelectedId(selectedMessage.id);
  }, [selectedMessage]);

  const counts = useMemo(() => {
    const countByCategory = new Map<MessageCategory, number>();

    categories.forEach((category) => {
      countByCategory.set(
        category.key,
        allMessages.filter(
          (message) =>
            !archivedIds.includes(message.id) &&
            message.categories.includes(category.key)
        ).length
      );
    });

    return countByCategory;
  }, [allMessages, archivedIds]);

  const unreadCount = allMessages.filter(
    (message) => !readIds.includes(message.id) && !archivedIds.includes(message.id)
  ).length;

  const alertCount = counts.get("alertes") ?? 0;

  function togglePinned(id: string) {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function markRead(id: string) {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function archiveMessage(id: string) {
    setArchivedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function restoreArchived() {
    setArchivedIds([]);
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-5">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="cs-pill">
                  <MessagesSquare className="h-3.5 w-3.5 text-[#667cff]" />
                  Centre de communication
                </span>
                <span className="cs-pill">
                  <BadgeCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  {unreadCount} non lus
                </span>
                <span className="cs-pill">
                  <ShieldAlert className="h-3.5 w-3.5 text-[#b84a4a]" />
                  {alertCount} alertes
                </span>
              </div>

              <h1 className="cs-heading mt-4 text-[clamp(2.1rem,4vw,4.7rem)] leading-[0.94]">
                Messages CloneStore
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                Pas un chat brouillon : un centre premium pour les préparations,
                suivis, briefings, livraisons, alertes et éléments envoyés à retrouver
                dans le temps.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton href="/profile/agents" icon={<ArrowLeft className="h-4 w-4" />}>
                Cockpit
              </ActionButton>
              <ActionButton href="/profile" icon={<User2 className="h-4 w-4" />}>
                Mon CloneStore
              </ActionButton>
            </div>
          </section>

          {error ? (
            <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.4rem] p-4">
              <div className="flex items-start gap-3 text-[#b84a4a]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-medium leading-6">{error}</p>
              </div>
            </LiquidGlass>
          ) : null}

          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="rounded-[2.25rem] p-4 md:p-5"
          >
            <div className="grid gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-h-14 flex-1 items-center gap-3 rounded-full border border-white/55 bg-white/34 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_18px_46px_rgba(38,32,22,0.06)] backdrop-blur-xl">
                  <Search className="h-4 w-4 shrink-0 text-[#667cff]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rechercher une mission, un livrable, un employé, une alerte, un document..."
                    className="h-12 w-full border-0 bg-transparent text-sm font-semibold text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/50 bg-white/40 text-[var(--cs-ink-3)]"
                      aria-label="Effacer la recherche"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
                  {categories.map((category) => (
                    <RoundNotification
                      key={category.key}
                      category={category}
                      count={counts.get(category.key) ?? 0}
                      active={activeCategory === category.key}
                      onClick={() => setActiveCategory(category.key)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                    activeCategory === "all"
                      ? "border-white/70 bg-white/62 text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_12px_30px_rgba(38,32,22,0.06)]"
                      : "border-white/42 bg-white/24 text-[var(--cs-ink-3)]"
                  )}
                >
                  <Inbox className="h-4 w-4" />
                  Tous
                  <span className="rounded-full bg-white/46 px-2 py-0.5 text-xs">
                    {allMessages.filter((message) => !archivedIds.includes(message.id)).length}
                  </span>
                </button>

                {categories.map((category) => {
                  const Icon = category.icon;
                  const active = activeCategory === category.key;

                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setActiveCategory(category.key)}
                      className={cn(
                        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                        active
                          ? "border-white/70 bg-white/62 text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_12px_30px_rgba(38,32,22,0.06)]"
                          : "border-white/42 bg-white/24 text-[var(--cs-ink-3)]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {category.label}
                      <span className="rounded-full bg-white/46 px-2 py-0.5 text-xs">
                        {counts.get(category.key) ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </LiquidGlass>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
            <LiquidGlass
              variant="panel"
              intensity="medium"
              className="min-h-[680px] rounded-[2rem] p-4"
            >
              <div className="flex items-center justify-between gap-3 px-1 pb-4">
                <div>
                  <p className="cs-eyebrow">Boîte opérationnelle</p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                    {visibleMessages.length} éléments
                  </p>
                </div>

                <button
                  type="button"
                  onClick={restoreArchived}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/50 bg-white/34 px-4 text-xs font-semibold text-[var(--cs-ink-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Réinitialiser
                </button>
              </div>

              {loading ? (
                <div className="grid min-h-[420px] place-items-center">
                  <div className="flex items-center gap-3 text-[var(--cs-ink-3)]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#667cff]" />
                    <span className="text-sm font-medium">Chargement des messages...</span>
                  </div>
                </div>
              ) : visibleMessages.length === 0 ? (
                <EmptyState
                  title="Aucun message dans cette vue"
                  text="Change d’onglet, efface la recherche ou restaure les éléments masqués."
                  icon={<Inbox className="h-6 w-6" />}
                />
              ) : (
                <div className="grid gap-3">
                  {visibleMessages.map((message) => {
                    const selected = selectedMessage?.id === message.id;
                    const unread = !readIds.includes(message.id);
                    const pinned = pinnedIds.includes(message.id);

                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(message.id);
                          markRead(message.id);
                        }}
                        className={cn(
                          "group rounded-[1.55rem] border p-4 text-left transition",
                          selected
                            ? "border-white/72 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_18px_48px_rgba(38,32,22,0.08)]"
                            : "border-white/42 bg-white/24 hover:border-white/62 hover:bg-white/38"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {unread ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-[#667cff] shadow-[0_0_18px_rgba(102,124,255,0.55)]" />
                              ) : null}

                              {pinned ? (
                                <Pin className="h-3.5 w-3.5 text-[#c99a4d]" />
                              ) : null}

                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
                                  priorityTone(message.priority)
                                )}
                              >
                                {priorityLabel(message.priority)}
                              </span>

                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
                                  statusTone(message.status)
                                )}
                              >
                                {statusLabel(message.status)}
                              </span>
                            </div>

                            <p className="mt-3 line-clamp-2 text-base font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                              {message.title}
                            </p>

                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                              {message.summary}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold text-[var(--cs-ink-4)]">
                              {formatDate(message.updatedAt)}
                            </p>
                            <p className="mt-2 text-xs font-bold text-[#667cff]">
                              {message.source}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {message.categories.map((category) => {
                            const meta = categories.find((item) => item.key === category);

                            return (
                              <span
                                key={category}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
                                  categoryTone(category)
                                )}
                              >
                                {meta?.shortLabel ?? category}
                              </span>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </LiquidGlass>

            <LiquidGlass
              variant="panel"
              intensity="strong"
              refractive
              className="min-h-[680px] rounded-[2rem] p-5 md:p-6"
            >
              {!selectedMessage ? (
                <EmptyState
                  title="Sélectionnez un message"
                  text="Le détail opérationnel apparaîtra ici avec ses actions, ses employés, ses tags et ses livrables."
                  icon={<MessagesSquare className="h-6 w-6" />}
                />
              ) : (
                <div className="flex h-full flex-col gap-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            priorityTone(selectedMessage.priority)
                          )}
                        >
                          {priorityLabel(selectedMessage.priority)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            statusTone(selectedMessage.status)
                          )}
                        >
                          {statusLabel(selectedMessage.status)}
                        </span>
                      </div>

                      <h2 className="cs-heading mt-4 text-[clamp(1.65rem,2.8vw,3.05rem)] leading-[0.98]">
                        {selectedMessage.title}
                      </h2>

                      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                        {selectedMessage.summary}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePinned(selectedMessage.id)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/34 text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_34px_rgba(38,32,22,0.08)] backdrop-blur-xl"
                      aria-label={
                        pinnedIds.includes(selectedMessage.id)
                          ? "Retirer l’épingle"
                          : "Épingler"
                      }
                    >
                      {pinnedIds.includes(selectedMessage.id) ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.35rem] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        Source
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--cs-ink-1)]">
                        {selectedMessage.source}
                      </p>
                    </LiquidGlass>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.35rem] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        Mise à jour
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--cs-ink-1)]">
                        {formatDate(selectedMessage.updatedAt)}
                      </p>
                    </LiquidGlass>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.35rem] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        Échéance
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--cs-ink-1)]">
                        {formatDate(selectedMessage.dueAt)}
                      </p>
                    </LiquidGlass>
                  </div>

                  <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      Détail opérationnel
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[var(--cs-ink-3)]">
                      {selectedMessage.body}
                    </p>
                  </LiquidGlass>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                      <div className="flex items-center gap-2">
                        <BriefcaseBusiness className="h-4 w-4 text-[#667cff]" />
                        <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                          Employés concernés
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedMessage.employees.map((employee) => (
                          <span
                            key={employee}
                            className="rounded-full border border-white/55 bg-white/38 px-3 py-1.5 text-xs font-bold text-[var(--cs-ink-2)]"
                          >
                            {employee}
                          </span>
                        ))}
                      </div>
                    </LiquidGlass>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-[#667cff]" />
                        <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                          Livrables / traces
                        </p>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {(selectedMessage.deliverables ?? []).map((deliverable) => (
                          <div
                            key={deliverable}
                            className="flex items-center gap-2 rounded-[1rem] border border-white/50 bg-white/30 px-3 py-2 text-xs font-semibold text-[var(--cs-ink-2)]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                            {deliverable}
                          </div>
                        ))}
                      </div>
                    </LiquidGlass>
                  </div>

                  <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-[#667cff]" />
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        Catégories et tags
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedMessage.categories.map((category) => {
                        const meta = categories.find((item) => item.key === category);

                        return (
                          <span
                            key={category}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-bold",
                              categoryTone(category)
                            )}
                          >
                            {meta?.label ?? category}
                          </span>
                        );
                      })}

                      {selectedMessage.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/55 bg-white/32 px-3 py-1.5 text-xs font-bold text-[var(--cs-ink-3)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </LiquidGlass>

                  <div className="mt-auto flex flex-wrap gap-2">
                    {selectedMessage.actions.map((action) => (
                      <ActionButton
                        key={action.label}
                        primary={action.tone === "primary"}
                        danger={action.tone === "danger"}
                        icon={<ArrowRight className="h-4 w-4" />}
                      >
                        {action.label}
                      </ActionButton>
                    ))}

                    <ActionButton
                      onClick={() => markRead(selectedMessage.id)}
                      icon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Marquer comme lu
                    </ActionButton>

                    <ActionButton
                      onClick={() => archiveMessage(selectedMessage.id)}
                      icon={<Inbox className="h-4 w-4" />}
                    >
                      Archiver
                    </ActionButton>
                  </div>
                </div>
              )}
            </LiquidGlass>
          </section>

          {!userId && authReady ? (
            <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.55rem] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-4 w-4 text-[#667cff]" />
                  <p className="text-sm leading-6 text-[var(--cs-ink-3)]">
                    Connectez-vous pour relier cette messagerie aux vrais employés IA,
                    aux missions et à l’historique du compte.
                  </p>
                </div>

                <div className="flex gap-2">
                  <ActionButton href="/login">Connexion</ActionButton>
                  <ActionButton href="/signup" primary>
                    Créer un compte
                  </ActionButton>
                </div>
              </div>
            </LiquidGlass>
          ) : null}
        </div>
      </div>
    </main>
  );
}