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
  // ✅ singleton Supabase
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
        "Supabase non configuré : vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (local + Vercel)."
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
              Clone CloneStore • Support
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <LifeBuoy className="h-3.5 w-3.5" />
              SAV + emails + réponses
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
            Emma — l’agent support autonome qui gère ton SAV, structure les demandes, et prépare des réponses prêtes à envoyer
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Emma transforme un flux “bordel” (emails, messages, tickets) en support carré :
            catégorisation, priorités, réponses cohérentes, et suivi.
            <span className="block mt-2">
              En mode autonome, Emma peut traiter les demandes récurrentes via CloneOS/Router : elle classe, prépare la
              réponse, et peut déclencher des actions autorisées (ex : créer un ticket, générer un résumé, demander une
              info manquante).
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              Accéder à Emma <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Timer className="h-4 w-4" />}
            title="Réponses rapides"
            desc="Emma prépare des réponses propres en quelques secondes, même sur des cas répétitifs."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Ton de marque"
            desc="Même style, même politesse, même clarté. Tu arrêtes les réponses “à l’arrache”."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Garde-fous"
            desc="Emma ne promet pas n’importe quoi : hors règles, elle te demande, ou elle escalade."
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
            desc="Elle peut traiter les demandes récurrentes selon tes règles : réponses, relances, demandes d’infos manquantes."
          />
          <Card
            icon={<Workflow className="h-4 w-4" />}
            title="Coopération inter-clones"
            desc="Emma peut déclencher un autre clone si besoin (ex : Pierre pour une réponse RH structurée), via Router."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Traçabilité"
            desc="Historique/log possible : demandes reçues, catégories, brouillons de réponses, actions réalisées."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Objectif</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Réduire drastiquement le temps support, sans dégrader la qualité. Emma ne remplace pas ton produit — elle
            fait tourner ton support proprement.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Emma au nom de ta boîte</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dédiée"
            desc="Connexion possible à une adresse du domaine (ex : support@tonentreprise.com / emma@tonentreprise.com) via DNS."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Réponses prêtes à envoyer"
            desc="Emma prépare l’objet, la réponse, les étapes suivantes. Envoi automatique uniquement si tu l’autorises."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Résultat</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Un support pro, plus rapide, plus cohérent, avec moins d’oublis et moins de clients laissés “sans réponse”.
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
            desc="Emma peut être reliée à un outil de support/tickets selon ton stack et tes autorisations."
          />
          <Card
            icon={<Tag className="h-4 w-4" />}
            title="Catégorisation & priorités"
            desc="Elle classe (bug, facturation, livraison, accès, demande commerciale), et met des priorités."
          />
          <Card
            icon={<ListChecks className="h-4 w-4" />}
            title="Routines & suivi"
            desc="Relances, demandes d’infos manquantes, résumés d’échanges, prochaine action recommandée."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intégrations dépendent de ton outil. Sans connecteur direct, on passe par Router/Make ou API quand c’est
            possible.
          </p>
        </div>
      </section>

      {/* CAPACITÉS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Emma fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<MessageSquareText className="h-4 w-4" />}
            title="Réponses support"
            desc="Réponses claires, polies, structurées (avec étapes). Adaptation au ton de la marque."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Résumé & contexte"
            desc="Résumé des échanges, points importants, ce qui manque, prochaine action recommandée."
          />
          <Card
            icon={<Tag className="h-4 w-4" />}
            title="Catégorisation"
            desc="Classe la demande et propose un niveau d’urgence + routage interne si besoin."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="Qualité constante"
            desc="Réponses propres même quand tu es pressé : structure + formulation + clarté."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Emails (option)"
            desc="Prépare l’email complet. Envoi automatique uniquement si tu actives et autorises."
          />
          <Card
            icon={<LifeBuoy className="h-4 w-4" />}
            title="Escalade intelligente"
            desc="Si c’est hors règles ou sensible : elle demande validation, ou transfère au bon endroit."
          />
        </div>

        <div className="rounded-2xl border p-6 cs-card shadow-soft">
          <p className="text-sm">
            <span className="font-medium">Emma ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              promettre un remboursement/engagement sans règle • “inventer” une réponse si l’info n’existe pas • gérer un
              litige juridique • accéder à des données non autorisées.
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
              “Client énervé : ‘je n’ai pas accès’, reste calme, demande les infos utiles.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Réponse pro + empathie + questions ciblées + étapes de résolution.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Résume ce fil de 12 mails et dis la prochaine action.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Résumé clair + points clés + action recommandée + brouillon de réponse.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Classe ces 30 demandes : bug / facturation / livraison / accès.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Catégories + priorités + suggestions de réponses types.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Mode autonome : nouvelle demande → réponse brouillon + tag + alerte si urgent.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Flux CloneOS/Router : classification + brouillon + escalade si besoin.
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment ça marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">1) Tu définis les règles</p>
            <p className="text-sm text-muted-foreground">
              Ton, garanties, FAQ, ce que Emma peut dire / ne pas dire, et quand escalader.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">2) Emma traite</p>
            <p className="text-sm text-muted-foreground">
              Classe, résume, propose une réponse, et demande ce qui manque.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">3) Automatisation (option)</p>
            <p className="text-sm text-muted-foreground">
              Déclencheurs CloneOS/Router : mails, tickets, suivi, relances — avec logs.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
        <h3 className="text-lg font-medium">3 modes d’utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> tu colles une demande → Emma te donne la
            réponse pro.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode support :</span> Emma classe + résume + prépare les réponses
            selon ta base.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> automatisation + coopération avec d’autres
            clones via Router.
          </li>
        </ul>
      </section>

      {/* ACCÈS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4 cs-card shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Accès à Emma</h2>
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
            Vérification en cours…
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
                ? "Emma n’est pas encore disponible à l’achat. Tu peux déjà poser des questions via l’assistant."
                : "Connecte-toi pour suivre l’arrivée d’Emma. En attendant, tu peux poser tes questions via l’assistant."}
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

