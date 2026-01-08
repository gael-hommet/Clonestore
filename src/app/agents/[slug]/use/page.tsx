"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AGENTS } from "@/lib/agent-catalog";

export default function AgentUsePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const agent = useMemo(() => AGENTS.find((a) => a.slug === slug), [slug]);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function check() {
      setLoading(true);

      const { data: auth } = await supabaseBrowser.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data, error } = await supabaseBrowser
        .from("agents_owned")
        .select("id,status")
        .eq("user_id", user.id)
        .eq("agent_slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      setAllowed(true);
      setLoading(false);
    }

    check();
  }, [router, slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl py-10 px-4">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl py-10 px-4 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">
          Tu n’as pas cet agent actif sur ton compte.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/agents/${slug}`}>Voir la fiche</Link>
          </Button>
          <Button asChild>
            <Link href="/paiement">Paiement</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl py-10 px-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {agent ? agent.name : slug} — Espace d’utilisation
        </h1>
        <p className="text-sm text-muted-foreground">
          Ici, on branchera le formulaire CloneStore → Router → Make.
          Pour l’instant, c’est l’espace “pro” prêt à recevoir l’interface.
        </p>
      </header>

      <section className="rounded-2xl border p-6 space-y-4">
        <p className="text-sm">
          Prochaine étape : créer le formulaire intégré (mode free V1) et envoyer le payload au Router.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/assistant">Poser une question</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/agents">Retour à Mes agents</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
