"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Check, Clock, ShieldCheck, Layers, Activity, CreditCard } from "lucide-react";

type OrdersMe = { active: string[]; past_due: string[]; cancelled: string[] };
type OrderRow = { agent_slug: string; status: string };

type Agent = {
  slug: string;
  name: string;
  role: string;
  price: string;
  bullets: string[];
  workload: string; // “équivalence charge de travail”
};

const AGENTS: Agent[] = [
  {
    slug: "pierre",
    name: "Pierre",
    role: "Assistant RH rédacteur",
    price: "299€/mois",
    bullets: [
      "Rédige vos documents RH (mails, courriers, notes, process)",
      "Standardise vos modèles et vos réponses en interne",
      "Produit des textes prêts à envoyer, au bon ton",
    ],
    workload: "≈ 4 à 8 h / semaine économisées (rédaction & administratif RH)",
  },
  {
    slug: "clara",
    name: "Clara",
    role: "Recruteuse IA",
    price: "549€/mois",
    bullets: [
      "Analyse les candidatures et structure les profils",
      "Score les candidats selon vos critères",
      "Prépare une shortlist exploitable",
    ],
    workload: "≈ 6 à 12 h / semaine économisées (tri & présélection)",
  },
  {
    slug: "alex",
    name: "Alex",
    role: "Assistant Ops",
    price: "399€/mois",
    bullets: [
      "Prépare des procédures et checklists opérationnelles",
      "Synthétise, structure, formalise vos infos",
      "Aide à standardiser les process d’équipe",
    ],
    workload: "≈ 3 à 7 h / semaine économisées (structuration & ops)",
  },
  {
    slug: "emma",
    name: "Emma",
    role: "Support & mails",
    price: "449€/mois",
    bullets: [
      "Prépare des réponses support claires et cohérentes",
      "Classe les demandes et résume les échanges",
      "Aide à maintenir un ton client constant",
    ],
    workload: "≈ 5 à 10 h / semaine économisées (support & email)",
  },
  {
    slug: "noah",
    name: "Noah",
    role: "Assistant direction",
    price: "499€/mois",
    bullets: [
      "Prépare des synthèses et décisions (notes, résumés, plans)",
      "Rédige des mails et documents de pilotage",
      "Aide à cadrer et prioriser des actions",
    ],
    workload: "≈ 3 à 8 h / semaine économisées (pilotage & administratif)",
  },
];

function makeSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase non configuré : vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(url, anon);
}

function normalizeOrders(rows: OrderRow[]): OrdersMe {
  const active: string[] = [];
  const past_due: string[] = [];
  const cancelled: string[] = [];

  for (const r of rows) {
    const slug = r.agent_slug;
    const st = (r.status || "").toLowerCase();
    if (!slug) continue;

    if (st === "active") active.push(slug);
    else if (st === "past_due") past_due.push(slug);
    else if (st === "cancelled") cancelled.push(slug);
  }

  return { active, past_due, cancelled };
}

function badgeFor(slug: string, orders: OrdersMe) {
  if (orders.active.includes(slug)) {
    return { label: "Accès actif", className: "bg-foreground text-background" };
  }
  if (orders.past_due.includes(slug)) {
    return { label: "Paiement en attente", className: "bg-muted text-foreground" };
  }
  if (orders.cancelled.includes(slug)) {
    return { label: "Résilié", className: "bg-muted text-foreground" };
  }
  return { label: "Non embauché", className: "bg-muted text-foreground" };
}

export default function AgentsPage() {
  const supabase = useMemo(() => makeSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrdersMe>({ active: [], past_due: [], cancelled: [] });
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const activeSet = useMemo(() => new Set(orders.active), [orders.active]);

  const refreshAccess = useCallback(async () => {
    setLoading(true);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();

      if (userErr || !userRes?.user) {
        setOrders({ active: [], past_due: [], cancelled: [] });
        return;
      }

      const user = userRes.user;

      const { data, error } = await supabase
        .from("orders")
        .select("agent_slug,status")
        .eq("user_id", user.id);

      if (error) {
        setOrders({ active: [], past_due: [], cancelled: [] });
        return;
      }

      setOrders(normalizeOrders((data || []) as OrderRow[]));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    refreshAccess();

    const onFocus = () => refreshAccess();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAccess();
    });

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      sub.subscription.unsubscribe();
    };
  }, [refreshAccess, supabase]);

  const visibleAgents = useMemo(() => {
    if (filter === "mine") {
      return AGENTS.filter((a) => activeSet.has(a.slug));
    }
    return AGENTS;
  }, [filter, activeSet]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 space-y-10">
      {/* Header */}
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Boutique d’agents</h1>
        <p className="text-muted-foreground text-sm">
          {loading
            ? "Chargement des accès…"
            : "Choisis un agent. Accès instantané après paiement."}
        </p>

        {/* Mini proof / positioning */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <Clock size={14} /> Mise en place &lt; 24h
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <ShieldCheck size={14} /> Données isolées + logs
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <Layers size={14} /> Agents spécialisés (pas des prompts)
          </span>
        </div>
      </header>

      {/* How it works (simple) */}
      <section className="grid gap-4 md:grid-cols-3">
        <HowCard
          title="1. Choisis un agent"
          text="Un agent = un métier. Objectif clair, livrables concrets."
          icon={<Check />}
        />
        <HowCard
          title="2. Configuration entreprise"
          text="Tu le règles à ton contexte : règles, formats, données autorisées."
          icon={<Activity />}
        />
        <HowCard
          title="3. Il exécute"
          text="Il travaille seul ou avec d’autres agents via le Router."
          icon={<Layers />}
        />
      </section>

      {/* Filter */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Agents disponibles</h2>
          <p className="text-sm text-muted-foreground">
            Chaque agent est conçu pour réduire une vraie charge de travail.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            Tous
          </Button>
          <Button
            variant={filter === "mine" ? "default" : "outline"}
            onClick={() => setFilter("mine")}
            disabled={loading}
            title={loading ? "Chargement…" : "Afficher uniquement tes agents actifs"}
          >
            Mes agents
          </Button>
        </div>
      </section>

      {/* Cards */}
      <section className="grid gap-4 sm:grid-cols-2">
        {visibleAgents.map((a) => {
          const has = activeSet.has(a.slug);
          const badge = badgeFor(a.slug, orders);

          return (
            <div key={a.slug} className="rounded-2xl border p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-lg font-medium truncate">{a.name}</h3>
                  <p className="text-sm text-muted-foreground">{a.role}</p>
                </div>

                <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <ul className="text-sm text-muted-foreground space-y-2">
                  {a.bullets.slice(0, 3).map((b, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Équivalence :</span> {a.workload}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="text-muted-foreground">Prix :</span>{" "}
                  <span className="font-medium">{a.price}</span>
                </p>

                {!has ? (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard size={14} /> Accès après paiement
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Utilisable maintenant</span>
                )}
              </div>

              <div className="flex gap-3">
                <Button asChild variant="outline">
                  <Link href={`/agents/${a.slug}`}>Voir</Link>
                </Button>

                {has ? (
                  <Button asChild>
                    <Link href={`/agents/${a.slug}/use`}>Utiliser</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href={`/paiement?agent=${a.slug}`}>Embaucher</Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Trust / Security (short, no overtalk) */}
      <section className="rounded-2xl border p-6 space-y-3">
        <h2 className="text-lg font-medium">Sécurité & confiance</h2>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• Données cloisonnées par entreprise</li>
          <li>• Historique / logs des actions (traçabilité)</li>
          <li>• Aucune donnée utilisée pour l’entraînement</li>
          <li>• Support : chatbot + humain si besoin</li>
        </ul>
      </section>

      {/* CTA final */}
      <section className="text-center space-y-4">
        <h2 className="text-2xl font-semibold">Tu hésites ?</h2>
        <p className="text-sm text-muted-foreground">
          Parle au chatbot : il te dit quel agent correspond à ta charge de travail.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/chatbot">Parler au chatbot</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile">Mon compte</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function HowCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-6 space-y-3">
      <div className="w-10 h-10 rounded-lg border flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}






