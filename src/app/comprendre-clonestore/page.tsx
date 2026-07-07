import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EMPLOYEE_PRICE, PIERRE_PUBLIC, FUTURE_DEPARTMENTS } from "@/lib/catalog/public-catalog";
import { getPierreLegalLimitStatement } from "@/lib/pierre/legal/pierre-commercial-claims";

// /comprendre-clonestore — page de référence complète.
// Rôle : expliquer TOUT CloneStore, de façon claire et défendable, pour être
// envoyée à un dirigeant, une DRH, un DSI ou un associé. Server component,
// contenu statique (SEO), aucun effet de bord. S'appuie sur les tokens cs-* du
// design system et sur la source de vérité commerciale (449 € HT/mois).

export const metadata: Metadata = {
  title: "Comprendre CloneStore — Le système d'exploitation d'employés IA",
  description:
    "La page de référence CloneStore : ce qu'est un employé IA, la différence avec un logiciel, un assistant et un agent, le fonctionnement d'une mission, l'Empreinte Entreprise, les technologies, le périmètre RH de Pierre, la gouvernance, le prix (449 € HT/mois), les limites et la vision.",
  alternates: { canonical: "/comprendre-clonestore" },
  robots: { index: true, follow: true },
};

const CATEGORY = [
  { k: "Un logiciel", does: "Fournit un espace et des fonctions.", human: "L'humain comprend la situation, organise, saisit, coordonne et suit le travail." },
  { k: "Un assistant IA", does: "Produit une réponse, un résumé ou un texte.", human: "L'humain transforme la réponse en actions et poursuit le travail." },
  { k: "Un agent IA", does: "Exécute une action ou poursuit un objectif technique.", human: "L'humain reste responsable du périmètre : l'agent n'est pas un poste dans l'entreprise." },
  { k: "Un employé IA CloneStore", does: "Reçoit un objectif et assume un périmètre de travail : comprend, organise, prépare, exécute, attend, relance, fait valider, trace — jusqu'au résultat.", human: "L'humain garde les décisions, les arbitrages, la relation et la responsabilité finale.", highlight: true },
];

const MISSION_STEPS = [
  { n: "01", t: "Une demande", d: "Vous formulez un objectif en langage naturel — pas une suite de clics." },
  { n: "02", t: "Compréhension", d: "L'employé IA lit la demande et en extrait les objectifs, les personnes et les échéances, sans rien inventer." },
  { n: "03", t: "Contexte", d: "Il relit l'Empreinte Entreprise : vos règles, vos modèles, vos validateurs, vos habitudes." },
  { n: "04", t: "Organisation", d: "La demande devient des missions, des tâches, des dépendances et des échéances." },
  { n: "05", t: "Exécution", d: "Il exécute les actions opérationnelles autorisées — relances, suivis, mises à jour de dossiers, notifications — produit les documents et fait avancer plusieurs missions en parallèle." },
  { n: "06", t: "Information manquante", d: "S'il manque une donnée, il la signale et bloque la tâche concernée — il ne comble jamais le trou seul." },
  { n: "07", t: "Validation humaine", d: "L'humain ne valide pas tout : Pierre s'arrête et sollicite un accord uniquement sur le sensible, l'engageant ou l'ambigu." },
  { n: "08", t: "Continuité", d: "La mission reste active dans le temps : il attend, reprend, relance et suit jusqu'à la clôture." },
  { n: "09", t: "Traçabilité", d: "Chaque action, source, document, décision et validation reste visible et vérifiable." },
];

const TECHS = [
  { n: "CloneOS", r: "Organise le travail", d: "Transforme un objectif en missions, tâches, dépendances, responsables, échéances et résultats attendus, puis coordonne l'avancement." },
  { n: "CloneADN & Empreinte Entreprise", r: "Adapte à votre entreprise", d: "L'employé IA possède déjà les compétences ; l'Empreinte lui apprend comment votre entreprise veut qu'elles soient appliquées : règles, modèles, validateurs, ton, formats, habitudes." },
  { n: "CloneGuard", r: "Encadre l'autonomie", d: "Chaque action est évaluée selon son contexte, sa sensibilité et les droits du demandeur : elle est exécutée, préparée, soumise à validation ou bloquée — jamais aveugle." },
  { n: "CloneContinuum", r: "Assure la continuité", d: "La mission ne disparaît pas après une réponse : elle reste active, se reprend sans perte de contexte, se relance et se suit jusqu'au résultat." },
  { n: "CloneTrace", r: "Trace et conserve", d: "Chaque décision, génération, action et validation est horodatée et retrouvable — pour comprendre et vérifier ce qui a été fait." },
];

const HR_TODAY = [
  "Réception et compréhension de demandes RH en langage naturel",
  "Relances, rappels et mises à jour de dossiers exécutés en autonomie encadrée",
  "Onboarding : préparation de l'arrivée, checklists, communications",
  "Recrutement opérationnel : offres, grilles, invitations, relances, comparatifs",
  "Documents RH : courriers, avenants, notes, comptes rendus",
  "Dossiers salariés : rassemblement, contrôle, signalement des pièces manquantes",
  "Absences et suivi administratif récurrent",
  "Communications autorisées et circuits de signature encadrés",
  "Continuité : reprise des missions, gestion des échéances, suivi jusqu'à la clôture",
  "Traçabilité complète de chaque action et de chaque validation",
];

const HUMAN_VALIDATES = [
  "Décision légale, exécution de la paie, décision de licenciement ou de sanction, signature d'un acte officiel",
  "Sujets disciplinaires, juridiques et contractuels sensibles",
  "Envoi d'une communication sensible ou action engageante",
  "Toute action marquée sensible ou ambiguë par les règles de l'entreprise",
];

// Modes d'autonomie configurables (ancrés sur les enums réels du moteur :
// draft / normal / high_autonomy / enterprise_autonomous — src/lib/pierre/v1/autonomy.ts).
const AUTONOMY_MODES = [
  { t: "Brouillon", tag: "Contrôle maximal", d: "Pierre prépare le travail — documents, messages, actions — mais n'envoie et n'exécute rien seul. Idéal pour les premières semaines, les décisions sensibles ou un contrôle fort." },
  { t: "Validation", tag: "Par défaut", d: "Pierre fait avancer la mission et prépare les actions, puis demande une validation avant certaines étapes : communication externe, signature, modification de dossier, action engageante." },
  { t: "Autonome", tag: "Capacité maximale", d: "Pierre exécute directement, sans interruption humaine, les actions internes autorisées — relances, suivis, mises à jour de dossiers, notifications, tâches récurrentes. Les envois externes suivent les intégrations et la configuration activées ; les exceptions sensibles remontent toujours à l'humain." },
];

// Trois modèles d'organisation possibles.
const ORG_MODELS = [
  { t: "Équipe IA seule", d: "Un dirigeant ou une direction garde les décisions sensibles, et Pierre prend en charge l'opérationnel RH quotidien." },
  { t: "Équipe hybride", d: "Pierre absorbe l'exécution, les relances, les documents, les suivis et les workflows, pendant que les humains gardent la relation, le management, les arbitrages et les cas complexes." },
  { t: "RH humain augmenté", d: "Pierre travaille avec le service RH existant pour multiplier sa capacité, réduire les délais, supprimer les oublis et industrialiser la continuité." },
];

// Ce que Pierre peut faire dans les outils connectés lorsque son périmètre l'y autorise.
const TOOLS_ACTIONS = [
  "Préparer les messages et — selon les intégrations et la configuration activées — envoyer les communications autorisées (les envois sensibles passent par une validation)",
  "Suivre les conversations entrantes et les rattacher au bon dossier ou à la bonne mission",
  "Relancer et planifier les relances aux bonnes échéances",
  "Mettre à jour les dossiers et faire avancer plusieurs missions en parallèle",
  "Préparer les documents et les faire circuler dans un workflow gouverné",
  "Préparer, suivre — et déclencher selon les règles et l'autorisation — un circuit de signature encadré",
  "Conserver la trace de chaque action, décision et validation",
];

const GOVERNANCE = [
  { t: "Autonomie encadrée", d: "Chaque action est classée avant d'agir : exécutée, préparée, soumise à validation ou refusée. Autonomie ne veut pas dire absence de contrôle — elle veut dire exécution dans un cadre défini par l'entreprise." },
  { t: "Permissions", d: "L'employé IA n'accède qu'à ce qui est nécessaire, autorisé et pertinent pour la mission." },
  { t: "Validation ciblée", d: "L'humain ne valide pas tout : la validation ne se déclenche que sur le sensible, l'engageant, l'ambigu ou le hors-périmètre." },
  { t: "Refus", d: "Les demandes hors périmètre ou contraires aux règles sont bloquées, avec une alternative proposée." },
  { t: "Isolation", d: "Chaque organisation dispose de son propre environnement, de ses propres règles et de ses propres données." },
  { t: "Traçabilité", d: "Chaque action, validée ou non, reste visible et retrouvable : rien n'avance sans laisser de trace." },
];

const FAQ = [
  { q: "CloneStore, c'est un logiciel de plus ?", a: "Non. Un logiciel équipe votre équipe pour faire le travail. CloneStore fournit un employé IA qui prend en charge un périmètre de travail, sous vos règles et votre contrôle." },
  { q: "Quelle différence avec ChatGPT ou un assistant IA ?", a: "Un assistant produit une réponse puis s'arrête ; l'humain doit ensuite tout exécuter. Un employé IA reçoit un objectif, organise une mission, exécute le travail autorisé, attend, relance, fait valider ce qui est sensible et garde la trace jusqu'au résultat." },
  { q: "Et un agent IA ?", a: "Un agent IA exécute une action. CloneStore lui apporte le contexte de l'entreprise, la continuité, les règles, la gouvernance et la traçabilité nécessaires pour devenir un employé IA responsable d'un périmètre." },
  { q: "Pierre remplace-t-il mon équipe RH ?", a: "Pierre peut prendre en charge une grande partie du périmètre RH opérationnel, et devenir dans certaines organisations l'équipe RH IA principale. Il traite les demandes, les documents, les relances, les suivis, les dossiers, les communications, les workflows, les circuits de signature encadrés et la traçabilité. L'entreprise choisit son modèle : IA seule, hybride, ou RH humain augmenté. Les humains gardent les décisions sensibles, la relation, les arbitrages et la responsabilité." },
  { q: "Pierre peut-il agir tout seul ?", a: "Oui, lorsque les actions sont autorisées par les règles, les permissions, les intégrations et le niveau d'autonomie choisis. Pierre fonctionne en mode brouillon, validation ou autonome. En mode autonome, il exécute directement les tâches autorisées et ne sollicite l'humain que pour les actions sensibles, ambiguës, interdites ou hors périmètre. L'humain ne valide pas tout — seulement ce que l'entreprise définit comme sensible, engageant ou hors périmètre." },
  { q: "Pierre peut-il envoyer des messages ou gérer des signatures ?", a: "Oui, si les intégrations et les permissions sont configurées. Pierre peut agir dans les messageries, les documents, les workflows, les signatures et les outils connectés lorsque son périmètre l'y autorise. Les signatures et actions engageantes peuvent être préparées, suivies ou exécutées selon les règles configurées : brouillon, validation humaine ou autonomie autorisée. Il gère des circuits de signature encadrés — avec permissions, traçabilité et validation humaine quand l'action est sensible ; il ne signe jamais à la place d'un humain." },
  { q: "Et si mon RH connaît déjà très bien l'entreprise ?", a: "Pierre apprend l'entreprise par l'Empreinte Entreprise : règles, modèles, équipes, circuits, validations, historiques, habitudes et exceptions. Dès les premières missions, il est utile. Après quelques semaines, il devient profondément adapté. Avec le temps, il devient une mémoire opérationnelle RH extrêmement difficile à égaler, parce qu'il conserve tout ce qui est fait, validé, corrigé et décidé — pour cette entreprise uniquement." },
  { q: "Comment Pierre connaît-il mon entreprise ?", a: "Grâce à l'Empreinte Entreprise : vos règles, vos modèles, vos validateurs, votre ton et vos habitudes. Son environnement se personnalise en quelques jours, puis chaque mission et chaque correction approuvée améliorent sa précision, pour cette entreprise uniquement." },
  { q: "Combien coûte Pierre ?", a: `${EMPLOYEE_PRICE}. Le tarif fondateur est conservé tant que l'abonnement reste actif. Aucun paiement ne se déclenche tant que vous ne créez pas votre compte.` },
  { q: "Pourquoi est-ce économiquement intéressant ?", a: `Dans de nombreuses organisations, Pierre peut absorber un volume de travail RH qui mobiliserait autrement plusieurs collaborateurs. Pour ${EMPLOYEE_PRICE}, l'entreprise obtient une capacité RH opérationnelle continue, rapide, traçable et configurable. L'écart de coût ne vient pas seulement du prix : il vient de la vitesse, du travail en parallèle, de la continuité, de l'absence d'oubli et de la disponibilité.` },
  { q: "Devons-nous remplacer nos outils ?", a: "Non. Pierre peut s'intégrer progressivement à votre environnement. Les connexions disponibles sont présentées selon leur état réel." },
  { q: "Quelles sont les limites ?", a: getPierreLegalLimitStatement() },
  { q: "S'adapte-t-il à ma taille d'entreprise ?", a: "Oui. La compétence reste la même ; le périmètre, le volume, les règles et le niveau d'autonomie s'adaptent, de la petite entreprise au groupe multisite." },
  { q: "Puis-je vérifier ce que Pierre a fait ?", a: "Oui. CloneTrace conserve chaque action, source, document, décision et validation, avec horodatage — tout reste visible et retrouvable." },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <p className="cs-eyebrow">{eyebrow}</p>
      <h2 className="cs-heading mt-2 text-[clamp(1.5rem,3vw,2.3rem)] leading-[1.1]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function ComprendreCloneStorePage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="mx-auto max-w-[860px]">
          {/* Hero */}
          <header className="text-center">
            <p className="cs-eyebrow">La référence CloneStore</p>
            <h1 className="cs-display mt-3 text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.02]">
              Comprendre CloneStore
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[1.02rem] leading-8 text-[var(--cs-ink-3)]">
              CloneStore est un système d&apos;exploitation d&apos;employés IA spécialisés. Chaque employé IA prend en
              charge un périmètre de travail complet, dans la durée, à partir des règles, des données, des permissions,
              des outils et des validations de votre entreprise.
            </p>
            <p className="mx-auto mt-4 max-w-[640px] text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
              Un logiciel aide une équipe à faire le travail. <strong>CloneStore fournit l&apos;employé IA qui le prend
              en charge.</strong>
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/demo" className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg">
                Voir la démonstration <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/reserver/pierre" className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--cs-line)] px-6 text-sm font-semibold text-[var(--cs-ink-1)]">
                Réserver Pierre
              </Link>
            </div>
          </header>

          {/* Pitch — le manifeste CloneStore */}
          <section id="pitch-clonestore" className="mt-16 scroll-mt-24">
            <p className="cs-eyebrow">Le pitch CloneStore</p>
            <h2 className="cs-heading mt-2 text-[clamp(1.8rem,3.6vw,2.9rem)] leading-[1.05]">
              C’est quoi CloneStore ?
            </h2>
            <p className="mt-5 max-w-[700px] text-[1.05rem] leading-8 text-[var(--cs-ink-2)]">
              CloneStore part d’un constat simple. Pour avancer plus vite, une entreprise n’a longtemps eu que deux
              options : recruter plus de monde, ou acheter plus de logiciels. Mais les logiciels ne font pas le travail.
            </p>

            {/* Le problème */}
            <div className="mt-8 max-w-[700px]">
              <p className="cs-eyebrow">Le problème</p>
              <p className="mt-2 text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                Ils donnent des tableaux, des boutons, des espaces, des dossiers. Derrière, il faut encore quelqu’un
                pour comprendre la demande, retrouver les informations, préparer les documents, relancer les bonnes
                personnes, suivre les échéances, vérifier ce qui manque, demander les validations et rendre compte.
              </p>
            </div>

            {/* La rupture — phrase 1 + phrase 2 */}
            <div className="cs-panel mt-7 border-l-2 border-[var(--cs-violet)] px-6 py-6">
              <p className="cs-eyebrow">La rupture</p>
              <p className="mt-2 text-[1.25rem] font-semibold leading-9 text-[var(--cs-ink-1)]">
                Un logiciel aide votre équipe à faire le travail. CloneStore fournit l’employé IA qui le prend en charge.
              </p>
              <p className="mt-3 text-[0.95rem] leading-7 text-[var(--cs-ink-3)]">
                Un assistant IA peut répondre à une question. Un agent IA exécute une action. Un employé IA assume un
                périmètre de travail. CloneStore ne vend pas des agents isolés : il fournit des employés IA complets,
                spécialisés, capables de prendre en charge un périmètre opérationnel dans la durée — avec les règles, les
                données, les permissions, les validations et les habitudes de l’entreprise.
              </p>
            </div>

            {/* Pierre — phrase 3 */}
            <div className="mt-8 max-w-[720px]">
              <p className="cs-eyebrow">Pierre, le premier employé IA</p>
              <p className="mt-2 text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                Le premier employé IA de CloneStore s’appelle Pierre. Il est spécialisé dans les ressources humaines.
              </p>
              <p className="mt-3 text-[1.05rem] font-semibold leading-8 text-[var(--cs-ink-1)]">
                Pierre n’est pas un assistant RH. C’est un employé IA RH complet qui organise, produit, suit, relance,
                fait valider et conserve la trace.
              </p>
              <p className="mt-3 text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                Il peut recevoir une demande RH, comprendre le contexte, retrouver les règles de l’entreprise, organiser
                la mission, produire les documents, préparer les communications, suivre les échéances, signaler les
                informations manquantes, relancer, demander une validation humaine quand c’est nécessaire, puis conserver
                l’historique complet. Recrutement opérationnel, onboarding, administration, dossiers salariés, absences,
                relances, suivi, conformité interne, communications, offboarding : ce n’est pas une tâche isolée, ni une
                checklist, ni un générateur de texte. C’est une fonction RH opérationnelle qui avance en continu.
              </p>
            </div>

            {/* L'économie — phrase 4 + 449 € HT */}
            <div className="cs-panel mt-7 border-l-2 border-[var(--cs-violet)] px-6 py-6">
              <p className="cs-eyebrow">L’économie</p>
              <p className="mt-2 text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                Dans beaucoup d’entreprises, ce travail mobilise plusieurs personnes, parfois une équipe RH entière —
                salaires, charges, outils, absences, oublis, relances manquées, temps perdu. Pierre, lui, coûte 449 € HT
                par mois.
              </p>
              <p className="mt-3 text-[1.2rem] font-semibold leading-9 text-[var(--cs-ink-1)]">
                Pour une fraction du coût d’une équipe humaine équivalente, l’entreprise obtient une capacité
                opérationnelle continue, rapide, gouvernée et traçable.
              </p>
              <p className="mt-3 text-[0.95rem] leading-7 text-[var(--cs-ink-3)]">
                Le gain ne vient pas seulement du prix. Pierre travaille en parallèle, garde le contexte, reprend une
                mission après une attente, relance sans oublier et ne laisse jamais une demande disparaître entre deux
                logiciels. L’humain garde les décisions, les arbitrages, la relation, le management et la responsabilité ;
                Pierre prend l’opérationnel répétitif, dispersé et chronophage. Il ne remplace pas le jugement humain — il
                retire à l’humain la charge de tout ce qui l’empêche d’avancer vite.
              </p>
            </div>

            {/* L'Empreinte + technologies */}
            <div className="mt-8 max-w-[720px]">
              <p className="cs-eyebrow">L’Empreinte Entreprise</p>
              <p className="mt-2 text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                Contrairement à une IA générique, Pierre devient unique à chaque entreprise grâce à l’Empreinte
                Entreprise : la mémoire opérationnelle de l’organisation — ses règles, ses documents, ses modèles, ses
                rôles, son ton, ses circuits de validation, ses permissions et ses habitudes. Opérationnel dès le départ,
                adapté après une semaine, il devient au fil des mois une mémoire opérationnelle qui conserve les missions,
                les décisions, les validations, les documents, les exceptions et les traces. La valeur, elle, commence dès
                les premières missions.
              </p>
              <p className="mt-3 text-[0.95rem] leading-7 text-[var(--cs-ink-3)]">
                Et tout est encadré : CloneOS organise le travail, CloneADN l’adapte à l’entreprise, CloneGuard définit ce
                qu’il fait seul, prépare, fait valider ou refuse, CloneContinuum garde les missions actives et CloneTrace
                conserve la preuve de chaque action. L’entreprise ne confie pas son organisation à une IA aveugle : elle
                ouvre un poste numérique, spécialisé, gouverné, traçable et adapté à son fonctionnement.
              </p>
            </div>

            {/* La vision — phrase 5 */}
            <div className="cs-panel mt-7 border-l-2 border-[var(--cs-violet)] px-6 py-6">
              <p className="cs-eyebrow">La vision</p>
              <p className="mt-2 text-[1.2rem] font-semibold leading-9 text-[var(--cs-ink-1)]">
                Pierre est le premier employé. Les RH sont le premier périmètre. CloneStore construit l’infrastructure des
                futures organisations augmentées par des employés IA.
              </p>
              <p className="mt-3 text-[0.95rem] leading-7 text-[var(--cs-ink-3)]">
                Demain, CloneStore pourra proposer des employés IA pour la finance, les opérations, le support,
                l’administration, le juridique, la communication et l’ingénierie. Une entreprise ne construira plus
                seulement son organisation avec des humains et des logiciels : elle pourra ouvrir des postes numériques,
                composés d’employés IA spécialisés, chacun adapté, encadré et traçable, chacun capable de prendre en
                charge un périmètre complet.
              </p>
            </div>

            {/* La vraie question — phrase 6, citation de clôture */}
            <blockquote className="mx-auto mt-9 max-w-[760px] text-center">
              <p className="text-[clamp(1.3rem,2.6vw,1.8rem)] font-semibold leading-[1.35] text-[var(--cs-ink-1)]">
                La vraie question n’est pas «&nbsp;est-ce qu’une entreprise va utiliser des employés IA&nbsp;?&nbsp;» La
                vraie question, c’est combien de temps elle acceptera encore de payer beaucoup plus cher pour avancer
                beaucoup plus lentement.
              </p>
            </blockquote>

            {/* Conclusion + CTA */}
            <div className="cs-command-surface mt-9 space-y-4 text-center">
              <p className="mx-auto max-w-[620px] text-[1.05rem] leading-8 text-[var(--cs-ink-1)]">
                <strong>Gagnez du temps et de l’argent.</strong> Pas avec un logiciel de plus. Avec des employés IA qui
                prennent le travail en charge.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-1">
                <Link href="/demo/pierre" className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg">
                  Voir Pierre travailler <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/reserver/pierre" className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--cs-line)] px-6 text-sm font-semibold text-[var(--cs-ink-1)]">
                  Réserver Pierre
                </Link>
              </div>
            </div>
          </section>

          {/* Catégorie */}
          <Section id="categorie" eyebrow="La catégorie" title="Logiciel, assistant, agent, employé IA">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--cs-line)] text-[var(--cs-ink-4)]">
                    <th className="py-3 pr-4 font-semibold">Catégorie</th>
                    <th className="py-3 pr-4 font-semibold">Ce qu&apos;elle fait</th>
                    <th className="py-3 font-semibold">Ce qui reste à l&apos;humain</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY.map((row) => (
                    <tr key={row.k} className={`border-b border-[var(--cs-line-soft)] align-top ${row.highlight ? "bg-[rgba(107,99,232,0.05)]" : ""}`}>
                      <td className="py-3 pr-4 font-semibold text-[var(--cs-ink-1)]">{row.k}</td>
                      <td className="py-3 pr-4 text-[var(--cs-ink-2)]">{row.does}</td>
                      <td className="py-3 text-[var(--cs-ink-3)]">{row.human}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-[var(--cs-ink-3)]">
              Le mot « agent » décrit une brique technique. Pierre n&apos;est pas un agent isolé : c&apos;est un employé
              IA complet, entouré d&apos;une mémoire d&apos;entreprise, d&apos;un système de missions, de règles, de
              validations, de continuité et de traçabilité.
            </p>
          </Section>

          {/* Mission */}
          <Section id="mission" eyebrow="Le fonctionnement" title="Comment fonctionne une mission">
            <div className="grid gap-3 sm:grid-cols-2">
              {MISSION_STEPS.map((s) => (
                <div key={s.n} className="cs-panel px-5 py-4">
                  <p className="text-[0.7rem] font-bold tracking-[0.14em] text-[var(--cs-ink-4)]">{s.n}</p>
                  <p className="mt-1 font-semibold text-[var(--cs-ink-1)]">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--cs-ink-3)]">{s.d}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Autonomie */}
          <Section id="autonomie" eyebrow="L'autonomie" title="Brouillon, validation, ou autonomie encadrée — vous choisissez">
            <p className="text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
              Pierre exécute réellement le travail RH opérationnel autorisé. Son autonomie est configurable :
              brouillon, validation ou autonomie encadrée, selon les actions, les outils et le niveau de confiance
              choisi. Autonomie ne veut pas dire absence de contrôle — elle veut dire exécution dans un cadre défini
              par l&apos;entreprise.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {AUTONOMY_MODES.map((m) => (
                <div key={m.t} className="cs-panel px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--cs-ink-1)]">{m.t}</p>
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-violet)]">{m.tag}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--cs-ink-3)]">{m.d}</p>
                </div>
              ))}
            </div>
            <div className="cs-panel mt-4 border-l-2 border-[var(--cs-violet)] px-5 py-4">
              <p className="text-sm leading-relaxed text-[var(--cs-ink-2)]">
                <strong>Les exceptions sensibles restent humaines.</strong> Même en mode autonome, Pierre remonte à
                l&apos;humain ce qui est sensible, engageant, ambigu ou hors périmètre. Quatre catégories restent
                toujours humaines et ne sont jamais exécutées seules : décision légale, exécution de la paie, décision
                de licenciement ou de sanction, et signature d&apos;un contrat à la place d&apos;un humain.
              </p>
            </div>
          </Section>

          {/* Modèles d'organisation */}
          <Section id="modeles" eyebrow="Modèles d'organisation" title="IA seule, hybride, ou RH humain augmenté">
            <p className="text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
              L&apos;entreprise choisit son modèle. Pierre peut fonctionner comme une équipe RH IA complète, ou comme
              le cœur opérationnel d&apos;une équipe hybride — jusqu&apos;à devenir le cœur opérationnel RH de
              l&apos;entreprise.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {ORG_MODELS.map((m) => (
                <div key={m.t} className="cs-panel px-5 py-4">
                  <p className="font-semibold text-[var(--cs-ink-1)]">{m.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--cs-ink-3)]">{m.d}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Empreinte */}
          <Section id="empreinte" eyebrow="Le contexte" title="L'Empreinte Entreprise">
            <div className="cs-panel px-6 py-6">
              <p className="text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                L&apos;Empreinte Entreprise est la connaissance structurée de votre organisation : ses règles, ses
                documents, ses modèles, ses équipes, ses rôles, ses permissions, ses circuits de validation, son
                vocabulaire et son fonctionnement réel.
              </p>
              <p className="mt-3 text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
                Elle permet à l&apos;employé IA de ne pas travailler comme une IA générique, mais selon la manière dont
                votre entreprise fonctionne. Son environnement se personnalise en quelques jours ; chaque mission,
                validation et correction améliore ensuite sa précision. Vous gardez le contrôle des sources, des accès,
                des règles et des niveaux d&apos;autonomie.
              </p>
            </div>
          </Section>

          {/* Technologies */}
          <Section id="technologies" eyebrow="Les technologies" title="Ce qui fait un employé IA, pas un agent">
            <div className="grid gap-3">
              {TECHS.map((t) => (
                <div key={t.n} className="cs-panel px-5 py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold text-[var(--cs-ink-1)]">{t.n}</span>
                    <span className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[var(--cs-violet)]">{t.r}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--cs-ink-3)]">{t.d}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Pierre */}
          <Section id="pierre" eyebrow="L'employé IA ouvert aujourd'hui" title={`Pierre — ${PIERRE_PUBLIC.role}`}>
            <p className="text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">{PIERRE_PUBLIC.tagline}</p>
            <p className="mt-2 text-[0.98rem] font-semibold leading-8 text-[var(--cs-ink-1)]">
              Pierre exécute réellement le travail RH opérationnel autorisé — pas seulement des brouillons, pas
              seulement des propositions.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="cs-panel px-5 py-4">
                <p className="cs-eyebrow">Ce que Pierre prend en charge aujourd&apos;hui</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--cs-ink-2)]">
                  {HR_TODAY.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
              <div className="cs-panel px-5 py-4">
                <p className="cs-eyebrow">Ce qui reste toujours humain</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--cs-ink-2)]">
                  {HUMAN_VALIDATES.map((x) => <li key={x}>{x}</li>)}
                </ul>
                <p className="mt-3 text-xs text-[var(--cs-ink-4)]">
                  Pierre exécute directement les actions opérationnelles autorisées ; il ne sollicite l&apos;humain que
                  pour ces cas — pas pour tout.
                </p>
              </div>
            </div>

            {/* Outils connectés & signatures */}
            <div className="cs-panel mt-3 px-5 py-4">
              <p className="cs-eyebrow">Messageries, documents, workflows, signatures &amp; outils connectés</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cs-ink-2)]">
                Pierre peut agir dans les messageries, les documents, les workflows, les signatures et les outils
                connectés lorsque son périmètre l&apos;y autorise.
              </p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {TOOLS_ACTIONS.map((x) => (
                  <li key={x} className="flex items-start gap-2 text-sm text-[var(--cs-ink-2)]">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cs-violet)]" />
                    {x}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-[var(--cs-ink-4)]">
                Les signatures et actions engageantes peuvent être préparées, suivies — et, lorsqu&apos;un prestataire
                de signature est raccordé et activé, exécutées — selon les règles configurées : brouillon, validation
                humaine ou autonomie autorisée. Pierre gère des circuits de signature encadrés — avec permissions,
                traçabilité et validation humaine quand l&apos;action est sensible ; il ne signe jamais à la place
                d&apos;un humain.
              </p>
            </div>
          </Section>

          {/* Gouvernance */}
          <Section id="gouvernance" eyebrow="Sécurité & gouvernance" title="La confiance est une architecture">
            <div className="grid gap-3 sm:grid-cols-2">
              {GOVERNANCE.map((g) => (
                <div key={g.t} className="cs-panel px-5 py-4">
                  <p className="font-semibold text-[var(--cs-ink-1)]">{g.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--cs-ink-3)]">{g.d}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Installation & prix */}
          <Section id="installation" eyebrow="Mise en place & prix" title="Installation, tarif, engagement">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="cs-panel px-5 py-4">
                <p className="cs-eyebrow">Installation</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--cs-ink-2)]">
                  L&apos;essentiel de l&apos;Empreinte Entreprise (structure, rôles, règles, validations, documents) se
                  prépare en quelques jours selon la taille de l&apos;entreprise et les éléments transmis. Pierre
                  s&apos;intègre progressivement à votre environnement, sans obliger à tout reconstruire.
                </p>
              </div>
              <div className="cs-panel px-5 py-4">
                <p className="cs-eyebrow">Prix</p>
                <p className="mt-2 text-[1.4rem] font-semibold text-[var(--cs-ink-1)]">{EMPLOYEE_PRICE}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--cs-ink-3)]">
                  Accès complet à Pierre, employé IA RH dédié à votre entreprise. Tarif fondateur conservé tant que
                  l&apos;abonnement reste actif. Aucun paiement ne se déclenche tant que vous ne créez pas votre compte.
                </p>
              </div>
            </div>
          </Section>

          {/* Limites */}
          <Section id="limites" eyebrow="Honnêteté" title="Les limites, clairement posées">
            <div className="cs-panel px-6 py-6">
              <p className="text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">{getPierreLegalLimitStatement()}</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--cs-ink-3)]">
                Les résultats dépendent de la qualité de l&apos;Empreinte Entreprise et des informations fournies. Pierre
                signale ce qui manque plutôt que de l&apos;inventer, et laisse les décisions sensibles à l&apos;humain.
              </p>
            </div>
          </Section>

          {/* Vision */}
          <Section id="vision" eyebrow="La vision" title="Pierre est le premier employé. Les RH, le premier périmètre.">
            <p className="text-[0.98rem] leading-8 text-[var(--cs-ink-2)]">
              CloneStore est conçu pour accueillir progressivement d&apos;autres employés IA spécialisés. Les entreprises
              qui installent Pierre aujourd&apos;hui construisent déjà leur Empreinte, leurs politiques et leur historique
              dans l&apos;infrastructure qui accueillera la suite — sans repartir de zéro.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {FUTURE_DEPARTMENTS.map((d) => (
                <div key={d.label} className="cs-panel px-5 py-4">
                  <p className="font-semibold text-[var(--cs-ink-1)]">{d.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--cs-ink-3)]">{d.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--cs-ink-4)]">
              Métiers présentés à titre de vision : aucun n&apos;est nommé, tarifé ou daté tant qu&apos;il n&apos;est
              pas ouvert. Pierre est le seul employé IA disponible aujourd&apos;hui.
            </p>
          </Section>

          {/* FAQ */}
          <Section id="faq" eyebrow="Questions fréquentes" title="FAQ">
            <div className="grid gap-2">
              {FAQ.map((item) => (
                <details key={item.q} className="cs-panel px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-[var(--cs-ink-1)] marker:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--cs-ink-3)]">{item.a}</p>
                </details>
              ))}
            </div>
          </Section>

          {/* CTA final */}
          <section className="mt-14">
            <div className="cs-command-surface space-y-4 text-center">
              <p className="cs-eyebrow">Prochaine étape</p>
              <h2 className="cs-heading text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.1]">
                Voyez Pierre prendre en charge une semaine RH.
              </h2>
              <p className="mx-auto max-w-[560px] text-sm leading-relaxed text-[var(--cs-ink-3)]">
                La démonstration est interactive et ne nécessite aucun compte. {EMPLOYEE_PRICE}.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-1">
                <Link href="/demo/pierre" className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg">
                  Voir Pierre travailler <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/agents/pierre" className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--cs-line)] px-6 text-sm font-semibold text-[var(--cs-ink-1)]">
                  Découvrir l&apos;offre Pierre
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
