"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

type CheckoutResponse = { url?: string; error?: string };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function PaiementPage() {
  const sp = useSearchParams();
  const agent = sp.get("agent") ?? "pierre";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);
    setLoading(true);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser();

      if (error) throw new Error(error.message);

      const user = data?.user;
      if (!user) {
        setErr("Connecte-toi avant de payer.");
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, agent_slug: agent }),
      });

      const json = (await res.json()) as CheckoutResponse;

      if (!res.ok || !json.url) {
        setErr(json.error ?? "Checkout impossible.");
        return;
      }

      window.location.href = json.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <h1 className="text-2xl font-semibold">Paiement</h1>

      <p className="text-sm text-muted-foreground">
        Tu vas embaucher : <strong>{agent}</strong>
      </p>

      <Button onClick={go} disabled={loading}>
        {loading ? "Redirection..." : "Continuer vers Stripe"}
      </Button>

      {err && <p className="text-sm text-red-600">{err}</p>}
    </main>
  );
}









