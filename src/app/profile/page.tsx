"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  try {
    return new Date(value).toLocaleString("fr-FR");
  } catch {
    return value;
  }
}

function statusBadge(status: string) {
  if (status === "active") {
    return { label: "Actif", className: "bg-foreground text-background" };
  }
  if (status === "cancelled") {
    return { label: "Résilié", className: "bg-muted text-foreground" };
  }
  return { label: status, className: "bg-muted text-foreground" };
}

export default function ProfilePage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Si l'env saute -> on affiche une erreur claire au lieu de crash
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

  const activeOrders = orders.filter((o) => o.status === "active");
  const cancelledOrders = orders.filter((o) => o.status !== "active");

  async function refresh() {
    setError(null);
    setLoading(true);

    if (!supabase) {
      setError(
        "Configuration Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local puis redémarre le serveur."
      );
      setLoading(false);
      return;
    }

    // 1) User
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

    // 2) Profile (table public.profiles : id / email / full_name)
    const prof = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", uid)
      .maybeSingle();

    if (prof.error) {
      // pas bloquant : on affiche quand même la page
      setProfile(null);
    } else {
      setProfile((prof.data as ProfileRow) ?? null);
    }

    // 3) Orders (table public.orders : user_id / agent_slug / status / started_at / ended_at)
    const ord = await supabase
      .from("orders")
      .select("id, agent_slug, status, started_at, ended_at")
      .eq("user_id", uid)
      .order("started_at", { ascending: false });

    if (ord.error) {
      setError(ord.error.message);
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((ord.data ?? []) as OrderRow[]);
    setLoading(false);
  }

  async function logout() {
    if (!supabase) return;
    try {
      setLogoutBusy(true);
      setError(null);
      await supabase.auth.signOut();
      // refresh état UI
      setUserId(null);
      setEmail(null);
      setProfile(null);
      setOrders([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de déconnexion";
      setError(msg);
    } finally {
      setLogoutBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName =
    profile?.full_name?.trim() ||
    profile?.email?.trim() ||
    email?.trim() ||
    "Compte CloneStore";

  return (
    <main className="mx-auto max-w-5xl py-12 px-4 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
          <p className="text-sm text-muted-foreground">
            Gestion du compte, sécurité, agents et facturation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/agents">Boutique</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/profile/agents">Mes agents</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/questions">Questions</Link>
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

      {/* Erreur */}
      {error && (
        <section className="rounded-2xl border p-4">
          <p className="text-sm text-red-600">{error}</p>
        </section>
      )}

      {/* Not logged */}
      {!loading && !userId && (
        <section className="rounded-2xl border p-6 space-y-3">
          <h2 className="text-lg font-medium">Connexion</h2>
          <p className="text-sm text-muted-foreground">
            Tu n’es pas connecté. Connecte-toi pour accéder à ton compte et tes agents.
          </p>
          <Button asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
        </section>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      )}

      {/* Content */}
      {!loading && userId && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Identité */}
          <section className="rounded-2xl border p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Identité</h2>
              <p className="text-sm text-muted-foreground">
                Informations liées à ton compte CloneStore.
              </p>
            </div>

            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="text-sm font-medium truncate">{displayName}</p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate">
                  {profile?.email || email || "—"}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="text-xs font-mono truncate">{userId}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              (Plus tard on ajoutera : nom d’entreprise, SIRET, rôle, etc.)
            </p>
          </section>

          {/* Résumé agents */}
          <section className="rounded-2xl border p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Agents</h2>
              <p className="text-sm text-muted-foreground">
                Vue rapide de tes agents actifs et historique.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4 space-y-1">
                <p className="text-sm text-muted-foreground">Actifs</p>
                <p className="text-2xl font-semibold">{activeOrders.length}</p>
              </div>

              <div className="rounded-xl border p-4 space-y-1">
                <p className="text-sm text-muted-foreground">Résiliés</p>
                <p className="text-2xl font-semibold">{cancelledOrders.length}</p>
              </div>
            </div>

            {activeOrders.length > 0 && (
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-sm font-medium">Dernier agent actif</p>
                {(() => {
                  const last = activeOrders[0];
                  const badge = statusBadge(last.status);
                  return (
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold capitalize">
                          {last.agent_slug}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Actif depuis : {fmtDate(last.started_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/profile/agents">Gérer mes agents</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/agents">Embaucher un agent</Link>
              </Button>
            </div>
          </section>

          {/* Facturation */}
          <section className="rounded-2xl border p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Facturation</h2>
              <p className="text-sm text-muted-foreground">
                Accès aux paiements et à l’historique des achats.
              </p>
            </div>

            <div className="rounded-xl border p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Prochaine étape : connecter une page “Factures” (Stripe Customer Portal)
                et l’historique des transactions.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/paiement">Paiement</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/profile/agents">Voir mes abonnements</Link>
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              (On finalise la version “entreprise” plus tard : TVA, adresse, etc.)
            </p>
          </section>

          {/* Sécurité */}
          <section className="rounded-2xl border p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Sécurité & connexion</h2>
              <p className="text-sm text-muted-foreground">
                Connexion, sécurité, et actions sensibles.
              </p>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Session</p>
                  <p className="text-xs text-muted-foreground">
                    Connecté en tant que {profile?.email || email || "—"}.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={logout}
                  disabled={logoutBusy}
                >
                  {logoutBusy ? "Déconnexion…" : "Se déconnecter"}
                </Button>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Mot de passe</p>
                <p className="text-xs text-muted-foreground mt-1">
                  (On ajoutera une page “Changer le mot de passe” propre + email de reset.)
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Objectif : expérience “niveau SaaS”, zéro zone floue.
            </p>
          </section>

          {/* Support */}
          <section className="rounded-2xl border p-6 space-y-4 md:col-span-2">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Aide & support</h2>
              <p className="text-sm text-muted-foreground">
                Besoin d’aide ? Utilise l’assistant ou consulte la boutique.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/questions">Poser une question</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/agents">Voir les agents</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/legal/confidentialite">Confidentialité</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              (Plus tard : page Support, tickets, email support, FAQ.)
            </p>
          </section>
        </div>
      )}
    </main>
  );
}











