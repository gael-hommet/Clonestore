"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

type CheckoutResponse = { url?: string; error?: string };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function CheckoutPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const agent = sp.get("agent") ?? "pierre";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [canPay, setCanPay] = useState(false);

  async function startCheckout() {
    setErr(null);
    setLoading(true);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw new Error(error.message);

      const user = data?.user;
      if (!user) {
        setCanPay(false);
        setErr("Tu dois te connecter avant de payer.");
        return;
      }

      setCanPay(true);

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

  useEffect(() => {
    // auto-start checkout dès l’arrivée sur /checkout
    startCheckout().catch(() => {
      // erreurs déjà gérées dans startCheckout
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      <p className="text-sm text-muted-foreground">
        Préparation du paiement pour : <strong>{agent}</strong>
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Redirection vers Stripe...</p>
      ) : (
        <>
          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="flex gap-3">
            <Button onClick={startCheckout} disabled={!canPay}>
              Réessayer
            </Button>
            <Button variant="outline" onClick={() => router.push("/login")}>
              Se connecter
            </Button>
          </div>
        </>
      )}
    </main>
  );
}








