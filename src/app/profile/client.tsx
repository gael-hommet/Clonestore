"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  Clock3,
  LayoutDashboard,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { AGENTS, type AgentSpec } from "@/lib/agent-catalog";
import {
  ProfileActionLink,
  ProfileEmptyState,
  ProfileErrorBanner,
  ProfileSection,
  ProfileStatCard,
} from "./_ui/profile-primitives";

type OrderRow = {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? "").toLowerCase();
}

function statusLabel(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "active") return "Actif";
  if (normalized === "cancelled") return "Résilié";
  if (normalized === "past_due") return "Paiement en attente";
  if (normalized === "trialing") return "Essai";
  if (normalized === "incomplete") return "Activation incomplète";

  return status || "—";
}

function statusClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "active") return "cs-status cs-status--success";
  if (normalized === "trialing") return "cs-status cs-status--info";
  if (normalized === "past_due" || normalized === "incomplete") {
    return "cs-status cs-status--warn";
  }

  return "cs-status";
}

function getAgentSpec(slug: string): AgentSpec | null {
  return AGENTS.find((agent) => agent.slug === slug) ?? null;
}

function isAvailableNow(slug: string) {
  return slug === "pierre";
}

function getWorkspace(slug: string, active: boolean) {
  if (slug === "pierre" && active) {
    return {
      primaryHref: "/agents/pierre/use",
      primaryLabel: "Utiliser Pierre",
      secondaryHref: "/agents/pierre/setup",
      secondaryLabel: "Configurer",
      tertiaryHref: "/agents/pierre",
      tertiaryLabel: "Voir la fiche",
    };
  }

  if (slug === "pierre") {
    return {
      primaryHref: "/agents/pierre",
      primaryLabel: "Voir Pierre",
      secondaryHref: "/checkout?agent=pierre",
      secondaryLabel: "Activer Pierre",
      tertiaryHref: "/questions",
      tertiaryLabel: "Poser une question",
    };
  }

  return {
    primaryHref: `/agents/${slug}`,
    primaryLabel: "Voir la fiche",
    secondaryHref: "/agents",
    secondaryLabel: "Boutique",
    tertiaryHref: "/questions",
    tertiaryLabel: "Poser une question",
  };
}

function EmployeeCard({
  agent,
  order,
}: {
  agent: AgentSpec;
  order: OrderRow | null;
}) {
  const active = order ? normalizeStatus(order.status) === "active" : false;
  const available = isAvailableNow(agent.slug);
  const workspace = getWorkspace(agent.slug, active);

  return (
    <article className="cs-panel cs-hover-lift p-5">
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {order ? (
                  <span className={statusClass(order.status)}>
                    {statusLabel(order.status)}
                  </span>
                ) : available ? (
                  <span className="cs-status cs-status--info">Disponible</span>
                ) : (
                  <span className="cs-status">En construction</span>
                )}

                {agent.slug === "pierre" ? (
                  <span className="cs-status cs-status--success">Entrée forte</span>
                ) : null}
              </div>

              <div>
                <h2 className="text-[1.22rem] font-semibold tracking-[-0.045em] text-[var(--cs-ink-1)]">
                  {agent.name}
                </h2>
                <p className="mt-1 text-[0.88rem] font-medium text-[var(--cs-ink-2)]">
                  {agent.role}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[0.9rem] leading-7 text-[var(--cs-ink-3)]">
            {agent.does[0] ?? "Employé IA CloneStore."}
          </p>

          <div className="grid gap-2">
            <p className="text-[0.82rem] text-[var(--cs-ink-4)]">
              Début : {order ? formatDateTime(order.started_at) : "—"}
            </p>
            <p className="text-[0.82rem] text-[var(--cs-ink-4)]">
              Fin / état : {order ? formatDateTime(order.ended_at) : "Non activé"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ProfileActionLink
            href={workspace.primaryHref}
            label={workspace.primaryLabel}
            primary
          />
          <ProfileActionLink
            href={workspace.secondaryHref}
            label={workspace.secondaryLabel}
          />
          <ProfileActionLink
            href={workspace.tertiaryHref}
            label={workspace.tertiaryLabel}
          />
        </div>
      </div>
    </article>
  );
}

export default function ProfileAgentsClient() {
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      if (!supabase) {
        setError(
          "Configuration Supabase manquante. Vérifie les variables publiques puis redémarre le serveur.",
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
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setUserId(authData.user.id);

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
    [supabase],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const activeOrders = useMemo(
    () => orders.filter((order) => normalizeStatus(order.status) === "active"),
    [orders],
  );

  const orderBySlug = useMemo(() => {
    const map = new Map<string, OrderRow>();
    for (const order of orders) {
      if (!map.has(order.agent_slug)) {
        map.set(order.agent_slug, order);
      }
    }
    return map;
  }, [orders]);

  const activeAgents = useMemo(() => {
    return AGENTS.filter((agent) => {
      const order = orderBySlug.get(agent.slug);
      return !!order && normalizeStatus(order.status) === "active";
    });
  }, [orderBySlug]);

  const availableToActivate = useMemo(() => {
    return AGENTS.filter((agent) => {
      const order = orderBySlug.get(agent.slug);
      return !order && isAvailableNow(agent.slug);
    });
  }, [orderBySlug]);

  const futureAgents = useMemo(() => {
    return AGENTS.filter((agent) => !isAvailableNow(agent.slug));
  }, []);

  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-5">
          <section className="cs-command-surface">
            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr] xl:items-center">
              <div className="space-y-5">
                <span className="cs-pill">
                  <LayoutDashboard className="h-4 w-4 text-[var(--cs-violet)]" />
                  Mes employés
                </span>

                <div className="space-y-3">
                  <h1 className="cs-display text-[clamp(1.95rem,3vw,3.3rem)] leading-[0.98]">
                    Faire travailler les
                    <br />
                    <span className="cs-gradient-text">employés IA.</span>
                  </h1>

                  <p className="max-w-3xl text-[0.92rem] leading-7 text-[var(--cs-ink-3)]">
                    Cette zone doit devenir le vrai point d’entrée de travail du client.
                    Elle rassemble les employés actifs, les accès prioritaires, les
                    activations possibles et le reste de l’univers CloneStore dans un
                    cadre premium et lisible.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <ProfileActionLink
                    href="/profile"
                    label="Mon espace"
                    primary
                  />
                  <ProfileActionLink
                    href="/agents"
                    label="Boutique"
                  />
                  <ProfileActionLink
                    href="/assistant"
                    label="CloneChat"
                  />
                  <ProfileActionLink
                    href="/agents/pierre/use"
                    label="Utiliser Pierre"
                  />
                </div>
              </div>

              <div className="cs-panel p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileStatCard
                    title="Actifs"
                    value={activeOrders.length}
                    helper="Employés utilisables maintenant"
                    icon={<BadgeCheck className="h-5 w-5" />}
                    tone="success"
                  />
                  <ProfileStatCard
                    title="Disponibles à ouvrir"
                    value={availableToActivate.length}
                    helper="Employés activables maintenant"
                    icon={<Sparkles className="h-5 w-5" />}
                    tone="violet"
                  />
                  <ProfileStatCard
                    title="Vision future"
                    value={futureAgents.length}
                    helper="Employés visibles dans la gamme"
                    icon={<Clock3 className="h-5 w-5" />}
                    tone="blue"
                  />
                  <ProfileStatCard
                    title="Compte"
                    value={userId ? "Connecté" : "Invité"}
                    helper="Session privée nécessaire"
                    icon={<BriefcaseBusiness className="h-5 w-5" />}
                    tone="default"
                  />
                </div>
              </div>
            </div>
          </section>

          {error ? <ProfileErrorBanner message={error} /> : null}

          {!loading && !userId ? (
            <ProfileSection
              title="Accès"
              description="Une session active est nécessaire pour piloter les employés."
            >
              <ProfileEmptyState
                title="Connecte-toi pour accéder à tes employés"
                text="Le cockpit employés, les usages Pierre, les configurations et les états de souscription nécessitent une session CloneStore active."
                actions={
                  <>
                    <ProfileActionLink href="/login" label="Connexion" primary />
                    <ProfileActionLink href="/signup" label="Créer un compte" />
                  </>
                }
              />
            </ProfileSection>
          ) : null}

          {loading ? (
            <ProfileSection
              title="Chargement"
              description="Lecture des employés liés au compte."
            >
              <div className="rounded-[1.2rem] border border-[var(--cs-line-soft)] bg-white/28 px-4 py-5">
                <p className="text-[0.88rem] leading-6 text-[var(--cs-ink-3)]">
                  Chargement des employés du compte…
                </p>
              </div>
            </ProfileSection>
          ) : null}

          {!loading && userId ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <div className="cs-card cs-card-tight">
                  <div className="flex items-start gap-3">
                    <LayoutDashboard className="mt-0.5 h-4 w-4 text-[var(--cs-violet)]" />
                    <div>
                      <p className="text-[0.88rem] font-semibold text-[var(--cs-ink-1)]">
                        Zone de travail
                      </p>
                      <p className="mt-1 text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
                        Mes employés doit servir de point d’entrée réel vers les cockpits.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="cs-card cs-card-tight">
                  <div className="flex items-start gap-3">
                    <Settings2 className="mt-0.5 h-4 w-4 text-[var(--cs-violet)]" />
                    <div>
                      <p className="text-[0.88rem] font-semibold text-[var(--cs-ink-1)]">
                        Configuration
                      </p>
                      <p className="mt-1 text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
                        Chaque employé doit être lisible côté usage et côté setup.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="cs-card cs-card-tight">
                  <div className="flex items-start gap-3">
                    <Wrench className="mt-0.5 h-4 w-4 text-[var(--cs-violet)]" />
                    <div>
                      <p className="text-[0.88rem] font-semibold text-[var(--cs-ink-1)]">
                        Exploitation
                      </p>
                      <p className="mt-1 text-[0.84rem] leading-6 text-[var(--cs-ink-3)]">
                        Le but n’est pas de “parler à une IA”, mais de faire tourner un poste.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <ProfileSection
                title="Actifs maintenant"
                description="Les employés déjà exploitables doivent ressortir avant tout le reste."
                right={
                  refreshing ? (
                    <span className="cs-status cs-status--info">Actualisation…</span>
                  ) : (
                    <ProfileActionLink
                      href="/profile"
                      label="Retour Mon espace"
                    />
                  )
                }
              >
                {activeAgents.length === 0 ? (
                  <ProfileEmptyState
                    title="Aucun employé actif"
                    text="Le meilleur départ aujourd’hui reste d’activer Pierre pour obtenir une vraie valeur opérationnelle immédiate."
                    actions={
                      <>
                        <ProfileActionLink
                          href="/agents/pierre"
                          label="Voir Pierre"
                          primary
                        />
                        <ProfileActionLink
                          href="/checkout?agent=pierre"
                          label="Activer Pierre"
                        />
                      </>
                    }
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {activeAgents.map((agent) => (
                      <EmployeeCard
                        key={agent.slug}
                        agent={agent}
                        order={orderBySlug.get(agent.slug) ?? null}
                      />
                    ))}
                  </div>
                )}
              </ProfileSection>

              <ProfileSection
                title="Disponibles maintenant"
                description="Ce bloc doit rendre évident l’employé à activer quand rien n’est encore ouvert."
              >
                {availableToActivate.length === 0 ? (
                  <ProfileEmptyState
                    title="Aucun autre employé immédiatement activable"
                    text="L’entrée publique ouverte aujourd’hui reste concentrée sur Pierre."
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {availableToActivate.map((agent) => (
                      <EmployeeCard
                        key={agent.slug}
                        agent={agent}
                        order={null}
                      />
                    ))}
                  </div>
                )}
              </ProfileSection>

              <ProfileSection
                title="Univers CloneStore"
                description="Les employés à venir doivent exister proprement dans l’écosystème sans être survendus."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {futureAgents.map((agent) => (
                    <EmployeeCard
                      key={agent.slug}
                      agent={agent}
                      order={orderBySlug.get(agent.slug) ?? null}
                    />
                  ))}
                </div>
              </ProfileSection>

              <section className="grid gap-4 md:grid-cols-3">
                <ProfileStatCard
                  title="Actifs"
                  value={activeOrders.length}
                  helper="Employés réellement utilisables"
                  icon={<BadgeCheck className="h-5 w-5" />}
                  tone="success"
                />
                <ProfileStatCard
                  title="Entrée forte"
                  value="Pierre"
                  helper="Le point de départ le plus crédible aujourd’hui"
                  icon={<Sparkles className="h-5 w-5" />}
                  tone="violet"
                />
                <ProfileStatCard
                  title="Support"
                  value="CloneChat"
                  helper="Doit orienter, expliquer et réduire la friction"
                  icon={<Bot className="h-5 w-5" />}
                  tone="blue"
                />
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}