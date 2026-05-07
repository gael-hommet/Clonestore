"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  Timer,
  ShieldCheck,
  Wand2,
  Workflow,
  ClipboardList,
  FileText,
  BadgeCheck,
  Layers,
  Target,
  MessageSquareText,
  AtSign,
  Building2,
  Plug,
  CheckCircle2,
  BriefcaseBusiness,
} from "lucide-react";

type AccessCheckResult = { ok: boolean; has: boolean };

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function Card({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border p-6 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="font-medium">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

export default function AlexPage() {
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [hasAlex, setHasAlex] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shouldPoll, setShouldPoll] = useState(false);

  useEffect(() => {
    const u = new URL(window.location.href);
    setShouldPoll(u.searchParams.get("success") === "1");
  }, []);

  async function checkAccess(): Promise<AccessCheckResult> {
    setError(null);

    if (!supabase) {
      setIsLogged(false);
      setHasAlex(false);
      setLoading(false);
      setError(
        "Supabase non configurÃ© : vÃ©rifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (local + Vercel)."
      );
      return { ok: false, has: false };
    }

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setIsLogged(false);
        setHasAlex(false);
        setLoading(false);
        setError(userErr.message);
        return { ok: false, has: false };
      }

      const user = userData?.user;
      if (!user) {
        setIsLogged(false);
        setHasAlex(false);
        setLoading(false);
        return { ok: true, has: false };
      }

      setIsLogged(true);

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_slug", "alex")
        .eq("status", "active")
        .maybeSingle();

      if (orderErr) setError(orderErr.message);

      const has = Boolean(order);
      setHasAlex(has);
      setLoading(false);
      return { ok: true, has };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur accÃ¨s";
      setError(msg);
      setLoading(false);
      return { ok: false, has: false };
    }
  }

  useEffect(() => {
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function run() {
      setLoading(true);
      const first = await checkAccess();

      if (shouldPoll && first.ok && !first.has) {
        const started = Date.now();

        intervalId = setInterval(async () => {
          if (stopped) return;

          const res = await checkAccess();

          if (res.has) {
            if (intervalId) clearInterval(intervalId);

            const u = new URL(window.location.href);
            u.searchParams.delete("success");
            window.history.replaceState({}, "", u.toString());
          }

          if (Date.now() - started > 25_000) {
            if (intervalId) clearInterval(intervalId);
          }
        }, 1500);
      }
    }

    run();

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [shouldPoll]);

  return (
    <main className="mx-auto max-w-6xl py-12 px-4 space-y-12">
      {/* HERO */}
      <header className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Pill>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Clone CloneStore â€¢ Assistant commercial
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Prospection + messages
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <Workflow className="h-3.5 w-3.5" />
              Compatible CloneOS
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <AtSign className="h-3.5 w-3.5" />
              Email pro via DNS
            </span>
          </Pill>
          <Pill>Scripts & process</Pill>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Alex â€” lâ€™assistant commercial qui structure ton pipeline, prÃ©pare tes messages, et standardise ta vente
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Alex transforme des notes brutes en actions commerciales claires : messages de prospection, relances,
            scripts dâ€™appel, rÃ©ponses aux objections, et process de suivi.
            <span className="block mt-2">
              En mode CloneOS/Router, Alex peut exÃ©cuter des routines autorisÃ©es : prÃ©parer des sÃ©quences,
              demander une info manquante, gÃ©nÃ©rer un compte rendu, et dÃ©clencher des tÃ¢ches vers dâ€™autres clones.
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              AccÃ©der Ã  Alex <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Timer className="h-4 w-4" />}
            title="Gain de temps"
            desc="Tu arrÃªtes de rÃ©Ã©crire tes messages. Alex sort des textes propres, cohÃ©rents, prÃªts Ã  envoyer."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Standardisation"
            desc="MÃªme niveau de qualitÃ© dans tes relances, scripts et rÃ©ponses â€” mÃªme quand tu es fatiguÃ©."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Garde-fous"
            desc="Alex nâ€™invente pas des promesses. Il suit tes rÃ¨gles et escalade si câ€™est sensible."
          />
        </div>
      </header>

      {/* AUTONOMIE / CLONEOS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Autonomie & CloneOS</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Workflow className="h-4 w-4" />}
            title="Routines commerciales"
            desc="Relances, sÃ©quences, templates, suivi : Alex peut produire et maintenir ton systÃ¨me commercial."
          />
          <Card
            icon={<Layers className="h-4 w-4" />}
            title="CoopÃ©ration"
            desc="Alex peut dÃ©clencher dâ€™autres clones (ex : Emma pour support, Pierre pour docs) via Router."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="TraÃ§abilitÃ©"
            desc="Historique/log possible : actions, brouillons, dÃ©cisions proposÃ©es, et Ã©tapes suivantes."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Objectif</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Avoir un commercial â€œsystÃ¨mes & messagesâ€ : moins dâ€™impro, plus de process, et des livrables rÃ©pÃ©tables.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Alex au nom de ta boÃ®te</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dÃ©diÃ©e"
            desc="Connexion possible Ã  une adresse du domaine (ex : alex@tonentreprise.com / sales@tonentreprise.com) via DNS."
          />
          <Card
            icon={<AtSign className="h-4 w-4" />}
            title="SÃ©quences prÃªtes"
            desc="Alex prÃ©pare objets + messages + relances. Envoi automatique uniquement si tu lâ€™actives."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">RÃ©sultat</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Un outbound plus propre, plus constant, avec moins de â€œtrousâ€ dans le suivi.
          </p>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connexion outils (option)</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Plug className="h-4 w-4" />}
            title="CRM & outils"
            desc="Connexion possible selon ton stack (via Router/Make/API) : suivi, tÃ¢ches, notes, exports."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Compte rendu"
            desc="Ã€ partir de notes brutes : Alex sort un compte rendu + next steps + relances Ã  prÃ©voir."
          />
          <Card
            icon={<Target className="h-4 w-4" />}
            title="Qualification"
            desc="Alex structure une qualification simple (besoin, urgence, budget, dÃ©cideur, objections)."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intÃ©grations dÃ©pendent de ton outil. Sans connecteur direct, on passe par Router/Make ou API quand câ€™est possible.
          </p>
        </div>
      </section>

      {/* CAPACITÃ‰S */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Alex fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<MessageSquareText className="h-4 w-4" />}
            title="Prospection & relances"
            desc="Messages courts, emails, DM, relances. Plusieurs variantes selon ton ton et ta cible."
          />
          <Card
            icon={<FileText className="h-4 w-4" />}
            title="Scripts & playbooks"
            desc="Scripts dâ€™appel, rÃ©ponses aux objections, checklists, mini playbooks commerciaux."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Pipeline & process"
            desc="Ã‰tapes, rÃ¨gles, suivi, tags. Alex tâ€™aide Ã  standardiser un pipeline simple et efficace."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="CohÃ©rence"
            desc="MÃªme niveau de qualitÃ©, mÃªmes rÃ¨gles, mÃªme structure dans tes Ã©changes commerciaux."
          />
        </div>

        <div className="rounded-2xl border p-6">
          <p className="text-sm">
            <span className="font-medium">Alex ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              promettre un rÃ©sultat garanti â€¢ inventer des donnÃ©es â€¢ envoyer automatiquement sans autorisation â€¢ fournir du conseil juridique formel.
            </span>
          </p>
        </div>
      </section>

      {/* EXEMPLES */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Exemples de briefs (et ce que tu obtiens)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œProspection : DRH PME 50-150 salariÃ©s. Message court, ton pro, objectif : call 15 min.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              3 variantes + objet + angle valeur + CTA simple.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œRelance J+3 et J+7, sans Ãªtre lourd.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              SÃ©quence de relances courte + version â€œpolieâ€ + version â€œdirecteâ€.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œObjection : â€˜pas de budgetâ€™. RÃ©ponds et propose une option.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              RÃ©ponse structurÃ©e + options + question de qualification.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œNotes dâ€™appel â†’ compte rendu + next steps + relance Ã  prÃ©parer.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              CR propre + actions + brouillon de mail de suivi.
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment Ã§a marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">1) Tu fixes les rÃ¨gles</p>
            <p className="text-sm text-muted-foreground">
              Ton, offre, cibles, objections, ce quâ€™on promet / ne promet pas.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">2) Alex produit</p>
            <p className="text-sm text-muted-foreground">
              Messages, scripts, sÃ©quences, playbooks â€” prÃªts Ã  copier-coller.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">3) Mode CloneOS (option)</p>
            <p className="text-sm text-muted-foreground">
              DÃ©clencheurs Router : suivi, relances, tÃ¢ches, coopÃ©ration inter-clones.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3">
        <h3 className="text-lg font-medium">3 modes dâ€™utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> brief â†’ Alex te rend les messages/scrits.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode systÃ¨me :</span> pipeline + templates + process commercial.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> routines + coopÃ©ration via Router.
          </li>
        </ul>
      </section>

      {/* ACCÃˆS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">AccÃ¨s Ã  Alex</h2>
            <p className="text-sm text-muted-foreground">
              Statut actuel : <span className="font-medium text-foreground">en construction</span>.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/agents">Boutique</Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            VÃ©rification en coursâ€¦
            {shouldPoll && <span> (post-paiement, attente activation...)</span>}
          </p>
        ) : hasAlex ? (
          <>
            <p className="text-sm text-muted-foreground">Alex est actif dans ton espace.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/agents/alex/use">Utiliser Alex</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile/agents">Mes clones</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {isLogged
                ? "Alex nâ€™est pas encore disponible Ã  lâ€™achat. Tu peux dÃ©jÃ  poser des questions via lâ€™assistant."
                : "Connecte-toi pour suivre lâ€™arrivÃ©e dâ€™Alex. En attendant, tu peux poser tes questions via lâ€™assistant."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline">
                <Link href="/assistant">Poser une question</Link>
              </Button>

              {!isLogged && (
                <Button asChild variant="outline">
                  <Link href="/login">Se connecter</Link>
                </Button>
              )}

              <Button variant="outline" onClick={() => checkAccess()}>
                RafraÃ®chir lâ€™accÃ¨s
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}
