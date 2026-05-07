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

export default function ClaraPage() {
  // âœ… singleton Supabase
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
        "Supabase non configurÃ© : vÃ©rifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (local + Vercel)."
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
              Clone CloneStore â€¢ Recrutement
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
              Autonome (selon rÃ¨gles)
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
            Clara â€” la recruteuse IA autonome qui structure ton recrutement, du tri Ã  la shortlist, avec dÃ©cisions claires
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Clara lit, extrait, score et compare. Elle transforme un tas de candidatures en{" "}
            <span className="font-medium text-foreground">shortlist exploitable</span>, avec raisons â€œpourquoi oui /
            pourquoi nonâ€, questions dâ€™entretien ciblÃ©es, et messages prÃªts Ã  envoyer si tu lâ€™actives.
            <span className="block mt-2">
              Clara peut aussi fonctionner en <span className="font-medium text-foreground">mode autonome</span> : elle
              agit sur dÃ©clencheurs (nouveau CV, nouvelle annonce, nouvelle Ã©tape pipeline) via CloneOS/Router â€” avec
              historique/log.
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="#acces">
              AccÃ©der Ã  Clara <ArrowRight className="ml-2 h-4 w-4" />
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
            desc="Clara gÃ¨re de gros volumes (CV, candidatures, profils) avec une structure constante."
          />
          <Card
            icon={<Wand2 className="h-4 w-4" />}
            title="DÃ©cision structurÃ©e"
            desc="Scoring + justification + comparaison : tu sais exactement pourquoi un profil passe ou sort."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="RÃ¨gles + garde-fous"
            desc="Clara ne devine pas. Elle sâ€™appuie sur les infos fournies. Hors cadre : elle demande, ou refuse."
          />
        </div>
      </header>

      {/* AUTONOMIE / CLONEOS */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Autonomie & CloneOS </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Bot className="h-4 w-4" />}
            title="Recruteuse autonome"
            desc="Elle peut piloter des tÃ¢ches rÃ©currentes : tri, scoring, shortlist, relances, prÃ©paration dâ€™entretiens â€” selon ton setup."
          />
          <Card
            icon={<Workflow className="h-4 w-4" />}
            title="CoopÃ©ration inter-clones"
            desc="Compatible CloneOS : Clara peut dÃ©clencher Pierre (mails, docs RH) via le Router, ou Ãªtre dÃ©clenchÃ©e par un autre clone."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="TraÃ§abilitÃ©"
            desc="Chaque action peut Ãªtre loggÃ©e : ce qui a Ã©tÃ© lu, pourquoi tel score, quelle shortlist, quel message gÃ©nÃ©rÃ©."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Ce que Clara promet / ce qu'elle ne promet pas</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Clara peut absorber une grosse charge de recrutement et te faire gagner Ã©normÃ©ment de temps, mais je ne
            vends pas â€œ5 employÃ©sâ€ comme une garantie. La performance dÃ©pend du volume, de la qualitÃ© des CV, et de tes
            critÃ¨res/rÃ¨gles.
          </p>
        </div>
      </section>

      {/* EMAIL ENTREPRISE (DNS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Email entreprise (option) : Clara au nom de ta boÃ®te</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<Building2 className="h-4 w-4" />}
            title="Adresse pro dÃ©diÃ©e"
            desc="Connexion possible Ã  une adresse du domaine (ex : clara@tonentreprise.com) via configuration DNS."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Messages candidats"
            desc="Clara peut prÃ©parer des messages candidats (reÃ§us, refus, relances, convocations). Envoi automatique uniquement si tu lâ€™autorises."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">RÃ©sultat</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Un ton RH constant, une expÃ©rience candidat plus propre, et un pipeline qui avance mÃªme quand tu es occupÃ©.
          </p>
        </div>
      </section>

      {/* INTEGRATIONS RH */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">IntÃ©grations RH (option) : ATS / outils internes</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <Card
            icon={<Plug className="h-4 w-4" />}
            title="Connexion outils"
            desc="Clara peut Ãªtre reliÃ©e Ã  des outils RH (ATS/pipeline) via intÃ©grations, selon ton stack et ce que tu autorises."
          />
          <Card
            icon={<ListChecks className="h-4 w-4" />}
            title="Pipeline recrutement"
            desc="Elle peut aider Ã  structurer : Ã©tapes, statuts, critÃ¨res, checklists, et suivi des candidats."
          />
          <Card
            icon={<ShieldCheck className="h-4 w-4" />}
            title="DonnÃ©es maÃ®trisÃ©es"
            desc="On limite aux donnÃ©es nÃ©cessaires. Pas dâ€™invention, pas dâ€™accÃ¨s implicite : tout est autorisÃ© explicitement."
          />
        </div>

        <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
          <p className="text-sm font-medium">Note</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les intÃ©grations dÃ©pendent de ton outil (et des autorisations). Si un connecteur nâ€™existe pas, on passe par un
            flux Router/Make ou API quand câ€™est possible.
          </p>
        </div>
      </section>

      {/* CAPACITÃ‰S */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Ce que Clara fait</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            icon={<FileText className="h-4 w-4" />}
            title="Analyse & extraction CV"
            desc="Lecture, extraction des infos clÃ©s, synthÃ¨se claire et comparable entre candidats."
          />
          <Card
            icon={<BadgeCheck className="h-4 w-4" />}
            title="Scoring selon critÃ¨res"
            desc="Score basÃ© sur tes must-have / nice-to-have / contexte poste. Justification transparente."
          />
          <Card
            icon={<Users className="h-4 w-4" />}
            title="Shortlists exploitables"
            desc="Top candidats + raisons + risques + points Ã  vÃ©rifier. Format prÃªt Ã  partager en interne."
          />
          <Card
            icon={<ClipboardList className="h-4 w-4" />}
            title="PrÃ©paration dâ€™entretien"
            desc="Questions ciblÃ©es + axes dâ€™Ã©valuation + grille simple pour standardiser les dÃ©cisions."
          />
          <Card
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Comparaison candidats"
            desc="Comparatifs 1v1 / 1v3 / 1v10. Elle explique le choix et propose une dÃ©cision."
          />
          <Card
            icon={<Mail className="h-4 w-4" />}
            title="Messages candidats (option)"
            desc="PrÃ©pare les mails candidats. Envoi automatique uniquement si tu actives et autorises."
          />
        </div>

        <div className="rounded-2xl border p-6 cs-card shadow-soft">
          <p className="text-sm">
            <span className="font-medium">Clara ne fait pas :</span>{" "}
            <span className="text-muted-foreground">
              rÃ©diger des documents RH complets type â€œcontrat/notes/processâ€ (câ€™est Pierre) â€¢ inventer des infos absentes
              â€¢ promesses juridiques â€¢ remplacer lâ€™entretien humain (elle prÃ©pare la dÃ©cision).
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
              â€œJâ€™ai 37 CV pour un commercial B2B. Score + shortlist de 5 + raisons.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              Tableau synthÃ¨se + scores + shortlist + points Ã  vÃ©rifier Ã  lâ€™entretien.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œCompare ces 3 candidats et propose une dÃ©cision (avec risques).â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              Comparatif clair + recommandation + plan de questions pour confirmer.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œPrÃ©pare lâ€™entretien : questions ciblÃ©es + grille dâ€™Ã©val.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              Questions par thÃ¨me + grille simple + critÃ¨res â€œgo/no-goâ€.
            </p>
          </div>

          <div className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
            <p className="text-sm font-medium">Brief</p>
            <p className="text-sm text-muted-foreground">
              â€œPipeline : on reÃ§oit 10 CV/jour. Classe automatiquement et alerte quand profil â€˜Aâ€™.â€
            </p>
            <p className="text-sm font-medium pt-2">RÃ©sultat</p>
            <p className="text-sm text-muted-foreground">
              RÃ¨gles + dÃ©clencheurs + shortlist continue (si ton setup est activÃ©).
            </p>
          </div>
        </div>
      </section>

      {/* COMMENT */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Comment Ã§a marche</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">1) Tu fournis le contexte</p>
            <p className="text-sm text-muted-foreground">
              Poste, must-have, niveau, critÃ¨res, ton process (mÃªme simple).
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">2) Clara analyse & score</p>
            <p className="text-sm text-muted-foreground">
              Extraction, synthÃ¨se, scoring, shortlist et recommandations.
            </p>
          </div>
          <div className="rounded-2xl border p-6 space-y-2 cs-card shadow-soft">
            <p className="text-sm font-medium">3) Clara peut automatiser</p>
            <p className="text-sm text-muted-foreground">
              DÃ©clencheurs via CloneOS/Router : tri continu, alertes, messages, coopÃ©ration avec Pierre.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 space-y-3 cs-card shadow-soft">
        <h3 className="text-lg font-medium">3 modes dâ€™utilisation</h3>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
          <li>
            <span className="font-medium text-foreground">Mode simple :</span> tu upload/colles des CV â†’ Clara rend scoring
            + shortlist.
          </li>
          <li>
            <span className="font-medium text-foreground">Mode pipeline :</span> Clara gÃ¨re un flux continu (tri, alertes,
            comparatifs).
          </li>
          <li>
            <span className="font-medium text-foreground">Mode CloneOS :</span> Clara coopÃ¨re avec Pierre (mails/docs) via
            Router, avec logs.
          </li>
        </ul>
      </section>

      {/* ACCÃˆS / CTA */}
      <section id="acces" className="rounded-2xl border p-8 space-y-4 cs-card shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">AccÃ¨s Ã  Clara</h2>
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
                ? "Clara nâ€™est pas encore disponible Ã  lâ€™achat. Tu peux dÃ©jÃ  poser des questions via lâ€™assistant."
                : "Connecte-toi pour suivre lâ€™arrivÃ©e de Clara. En attendant, tu peux poser tes questions via lâ€™assistant."}
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




