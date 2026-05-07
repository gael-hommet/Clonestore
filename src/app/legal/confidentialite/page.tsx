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
                    <span>Politique de confidentialitÃ©</span>
                  </span>

                  <span className="cs-pill">
                    <Lock className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                    <span>ClartÃ©, contrÃ´le, transparence</span>
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="cs-display text-[clamp(2rem,3.5vw,4.6rem)] leading-[0.96]">
                    Une confidentialitÃ© claire,
                    <br />
                    <span className="cs-gradient-text">
                      Ã  la hauteur dâ€™un produit entreprise.
                    </span>
                  </h1>

                  <p className="max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                    CloneStore traite des donnÃ©es pour fournir un systÃ¨me dâ€™employÃ©s IA
                    destinÃ© aux entreprises. Cette page explique les catÃ©gories de donnÃ©es
                    concernÃ©es, les usages, les protections, les droits utilisateurs et la
                    logique de gouvernance appliquÃ©e au produit.
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
                  text="Les donnÃ©es traitÃ©es doivent rester comprÃ©hensibles : compte, entreprise, usage, missions, fichiers, messages, paramÃ¨tres et historiques."
                  icon={<Eye className="h-4 w-4" />}
                  tone="violet"
                />

                <InfoCard
                  title="ContrÃ´le"
                  text="Lâ€™utilisateur doit pouvoir piloter son compte, ses informations, ses prÃ©fÃ©rences, ses accÃ¨s et les demandes relatives Ã  ses droits."
                  icon={<UserCheck className="h-4 w-4" />}
                  tone="green"
                />

                <InfoCard
                  title="TraÃ§abilitÃ©"
                  text="CloneStore valorise la visibilitÃ© des missions, dÃ©cisions, validations, actions, documents gÃ©nÃ©rÃ©s et Ã©vÃ©nements importants."
                  icon={<FileCheck2 className="h-4 w-4" />}
                  tone="blue"
                />

                <InfoCard
                  title="SÃ©curitÃ©"
                  text="Le service est pensÃ© pour un usage professionnel : accÃ¨s sÃ©curisÃ©s, gouvernance, journalisation utile et sÃ©paration logique des espaces."
                  icon={<Server className="h-4 w-4" />}
                  tone="rose"
                />
              </div>
            </div>
          </section>

          <section className="cs-panel">
            <div className="p-6 md:p-7">
              <SectionTitle
                kicker="Vue dâ€™ensemble"
                title="Ce que cette politique encadre"
                text="CloneStore nâ€™est pas une simple interface de chat. Le produit peut traiter des demandes, documents, rÃ¨gles, historiques, prÃ©fÃ©rences et Ã©lÃ©ments de configuration liÃ©s Ã  lâ€™entreprise cliente."
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                  title="Qui traite"
                  text="Lâ€™Ã©diteur du service CloneStore, tel quâ€™identifiÃ© dans les mentions lÃ©gales et les documents contractuels applicables."
                  icon={<ShieldCheck className="h-4 w-4" />}
                  tone="violet"
                />

                <InfoCard
                  title="Quelles donnÃ©es"
                  text="Compte, entreprise, missions, messages, documents, actions, paramÃ¨tres, historique, sÃ©curitÃ© et support."
                  icon={<Database className="h-4 w-4" />}
                  tone="blue"
                />

                <InfoCard
                  title="Pourquoi"
                  text="Fournir le service, sÃ©curiser lâ€™usage, personnaliser lâ€™expÃ©rience, permettre le support et assurer la continuitÃ© opÃ©rationnelle."
                  icon={<Sparkles className="h-4 w-4" />}
                  tone="green"
                />

                <InfoCard
                  title="Quels droits"
                  text="AccÃ¨s, rectification, suppression, limitation, opposition, portabilitÃ© lorsque applicable et demande dâ€™information."
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
                  Le responsable du traitement est lâ€™Ã©diteur du service CloneStore,
                  identifiÃ© dans les mentions lÃ©gales, les conditions contractuelles ou les
                  documents dâ€™abonnement applicables au client.
                </p>

                <p>
                  Pour les entreprises clientes, certains traitements peuvent Ãªtre rÃ©alisÃ©s
                  dans le cadre de lâ€™utilisation du service par leurs collaborateurs, dirigeants
                  ou utilisateurs autorisÃ©s. Dans ce cas, lâ€™entreprise cliente peut Ã©galement
                  dÃ©finir certaines finalitÃ©s internes liÃ©es Ã  son usage opÃ©rationnel.
                </p>
              </LegalSection>

              <LegalSection title="2. DonnÃ©es susceptibles dâ€™Ãªtre traitÃ©es">
                <p>
                  Les catÃ©gories de donnÃ©es traitÃ©es dÃ©pendent des fonctionnalitÃ©s utilisÃ©es,
                  des employÃ©s IA activÃ©s et des informations fournies volontairement dans
                  CloneStore.
                </p>

                <BulletList
                  items={[
                    "DonnÃ©es de compte : nom, prÃ©nom, adresse email, entreprise, rÃ´le, prÃ©fÃ©rences, identifiants techniques et accÃ¨s.",
                    "DonnÃ©es dâ€™entreprise : nom de lâ€™entreprise, secteur, rÃ¨gles internes, prÃ©fÃ©rences, configuration, identitÃ© de messagerie, paramÃ¨tres dâ€™employÃ©s IA.",
                    "DonnÃ©es dâ€™usage : actions rÃ©alisÃ©es, missions crÃ©Ã©es, tÃ¢ches, validations, statuts, historiques, journaux fonctionnels et Ã©vÃ©nements de traÃ§abilitÃ©.",
                    "Contenus fournis : demandes, messages, fichiers, documents, emails, notes, piÃ¨ces jointes, textes RH, Ã©lÃ©ments opÃ©rationnels ou supports transmis au service.",
                    "DonnÃ©es gÃ©nÃ©rÃ©es : rÃ©ponses, documents, synthÃ¨ses, emails, PDF, suggestions, logs, rÃ©sultats de missions et Ã©lÃ©ments produits par les employÃ©s IA.",
                    "DonnÃ©es techniques : navigateur, informations de sÃ©curitÃ©, erreurs, logs applicatifs, donnÃ©es nÃ©cessaires au fonctionnement, Ã  la maintenance et Ã  la prÃ©vention des abus.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="3. DonnÃ©es sensibles et contenus professionnels">
                <p>
                  CloneStore peut Ãªtre utilisÃ© dans des contextes professionnels sensibles,
                  notamment RH, support client, opÃ©rations, documents internes, emails ou
                  coordination dâ€™entreprise.
                </p>

                <p>
                  Lâ€™utilisateur doit Ã©viter de transmettre des donnÃ©es qui ne sont pas nÃ©cessaires
                  Ã  la mission demandÃ©e. Lorsquâ€™un contenu sensible est utile au service, il doit
                  Ãªtre traitÃ© dans un cadre proportionnÃ©, contrÃ´lÃ© et cohÃ©rent avec les rÃ¨gles de
                  lâ€™entreprise cliente.
                </p>

                <BulletList
                  items={[
                    "Ne transmettre que les informations utiles Ã  la mission demandÃ©e.",
                    "Ã‰viter les donnÃ©es excessives, non pertinentes ou inutiles.",
                    "Utiliser les validations humaines prÃ©vues pour les sujets sensibles.",
                    "Respecter les rÃ¨gles internes de confidentialitÃ© de lâ€™entreprise.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="4. FinalitÃ©s principales">
                <p>Les donnÃ©es peuvent Ãªtre traitÃ©es pour les finalitÃ©s suivantes :</p>

                <BulletList
                  items={[
                    "CrÃ©er, gÃ©rer et sÃ©curiser les comptes utilisateurs et les accÃ¨s entreprise.",
                    "Permettre lâ€™utilisation des employÃ©s IA, des missions, des messages, des livrables, des fichiers et de la traÃ§abilitÃ© produit.",
                    "Configurer les rÃ¨gles, prÃ©fÃ©rences, paramÃ¨tres, validations et Ã©lÃ©ments dâ€™identitÃ© liÃ©s Ã  lâ€™entreprise cliente.",
                    "Produire des documents, emails, synthÃ¨ses, rÃ©ponses, tÃ¢ches ou recommandations Ã  partir des demandes formulÃ©es.",
                    "Assurer lâ€™historique, la continuitÃ©, la reprise de contexte, le suivi des missions et la visibilitÃ© des actions.",
                    "Fournir lâ€™assistance, lâ€™onboarding, lâ€™aide au choix dâ€™un employÃ© IA, le support et les rÃ©ponses aux questions.",
                    "SÃ©curiser le service, prÃ©venir les abus, corriger les erreurs, maintenir la stabilitÃ© et amÃ©liorer la fiabilitÃ©.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="5. Bases juridiques">
                <p>Selon les traitements concernÃ©s, les bases juridiques peuvent inclure :</p>

                <BulletList
                  items={[
                    "lâ€™exÃ©cution dâ€™un contrat ou de mesures prÃ©contractuelles liÃ©es au service CloneStore ;",
                    "le respect dâ€™obligations lÃ©gales applicables ;",
                    "lâ€™intÃ©rÃªt lÃ©gitime liÃ© Ã  la sÃ©curitÃ©, Ã  la prÃ©vention des abus, Ã  lâ€™amÃ©lioration du service, au support et Ã  la continuitÃ© opÃ©rationnelle ;",
                    "le consentement lorsque celui-ci est requis, notamment pour certains cookies, prÃ©fÃ©rences ou traitements optionnels.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="6. Fonctionnement IA et limites">
                <p>
                  Les employÃ©s IA de CloneStore peuvent analyser une demande, produire une rÃ©ponse,
                  gÃ©nÃ©rer un document, prÃ©parer une action ou assister lâ€™utilisateur dans un contexte
                  professionnel.
                </p>

                <p>
                  Les employÃ©s IA ne doivent pas remplacer la validation humaine lorsquâ€™une dÃ©cision
                  sensible, juridique, disciplinaire, contractuelle ou stratÃ©gique nÃ©cessite un contrÃ´le
                  humain. CloneStore peut intÃ©grer des mÃ©canismes de validation, de blocage, de refus
                  intelligent ou dâ€™escalade selon les cas dâ€™usage.
                </p>
              </LegalSection>
            </div>

            <div className="space-y-6">
              <LegalSection title="7. Partage, prestataires et sous-traitants">
                <p>
                  CloneStore peut faire appel Ã  des prestataires techniques nÃ©cessaires Ã  lâ€™exploitation
                  du service, par exemple pour lâ€™hÃ©bergement, la base de donnÃ©es, lâ€™authentification,
                  lâ€™envoi dâ€™emails transactionnels, le paiement, la sÃ©curitÃ©, lâ€™analyse technique ou
                  certaines briques dâ€™infrastructure.
                </p>

                <p>
                  Les accÃ¨s des prestataires sont limitÃ©s Ã  ce qui est nÃ©cessaire au fonctionnement du
                  service, Ã  sa sÃ©curitÃ©, Ã  sa maintenance ou Ã  lâ€™exÃ©cution des prestations prÃ©vues.
                </p>
              </LegalSection>

              <LegalSection title="8. HÃ©bergement et transferts">
                <p>
                  Les donnÃ©es peuvent Ãªtre hÃ©bergÃ©es ou traitÃ©es par des prestataires situÃ©s dans
                  diffÃ©rents pays selon lâ€™infrastructure retenue. Lorsque des transferts hors de lâ€™espace
                  rÃ©glementaire applicable sont nÃ©cessaires, CloneStore sâ€™appuie sur les mÃ©canismes
                  contractuels ou garanties prÃ©vues par la rÃ©glementation applicable.
                </p>

                <p>
                  La liste prÃ©cise des sous-traitants, zones dâ€™hÃ©bergement ou garanties applicables peut
                  Ãªtre communiquÃ©e ou prÃ©cisÃ©e dans les documents contractuels, les mentions lÃ©gales ou
                  la documentation de sÃ©curitÃ©.
                </p>
              </LegalSection>

              <LegalSection title="9. SÃ©curitÃ© et gouvernance">
                <p>
                  CloneStore applique une logique de sÃ©curitÃ© adaptÃ©e Ã  un usage professionnel, avec une
                  attention particuliÃ¨re portÃ©e aux accÃ¨s, Ã  la sÃ©paration des espaces, aux permissions
                  et Ã  la traÃ§abilitÃ© utile.
                </p>

                <BulletList
                  items={[
                    "Authentification et gestion des accÃ¨s utilisateurs.",
                    "SÃ©paration logique des comptes, entreprises, employÃ©s IA et donnÃ©es associÃ©es.",
                    "ContrÃ´le des permissions selon le rÃ´le, lâ€™accÃ¨s ou lâ€™abonnement.",
                    "Historique et journalisation des actions importantes lorsque cela est nÃ©cessaire.",
                    "MÃ©canismes de validation humaine pour certaines actions sensibles.",
                    "Surveillance technique, correction dâ€™erreurs, prÃ©vention des abus et maintien de la stabilitÃ©.",
                    "Limitation des accÃ¨s internes aux besoins strictement nÃ©cessaires.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="10. DurÃ©e de conservation">
                <p>
                  Les donnÃ©es sont conservÃ©es pendant une durÃ©e cohÃ©rente avec les finalitÃ©s du service,
                  la relation contractuelle, les obligations lÃ©gales applicables, les besoins de sÃ©curitÃ©,
                  de preuve, de support, de traÃ§abilitÃ© et de continuitÃ© opÃ©rationnelle.
                </p>

                <p>
                  Certaines donnÃ©es peuvent Ãªtre supprimÃ©es, archivÃ©es ou anonymisÃ©es lorsquâ€™elles ne sont
                  plus utiles au service, lorsque lâ€™utilisateur en fait la demande dans un cadre applicable,
                  ou lorsque la conservation nâ€™est plus justifiÃ©e.
                </p>
              </LegalSection>

              <LegalSection title="11. Cookies et technologies similaires">
                <p>
                  CloneStore peut utiliser des cookies ou technologies similaires pour assurer le
                  fonctionnement du site, sÃ©curiser la connexion, mÃ©moriser certaines prÃ©fÃ©rences,
                  mesurer lâ€™usage technique ou amÃ©liorer lâ€™expÃ©rience.
                </p>

                <BulletList
                  items={[
                    "Cookies nÃ©cessaires au fonctionnement, Ã  lâ€™authentification ou Ã  la sÃ©curitÃ©.",
                    "Cookies de prÃ©fÃ©rences pour conserver certains rÃ©glages dâ€™interface.",
                    "Mesures techniques dâ€™usage lorsque nÃ©cessaires pour amÃ©liorer le produit.",
                    "Cookies optionnels soumis au consentement lorsque la rÃ©glementation lâ€™exige.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="12. Vos droits">
                <p>
                  Selon le cadre applicable, vous pouvez exercer plusieurs droits sur vos donnÃ©es.
                </p>

                <BulletList
                  items={[
                    "demander lâ€™accÃ¨s Ã  certaines donnÃ©es vous concernant ;",
                    "demander la rectification ou la mise Ã  jour dâ€™informations inexactes ;",
                    "demander la suppression lorsque cela est juridiquement possible ;",
                    "demander la limitation de certains traitements ;",
                    "vous opposer Ã  certains traitements lorsque le cadre le permet ;",
                    "demander la portabilitÃ© de certaines donnÃ©es lorsque ce droit est applicable ;",
                    "introduire une rÃ©clamation auprÃ¨s de lâ€™autoritÃ© compÃ©tente si nÃ©cessaire.",
                  ]}
                />

                <p>
                  Les demandes peuvent Ãªtre adressÃ©es via les canaux de contact indiquÃ©s par CloneStore,
                  notamment depuis lâ€™espace client, le support ou les mentions lÃ©gales du service.
                </p>
              </LegalSection>

              <LegalSection title="13. Mise Ã  jour de cette politique">
                <p>
                  Cette politique peut Ã©voluer pour reflÃ©ter les changements du service, lâ€™ajout de
                  nouvelles fonctionnalitÃ©s, lâ€™Ã©volution de lâ€™infrastructure, des obligations lÃ©gales ou
                  des pratiques de sÃ©curitÃ©.
                </p>

                <BulletList
                  items={[
                    "Ã©volution des employÃ©s IA et de leurs capacitÃ©s ;",
                    "ajout de nouvelles pages, cockpits, historiques, validations ou automatisations ;",
                    "changement de prestataires, dâ€™hÃ©bergement ou dâ€™architecture technique ;",
                    "renforcement des rÃ¨gles de sÃ©curitÃ©, gouvernance, support ou conformitÃ©.",
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
                  <span>Encore une question sur la confidentialitÃ© ?</span>
                </span>
              </div>

              <h2 className="cs-heading mt-6 text-3xl md:text-5xl">
                Demande une rÃ©ponse claire
                <br />
                plutÃ´t que de rester dans le doute.
              </h2>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--cs-ink-4)] md:text-base">
                CloneStore doit rester lisible mÃªme sur les sujets sÃ©rieux :
                donnÃ©es, accÃ¨s, IA, sÃ©curitÃ©, suppression, historique, support ou gouvernance.
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