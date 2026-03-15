"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type CheckoutResponse = { url?: string; error?: string };

const ALLOWED_AGENTS = ["pierre", "clara", "alex", "emma", "noah"] as const;
type AgentSlug = (typeof ALLOWED_AGENTS)[number];

function isAllowedAgent(v: string): v is AgentSlug {
  return (ALLOWED_AGENTS as readonly string[]).includes(v);
}

function PaiementContent() {
  const sp = useSearchParams();
  const router = useRouter();

  const agentRaw = (sp.get("agent") ?? "pierre").toLowerCase().trim();
  const agent: AgentSlug | null = isAllowedAgent(agentRaw) ? agentRaw : null;

  const supabase = useMemo(() => supabaseBrowser(), []);

  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ Session stable + écoute des changements
  useEffect(() => {
    let alive = true;

    async function checkSession() {
      setChecking(true);
      const { data, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setIsAuthed(false);
      } else {
        setIsAuthed(!!data.session?.user?.id);
      }

      setChecking(false);
    }

    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setIsAuthed(!!session?.user?.id);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function goStripe() {
    if (!agent) {
      setErr("Agent invalide.");
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw new Error(sessionErr.message);

      const user = sessionRes.session?.user;
      if (!user) {
        const next = encodeURIComponent(`/paiement?agent=${agent}`);
        router.push(`/login?next=${next}`);
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, agent_slug: agent }),
      });

      const data = (await res.json().catch(() => ({}))) as CheckoutResponse;

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Checkout impossible.");
      }

      window.location.assign(data.url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur paiement.");
    } finally {
      setLoading(false);
    }
  }

  const canPay = !checking && !!agent && (isAuthed || !isAuthed) && !loading; // bouton actif même si pas authed (on redirige login)

  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Paiement</h1>
        <p className="text-sm text-muted-foreground">
          Agent sélectionné : <strong>{agent ?? agentRaw}</strong>
        </p>
      </header>

      <div className="rounded-2xl border p-5 space-y-3">
        <div className="text-sm text-muted-foreground">
          {checking ? (
            "Vérification de la session…"
          ) : isAuthed ? (
            "Session OK. Tu peux continuer."
          ) : (
            "Tu n’es pas connecté. On te redirigera vers la page de connexion avant Stripe."
          )}
        </div>

        {err && (
          <div className="rounded-xl border p-3">
            <p className="text-sm text-red-600">{err}</p>
          </div>
        )}

        <div className="space-y-2">
          <Button onClick={goStripe} disabled={!canPay || !agent} className="w-full">
            {loading ? "Redirection vers Stripe…" : "Continuer vers Stripe"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/agents/${agent ?? "pierre"}`)}
            disabled={loading}
          >
            Revenir à la fiche agent
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Si tu as déjà payé et que l’accès n’est pas activé, le problème vient de l’activation côté
          serveur (webhook / orders).
        </p>
      </div>
    </main>
  );
}

export default function PaiementPage() {
  // ✅ Obligatoire pour useSearchParams dans l’App Router
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-4 py-12">
          <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
            Chargement…
          </div>
        </main>
      }
    >
      <PaiementContent />
    </Suspense>
  );
}