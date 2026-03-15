"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type CheckoutSuccess = { url: string };
type CheckoutFailure = { error: string };
type CheckoutResponse = CheckoutSuccess | CheckoutFailure;

const ALLOWED_AGENTS = ["pierre", "clara", "alex", "emma", "noah"] as const;
type AgentSlug = (typeof ALLOWED_AGENTS)[number];

function isAllowedAgent(value: string): value is AgentSlug {
  return (ALLOWED_AGENTS as readonly string[]).includes(value);
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const agent = useMemo(() => {
    const raw = (searchParams.get("agent") || "pierre").toLowerCase().trim();
    return raw;
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAllowedAgent(agent)) {
      setErr("Agent invalide.");
      return;
    }

    setErr(null);
  }, [agent]);

  async function goCheckout() {
    if (!isAllowedAgent(agent)) {
      setErr("Agent invalide.");
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const browserClient = supabaseBrowser();

      if (!browserClient) {
        setLoading(false);
        setErr("Supabase navigateur non configuré.");
        return;
      }

      const { data: sessionRes, error: sessionErr } =
        await browserClient.auth.getSession();

      if (sessionErr) {
        setLoading(false);
        setErr(sessionErr.message);
        return;
      }

      const user = sessionRes.session?.user;

      if (!user) {
        setLoading(false);
        const next = encodeURIComponent(`/checkout?agent=${agent}`);
        router.push(`/login?next=${next}`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          agent_slug: agent,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<CheckoutResponse>;

      if (!res.ok) {
        setLoading(false);
        setErr((data as CheckoutFailure)?.error || "Checkout impossible.");
        return;
      }

      const url = (data as CheckoutSuccess)?.url;

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
    <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
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










