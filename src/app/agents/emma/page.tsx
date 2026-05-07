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
  Bot,
  Workflow,
  AtSign,
  Building2,
  LifeBuoy,
  Mail,
  ClipboardList,
  MessageSquareText,
  Tag,
  ListChecks,
  Plug,
  BadgeCheck,
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

export default function EmmaPage() {
  // âœ… singleton Supabase
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [hasEmma, setHasEmma] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydration-safe
  const [shouldPoll, setShouldPoll] = useState(false);

  useEffect(() => {
    const u = new URL(window.location.href);
    setShouldPoll(u.searchParams.get("success") === "1");
  }, []);

  async function checkAccess(): Promise<AccessCheckResult> {
    setError(null);

    if (!supabase) {
      setIsLogged(false);
      setHasEmma(false);
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
        setHasEmma(false);
        setLoading(false);
        setError(userErr.message);
        return { ok: false, has: false };
      }

      const user = userData?.user;
      if (!user) {
        setIsLogged(false);
        setHasEmma(false);
        setLoading(false);
        return { ok: true, has: false };
      }

      setIsLogged(true);

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_slug", "emma")
        .eq("status", "active")
        .maybeSingle();

      if (orderErr) setError(orderErr.message);

      const has = Boolean(order);
      setHasEmma(has);
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
              Clone CloneStore â€¢ Support
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <LifeBuoy className="h-3.5 w-3.5" />
              SAV + emails + rÃ©ponses
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
          <Pill>Ton client constant</Pill>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Emma â€” lâ€™agent support autonome qui gÃ¨re ton SAV, structure les demandes, et prÃ©pare des rÃ©ponses prÃªtes Ã  envoyer
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Emma transforme un flux â€œbordelâ€ (emails, messages, tickets) en support carrÃ© :
            catÃ©gorisation, prioritÃ©s, rÃ©ponses cohÃ©rentes, et suivi.
            <span className="block mt-2">
              En mode autonome, Emma peut traiter les demandes rÃ©currentes via CloneOS/Router : elle classe, prÃ©pare la
              rÃ©ponse, et peut dÃ©clencher des actions autorisÃ©es (ex : crÃ©er un ticket, gÃ©nÃ©rer un rÃ©sumÃ©, demander une
              info manquante).
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              AccÃ©der Ã  Emma <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Timer className="h-4 w-4" />}
            title="RÃ©ponses rapides"
            desc="Emma prÃ©pare des rÃ©ponses propres en quelques secondes, mÃªme sur des cas rÃ©pÃ©titifs."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Ton de marque"
            desc="MÃªme style, mÃªme politesse, mÃªme clartÃ©. Tu arrÃªtes les rÃ©ponses â€œÃ  lâ€™arracheâ€."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Garde-fous"
            desc="Emma ne promet pas nâ€™importe quoi : hors rÃ¨gles, elle te demande, ou elle escalade."
          />
        </div>
      </header>

      {/* AUTONOMIE / CLONEOS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Autonomie & CloneOS</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Bot className="h-4 w-4" />}
            title="Support autonome"
            desc="Elle peut traiter les demandes rÃ©currentes selon tes rÃ¨gles : rÃ©ponses, relances, demandes dâ€™infos manquantes."
          />
          <Card
            icon={<Workflow className="h-4 w-4" />}
            title="CoopÃ©ration inter-clones"
            desc="Emma peut dÃ©clencher un autre clone si besoin (ex : Pierre pour une rÃ©ponse RH structurÃ©e), via Router."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="TraÃ§abilitÃ©"
            desc="Historique/log possible : demandes reÃ§ues, catÃ©gories, brouillons de rÃ©ponses, actions rÃ©alisÃ©es."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Objectif</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            RÃ©duire drastiquement le temps support, sans dÃ©grader la qualitÃ©. Emma ne remplace pas ton produit â€” elle
            fait tourner ton support proprement.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Emma au nom de ta boÃ®te</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dÃ©diÃ©e"
            desc="Connexion possible Ã  une adresse du domaine (ex : support@tonentreprise.com / emma@tonentreprise.com) via DNS."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="RÃ©ponses prÃªtes Ã  envoyer"
            desc="Emma prÃ©pare lâ€™objet, la rÃ©ponse, les Ã©tapes suivantes. Envoi automatique uniquement si tu lâ€™autorises."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">RÃ©sultat</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Un support pro, plus rapide, plus cohÃ©rent, avec moins dâ€™oublis et moins de clients laissÃ©s â€œsans rÃ©ponseâ€.
          </p>
        </div>
      </section>

      {/* INTEGRATIONS SAV */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connexion au SAV / tickets (option)</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Plug className="h-4 w-4" />}
            title="Outils support"
            desc="Emma peut Ãªtre reliÃ©e Ã  un outil de support/tickets selon ton stack et tes autorisations."
          />
          <Card
            icon={<Tag className="h-4 w-4" />}
            title="CatÃ©gorisation & prioritÃ©s"
            desc="Elle classe (bug, facturation, livraison, accÃ¨s, demande commerciale), et met des prioritÃ©s."
          />
          <Card
            icon={<ListChecks className="h-4 w-4" />}
            title="Routines & suivi"
            desc="Relances, demandes dâ€™infos manquantes, rÃ©sumÃ©s dâ€™Ã©changes, prochaine action recommandÃ©e."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intÃ©grations dÃ©pendent de ton outil. Sans connecteur direct, on passe par Router/Make ou API quand câ€™est
            possible.
          </p>
        </div>
      </section>

      {/* CAPACITÃ‰S */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Emma fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<MessageSquareText className="h-4 w-4" />}
            title="RÃ©ponses support"
            desc="RÃ©ponses claires, polies, structurÃ©es (avec Ã©tapes). Adaptation au ton de la marque."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="RÃ©sumÃ© & contexte"
            desc="RÃ©sumÃ© des Ã©changes, points importants, ce qui manque, prochaine action recommandÃ©e."
          />
          <Card
            icon={<Tag className="h-4 w-4" />}
            title="CatÃ©gorisation"
            desc="Classe la demande et propose un niveau dâ€™urgence + routage interne si besoin."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="QualitÃ© constante"
            desc="RÃ©ponses propres mÃªme quand tu es pressÃ© : structure + formulation + clartÃ©."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Emails (option)"
            desc="PrÃ©pare lâ€™email complet. Envoi automatique uniquement si tu actives et autorises."
          />
          <Card
            icon={<LifeBuoy className="h-4 w-4" />}
            title="Escalade intelligente"
            desc="Si câ€™est hors rÃ¨gles ou sensible : elle demande validation, ou transfÃ¨re au bon endroit."
          />
        </div>

        <div className="rounded-2xl border p-6 cs-card shadow-soft">
          <p className="text-sm">
            <span className="font-medium">Emma ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              promettre un remboursement/engagement sans rÃ¨gle â€¢ â€œinventerâ€ une rÃ©ponse si lâ€™info nâ€™existe pas â€¢ gÃ©rer un
              litige juridique â€¢ accÃ©der Ã  des donnÃ©es non autorisÃ©es.
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
              â€œClient Ã©nervÃ© : â€˜je nâ€™ai pas accÃ¨sâ€™, reste calme, demande les infos utiles.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              RÃ©ponse pro + empathie + questions ciblÃ©es + Ã©tapes de rÃ©solution.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œRÃ©sume ce fil de 12 mails et dis la prochaine action.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              RÃ©sumÃ© clair + points clÃ©s + action recommandÃ©e + brouillon de rÃ©ponse.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œClasse ces 30 demandes : bug / facturation / livraison / accÃ¨s.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              CatÃ©gories + prioritÃ©s + suggestions de rÃ©ponses types.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œMode autonome : nouvelle demande â†’ rÃ©ponse brouillon + tag + alerte si urgent.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              Flux CloneOS/Router : classification + brouillon + escalade si besoin.
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment Ã§a marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">1) Tu dÃ©finis les rÃ¨gles</p>
            <p className="text-sm text-muted-foreground">
              Ton, garanties, FAQ, ce que Emma peut dire / ne pas dire, et quand escalader.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">2) Emma traite</p>
            <p className="text-sm text-muted-foreground">
              Classe, rÃ©sume, propose une rÃ©ponse, et demande ce qui manque.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">3) Automatisation (option)</p>
            <p className="text-sm text-muted-foreground">
              DÃ©clencheurs CloneOS/Router : mails, tickets, suivi, relances â€” avec logs.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
        <h3 className="text-lg font-medium">3 modes dâ€™utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> tu colles une demande â†’ Emma te donne la
            rÃ©ponse pro.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode support :</span> Emma classe + rÃ©sume + prÃ©pare les rÃ©ponses
            selon ta base.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> automatisation + coopÃ©ration avec dâ€™autres
            clones via Router.
          </li>
        </ul>
      </section>

      {/* ACCÃˆS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4 cs-card shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">AccÃ¨s Ã  Emma</h2>
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
        ) : hasEmma ? (
          <>
            <p className="text-sm text-muted-foreground">Emma est active dans ton espace.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/agents/emma/use">Utiliser Emma</Link>
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
                ? "Emma nâ€™est pas encore disponible Ã  lâ€™achat. Tu peux dÃ©jÃ  poser des questions via lâ€™assistant."
                : "Connecte-toi pour suivre lâ€™arrivÃ©e dâ€™Emma. En attendant, tu peux poser tes questions via lâ€™assistant."}
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

