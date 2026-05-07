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
  Layers,
  ClipboardList,
  FileText,
  BadgeCheck,
  Target,
  MessageSquareText,
  AtSign,
  Building2,
  Plug,
  CheckCircle2,
  LayoutList,
  CalendarClock,
  Scale,
  Network,
} from "lucide-react";

type AccessCheckResult = { ok: boolean; has: boolean };

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground cs-pill">
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
    <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="font-medium">{title}</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

export default function NoahPage() {
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [hasNoah, setHasNoah] = useState(false);
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
      setHasNoah(false);
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
        setHasNoah(false);
        setLoading(false);
        setError(userErr.message);
        return { ok: false, has: false };
      }

      const user = userData?.user;
      if (!user) {
        setIsLogged(false);
        setHasNoah(false);
        setLoading(false);
        return { ok: true, has: false };
      }

      setIsLogged(true);

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_slug", "noah")
        .eq("status", "active")
        .maybeSingle();

      if (orderErr) setError(orderErr.message);

      const has = Boolean(order);
      setHasNoah(has);
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
              Clone CloneStore â€¢ Assistant direction
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <LayoutList className="h-3.5 w-3.5" />
              Pilotage + dÃ©cisions
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" />
              Compatible CloneOS
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <AtSign className="h-3.5 w-3.5" />
              Email pro via DNS
            </span>
          </Pill>
          <Pill>Notes â†’ actions</Pill>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Noah â€” lâ€™assistant direction qui transforme le flou en plan clair (prioritÃ©s, dÃ©cisions, docs, suivi)
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Noah est fait pour les dirigeants et managers qui veulent avancer vite sans se perdre :
            il structure, tranche (avec toi), prÃ©pare les documents de pilotage, et garde un fil conducteur.
            <span className="block mt-2">
              En mode CloneOS/Router, Noah peut orchestrer des routines autorisÃ©es et coopÃ©rer avec dâ€™autres clones
              (ex : Pierre pour docs RH, Emma pour support, Alex pour messages).
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              AccÃ©der Ã  Noah <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Timer className="h-4 w-4" />}
            title="Tu gagnes des heures"
            desc="Moins de chaos : Noah synthÃ©tise, structure, propose une prochaine action claire."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Pilotage propre"
            desc="Notes, plans, mails, dÃ©cisions : mÃªme standard de qualitÃ©, tout le temps."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Garde-fous"
            desc="Noah nâ€™invente pas. Il demande ce qui manque, et reste dans le pÃ©rimÃ¨tre."
          />
        </div>
      </header>

      {/* AUTONOMIE / CLONEOS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Autonomie & CloneOS</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Network className="h-4 w-4" />}
            title="Orchestration"
            desc="Noah peut dÃ©clencher des actions via Router : demandes dâ€™infos, briefs, livrables, suivi."
          />
          <Card
            icon={<Layers className="h-4 w-4" />}
            title="CoopÃ©ration inter-clones"
            desc="Noah coordonne : Pierre Ã©crit, Emma rÃ©pond, Alex prÃ©pare une sÃ©quence â€” Noah assemble."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Routines"
            desc="RÃ©unions â†’ compte rendu â†’ dÃ©cisions â†’ tÃ¢ches â†’ relances : un cycle stable et traÃ§able."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Promesse rÃ©aliste</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Noah ne â€œmagiqueâ€ pas une entreprise. Il te rend meilleur au quotidien : moins de dispersion, plus de clartÃ©,
            des dÃ©cisions documentÃ©es, et des actions suivies.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Noah au nom de ta boÃ®te</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dÃ©diÃ©e"
            desc="Connexion possible Ã  une adresse du domaine (ex : noah@tonentreprise.com / direction@tonentreprise.com) via DNS."
          />
          <Card
            icon={<AtSign className="h-4 w-4" />}
            title="PrÃ©paration & envoi"
            desc="Noah prÃ©pare des mails de pilotage, comptes rendus, relances. Envoi auto uniquement si activÃ©."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Cas typique</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AprÃ¨s une rÃ©union : Noah gÃ©nÃ¨re le compte rendu + dÃ©cisions + actions + mail rÃ©capitulatif prÃªt Ã  partir.
          </p>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connexion outils (option)</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Plug className="h-4 w-4" />}
            title="Agenda / tÃ¢ches"
            desc="Connexion possible selon ton stack (Router/Make/API) : tÃ¢ches, suivis, exports, rappels."
          />
          <Card
            icon={<CalendarClock className="h-4 w-4" />}
            title="Rituels"
            desc="Weekly review, prioritÃ©s semaine, points blocages : Noah industrialise tes rituels."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="TraÃ§abilitÃ©"
            desc="Historique/log : dÃ©cisions, tÃ¢ches, livrables, et Ã©tat dâ€™avancement."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intÃ©grations dÃ©pendent des outils. Sans connecteur direct, on passe par Router/Make ou API quand câ€™est possible.
          </p>
        </div>
      </section>

      {/* CAPACITÃ‰S */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Noah fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="DÃ©cisions & prioritÃ©s"
            desc="Clarifie les options, propose un arbitrage, sort un plan dâ€™action simple et priorisÃ©."
          />
          <Card
            icon={<FileText className="h-4 w-4" />}
            title="Docs de pilotage"
            desc="Notes de synthÃ¨se, plans, briefs, checklists, documents de cadrage, rÃ©capitulatifs."
          />
          <Card
            icon={<MessageSquareText className="h-4 w-4" />}
            title="Communication"
            desc="Mails de pilotage : demandes, recadrage, relances, compte rendu, message dâ€™alignement."
          />
          <Card
            icon={<Target className="h-4 w-4" />}
            title="Cadrage & exÃ©cution"
            desc="Transforme une idÃ©e floue en objectifs, Ã©tapes, risques, et next steps."
          />
          <Card
            icon={<Scale className="h-4 w-4" />}
            title="Risque & cohÃ©rence"
            desc="Relit un plan/texte : incohÃ©rences, trous, risques Ã©vidents, points Ã  clarifier."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="Standardisation"
            desc="MÃªme format de CR, mÃªme structure de brief, mÃªmes rÃ¨gles internes â€” Ã§a devient â€œpropreâ€."
          />
        </div>

        <div className="rounded-2xl border p-6 cs-card shadow-soft">
          <p className="text-sm">
            <span className="font-medium">Noah ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              se substituer Ã  une dÃ©cision humaine â€¢ inventer des donnÃ©es â€¢ exÃ©cuter des actions sensibles sans autorisation â€¢ conseil juridique formel.
            </span>
          </p>
        </div>
      </section>

      {/* EXEMPLES */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Exemples de briefs (et ce que tu obtiens)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œJâ€™ai trop de sujets. Fais un tri : urgent / important, et donne un plan de la semaine.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              PrioritÃ©s + planning simple + risques + actions immÃ©diates.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œNotes rÃ©union â†’ compte rendu + dÃ©cisions + actions + mail Ã  envoyer.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              CR propre + next steps + mail rÃ©cap prÃªt Ã  partir.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œJe dois cadrer un projet. Fais un doc : objectif, pÃ©rimÃ¨tre, Ã©tapes, risques.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              Document de cadrage clair + checklists + points Ã  clarifier.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œPrÃ©pare un mail dâ€™alignement Ã  lâ€™Ã©quipe (objectifs, attentes, ton pro).â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              Mail complet + structure + ton maÃ®trisÃ© + CTA clair.
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment Ã§a marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">1) Tu donnes le contexte</p>
            <p className="text-sm text-muted-foreground">
              Notes brutes, messages, objectifs, contraintes. MÃªme brouillon.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">2) Noah structure</p>
            <p className="text-sm text-muted-foreground">
              SynthÃ¨se, dÃ©cisions proposÃ©es, plan, docs, messages prÃªts.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">3) Mode CloneOS (option)</p>
            <p className="text-sm text-muted-foreground">
              DÃ©clencheurs Router : routines, coopÃ©ration, exÃ©cution autorisÃ©e, logs.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
        <h3 className="text-lg font-medium">3 modes dâ€™utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> brief â†’ Noah sort synthÃ¨se + plan + doc/mails.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode pilotage :</span> rituels (weekly), dÃ©cisions, suivi, formats standard.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> orchestration via Router + coopÃ©ration inter-clones.
          </li>
        </ul>
      </section>

      {/* ACCÃˆS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4 cs-card shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">AccÃ¨s Ã  Noah</h2>
            <p className="text-sm text-muted-foreground">
              Statut actuel : <span className="font-medium text-foreground">en construction</span>. (Tarif cible : 499â‚¬/mois)
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
        ) : hasNoah ? (
          <>
            <p className="text-sm text-muted-foreground">Noah est actif dans ton espace.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/agents/noah/use">Utiliser Noah</Link>
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
                ? "Noah nâ€™est pas encore disponible Ã  lâ€™achat. Tu peux dÃ©jÃ  poser des questions via lâ€™assistant."
                : "Connecte-toi pour suivre lâ€™arrivÃ©e de Noah. En attendant, tu peux poser des questions via lâ€™assistant."}
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
