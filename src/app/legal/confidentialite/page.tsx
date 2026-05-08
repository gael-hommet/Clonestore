import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Clock3,
  Cookie,
  Database,
  Eye,
  FileCheck2,
  Fingerprint,
  Globe2,
  KeyRound,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

function ActionButton({
  href,
  label,
  primary = false,
  icon,
  className = "",
}: {
  href: string;
  label: string;
  primary?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-14 items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-semibold tracking-[-0.02em] transition-all duration-200 ease-out",
        "border backdrop-blur-[18px] will-change-transform",
        primary
          ? [
              "text-white",
              "border-[rgba(109,130,255,0.22)]",
              "bg-[linear-gradient(135deg,rgba(22,30,53,0.96)_0%,rgba(39,56,98,0.94)_42%,rgba(111,131,255,0.96)_100%)]",
              "shadow-[0_18px_42px_rgba(72,91,176,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
              "hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(72,91,176,0.30),inset_0_1px_0_rgba(255,255,255,0.18)]",
            ].join(" ")
          : [
              "text-[var(--cs-ink-2)]",
              "border-[rgba(255,255,255,0.72)]",
              "bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.56)_100%)]",
              "shadow-[0_10px_30px_rgba(31,41,55,0.06),inset_0_1px_0_rgba(255,255,255,0.82)]",
              "hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.66)_100%)] hover:shadow-[0_14px_34px_rgba(31,41,55,0.08),inset_0_1px_0_rgba(255,255,255,0.88)]",
            ].join(" "),
        className,
      ].join(" ")}
    >
      <span>{label}</span>
      {icon ? <span className="shrink-0">{icon}</span> : null}
    </Link>
  );
}

function SectionTitle({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl space-y-3">
      <p className="cs-eyebrow">{kicker}</p>
      <h2 className="cs-heading text-2xl md:text-4xl">{title}</h2>
      <p className="text-sm leading-7 text-[var(--cs-ink-4)] md:text-base">{text}</p>
    </div>
  );
}

function InfoCard({
  title,
  text,
  icon,
  tone = "violet",
}: {
  title: string;
  text: string;
  icon: ReactNode;
  tone?: "violet" | "blue" | "rose" | "green" | "gold";
}) {
  const toneClass =
    tone === "violet"
      ? "text-[var(--cs-violet)]"
      : tone === "blue"
        ? "text-[color:#4c6fff]"
        : tone === "rose"
          ? "text-[var(--cs-danger)]"
          : tone === "gold"
            ? "text-[color:#9b6a24]"
            : "text-[var(--cs-success)]";

  return (
    <div className="cs-card h-full">
      <div className="relative flex h-full flex-col gap-4">
        <div className={`flex items-center gap-2 ${toneClass}`}>
          {icon}
          <span className="text-sm font-semibold text-[var(--cs-ink-2)]">
            {title}
          </span>
        </div>

        <p className="text-sm leading-6 text-[var(--cs-ink-4)]">{text}</p>
      </div>
    </div>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="cs-card">
      <div className="relative space-y-4">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
          {title}
        </h3>

        <div className="space-y-3 text-sm leading-7 text-[var(--cs-ink-4)]">
          {children}
        </div>
      </div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cs-violet)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ConfidentialitePage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6">
          <section className="cs-command-surface overflow-hidden">
            <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr] xl:items-start">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cs-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                    <span>Politique de confidentialité</span>
                  </span>

                  <span className="cs-pill">
                    <Lock className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    <span>Clarté, contrôle, transparence</span>
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="cs-display text-[clamp(2rem,3.5vw,4.6rem)] leading-[0.96]">
                    Une confidentialité claire,
                    <br />
                    <span className="cs-gradient-text">
                      à la hauteur d’un produit entreprise.
                    </span>
                  </h1>

                  <p className="max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                    CloneStore traite des données pour fournir un système d’employés IA
                    destiné aux entreprises. Cette page explique les catégories de données
                    concernées, les usages, les protections, les droits utilisateurs et la
                    logique de gouvernance appliquée au produit.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    href="/assistant"
                    label="Ouvrir CloneChat"
                    primary
                    icon={<ArrowRight className="h-4 w-4" />}
                  />

                  <ActionButton
                    href="/profile"
                    label="Retour au cockpit"
                    icon={<Sparkles className="h-4 w-4" />}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard
                  title="Transparence"
                  text="Les données traitées doivent rester compréhensibles : compte, entreprise, usage, missions, fichiers, messages, paramètres et historiques."
                  icon={<Eye className="h-4 w-4" />}
                  tone="violet"
                />

                <InfoCard
                  title="Contrôle"
                  text="L’utilisateur doit pouvoir piloter son compte, ses informations, ses préférences, ses accès et les demandes relatives à ses droits."
                  icon={<UserCheck className="h-4 w-4" />}
                  tone="green"
                />

                <InfoCard
                  title="Traçabilité"
                  text="CloneStore valorise la visibilité des missions, décisions, validations, actions, documents générés et événements importants."
                  icon={<FileCheck2 className="h-4 w-4" />}
                  tone="blue"
                />

                <InfoCard
                  title="Sécurité"
                  text="Le service est pensé pour un usage professionnel : accès sécurisés, gouvernance, journalisation utile et séparation logique des espaces."
                  icon={<Server className="h-4 w-4" />}
                  tone="rose"
                />
              </div>
            </div>
          </section>

          <section className="cs-panel">
            <div className="p-6 md:p-7">
              <SectionTitle
                kicker="Vue d’ensemble"
                title="Ce que cette politique encadre"
                text="CloneStore n’est pas une simple interface de chat. Le produit peut traiter des demandes, documents, règles, historiques, préférences et éléments de configuration liés à l’entreprise cliente."
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                  title="Qui traite"
                  text="L’éditeur du service CloneStore, tel qu’identifié dans les mentions légales et les documents contractuels applicables."
                  icon={<ShieldCheck className="h-4 w-4" />}
                  tone="violet"
                />

                <InfoCard
                  title="Quelles données"
                  text="Compte, entreprise, missions, messages, documents, actions, paramètres, historique, sécurité et support."
                  icon={<Database className="h-4 w-4" />}
                  tone="blue"
                />

                <InfoCard
                  title="Pourquoi"
                  text="Fournir le service, sécuriser l’usage, personnaliser l’expérience, permettre le support et assurer la continuité opérationnelle."
                  icon={<Sparkles className="h-4 w-4" />}
                  tone="green"
                />

                <InfoCard
                  title="Quels droits"
                  text="Accès, rectification, suppression, limitation, opposition, portabilité lorsque applicable et demande d’information."
                  icon={<Mail className="h-4 w-4" />}
                  tone="rose"
                />
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <LegalSection title="1. Responsable du traitement">
                <p>
                  Le responsable du traitement est l’éditeur du service CloneStore,
                  identifié dans les mentions légales, les conditions contractuelles ou les
                  documents d’abonnement applicables au client.
                </p>

                <p>
                  Pour les entreprises clientes, certains traitements peuvent être réalisés
                  dans le cadre de l’utilisation du service par leurs collaborateurs, dirigeants
                  ou utilisateurs autorisés. Dans ce cas, l’entreprise cliente peut également
                  définir certaines finalités internes liées à son usage opérationnel.
                </p>
              </LegalSection>

              <LegalSection title="2. Données susceptibles d’être traitées">
                <p>
                  Les catégories de données traitées dépendent des fonctionnalités utilisées,
                  des employés IA activés et des informations fournies volontairement dans
                  CloneStore.
                </p>

                <BulletList
                  items={[
                    "Données de compte : nom, prénom, adresse email, entreprise, rôle, préférences, identifiants techniques et accès.",
                    "Données d’entreprise : nom de l’entreprise, secteur, règles internes, préférences, configuration, identité de messagerie, paramètres d’employés IA.",
                    "Données d’usage : actions réalisées, missions créées, tâches, validations, statuts, historiques, journaux fonctionnels et événements de traçabilité.",
                    "Contenus fournis : demandes, messages, fichiers, documents, emails, notes, pièces jointes, textes RH, éléments opérationnels ou supports transmis au service.",
                    "Données générées : réponses, documents, synthèses, emails, PDF, suggestions, logs, résultats de missions et éléments produits par les employés IA.",
                    "Données techniques : navigateur, informations de sécurité, erreurs, logs applicatifs, données nécessaires au fonctionnement, à la maintenance et à la prévention des abus.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="3. Données sensibles et contenus professionnels">
                <p>
                  CloneStore peut être utilisé dans des contextes professionnels sensibles,
                  notamment RH, support client, opérations, documents internes, emails ou
                  coordination d’entreprise.
                </p>

                <p>
                  L’utilisateur doit éviter de transmettre des données qui ne sont pas nécessaires
                  à la mission demandée. Lorsqu’un contenu sensible est utile au service, il doit
                  être traité dans un cadre proportionné, contrôlé et cohérent avec les règles de
                  l’entreprise cliente.
                </p>

                <BulletList
                  items={[
                    "Ne transmettre que les informations utiles à la mission demandée.",
                    "Éviter les données excessives, non pertinentes ou inutiles.",
                    "Utiliser les validations humaines prévues pour les sujets sensibles.",
                    "Respecter les règles internes de confidentialité de l’entreprise.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="4. Finalités principales">
                <p>Les données peuvent être traitées pour les finalités suivantes :</p>

                <BulletList
                  items={[
                    "Créer, gérer et sécuriser les comptes utilisateurs et les accès entreprise.",
                    "Permettre l’utilisation des employés IA, des missions, des messages, des livrables, des fichiers et de la traçabilité produit.",
                    "Configurer les règles, préférences, paramètres, validations et éléments d’identité liés à l’entreprise cliente.",
                    "Produire des documents, emails, synthèses, réponses, tâches ou recommandations à partir des demandes formulées.",
                    "Assurer l’historique, la continuité, la reprise de contexte, le suivi des missions et la visibilité des actions.",
                    "Fournir l’assistance, l’onboarding, l’aide au choix d’un employé IA, le support et les réponses aux questions.",
                    "Sécuriser le service, prévenir les abus, corriger les erreurs, maintenir la stabilité et améliorer la fiabilité.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="5. Bases juridiques">
                <p>Selon les traitements concernés, les bases juridiques peuvent inclure :</p>

                <BulletList
                  items={[
                    "l’exécution d’un contrat ou de mesures précontractuelles liées au service CloneStore ;",
                    "le respect d’obligations légales applicables ;",
                    "l’intérêt légitime lié à la sécurité, à la prévention des abus, à l’amélioration du service, au support et à la continuité opérationnelle ;",
                    "le consentement lorsque celui-ci est requis, notamment pour certains cookies, préférences ou traitements optionnels.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="6. Fonctionnement IA et limites">
                <p>
                  Les employés IA de CloneStore peuvent analyser une demande, produire une réponse,
                  générer un document, préparer une action ou assister l’utilisateur dans un contexte
                  professionnel.
                </p>

                <p>
                  Les employés IA ne doivent pas remplacer la validation humaine lorsqu’une décision
                  sensible, juridique, disciplinaire, contractuelle ou stratégique nécessite un contrôle
                  humain. CloneStore peut intégrer des mécanismes de validation, de blocage, de refus
                  intelligent ou d’escalade selon les cas d’usage.
                </p>
              </LegalSection>
            </div>

            <div className="space-y-6">
              <LegalSection title="7. Partage, prestataires et sous-traitants">
                <p>
                  CloneStore peut faire appel à des prestataires techniques nécessaires à l’exploitation
                  du service, par exemple pour l’hébergement, la base de données, l’authentification,
                  l’envoi d’emails transactionnels, le paiement, la sécurité, l’analyse technique ou
                  certaines briques d’infrastructure.
                </p>

                <p>
                  Les accès des prestataires sont limités à ce qui est nécessaire au fonctionnement du
                  service, à sa sécurité, à sa maintenance ou à l’exécution des prestations prévues.
                </p>
              </LegalSection>

              <LegalSection title="8. Hébergement et transferts">
                <p>
                  Les données peuvent être hébergées ou traitées par des prestataires situés dans
                  différents pays selon l’infrastructure retenue. Lorsque des transferts hors de l’espace
                  réglementaire applicable sont nécessaires, CloneStore s’appuie sur les mécanismes
                  contractuels ou garanties prévues par la réglementation applicable.
                </p>

                <p>
                  La liste précise des sous-traitants, zones d’hébergement ou garanties applicables peut
                  être communiquée ou précisée dans les documents contractuels, les mentions légales ou
                  la documentation de sécurité.
                </p>
              </LegalSection>

              <LegalSection title="9. Sécurité et gouvernance">
                <p>
                  CloneStore applique une logique de sécurité adaptée à un usage professionnel, avec une
                  attention particulière portée aux accès, à la séparation des espaces, aux permissions
                  et à la traçabilité utile.
                </p>

                <BulletList
                  items={[
                    "Authentification et gestion des accès utilisateurs.",
                    "Séparation logique des comptes, entreprises, employés IA et données associées.",
                    "Contrôle des permissions selon le rôle, l’accès ou l’abonnement.",
                    "Historique et journalisation des actions importantes lorsque cela est nécessaire.",
                    "Mécanismes de validation humaine pour certaines actions sensibles.",
                    "Surveillance technique, correction d’erreurs, prévention des abus et maintien de la stabilité.",
                    "Limitation des accès internes aux besoins strictement nécessaires.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="10. Durée de conservation">
                <p>
                  Les données sont conservées pendant une durée cohérente avec les finalités du service,
                  la relation contractuelle, les obligations légales applicables, les besoins de sécurité,
                  de preuve, de support, de traçabilité et de continuité opérationnelle.
                </p>

                <p>
                  Certaines données peuvent être supprimées, archivées ou anonymisées lorsqu’elles ne sont
                  plus utiles au service, lorsque l’utilisateur en fait la demande dans un cadre applicable,
                  ou lorsque la conservation n’est plus justifiée.
                </p>
              </LegalSection>

              <LegalSection title="11. Cookies et technologies similaires">
                <p>
                  CloneStore peut utiliser des cookies ou technologies similaires pour assurer le
                  fonctionnement du site, sécuriser la connexion, mémoriser certaines préférences,
                  mesurer l’usage technique ou améliorer l’expérience.
                </p>

                <BulletList
                  items={[
                    "Cookies nécessaires au fonctionnement, à l’authentification ou à la sécurité.",
                    "Cookies de préférences pour conserver certains réglages d’interface.",
                    "Mesures techniques d’usage lorsque nécessaires pour améliorer le produit.",
                    "Cookies optionnels soumis au consentement lorsque la réglementation l’exige.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="12. Vos droits">
                <p>
                  Selon le cadre applicable, vous pouvez exercer plusieurs droits sur vos données.
                </p>

                <BulletList
                  items={[
                    "demander l’accès à certaines données vous concernant ;",
                    "demander la rectification ou la mise à jour d’informations inexactes ;",
                    "demander la suppression lorsque cela est juridiquement possible ;",
                    "demander la limitation de certains traitements ;",
                    "vous opposer à certains traitements lorsque le cadre le permet ;",
                    "demander la portabilité de certaines données lorsque ce droit est applicable ;",
                    "introduire une réclamation auprès de l’autorité compétente si nécessaire.",
                  ]}
                />

                <p>
                  Les demandes peuvent être adressées via les canaux de contact indiqués par CloneStore,
                  notamment depuis l’espace client, le support ou les mentions légales du service.
                </p>
              </LegalSection>

              <LegalSection title="13. Mise à jour de cette politique">
                <p>
                  Cette politique peut évoluer pour refléter les changements du service, l’ajout de
                  nouvelles fonctionnalités, l’évolution de l’infrastructure, des obligations légales ou
                  des pratiques de sécurité.
                </p>

                <BulletList
                  items={[
                    "évolution des employés IA et de leurs capacités ;",
                    "ajout de nouvelles pages, cockpits, historiques, validations ou automatisations ;",
                    "changement de prestataires, d’hébergement ou d’architecture technique ;",
                    "renforcement des règles de sécurité, gouvernance, support ou conformité.",
                  ]}
                />
              </LegalSection>
            </div>
          </div>

          <section className="cs-panel overflow-hidden">
            <div className="p-6 text-center md:p-8">
              <div className="mx-auto w-fit">
                <span className="cs-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  <span>Encore une question sur la confidentialité ?</span>
                </span>
              </div>

              <h2 className="cs-heading mt-6 text-3xl md:text-5xl">
                Demande une réponse claire
                <br />
                plutôt que de rester dans le doute.
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--cs-ink-4)] md:text-base">
                CloneStore doit rester lisible même sur les sujets sérieux :
                données, accès, IA, sécurité, suppression, historique, support ou gouvernance.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ActionButton
                  href="/assistant"
                  label="Ouvrir CloneChat"
                  primary
                  icon={<Bot className="h-4 w-4" />}
                  className="min-w-[220px]"
                />

                <ActionButton
                  href="/profile"
                  label="Retour au cockpit"
                  icon={<Sparkles className="h-4 w-4" />}
                  className="min-w-[210px]"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}