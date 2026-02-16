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
  Radar,
  Workflow,
  AtSign,
  Building2,
  ClipboardList,
  FileText,
  CheckCircle2,
  Mail,
  Users,
  ListChecks,
  ScanSearch,
  BadgeCheck,
  Plug,
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

export default function ClaraPage() {
  // ✅ singleton Supabase
  const supabase = useMemo(() => getSupabase() as SupabaseClient | null, []);

  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [hasClara, setHasClara] = useState(false);
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
      setHasClara(false);
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
        setHasClara(false);
        setLoading(false);
        setError(userErr.message);
        return { ok: false, has: false };
      }

      const user = userData?.user;
      if (!user) {
        setIsLogged(false);
        setHasClara(false);
        setLoading(false);
        return { ok: true, has: false };
      }

      setIsLogged(true);

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_slug", "clara")
        .eq("status", "active")
        .maybeSingle();

      if (orderErr) setError(orderErr.message);

      const has = Boolean(order);
      setHasClara(has);
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
              Clone CloneStore • Recrutement
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <ScanSearch className="h-3.5 w-3.5" />
              Analyse + scoring + shortlist
            </span>
          </Pill>
          <Pill>
            <span className="inline-flex items-center gap-2">
              <Radar className="h-3.5 w-3.5" />
              Autonome (selon règles)
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
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">
            Clara — la recruteuse IA autonome qui structure ton recrutement, du tri à la shortlist, avec décisions claires
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Clara lit, extrait, score et compare. Elle transforme un tas de candidatures en{" "}
            <span className="font-medium text-foreground">shortlist exploitable</span>, avec raisons “pourquoi oui /
            pourquoi non”, questions d’entretien ciblées, et messages prêts à envoyer si tu l’actives.
            <span className="block mt-2">
              Clara peut aussi fonctionner en <span className="font-medium text-foreground">mode autonome</span> : elle
              agit sur déclencheurs (nouveau CV, nouvelle annonce, nouvelle étape pipeline) via CloneOS/Router — avec
              historique/log.
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              Accéder à Clara <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agents">Retour boutique</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Timer className="h-4 w-4" />}
            title="Tri massif, sans fatigue"
            desc="Clara gère de gros volumes (CV, candidatures, profils) avec une structure constante."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="Décision structurée"
            desc="Scoring + justification + comparaison : tu sais exactement pourquoi un profil passe ou sort."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Règles + garde-fous"
            desc="Clara ne devine pas. Elle s’appuie sur les infos fournies. Hors cadre : elle demande, ou refuse."
          />
        </div>
      </header>

      {/* AUTONOMIE / CLONEOS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Autonomie & CloneOS (le mode “big boss”)</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Bot className="h-4 w-4" />}
            title="Recruteuse autonome"
            desc="Elle peut piloter des tâches récurrentes : tri, scoring, shortlist, relances, préparation d’entretiens — selon ton setup."
          />
          <Card
            icon={<Workflow className="h-4 w-4" />}
            title="Coopération inter-clones"
            desc="Compatible CloneOS : Clara peut déclencher Pierre (mails, docs RH) via le Router, ou être déclenchée par un autre clone."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Traçabilité"
            desc="Chaque action peut être loggée : ce qui a été lu, pourquoi tel score, quelle shortlist, quel message généré."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Ce que je promets / ce que je ne promets pas</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Clara peut absorber une grosse charge de recrutement et te faire gagner énormément de temps, mais je ne
            vends pas “5 employés” comme une garantie. La performance dépend du volume, de la qualité des CV, et de tes
            critères/règles.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Clara au nom de ta boîte</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dédiée"
            desc="Connexion possible à une adresse du domaine (ex : clara@tonentreprise.com) via configuration DNS."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Messages candidats"
            desc="Clara peut préparer des messages candidats (reçus, refus, relances, convocations). Envoi automatique uniquement si tu l’autorises."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Résultat</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Un ton RH constant, une expérience candidat plus propre, et un pipeline qui avance même quand tu es occupé.
          </p>
        </div>
      </section>

      {/* INTEGRATIONS RH */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Intégrations RH (option) : ATS / outils internes</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Plug className="h-4 w-4" />}
            title="Connexion outils"
            desc="Clara peut être reliée à des outils RH (ATS/pipeline) via intégrations, selon ton stack et ce que tu autorises."
          />
          <Card
            icon={<ListChecks className="h-4 w-4" />}
            title="Pipeline recrutement"
            desc="Elle peut aider à structurer : étapes, statuts, critères, checklists, et suivi des candidats."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Données maîtrisées"
            desc="On limite aux données nécessaires. Pas d’invention, pas d’accès implicite : tout est autorisé explicitement."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intégrations dépendent de ton outil (et des autorisations). Si un connecteur n’existe pas, on passe par un
            flux Router/Make ou API quand c’est possible.
          </p>
        </div>
      </section>

      {/* CAPACITÉS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Clara fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<FileText className="h-4 w-4" />}
            title="Analyse & extraction CV"
            desc="Lecture, extraction des infos clés, synthèse claire et comparable entre candidats."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="Scoring selon critères"
            desc="Score basé sur tes must-have / nice-to-have / contexte poste. Justification transparente."
          />
          <Card
            icon={<Users className="h-4 w-4" />}
            title="Shortlists exploitables"
            desc="Top candidats + raisons + risques + points à vérifier. Format prêt à partager en interne."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="Préparation d’entretien"
            desc="Questions ciblées + axes d’évaluation + grille simple pour standardiser les décisions."
          />
          <Card
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Comparaison candidats"
            desc="Comparatifs 1v1 / 1v3 / 1v10. Elle explique le choix et propose une décision."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Messages candidats (option)"
            desc="Prépare les mails candidats. Envoi automatique uniquement si tu actives et autorises."
          />
        </div>

        <div className="rounded-2xl border p-6">
          <p className="text-sm">
            <span className="font-medium">Clara ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              rédiger des documents RH complets type “contrat/notes/process” (c’est Pierre) • inventer des infos absentes
              • promesses juridiques • remplacer l’entretien humain (elle prépare la décision).
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
              “J’ai 37 CV pour un commercial B2B. Score + shortlist de 5 + raisons.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Tableau synthèse + scores + shortlist + points à vérifier à l’entretien.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Compare ces 3 candidats et propose une décision (avec risques).”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Comparatif clair + recommandation + plan de questions pour confirmer.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Prépare l’entretien : questions ciblées + grille d’éval.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Questions par thème + grille simple + critères “go/no-go”.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              “Pipeline : on reçoit 10 CV/jour. Classe automatiquement et alerte quand profil ‘A’.”
            </p>
            <p className="text-sm font-medium pt-2">Résultat</p>
            <p className="text-sm text-muted-foreground">
              Règles + déclencheurs + shortlist continue (si ton setup est activé).
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment ça marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">1) Tu fournis le contexte</p>
            <p className="text-sm text-muted-foreground">
              Poste, must-have, niveau, critères, ton process (même simple).
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">2) Clara analyse & score</p>
            <p className="text-sm text-muted-foreground">
              Extraction, synthèse, scoring, shortlist et recommandations.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2">
            <p className="text-sm font-medium">3) Clara peut automatiser</p>
            <p className="text-sm text-muted-foreground">
              Déclencheurs via CloneOS/Router : tri continu, alertes, messages, coopération avec Pierre.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3">
        <h3 className="text-lg font-medium">3 modes d’utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> tu upload/colles des CV → Clara rend scoring
            + shortlist.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode pipeline :</span> Clara gère un flux continu (tri, alertes,
            comparatifs).
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> Clara coopère avec Pierre (mails/docs) via
            Router, avec logs.
          </li>
        </ul>
      </section>

      {/* ACCÈS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Accès à Clara</h2>
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
        ) : hasClara ? (
          <>
            <p className="text-sm text-muted-foreground">Clara est active dans ton espace.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/agents/clara/use">Utiliser Clara</Link>
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
                ? "Clara n’est pas encore disponible à l’achat. Tu peux déjà poser des questions via l’assistant."
                : "Connecte-toi pour suivre l’arrivée de Clara. En attendant, tu peux poser tes questions via l’assistant."}
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




