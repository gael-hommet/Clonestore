"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Mail,
  Sparkles,
  Timer,
  ShieldCheck,
  Wand2,
  ArrowRight,
  Bot,
  Radar,
  Workflow,
  AtSign,
  Building2,
  LifeBuoy,
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

export default function PierrePage() {
  // ✅ singleton Supabase (évite multiples clients GoTrue)
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [hasPierre, setHasPierre] = useState(false);
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
      setHasPierre(false);
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
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_slug", "pierre")
        .eq("status", "active")
        .maybeSingle();

      if (orderErr) setError(orderErr.message);

      const has = Boolean(order);
      setHasPierre(has);
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
              Clone CloneStore • RH rédaction
            </span>
          </Pill>
          <Pill>Documents prêts à envoyer</Pill>
          <Pill>PME • Managers • RH débordés</Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <Radar className="h-3.5 w-3.5" />
              Proactif (selon règles)
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <AtSign className="h-3.5 w-3.5" />
              Email pro via DNS
            </span>
          </Pill>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Pierre — le clone RH autonome qui transforme un brief brouillon en document RH pro, clair, prêt à envoyer
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Tu donnes quelques infos (même sales). Pierre te renvoie une version structurée : formulation propre, ton
            maîtrisé, sections nettes, contenu directement copiable (mail / annonce / fiche / procédure).
            <span className="block mt-2">
              Et surtout : Pierre peut être <span className="font-medium text-foreground">autonome</span> — il agit sans
              que tu aies à lui écrire, quand tes règles/événements le déclenchent, avec traçabilité via l’historique.
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              Accéder à Pierre <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Timer className="h-4 w-4" />}
            title="Gain de temps immédiat"
            desc="De 30–60 min de rédaction → quelques secondes. Tu ne réécris plus pour “faire pro”."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Qualité RH constante"
            desc="Structure, vocabulaire, cohérence : même niveau de qualité, même quand tu es fatigué."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Autonome + traçable"
            desc="Pierre peut agir automatiquement selon tes règles. Chaque action laisse un historique/log clair."
          />
        </div>
      </header>

      {/* AUTONOMIE / PROACTIF */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Autonomie (ce qui le différencie vraiment)</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Bot className="h-4 w-4" />}
            title="Clone autonome"
            desc="Tu lui donnes un cadre (ton, règles, modèles, formats) et il exécute les tâches récurrentes sans relance manuelle."
          />
          <Card
            icon={<Workflow className="h-4 w-4" />}
            title="Déclencheurs"
            desc="Événements / règles : recrutement, onboarding, relances, mails types, documents internes à produire au bon moment."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Sécurité & contrôle"
            desc="Pierre reste dans son périmètre RH rédaction/structuration. Hors cadre : il refuse. Et tu peux exiger validation avant envoi."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Important</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            L’autonomie dépend de ton setup (règles, autorisations, actions disponibles). Pierre peut fonctionner en
            “rédaction pure” (tu récupères le texte), ou en “action” (prépare + exécute) si tu l’autorises.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Pierre au nom de ta boîte</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dédiée"
            desc="Tu peux connecter Pierre à une adresse de ton domaine (ex : pierre@tonentreprise.com) via une configuration DNS."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Envoi & réception"
            desc="Selon ton paramétrage : Pierre peut préparer les mails, et (si autorisé) envoyer depuis l’adresse pro — avec historique."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Ce que ça permet</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
            <li>Réponses RH cohérentes au ton de la marque</li>
            <li>Relances / confirmations / onboarding déclenchés automatiquement</li>
            <li>Centralisation (tout est rattaché à l’entreprise, pas à une boîte perso)</li>
          </ul>
        </div>
      </section>

      {/* CONNEXION SAV / SUPPORT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connexion SAV / Support (option)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<LifeBuoy className="h-4 w-4" />}
            title="Branché au support"
            desc="Pierre peut se relier au SAV/support de l’entreprise pour préparer des réponses claires et cohérentes, ou aider à classer et résumer."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Toujours dans le cadre"
            desc="Il ne promet pas n’importe quoi : il suit les règles, modèles, et informations autorisées. Hors info : il demande ou refuse."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Usage typique</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Le support reçoit un message → le Router déclenche Pierre → Pierre prépare une réponse + résumé + prochaines
            actions → tu valides ou tu laisses partir automatiquement (selon ton niveau d’autorisation).
          </p>
        </div>
      </section>

      {/* USE CASES */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Pierre fait (capacités principales)</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<FileText className="h-4 w-4" />}
            title="Offres d’emploi & fiches de poste"
            desc="Annonce prête à publier : missions, profil, compétences, avantages, contexte, ton employeur."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Mails candidats & RH"
            desc="Refus, convocation, relance, confirmation, onboarding — poli, humain, et carré."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Entretiens"
            desc="Questions + grille simple + compte rendu propre à partir de tes notes brutes."
          />
          <Card
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Onboarding & documents internes"
            desc="Plan 30/60/90 jours, scripts, procédures, documents internes lisibles et actionnables."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm">
            <span className="font-medium">Pierre ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              scoring/analyse de CV (c’est Clara) • conseil juridique formel • inventer des infos absentes • agir hors
              autorisations.
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
              “Mail de refus candidat — dev front — on garde en shortlist — ton humain.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Mail complet + objet + formulation pro + ouverture pour rester en contact.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Fiche de poste + annonce : assistant administratif, temps partiel, Auxerre, salaire 1 400–1 600.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Fiche structurée (missions/compétences/conditions) + annonce prête à publier.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Onboard une nouvelle recrue : commercial B2B, remote 3j, objectifs à 30/60/90 jours.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Plan onboarding + checklists + scripts mails internes + étapes J1 → J90.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Support : client énervé, il veut être remboursé. Réponse calme, ferme, et pro (pas de promesses).”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Réponse support structurée + options + next steps, conforme au cadre autorisé.
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment ça marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">1) Tu donnes un brief</p>
            <p className="text-sm text-muted-foreground">
              Même brouillon. Pierre comprend l’intention et récupère l’essentiel.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">2) Pierre rédige (format final)</p>
            <p className="text-sm text-muted-foreground">
              Structure claire, ton adapté, contenu prêt à être utilisé sans retouches.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">3) Pierre peut agir seul</p>
            <p className="text-sm text-muted-foreground">
              Selon ton setup : règles + autorisations + déclencheurs (CloneOS). Historique clair à chaque action.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3">
        <h3 className="text-lg font-medium">3 modes d’utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> brief → document final.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode action :</span> prépare + exécute (mail/doc) si autorisé.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode multi-clones :</span> un autre clone (ex : Clara) déclenche
            Pierre via le Router automatiquement.
          </li>
        </ul>
      </section>

      {/* ACCÈS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Accès à Pierre</h2>
            <p className="text-sm text-muted-foreground">299€/mois — accès immédiat après paiement.</p>
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
        ) : hasPierre ? (
          <>
            <p className="text-sm text-muted-foreground">Pierre est actif dans ton espace.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/agents/pierre/use">Utiliser Pierre</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile/agents">Mes clones</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {isLogged ? "Pour utiliser Pierre, tu dois l’embaucher." : "Connecte-toi puis embauche Pierre pour y accéder."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/paiement?agent=pierre">Embaucher Pierre — 299€/mois</Link>
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
















