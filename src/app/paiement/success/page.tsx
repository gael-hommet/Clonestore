"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// -------- helpers --------
function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase non configuré : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anon, { auth: { persistSession: true } });
}

type ActivateResponse =
  | { ok: true; agent_slug?: string }
  | { ok: false; error?: string };

// on s’attend à ça côté DB
type OrderRow = {
  agent_slug: string;
  status: "active" | "cancelled" | "past_due" | string;
};

export default function PaiementSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();

  const agentFromUrl = useMemo(() => {
    const a = (params.get("agent") || "").trim().toLowerCase();
    return a || null;
  }, [params]);

  const [activating, setActivating] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activatedAgent, setActivatedAgent] = useState<string | null>(agentFromUrl);
  const [error, setError] = useState<string | null>(null);

  const didRun = useRef(false);

  // 1) TENTE l’activation via session_id (si ton API existe)
  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    if (didRun.current) return;
    didRun.current = true;

    let cancelled = false;

    async function activate() {
      setActivating(true);
      setError(null);

      try {
        const res = await fetch("/api/orders/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const payload: ActivateResponse = await res.json().catch(() => ({ ok: false }));

        if (!cancelled && payload && "ok" in payload && payload.ok) {
          if (payload.agent_slug) setActivatedAgent(payload.agent_slug);
        }

        // même si ça échoue, on continue (polling DB)
        if (!cancelled && !res.ok) {
          setError(
            (payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : null) || "Activation en cours…"
          );
        }
      } catch {
        if (!cancelled) setError("Activation en cours…");
      } finally {
        if (!cancelled) setActivating(false);
      }
    }

    activate();

    return () => {
      cancelled = true;
    };
  }, [params]);

  // 2) POLLING Supabase : dès que l’order est "active" => redirection
  useEffect(() => {
    let stopped = false;

    async function pollOrders() {
      try {
        const supabase = getSupabase();

        // user obligatoire
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;

        if (!user) {
          setChecking(false);
          // s’il est plus loggué (cookies), on l’envoie login
          router.replace("/login");
          return;
        }

        const startedAt = Date.now();
        const timeoutMs = 20000; // 20s max
        const intervalMs = 1200; // 1.2s

        while (!stopped) {
          // récupère les orders de l’utilisateur
          const { data, error: sbErr } = await supabase
            .from("orders")
            .select("agent_slug,status")
            .eq("user_id", user.id);

          if (sbErr) {
            setError(sbErr.message);
            break;
          }

          const rows = (data || []) as OrderRow[];

          // si un agent précis est demandé, on check celui-là en priorité
          const target = activatedAgent || agentFromUrl;

          const isActive =
            target
              ? rows.some((r) => r.agent_slug === target && r.status === "active")
              : rows.some((r) => r.status === "active");

          if (isActive) {
            setChecking(false);
            // redirection immédiate vers la page agents (le vrai fix)
            router.replace("/profile/agents");
            return;
          }

          if (Date.now() - startedAt > timeoutMs) {
            setChecking(false);
            // au bout de 20s, on n’insiste pas : user peut aller voir
            return;
          }

          await new Promise((r) => setTimeout(r, intervalMs));
        }
      } catch (e: unknown) {
        setChecking(false);
        setError(e instanceof Error ? e.message : "Erreur vérification activation.");
      }
    }

    pollOrders();

    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, activatedAgent, agentFromUrl]);

  const displayAgent = activatedAgent ? titleCaseSlug(activatedAgent) : "ton agent";
  const primaryHref = activatedAgent ? `/agents/${activatedAgent}` : "/profile/agents";
  const primaryLabel = activatedAgent ? `Accéder à ${displayAgent}` : "Voir mes agents";

  const showSpinner = activating || checking;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border bg-background p-6 text-center space-y-6 shadow-sm">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Paiement confirmé</h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Merci pour ton achat.
          <br />
          {activatedAgent ? (
            <>
              Ton accès à <strong>{displayAgent}</strong> est en cours d’activation.
            </>
          ) : (
            <>Ton accès est en cours d’activation.</>
          )}
        </p>

        <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
          {showSpinner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>
            {showSpinner
              ? "Activation en cours… (ça peut prendre quelques secondes)"
              : "Si rien ne s’affiche, clique sur “Voir mes agents”."}
          </span>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-3 pt-2">
          <Button asChild className="w-full">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/profile">Aller à mon compte</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Si l’activation tarde, c’est normal : Stripe → webhook → Supabase. La page se mettra à jour toute seule.
        </p>
      </section>
    </main>
  );
}







