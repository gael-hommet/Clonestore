"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type OrdersMe = { active: string[]; past_due: string[]; cancelled: string[] };

const AGENTS = [
  { slug: "pierre", name: "Pierre", role: "Assistant RH rédacteur", price: "299€/mois" },
  { slug: "clara", name: "Clara", role: "Recruteuse IA", price: "—" },
  { slug: "alex", name: "Alex", role: "Assistant Ops", price: "—" },
  { slug: "emma", name: "Emma", role: "Support & mails", price: "—" },
  { slug: "noah", name: "Noah", role: "Assistant direction", price: "—" },
];

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrdersMe>({ active: [], past_due: [], cancelled: [] });

  const activeSet = useMemo(() => new Set(orders.active), [orders.active]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        const res = await fetch("/api/orders/me", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && !data?.error) setOrders(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
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



