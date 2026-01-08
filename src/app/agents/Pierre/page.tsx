"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CheckCircle2, ClipboardList, FileText, Mail, Sparkles } from "lucide-react";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function PierrePage() {
  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [hasPierre, setHasPierre] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Hydration-safe: on calcule shouldPoll seulement côté client après montage
  const [shouldPoll, setShouldPoll] = useState(false);

  useEffect(() => {
    // ici, window existe forcément (client)
    const u = new URL(window.location.href);
    setShouldPoll(u.searchParams.get("success") === "1");
  }, []);

  async function checkAccess() {
    setError(null);
    const supabase = getSupabase();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setIsLogged(false);
      setHasPierre(false);
      setLoading(false);
      setError(userErr.message);
      return { ok: false, has: false };
    }

    const user = userData?.user;
    if (!user) {
      setIsLogged(false);
      setHasPierre(false);
      setLoading(false);
      return { ok: true, has: false };
    }

    setIsLogged(true);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .maybeSingle();

    if (orderErr) setError(orderErr.message);

    const has = Boolean(order);
    setHasPierre(has);
    setLoading(false);
    return { ok: true, has };
  }

  useEffect(() => {
    let stop = false;
    let intervalId: any = null;

    async function run() {
      setLoading(true);

      // 1) check initial
      const first = await checkAccess();

      // 2) si on revient de Stripe (?success=1), on poll jusqu'à activation DB
      if (shouldPoll && first.ok && !first.has) {
        const started = Date.now();

        intervalId = setInterval(async () => {
          if (stop) return;

          const res = await checkAccess();

          // ✅ dès que c'est actif, on stop + on nettoie l'URL
          if (res.has) {
            clearInterval(intervalId);

            const u = new URL(window.location.href);
            u.searchParams.delete("success");
            window.history.replaceState({}, "", u.toString());
          }

          // timeout 25s
          if (Date.now() - started > 25_000) {
            clearInterval(intervalId);
          }
        }, 1500);
      }
    }

    run();

    return () => {
      stop = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [shouldPoll]);

  return (
    <main className="mx-auto max-w-3xl py-12 px-4 space-y-12">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Agent CloneStore • RH rédaction & structuration
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">Pierre — Assistant RH rédacteur</h1>

        <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
          Pierre transforme un brief brut en <strong>documents RH prêts à envoyer</strong> :
          offres, mails candidats, fiches de poste, scripts, comptes rendus.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button asChild>
            <Link href="#embauche">Accès</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>
      </header>

      <section className="space-y-5">
        <h2 className="text-lg font-medium">Ce que Pierre fait (V1)</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-5 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <h3 className="font-medium">Offres d’emploi</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Fiche de poste + annonce prête à publier à partir de quelques informations.
            </p>
          </div>

          <div className="rounded-xl border p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <h3 className="font-medium">Mails RH</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Refus, convocation, relance, confirmation, onboarding.
            </p>
          </div>

          <div className="rounded-xl border p-5 space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <h3 className="font-medium">Entretiens</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Questions, grille simple, compte rendu structuré à partir de notes.
            </p>
          </div>

          <div className="rounded-xl border p-5 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <h3 className="font-medium">Onboarding</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Plan 30/60/90 jours : tâches, checkpoints, objectifs.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Pierre ne fait pas le scoring/analyse de CV. Cela sera géré par un autre agent.
        </p>
      </section>

      <section id="embauche" className="rounded-2xl border p-6 space-y-4">
        <h2 className="text-lg font-medium">Accès à Pierre</h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Vérification en cours…
            {shouldPoll && <span> (post-paiement, attente activation...)</span>}
          </p>
        ) : hasPierre ? (
          <>
            <p className="text-sm text-muted-foreground">Pierre est disponible dans ton espace.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/agents/pierre/use">Utiliser Pierre</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile">Mon compte</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {isLogged
                ? "Pour utiliser Pierre, tu dois l’embaucher."
                : "Connecte-toi puis embauche Pierre pour y accéder."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/paiement?agent=pierre">Embaucher Pierre</Link>
              </Button>
              {!isLogged && (
                <Button asChild variant="outline">
                  <Link href="/login">Se connecter</Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => checkAccess()}>
                Rafraîchir l’accès
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}














