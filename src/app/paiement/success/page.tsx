"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// Mini helper
function titleCaseSlug(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type ActivateResponse =
  | { ok: true; agent_slug?: string }
  | { ok: false; error?: string };

export default function PaiementSuccessPage() {
  const params = useSearchParams();

  const agentFromUrl = useMemo(() => {
    const a = (params.get("agent") || "").trim().toLowerCase();
    return a || null;
  }, [params]);

  const [activating, setActivating] = useState(false);
  const [activatedAgent, setActivatedAgent] = useState<string | null>(agentFromUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) return;

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

        // Si l’API renvoie l’agent, on l’utilise (plus fiable que l’URL)
        if (!cancelled && payload && "ok" in payload && payload.ok) {
          if (payload.agent_slug) setActivatedAgent(payload.agent_slug);
        }

        if (!cancelled && !res.ok) {
          setError(
            (payload && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : null) || "Activation en cours. Si ça ne bouge pas, va dans ton compte."
          );
        }
      } catch {
        if (!cancelled) {
          setError("Activation en cours. Si rien ne change, va dans ton compte.");
        }
      } finally {
        if (!cancelled) setActivating(false);
      }
    }

    activate();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const displayAgent = activatedAgent ? titleCaseSlug(activatedAgent) : "ton agent";
  const primaryHref = activatedAgent ? `/agents/${activatedAgent}` : "/profile/agents";
  const primaryLabel = activatedAgent ? `Accéder à ${displayAgent}` : "Voir mes agents";

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

        <p className="text-xs text-muted-foreground">
          {activating
            ? "Activation en cours…"
            : "Si quelque chose ne s’affiche pas immédiatement, l’activation peut prendre quelques instants."}
        </p>

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
          Besoin d’aide ? Contacte le support depuis ton espace compte.
        </p>
      </section>
    </main>
  );
}






