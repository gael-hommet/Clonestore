"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type OrdersMe = { active: string[]; past_due: string[]; cancelled: string[] };

type OrderRow = {
  agent_slug: string;
  status: string;
};

const AGENTS = [
  { slug: "pierre", name: "Pierre", role: "Assistant RH rédacteur", price: "299€/mois" },
  { slug: "clara", name: "Clara", role: "Recruteuse IA", price: "549€/mois" },
  { slug: "alex", name: "Alex", role: "Assistant Ops", price: "399€/mois" },
  { slug: "emma", name: "Emma", role: "Support & mails", price: "449€/mois" },
  { slug: "noah", name: "Noah", role: "Assistant direction", price: "499€/mois" },
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

export default function AgentsPage() {
  const supabase = useMemo(() => makeSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrdersMe>({ active: [], past_due: [], cancelled: [] });

  const activeSet = useMemo(() => new Set(orders.active), [orders.active]);

  async function refreshAccess() {
    setLoading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes?.user) {
        // pas connecté => aucun accès
        setOrders({ active: [], past_due: [], cancelled: [] });
        return;
      }

      const user = userRes.user;

      const { data, error } = await supabase
        .from("orders")
        .select("agent_slug,status")
        .eq("user_id", user.id);

      if (error) {
        // si erreur => on n’affiche pas “active” à tort
        setOrders({ active: [], past_due: [], cancelled: [] });
        return;
      }

      setOrders(normalizeOrders((data || []) as OrderRow[]));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 1) load initial
    refreshAccess();

    // 2) refresh auto quand on revient sur l’onglet (après Stripe / navigation)
    const onFocus = () => refreshAccess();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Boutique d’agents</h1>
        <p className="text-muted-foreground text-sm">
          {loading ? "Chargement des accès…" : "Choisis un agent. Accès instantané après paiement."}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {AGENTS.map((a) => {
          const has = activeSet.has(a.slug);

          return (
            <div key={a.slug} className="rounded-2xl border p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-medium">{a.name}</h2>
                <p className="text-sm text-muted-foreground">{a.role}</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="text-muted-foreground">Prix :</span>{" "}
                  <span className="font-medium">{a.price}</span>
                </p>

                <span className="text-xs text-muted-foreground">
                  {has ? "Accès actif" : "Non embauché"}
                </span>
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
    </main>
  );
}




