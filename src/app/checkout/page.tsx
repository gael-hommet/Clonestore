"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Supabase non configuré : vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, anon);
}

type CheckoutResponse =
  | { url: string }
  | { error: string };

export default function CheckoutPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const agent = (sp.get("agent") || "pierre").toLowerCase();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // si tu veux empêcher des agents inconnus
    const allowed = ["pierre", "clara", "alex", "emma", "noah"];
    if (!allowed.includes(agent)) {
      setErr("Agent invalide.");
    }
  }, [agent]);

  async function goCheckout() {
    setErr(null);
    setLoading(true);

    try {
      const supabase = getSupabase();

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setLoading(false);
        setErr(userErr.message);
        return;
      }

      const user = userRes.user;
      if (!user) {
        setLoading(false);
        router.push("/login");
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, agent_slug: agent }),
      });

      const json = (await res.json().catch(() => ({}))) as Partial<CheckoutResponse>;

      if (!res.ok) {
        setLoading(false);
        setErr((json as { error?: string })?.error || "Checkout impossible.");
        return;
      }

      const url = (json as { url?: string })?.url;
      if (!url) {
        setLoading(false);
        setErr("Checkout impossible (url manquante).");
        return;
      }

      window.location.href = url;
    } catch (e: unknown) {
      setLoading(false);
      setErr(e instanceof Error ? e.message : "Erreur checkout.");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Agent sélectionné : <strong>{agent}</strong>
        </p>
      </header>

      {err && (
        <div className="rounded-xl border p-4">
          <p className="text-sm text-red-600">{err}</p>
        </div>
      )}

      <Button onClick={goCheckout} disabled={loading || !!err}>
        {loading ? "Redirection vers Stripe…" : "Continuer vers Stripe"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Si tu as déjà payé et que rien ne s’active, on vérifie ensuite le webhook (étape 3).
      </p>
    </main>
  );
}










