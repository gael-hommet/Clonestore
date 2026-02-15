"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

  // ✅ important : persistance + auto refresh (comportement normal côté client)
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

type CheckoutResponse = { url: string } | { error: string };

const ALLOWED_AGENTS = ["pierre", "clara", "alex", "emma", "noah"] as const;
type AgentSlug = (typeof ALLOWED_AGENTS)[number];

function isAllowedAgent(v: string): v is AgentSlug {
  return (ALLOWED_AGENTS as readonly string[]).includes(v);
}

export default function CheckoutPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const agent = useMemo(() => {
    const raw = (sp.get("agent") || "pierre").toLowerCase().trim();
    return raw;
  }, [sp]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // validation agent
    if (!isAllowedAgent(agent)) {
      setErr("Agent invalide.");
    } else {
      setErr(null);
    }
  }, [agent]);

  async function goCheckout() {
    if (!isAllowedAgent(agent)) return;

    setErr(null);
    setLoading(true);

    try {
      const supabase = getSupabase();

      // ✅ session d’abord (plus fiable)
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        setLoading(false);
        setErr(sessionErr.message);
        return;
      }

      const user = sessionRes.session?.user;
      if (!user) {
        setLoading(false);
        const next = encodeURIComponent(`/paiement/checkout?agent=${agent}`);
        router.push(`/login?next=${next}`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, agent_slug: agent }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<CheckoutResponse>;

      if (!res.ok) {
        setLoading(false);
        setErr((data as { error?: string })?.error || "Checkout impossible.");
        return;
      }

      const url = (data as { url?: string })?.url;
      if (!url) {
        setLoading(false);
        setErr("Checkout impossible (url manquante).");
        return;
      }

      window.location.assign(url);
    } catch (e: unknown) {
      setLoading(false);
      setErr(e instanceof Error ? e.message : "Erreur checkout.");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Paiement</h1>
        <p className="text-sm text-muted-foreground">
          Agent sélectionné : <strong>{agent}</strong>
        </p>
      </header>

      {err && (
        <div className="rounded-xl border p-4">
          <p className="text-sm text-red-600">{err}</p>
        </div>
      )}

      <div className="space-y-3">
        <Button onClick={goCheckout} disabled={loading || !!err} className="w-full">
          {loading ? "Redirection vers Stripe…" : "Continuer vers Stripe"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/agents/${agent}`)}
          disabled={loading}
        >
          Revenir à la fiche agent
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Si tu as déjà payé et que l’agent ne s’active pas, le problème vient du webhook Stripe
        (activation côté serveur).
      </p>
    </main>
  );
}











