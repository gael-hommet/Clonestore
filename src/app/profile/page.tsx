"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

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
  return status;
}

function statusClass(status: string) {
  const st = (status || "").toLowerCase();
  if (st === "active") return "bg-foreground text-background";
  return "bg-muted text-foreground";
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
    <section className="rounded-2xl border p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{title}</h2>
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
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border p-4">
      <p className="text-sm text-red-600">{message}</p>
    </section>
  );
}

export default function ProfilePage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return null;
    return createClient(url, anon);
  }, []);

  const [loading, setLoading] = useState(true);
  const [logoutBusy, setLogoutBusy] = useState(false);
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

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);

    if (!supabase) {
      setError(
        "Configuration Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local puis redémarre le serveur."
      );
      setLoading(false);
      return;
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      setError(userErr.message);
      setLoading(false);
      return;
    }

    if (!userRes.user) {
      setUserId(null);
      setEmail(null);
      setProfile(null);
      setOrders([]);
      setLoading(false);
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
      return;
    }

    setOrders((ordRes.data ?? []) as OrderRow[]);
    setLoading(false);
  }, [supabase]);

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
    refresh();
  }, [refresh]);

  const lastActive = activeOrders[0] ?? null;

  return (
    <main className="mx-auto max-w-5xl py-12 px-4 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
          <p className="text-sm text-muted-foreground">Compte, agents et facturation.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/agents">Boutique</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/profile/agents">Mes agents</Link>
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
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {!loading && !userId ? (
        <Section
          title="Connexion"
          description="Connecte-toi pour accéder à ton compte et à tes agents."
          right={
            <Button asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
          }
        >
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">
              Une fois connecté, tu pourras gérer tes accès et utiliser tes agents.
            </p>
          </div>
        </Section>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}

      {!loading && userId ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Identité" description="Informations du compte.">
            <div className="rounded-xl border p-4 space-y-2">
              <KeyValueRow label="Nom" value={displayName} />
              <KeyValueRow label="Email" value={profile?.email || email || "—"} />
              <KeyValueRow label="User ID" value={userId} mono />
            </div>
          </Section>

          <Section title="Agents" description="Vue rapide des accès.">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Actifs" value={activeOrders.length} />
              <StatCard label="Résiliés / autres" value={cancelledOrders.length} />
            </div>

            <div className="mt-3 rounded-xl border p-4 space-y-3">
              <p className="text-sm font-medium">Dernier agent actif</p>

              {lastActive ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {titleCaseSlug(lastActive.agent_slug)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Actif depuis : {fmtDate(lastActive.started_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${statusClass(
                      lastActive.status
                    )}`}
                  >
                    {statusLabel(lastActive.status)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun agent actif pour l’instant.</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/profile/agents">Gérer mes agents</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/agents">Embaucher un agent</Link>
              </Button>
            </div>
          </Section>

          <Section title="Facturation" description="Paiements et abonnements.">
            <div className="rounded-xl border p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Accède au paiement et à tes abonnements.</p>
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
            description="Connexion et actions sensibles."
            right={
              <Button variant="destructive" onClick={logout} disabled={logoutBusy}>
                {logoutBusy ? "Déconnexion…" : "Se déconnecter"}
              </Button>
            }
          >
            <div className="rounded-xl border p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Session : {profile?.email || email || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Si tu as un doute sur un accès, contacte le support.
              </p>
            </div>
          </Section>

          <section className="rounded-2xl border p-6 space-y-4 md:col-span-2">
            <header className="space-y-1">
              <h2 className="text-lg font-medium">Historique</h2>
              <p className="text-sm text-muted-foreground">
                Agents et statuts associés à ton compte.
              </p>
            </header>

            {orders.length === 0 ? (
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">
                  Aucun achat / abonnement pour l’instant.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-3 px-4 font-medium">Agent</th>
                      <th className="py-3 px-4 font-medium">Statut</th>
                      <th className="py-3 px-4 font-medium">Début</th>
                      <th className="py-3 px-4 font-medium">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b last:border-b-0">
                        <td className="py-3 px-4 font-medium">
                          {titleCaseSlug(o.agent_slug)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${statusClass(
                              o.status
                            )}`}
                          >
                            {statusLabel(o.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {fmtDate(o.started_at)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {fmtDate(o.ended_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/agents">Boutique</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile/agents">Mes agents</Link>
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}














