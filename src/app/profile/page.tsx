"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Clock,
  ShieldCheck,
  Layers,
  User,
  Mail,
  Fingerprint,
  CreditCard,
  Package,
  Sparkles,
  ArrowRight,
  Activity,
  BadgeCheck,
  AlertCircle,
  LogOut,
  ShoppingBag,
  LifeBuoy,
  Settings2,
  FileText,
  PenSquare,
} from "lucide-react";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type OrderRow = {
  id: string;
  agent_slug: string;
  status: "active" | "cancelled" | string;
  started_at: string | null;
  ended_at: string | null;
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
  if (st === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (st === "past_due") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (st === "trialing") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-border bg-muted text-foreground";
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

function initialsFromName(name: string | null | undefined, email: string | null | undefined) {
  const n = safeTrim(name);
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean).slice(0, 2);
    const chars = parts.map((p) => p.charAt(0).toUpperCase()).join("");
    if (chars) return chars;
  }
  const e = safeTrim(email);
  if (e) return e.slice(0, 2).toUpperCase();
  return "CS";
}

function Section({
  title,
  description,
  children,
  right,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-background/80 p-6 shadow-sm space-y-4 cs-card">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

function KeyValueRow({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-background/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <div className="text-muted-foreground shrink-0">{icon}</div> : null}
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p
        className={`text-right text-sm font-medium break-all ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background/70 p-4 shadow-sm cs-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
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
    <div className="rounded-2xl border bg-background/70 p-6 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border bg-background">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild>
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border bg-background/70 p-4 transition hover:bg-background hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{icon}</div>
            <p className="text-sm font-medium">{title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const activeOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() === "active"),
    [orders]
  );

  const cancelledOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() !== "active"),
    [orders]
  );

  const displayName = useMemo(() => {
    return (
      safeTrim(profile?.full_name) ||
      safeTrim(profile?.email) ||
      safeTrim(email) ||
      "Compte CloneStore"
    );
  }, [profile?.full_name, profile?.email, email]);

  const avatarInitials = useMemo(
    () => initialsFromName(profile?.full_name, profile?.email || email),
    [profile?.full_name, profile?.email, email]
  );

  const lastActive = useMemo(() => activeOrders[0] ?? null, [activeOrders]);

  const hasPierre = useMemo(
    () => orders.some((o) => o.agent_slug === "pierre" && (o.status || "").toLowerCase() === "active"),
    [orders]
  );

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
        setEmail(null);
        setProfile(null);
        setOrders([]);
        setLoading(false);
        setRefreshBusy(false);
        return;
      }

      const uid = userRes.user.id;
      setUserId(uid);
      setEmail(userRes.user.email ?? null);

      const profRes = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", uid)
        .maybeSingle();

      if (!profRes.error) {
        setProfile((profRes.data as ProfileRow) ?? null);
      } else {
        setProfile(null);
      }

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

  const logout = useCallback(async () => {
    if (!supabase) return;

    try {
      setLogoutBusy(true);
      setError(null);
      await supabase.auth.signOut();
      setUserId(null);
      setEmail(null);
      setProfile(null);
      setOrders([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de déconnexion");
    } finally {
      setLogoutBusy(false);
    }
  }, [supabase]);

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 space-y-8">
      <header className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-background text-lg font-semibold tracking-wide shadow-sm">
              {avatarInitials}
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Espace client</p>
                <h1 className="text-3xl font-semibold tracking-tight">Mon compte</h1>
                <p className="text-sm text-muted-foreground">
                  Gère ton profil, tes clones, tes accès et ta facturation depuis un seul espace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 cs-pill">
                  <Clock size={14} /> Mise en place rapide
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 cs-pill">
                  <ShieldCheck size={14} /> Données isolées + logs
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 cs-pill">
                  <Layers size={14} /> Clones spécialisés
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refresh(true)} disabled={loading || refreshBusy}>
              {refreshBusy ? "Actualisation…" : "Actualiser"}
            </Button>

            <Button asChild variant="outline">
              <Link href="/agents">Boutique</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/profile/agents">Mes clones</Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/questions">Support</Link>
            </Button>

            <Button
              variant="destructive"
              onClick={logout}
              disabled={logoutBusy || loading || !userId}
              title={!userId ? "Connecte-toi pour te déconnecter" : "Se déconnecter"}
            >
              {logoutBusy ? "Déconnexion…" : "Se déconnecter"}
            </Button>
          </div>
        </div>

        {!loading && userId ? (
          <section className="rounded-3xl border bg-background/80 p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Bienvenue</p>
                  <h2 className="text-2xl font-semibold tracking-tight">{displayName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {profile?.email || email || "Adresse email indisponible"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label="Clones actifs"
                    value={activeOrders.length}
                    helper="Accès actuellement utilisables"
                    icon={<BadgeCheck className="h-5 w-5" />}
                  />
                  <StatCard
                    label="Autres statuts"
                    value={cancelledOrders.length}
                    helper="Résiliés ou non actifs"
                    icon={<Activity className="h-5 w-5" />}
                  />
                  <StatCard
                    label="Total"
                    value={orders.length}
                    helper="Historique global"
                    icon={<Package className="h-5 w-5" />}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-background/70 p-4 space-y-3">
                <p className="text-sm font-medium">Actions rapides</p>

                <div className="grid gap-3">
                  <QuickAction
                    href="/profile/agents"
                    title="Gérer mes clones"
                    description="Accès, paramètres et pages d’utilisation."
                    icon={<Package className="h-4 w-4" />}
                  />
                  <QuickAction
                    href="/agents"
                    title="Embaucher un clone"
                    description="Découvrir les clones disponibles."
                    icon={<ShoppingBag className="h-4 w-4" />}
                  />
                  <QuickAction
                    href="/agents/pierre/setup"
                    title="Configurer Pierre"
                    description="Ouvrir le formulaire 1 et modifier la configuration à tout moment."
                    icon={<Settings2 className="h-4 w-4" />}
                  />
                  <QuickAction
                    href="/paiement"
                    title="Paiement"
                    description="Gérer les souscriptions et accès."
                    icon={<CreditCard className="h-4 w-4" />}
                  />
                  <QuickAction
                    href="/questions"
                    title="Support"
                    description="Poser une question ou signaler un blocage."
                    icon={<LifeBuoy className="h-4 w-4" />}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {!loading && !userId ? (
        <Section
          title="Connexion"
          description="Connecte-toi pour accéder à ton compte et à tes clones."
          right={
            <Button asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
          }
        >
          <EmptyState
            title="Aucune session active"
            description="Une fois connecté, tu pourras accéder à tes clones, à tes accès et à ton historique."
            ctaHref="/login"
            ctaLabel="Aller à la connexion"
          />
        </Section>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border bg-background/70 p-6">
          <p className="text-sm text-muted-foreground">Chargement du compte…</p>
        </div>
      ) : null}

      {!loading && userId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Identité" description="Informations principales du compte.">
            <div className="space-y-3">
              <KeyValueRow label="Nom affiché" value={displayName} icon={<User className="h-4 w-4" />} />
              <KeyValueRow
                label="Adresse email"
                value={profile?.email || email || "—"}
                icon={<Mail className="h-4 w-4" />}
              />
              <KeyValueRow
                label="User ID"
                value={userId}
                mono
                icon={<Fingerprint className="h-4 w-4" />}
              />
            </div>
          </Section>

          <Section
            title="Clones"
            description="Vue rapide de tes accès actuels et de ton dernier clone actif."
            right={
              <Button asChild variant="outline">
                <Link href="/profile/agents">Voir tout</Link>
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Actifs" value={activeOrders.length} icon={<BadgeCheck className="h-5 w-5" />} />
                <StatCard label="Résiliés / autres" value={cancelledOrders.length} icon={<Activity className="h-5 w-5" />} />
              </div>

              <div className="rounded-2xl border bg-background/70 p-4 space-y-3">
                <p className="text-sm font-medium">Dernier clone actif</p>

                {lastActive ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold">
                        {titleCaseSlug(lastActive.agent_slug)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Actif depuis : {fmtDate(lastActive.started_at)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${statusClass(
                        lastActive.status
                      )}`}
                    >
                      {statusLabel(lastActive.status)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun clone actif pour l’instant.</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/profile/agents">Gérer mes clones</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/agents">Embaucher un clone</Link>
                </Button>
              </div>
            </div>
          </Section>

          <Section
            title="Pierre"
            description="Accès direct à la configuration et au formulaire principal de Pierre."
            right={
              hasPierre ? (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  Pierre actif
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
                  Pierre non actif
                </span>
              )
            }
          >
            <div className="space-y-4">
              <div className="rounded-2xl border bg-background/70 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Formulaire 1 Pierre</p>
                    <p className="text-sm text-muted-foreground">
                      Configure l’entreprise, les coordonnées, la signature, les règles internes et
                      l’identité email de Pierre. Tu peux modifier ces informations à tout moment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/agents/pierre/setup">
                    Ouvrir la configuration Pierre
                  </Link>
                </Button>

                <Button asChild variant="outline">
                  <Link href="/agents/pierre/use">Utiliser Pierre</Link>
                </Button>

                <Button asChild variant="outline">
                  <Link href="/agents/pierre">Voir la fiche Pierre</Link>
                </Button>
              </div>

              <div className="rounded-2xl border bg-background/70 p-4">
                <div className="flex items-start gap-3">
                  <PenSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Le formulaire 1 sert de mémoire principale pour Pierre. Il n’a pas besoin d’être
                    refait : il se complète une première fois, puis se met à jour directement depuis
                    ton compte.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Facturation" description="Paiements, souscriptions et accès payants.">
            <div className="rounded-2xl border bg-background/70 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CreditCard className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Paiements et abonnements</p>
                  <p className="text-sm text-muted-foreground">
                    Accède rapidement à tes pages de paiement et à la gestion de tes abonnements.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/paiement">Paiement</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/profile/agents">Abonnements</Link>
                </Button>
              </div>
            </div>
          </Section>

          <Section
            title="Sécurité"
            description="Session en cours et actions sensibles."
            right={
              <Button
                variant="destructive"
                onClick={logout}
                disabled={logoutBusy}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                {logoutBusy ? "Déconnexion…" : "Se déconnecter"}
              </Button>
            }
          >
            <div className="rounded-2xl border bg-background/70 p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Session active : {profile?.email || email || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Si tu remarques un comportement anormal, contacte le support immédiatement.
              </p>
            </div>
          </Section>

          <section className="rounded-3xl border bg-background/80 p-6 shadow-sm space-y-4 lg:col-span-2 cs-card">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">Historique</h2>
                <p className="text-sm text-muted-foreground">
                  Clones liés à ton compte et statuts associés.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/agents">Boutique</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/profile/agents">Mes clones</Link>
                </Button>
              </div>
            </header>

            {orders.length === 0 ? (
              <EmptyState
                title="Aucun achat pour le moment"
                description="Dès que tu embauches un clone, il apparaîtra ici avec son statut et ses dates."
                ctaHref="/agents"
                ctaLabel="Découvrir la boutique"
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-background/70">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-3 font-medium">Clone</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Début</th>
                      <th className="px-4 py-3 font-medium">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background text-xs font-semibold">
                              {titleCaseSlug(o.agent_slug).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">{titleCaseSlug(o.agent_slug)}</p>
                              <p className="text-xs text-muted-foreground">{o.agent_slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${statusClass(
                              o.status
                            )}`}
                          >
                            {statusLabel(o.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.started_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.ended_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
















