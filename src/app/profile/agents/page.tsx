"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

type OrderRow = {
  id: string;
  agent_slug: string;
  status: "active" | "cancelled" | string;
  started_at: string; // obligatoire chez toi
  ended_at: string | null;
};

const AGENT_CATALOG: Record<
  string,
  { name: string; short: string; highlights: string[] }
> = {
  pierre: {
    name: "Pierre",
    short: "Assistant RH : rédaction, structuration et automatisation des documents prêts à envoyer.",
    highlights: [
      "Offres d’emploi prêtes à publier",
      "Mails candidats (reçus, refus, relances)",
      "Fiches de poste + grilles d’entretien",
      "Onboarding (J1 → J30) + documents internes",
      "Comptes rendus, scripts, procédures",
    ],
  },
  clara: {
    name: "Clara",
    short: "Recruteuse IA : analyse, scoring et shortlist candidats avec messages prêts à envoyer.",
    highlights: [
      "Analyse et scoring de CV",
      "Shortlist + justification",
      "Questions d’entretien adaptées",
      "Mails automatiques candidats",
      "Suivi de pipeline recrutement",
    ],
  },
  alex: { name: "Alex", short: "Agent CloneStore (bientôt).", highlights: [] },
  emma: { name: "Emma", short: "Agent CloneStore (bientôt).", highlights: [] },
  noah: { name: "Noah", short: "Agent CloneStore (bientôt).", highlights: [] },
};

function statusBadge(status: string) {
  if (status === "active") {
    return { label: "Actif", className: "bg-foreground text-background" };
  }
  if (status === "cancelled") {
    return { label: "Résilié", className: "bg-muted text-foreground" };
  }
  return { label: status, className: "bg-muted text-foreground" };
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function MesAgentsPage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      // Ça évite des erreurs bizarres "No API key found"
      throw new Error(
        "Supabase non configuré : vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local"
      );
    }
    return createClient(url, anon);
  }, []);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setOrders([]);
      setLoading(false);
      setError(userErr.message);
      return;
    }

    const user = userRes?.user;
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // IMPORTANT : chez toi c’est user_id (pas client_id)
    // IMPORTANT : on trie par started_at (PAS created_at)
    const { data, error: selErr } = await supabase
      .from("orders")
      .select("id, agent_slug, status, started_at, ended_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (selErr) {
      setOrders([]);
      setLoading(false);
      setError(selErr.message);
      return;
    }

    setOrders((data || []) as OrderRow[]);
    setLoading(false);
  }

  async function cancelAgent(agent_slug: string) {
    try {
      setBusySlug(agent_slug);
      setError(null);

      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;

      if (!token) {
        setError("Tu dois être connecté.");
        setBusySlug(null);
        return;
      }

      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_slug, access_token: token }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "Impossible de résilier.");
        setBusySlug(null);
        return;
      }

      await refresh();
      setBusySlug(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusySlug(null);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = orders.filter((o) => o.status === "active");
  const history = orders.filter((o) => o.status !== "active");

  return (
    <main className="mx-auto max-w-6xl py-12 px-4 space-y-10">
      {/* Header pro */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Mes agents</h1>
            <p className="text-sm text-muted-foreground">
              Ici tu retrouves les agents que tu as embauchés. Les agents actifs sont utilisables
              immédiatement. Les agents résiliés restent visibles en historique.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/agents">Aller à la boutique</Link>
          </Button>
        </div>

        {/* Stat cards */}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border p-4">
            <p className="text-xs text-muted-foreground">Agents actifs</p>
            <p className="text-2xl font-semibold">{active.length}</p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-xs text-muted-foreground">Historique</p>
            <p className="text-2xl font-semibold">{history.length}</p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{orders.length}</p>
          </div>
        </section>
      </header>

      {/* Erreur */}
      {error && (
        <section className="rounded-2xl border p-4">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Astuce : si l’erreur parle de colonne manquante, c’est 100% un décalage entre le code et la base.
          </p>
        </section>
      )}

      {/* Loading */}
      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {/* Empty */}
      {!loading && orders.length === 0 && (
        <section className="rounded-2xl border p-8 space-y-4">
          <div className="space-y-1">
            <p className="text-base font-medium">Aucun agent pour le moment</p>
            <p className="text-sm text-muted-foreground">
              Va dans la boutique pour embaucher ton premier agent.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild>
              <Link href="/agents">Voir la boutique</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/questions">Poser une question</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Content */}
      {!loading && orders.length > 0 && (
        <div className="space-y-12">
          {/* Actifs */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Actifs</h2>
              <Button asChild variant="outline">
                <Link href="/questions">Questions avant achat</Link>
              </Button>
            </div>

            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun agent actif.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {active.map((o) => {
                  const meta = AGENT_CATALOG[o.agent_slug] || {
                    name: o.agent_slug,
                    short: "Agent CloneStore.",
                    highlights: [],
                  };
                  const badge = statusBadge(o.status);

                  return (
                    <article
                      key={o.id}
                      className="rounded-2xl border p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-base font-semibold truncate">{meta.name}</p>
                          <p className="text-sm text-muted-foreground">{meta.short}</p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Actif depuis : {fmtDate(o.started_at)}</p>
                      </div>

                      {meta.highlights.length > 0 && (
                        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                          {meta.highlights.slice(0, 5).map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <Button asChild className="w-full sm:w-auto">
                          <Link href={`/agents/${o.agent_slug}/use`}>Utiliser</Link>
                        </Button>

                        <Button asChild variant="outline" className="w-full sm:w-auto">
                          <Link href={`/agents/${o.agent_slug}`}>Ouvrir la fiche</Link>
                        </Button>

                        <Button
                          variant="destructive"
                          className="w-full sm:w-auto"
                          onClick={() => cancelAgent(o.agent_slug)}
                          disabled={busySlug === o.agent_slug}
                        >
                          {busySlug === o.agent_slug ? "Résiliation…" : "Résilier"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Historique */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Historique</h2>

            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun agent résilié.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {history.map((o) => {
                  const meta = AGENT_CATALOG[o.agent_slug] || {
                    name: o.agent_slug,
                    short: "Agent CloneStore.",
                    highlights: [],
                  };
                  const badge = statusBadge(o.status);

                  return (
                    <article
                      key={o.id}
                      className="rounded-2xl border p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-base font-semibold truncate">{meta.name}</p>
                          <p className="text-sm text-muted-foreground">{meta.short}</p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Début : {fmtDate(o.started_at)}</p>
                        <p>Fin : {fmtDate(o.ended_at)}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                          <Link href={`/agents/${o.agent_slug}`}>Ouvrir la fiche</Link>
                        </Button>

                        <Button asChild className="w-full sm:w-auto">
                          <Link href={`/paiement?agent=${o.agent_slug}`}>Ré-embaucher</Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}










