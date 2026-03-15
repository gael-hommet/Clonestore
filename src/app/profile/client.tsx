"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  Clock3,
  CreditCard,
  ExternalLink,
  Filter,
  FolderClock,
  Lock,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";

type OrderRow = {
  id: string;
  agent_slug: string;
  status: "active" | "cancelled" | string;
  started_at: string | null;
  ended_at: string | null;
};

type AgentMeta = {
  slug: string;
  name: string;
  role: string;
  description: string;
  accent: string;
  availableActions: Array<{
    label: string;
    href: string;
    variant?: "default" | "outline";
  }>;
};

type StatusFilter = "all" | "active" | "inactive";

const AGENT_META: Record<string, AgentMeta> = {
  pierre: {
    slug: "pierre",
    name: "Pierre",
    role: "Assistant RH rédacteur",
    description:
      "Rédige emails, documents RH et contenus structurés à partir d’un brief simple.",
    accent: "from-violet-500/15 to-fuchsia-500/10",
    availableActions: [
      { label: "Utiliser", href: "/agents/pierre/use" },
      { label: "Configurer", href: "/agents/pierre/setup", variant: "outline" },
      { label: "Onboarding", href: "/agents/pierre/onboarding", variant: "outline" },
    ],
  },
  clara: {
    slug: "clara",
    name: "Clara",
    role: "Directrice RH IA",
    description:
      "Analyse, recrutement, tri et pilotage RH avec une logique plus stratégique.",
    accent: "from-sky-500/15 to-cyan-500/10",
    availableActions: [{ label: "Voir la fiche", href: "/agents/clara" }],
  },
  alex: {
    slug: "alex",
    name: "Alex",
    role: "Assistant opérationnel",
    description:
      "Aide à structurer les demandes, les tâches et les actions répétitives.",
    accent: "from-emerald-500/15 to-teal-500/10",
    availableActions: [{ label: "Voir la fiche", href: "/agents/alex" }],
  },
  emma: {
    slug: "emma",
    name: "Emma",
    role: "Support client IA",
    description:
      "Réponses, organisation support et cadrage des demandes entrantes.",
    accent: "from-pink-500/15 to-rose-500/10",
    availableActions: [{ label: "Voir la fiche", href: "/agents/emma" }],
  },
  noah: {
    slug: "noah",
    name: "Noah",
    role: "Assistant de coordination",
    description:
      "Centralise l’information, fluidifie le suivi et aide à l’exécution.",
    accent: "from-amber-500/15 to-orange-500/10",
    availableActions: [{ label: "Voir la fiche", href: "/agents/noah" }],
  },
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  const st = (status || "").toLowerCase();
  if (st === "active") return "Actif";
  if (st === "cancelled") return "Résilié";
  if (st === "past_due") return "Paiement en attente";
  if (st === "incomplete") return "Incomplet";
  if (st === "trialing") return "Essai";
  return status || "—";
}

function statusClass(status: string) {
  const st = (status || "").toLowerCase();
  if (st === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (st === "past_due") return "border-amber-200 bg-amber-50 text-amber-700";
  if (st === "trialing") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-border bg-background text-foreground";
}

function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function safeTrim(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function getAgentMeta(slug: string): AgentMeta {
  return (
    AGENT_META[slug] ?? {
      slug,
      name: titleCaseSlug(slug),
      role: "Clone spécialisé",
      description: "Clone rattaché à ton espace client CloneStore.",
      accent: "from-violet-500/15 to-fuchsia-500/10",
      availableActions: [{ label: "Voir la fiche", href: `/agents/${slug}` }],
    }
  );
}

function Section({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border bg-background/80 p-6 shadow-sm space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <p className="text-sm text-red-700">{message}</p>
      </div>
    </section>
  );
}

function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-3xl border bg-background/80 p-8 text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border bg-background">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

function MiniBadge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "violet" | "success";
}) {
  const styles =
    variant === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-border bg-background text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${styles}`}>
      {children}
    </span>
  );
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-violet-300 bg-violet-50 text-violet-700"
          : "border-border bg-background/70 text-muted-foreground hover:bg-background",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function AgentCard({
  order,
}: {
  order: OrderRow;
}) {
  const meta = getAgentMeta(order.agent_slug);
  const isActive = (order.status || "").toLowerCase() === "active";

  return (
    <article className="overflow-hidden rounded-[28px] border bg-background/85 shadow-sm">
      <div className={`bg-gradient-to-r ${meta.accent} p-5 border-b`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-background/90 text-sm font-semibold shadow-sm">
              {meta.name.slice(0, 2).toUpperCase()}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight">{meta.name}</h3>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${statusClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>

              <p className="text-sm font-medium text-foreground/90">{meta.role}</p>
              <p className="max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
            </div>
          </div>

          <div className="hidden sm:flex">
            {isActive ? (
              <MiniBadge variant="success">
                <BadgeCheck className="h-3.5 w-3.5" />
                Disponible
              </MiniBadge>
            ) : (
              <MiniBadge>
                <Lock className="h-3.5 w-3.5" />
                Accès limité
              </MiniBadge>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">Statut</p>
            <p className="mt-1 text-sm font-semibold">{statusLabel(order.status)}</p>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">Début</p>
            <p className="mt-1 text-sm font-semibold">{fmtDate(order.started_at)}</p>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">Fin</p>
            <p className="mt-1 text-sm font-semibold">{fmtDate(order.ended_at)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {meta.availableActions.map((action) => (
            <Button
              key={`${meta.slug}-${action.href}-${action.label}`}
              asChild
              variant={action.variant ?? "default"}
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}

          <Button asChild variant="outline">
            <Link href={`/agents/${meta.slug}`}>
              Ouvrir la fiche
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/paiement">
              Gérer l’abonnement
              <CreditCard className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border bg-background/60 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-muted-foreground">
              {isActive ? <Wand2 className="h-4 w-4" /> : <FolderClock className="h-4 w-4" />}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isActive ? "Clone prêt à être utilisé" : "Accès non actif ou arrêté"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "Tu peux l’utiliser, le configurer ou accéder à ses pages dédiées selon son niveau d’avancement."
                  : "Ce clone est rattaché à ton historique mais n’est pas actuellement actif."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Client() {
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<"recent" | "name_az" | "name_za">("recent");

  const refresh = useCallback(
    async (silent = false) => {
      setError(null);
      if (silent) setRefreshBusy(true);
      else setLoading(true);

      if (!supabase) {
        setError(
          "Configuration Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local puis redémarre le serveur."
        );
        setLoading(false);
        setRefreshBusy(false);
        return;
      }

      const { data: userRes, error: userErr } = await supabase.auth.getUser();

      if (userErr) {
        setError(userErr.message);
        setLoading(false);
        setRefreshBusy(false);
        return;
      }

      if (!userRes.user) {
        setUserId(null);
        setOrders([]);
        setLoading(false);
        setRefreshBusy(false);
        return;
      }

      const uid = userRes.user.id;
      setUserId(uid);

      const ordRes = await supabase
        .from("orders")
        .select("id, agent_slug, status, started_at, ended_at")
        .eq("user_id", uid)
        .order("started_at", { ascending: false });

      if (ordRes.error) {
        setError(ordRes.error.message);
        setOrders([]);
        setLoading(false);
        setRefreshBusy(false);
        return;
      }

      setOrders((ordRes.data ?? []) as OrderRow[]);
      setLoading(false);
      setRefreshBusy(false);
    },
    [supabase]
  );

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  const activeOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() === "active"),
    [orders]
  );

  const inactiveOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() !== "active"),
    [orders]
  );

  const visibleOrders = useMemo(() => {
    const q = safeTrim(query)?.toLowerCase() || "";

    let base = orders.filter((order) => {
      const isActive = (order.status || "").toLowerCase() === "active";
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;

      if (!q) return true;

      const meta = getAgentMeta(order.agent_slug);
      const hay = [
        order.agent_slug,
        meta.name,
        meta.role,
        meta.description,
        statusLabel(order.status),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });

    base = [...base].sort((a, b) => {
      if (sortMode === "recent") {
        const at = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bt = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bt - at;
      }

      const an = getAgentMeta(a.agent_slug).name.toLowerCase();
      const bn = getAgentMeta(b.agent_slug).name.toLowerCase();

      if (sortMode === "name_az") return an.localeCompare(bn);
      return bn.localeCompare(an);
    });

    return base;
  }, [orders, query, sortMode, statusFilter]);

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (!loading && !userId) {
    return (
      <EmptyState
        title="Aucune session active"
        description="Connecte-toi pour retrouver tes clones, leurs accès et leurs actions disponibles."
        ctaHref="/login"
        ctaLabel="Aller à la connexion"
      />
    );
  }

  if (loading) {
    return (
      <section className="rounded-[28px] border bg-background/80 p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Chargement de tes clones…</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border bg-gradient-to-br from-background via-violet-50/40 to-background p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <MiniBadge variant="violet">
                <Sparkles className="h-3.5 w-3.5" />
                Gestion premium
              </MiniBadge>
              <MiniBadge>
                <ShieldCheck className="h-3.5 w-3.5" />
                Accès centralisés
              </MiniBadge>
              <MiniBadge>
                <Briefcase className="h-3.5 w-3.5" />
                Clones spécialisés
              </MiniBadge>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Pilotage de tes clones</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Retrouve tous les clones rattachés à ton compte, leur statut, leurs accès, et les
                raccourcis vers leurs pages clés dans une interface vraiment pensée pour l’usage.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Actifs"
                value={activeOrders.length}
                helper="Disponibles maintenant"
                icon={<BadgeCheck className="h-5 w-5" />}
              />
              <MetricCard
                label="Non actifs"
                value={inactiveOrders.length}
                helper="Historique ou arrêtés"
                icon={<Activity className="h-5 w-5" />}
              />
              <MetricCard
                label="Total"
                value={orders.length}
                helper="Clones liés au compte"
                icon={<Bot className="h-5 w-5" />}
              />
            </div>
          </div>

          <div className="rounded-3xl border bg-background/80 p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Actions rapides</p>
              <p className="text-sm text-muted-foreground">
                Va directement vers les zones les plus utiles.
              </p>
            </div>

            <div className="grid gap-3">
              <Button asChild className="justify-between">
                <Link href="/agents">
                  Recruter un clone
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-between">
                <Link href="/profile">
                  Revenir au compte
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-between">
                <Link href="/paiement">
                  Gérer les paiements
                  <CreditCard className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                variant="outline"
                onClick={() => refresh(true)}
                disabled={refreshBusy}
                className="justify-between"
              >
                {refreshBusy ? "Actualisation…" : "Actualiser la liste"}
                <Activity className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Section
        title="Filtres"
        description="Affiche uniquement les clones que tu veux voir."
        right={
          <MiniBadge>
            <Filter className="h-3.5 w-3.5" />
            {visibleOrders.length} affiché(s)
          </MiniBadge>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1">
            <p className="text-sm font-medium">Recherche</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-2xl border bg-background px-10 py-2.5 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pierre, RH, support, statut…"
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Statut</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                Tous
              </FilterPill>
              <FilterPill active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>
                Actifs
              </FilterPill>
              <FilterPill
                active={statusFilter === "inactive"}
                onClick={() => setStatusFilter("inactive")}
              >
                Non actifs
              </FilterPill>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Tri</p>
            <select
              className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as "recent" | "name_az" | "name_za")}
            >
              <option value="recent">Plus récents</option>
              <option value="name_az">Nom A→Z</option>
              <option value="name_za">Nom Z→A</option>
            </select>
          </div>
        </div>
      </Section>

      <Section
        title="Mes clones"
        description="Tous les clones associés à ton compte, avec leurs accès et actions utiles."
      >
        {visibleOrders.length === 0 ? (
          <EmptyState
            title="Aucun clone trouvé"
            description="Ajuste les filtres ou recrute un nouveau clone depuis la boutique."
            ctaHref="/agents"
            ctaLabel="Découvrir la boutique"
          />
        ) : (
          <div className="space-y-4">
            {visibleOrders.map((order) => (
              <AgentCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Repères utiles"
        description="Ce que tu peux faire depuis cet espace."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-background/80 p-5 space-y-2">
            <div className="text-muted-foreground">
              <Settings2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Configurer</p>
            <p className="text-sm text-muted-foreground">
              Quand un clone propose une configuration dédiée, tu peux y accéder directement depuis sa carte.
            </p>
          </div>

          <div className="rounded-2xl border bg-background/80 p-5 space-y-2">
            <div className="text-muted-foreground">
              <Wand2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Utiliser</p>
            <p className="text-sm text-muted-foreground">
              Les clones réellement actifs disposent d’actions concrètes et de raccourcis vers leurs pages d’usage.
            </p>
          </div>

          <div className="rounded-2xl border bg-background/80 p-5 space-y-2">
            <div className="text-muted-foreground">
              <Clock3 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Suivre</p>
            <p className="text-sm text-muted-foreground">
              Tu gardes une vue claire sur les dates, le statut et l’historique des clones rattachés à ton compte.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}