"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionClient } from "@/lib/auth/session-client";
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
  const supabase = useMemo(() => getSessionClient() as SupabaseClient | null, []);

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
        "Supabase non configuré : vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (local + Vercel)."
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
      const msg = e instanceof Error ? e.message : "Erreur accès";
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
              Clone CloneStore • Assistant direction
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <LayoutList className="h-3.5 w-3.5" />
              Pilotage + décisions
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
          <Pill>Notes → actions</Pill>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Noah — l’assistant direction qui transforme le flou en plan clair (priorités, décisions, docs, suivi)
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Noah est fait pour les dirigeants et managers qui veulent avancer vite sans se perdre :
            il structure, tranche (avec toi), prépare les documents de pilotage, et garde un fil conducteur.
            <span className="block mt-2">
              En mode CloneOS/Router, Noah peut orchestrer des routines autorisées et coopérer avec d’autres clones
              (ex : Pierre pour docs RH, Emma pour support, Alex pour messages).
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              Accéder à Noah <ArrowRight className="ml-2 h-4 w-4" />
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
            desc="Moins de chaos : Noah synthétise, structure, propose une prochaine action claire."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Pilotage propre"
            desc="Notes, plans, mails, décisions : même standard de qualité, tout le temps."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Garde-fous"
            desc="Noah n’invente pas. Il demande ce qui manque, et reste dans le périmètre."
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
            desc="Noah peut déclencher des actions via Router : demandes d’infos, briefs, livrables, suivi."
          />
          <Card
            icon={<Layers className="h-4 w-4" />}
            title="Coopération inter-clones"
            desc="Noah coordonne : Pierre écrit, Emma répond, Alex prépare une séquence — Noah assemble."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Routines"
            desc="Réunions → compte rendu → décisions → tâches → relances : un cycle stable et traçable."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Promesse réaliste</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Noah ne “magique” pas une entreprise. Il te rend meilleur au quotidien : moins de dispersion, plus de clarté,
            des décisions documentées, et des actions suivies.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Noah au nom de ta boîte</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dédiée"
            desc="Connexion possible à une adresse du domaine (ex : noah@tonentreprise.com / direction@tonentreprise.com) via DNS."
          />
          <Card
            icon={<AtSign className="h-4 w-4" />}
            title="Préparation & envoi"
            desc="Noah prépare des mails de pilotage, comptes rendus, relances. Envoi auto uniquement si activé."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Cas typique</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Après une réunion : Noah génère le compte rendu + décisions + actions + mail récapitulatif prêt à partir.
          </p>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connexion outils (option)</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Plug className="h-4 w-4" />}
            title="Agenda / tâches"
            desc="Connexion possible selon ton stack (Router/Make/API) : tâches, suivis, exports, rappels."
          />
          <Card
            icon={<CalendarClock className="h-4 w-4" />}
            title="Rituels"
            desc="Weekly review, priorités semaine, points blocages : Noah industrialise tes rituels."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Traçabilité"
            desc="Historique/log : décisions, tâches, livrables, et état d’avancement."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intégrations dépendent des outils. Sans connecteur direct, on passe par Router/Make ou API quand c’est possible.
          </p>
        </div>
      </section>

      {/* CAPACITÉS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Noah fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Décisions & priorités"
            desc="Clarifie les options, propose un arbitrage, sort un plan d’action simple et priorisé."
          />
          <Card
            icon={<FileText className="h-4 w-4" />}
            title="Docs de pilotage"
            desc="Notes de synthèse, plans, briefs, checklists, documents de cadrage, récapitulatifs."
          />
          <Card
            icon={<MessageSquareText className="h-4 w-4" />}
            title="Communication"
            desc="Mails de pilotage : demandes, recadrage, relances, compte rendu, message d’alignement."
          />
          <Card
            icon={<Target className="h-4 w-4" />}
            title="Cadrage & exécution"
            desc="Transforme une idée floue en objectifs, étapes, risques, et next steps."
          />
          <Card
            icon={<Scale className="h-4 w-4" />}
            title="Risque & cohérence"
            desc="Relit un plan/texte : incohérences, trous, risques évidents, points à clarifier."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="Standardisation"
            desc="Même format de CR, même structure de brief, mêmes règles internes — ça devient “propre”."
          />
        </div>

        <div className="rounded-2xl border p-6 cs-card shadow-soft">
          <p className="text-sm">
            <span className="font-medium">Noah ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              se substituer à une décision humaine • inventer des données • exécuter des actions sensibles sans autorisation • conseil juridique formel.
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
              “J’ai trop de sujets. Fais un tri : urgent / important, et donne un plan de la semaine.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Priorités + planning simple + risques + actions immédiates.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Notes réunion → compte rendu + décisions + actions + mail à envoyer.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              CR propre + next steps + mail récap prêt à partir.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Je dois cadrer un projet. Fais un doc : objectif, périmètre, étapes, risques.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Document de cadrage clair + checklists + points à clarifier.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Prépare un mail d’alignement à l’équipe (objectifs, attentes, ton pro).”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Mail complet + structure + ton maîtrisé + CTA clair.
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment ça marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">1) Tu donnes le contexte</p>
            <p className="text-sm text-muted-foreground">
              Notes brutes, messages, objectifs, contraintes. Même brouillon.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">2) Noah structure</p>
            <p className="text-sm text-muted-foreground">
              Synthèse, décisions proposées, plan, docs, messages prêts.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">3) Mode CloneOS (option)</p>
            <p className="text-sm text-muted-foreground">
              Déclencheurs Router : routines, coopération, exécution autorisée, logs.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
        <h3 className="text-lg font-medium">3 modes d’utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> brief → Noah sort synthèse + plan + doc/mails.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode pilotage :</span> rituels (weekly), décisions, suivi, formats standard.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> orchestration via Router + coopération inter-clones.
          </li>
        </ul>
      </section>

      {/* ACCÈS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4 cs-card shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Accès à Noah</h2>
            <p className="text-sm text-muted-foreground">
              Statut actuel : <span className="font-medium text-foreground">en construction</span>. (Tarif cible : 499€/mois)
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/agents">Boutique</Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Vérification en cours…
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
                ? "Noah n’est pas encore disponible à l’achat. Tu peux déjà poser des questions via l’assistant."
                : "Connecte-toi pour suivre l’arrivée de Noah. En attendant, tu peux poser des questions via l’assistant."}
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
