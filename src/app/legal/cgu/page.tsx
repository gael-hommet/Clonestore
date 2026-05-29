// P-FINAL 01 — /legal/cgu — Conditions Générales d'Utilisation
// DRAFT — À faire valider par un conseil juridique avant usage contractuel.

import { FileText } from "lucide-react";
import {
  BulletList,
  LegalHero,
  LegalNavBar,
  LegalSection,
  LegalValidationBanner,
} from "../_shared/legal-components";

export default function CguPage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6">
          <LegalHero
            pill="Conditions Générales d'Utilisation"
            title={
              <>
                CGU CloneStore —
                <br />
                <span className="cs-gradient-text">Conditions d'utilisation du service.</span>
              </>
            }
            subtitle="Ces conditions définissent les règles d'utilisation de la plateforme CloneStore et de ses employés IA, notamment Pierre. En utilisant le service, l'utilisateur accepte les présentes conditions."
            icon={<FileText className="h-3.5 w-3.5 text-[var(--cs-violet)]" />}
            backHref="/"
            backLabel="Retour à l'accueil"
          />

          <LegalNavBar />
          <LegalValidationBanner version="Draft 1.0" />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <LegalSection title="1. Objet du service">
                <p>
                  CloneStore est une plateforme de type SaaS (Software as a Service) qui met à
                  disposition des entreprises des employés IA spécialisés, dont Pierre, un assistant
                  RH opérationnel.
                </p>
                <p>
                  Le service permet d'automatiser certaines tâches opérationnelles dans des domaines
                  tels que les ressources humaines, la gestion documentaire, la traçabilité et la
                  communication interne professionnelle.
                </p>
                <p>
                  CloneStore n'est pas un cabinet juridique, un logiciel de paie officiel, un
                  expert-comptable, ni un fournisseur de conseils réglementaires. Le service est un
                  outil d'automatisation opérationnelle. La validation humaine finale reste
                  obligatoire pour toute décision sensible, contractuelle, disciplinaire ou légale.
                </p>
              </LegalSection>

              <LegalSection title="2. Acceptation des conditions">
                <p>
                  L'utilisation du service vaut acceptation des présentes CGU. Si l'utilisateur ou
                  l'entreprise cliente n'accepte pas ces conditions, il ne doit pas utiliser le
                  service.
                </p>
                <p>
                  Pour les entreprises, la personne créant le compte engage l'entreprise et garantit
                  disposer des autorisations nécessaires pour le faire.
                </p>
              </LegalSection>

              <LegalSection title="3. Accès au service">
                <BulletList
                  items={[
                    "L'accès au service nécessite la création d'un compte avec une adresse email valide.",
                    "L'accès aux fonctionnalités complètes de Pierre nécessite un abonnement actif.",
                    "Une démonstration illustrative gratuite peut être proposée, sans données réelles et sans engagement.",
                    "CloneStore se réserve le droit de suspendre l'accès en cas de non-respect des présentes CGU, de comportement abusif ou de défaut de paiement.",
                    "L'utilisateur est responsable de la confidentialité de ses identifiants d'accès.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="4. Limites de l'IA et responsabilité humaine">
                <p>
                  Les employés IA de CloneStore, dont Pierre, sont des outils d'assistance. Ils ne
                  remplacent pas le jugement humain, la responsabilité professionnelle, le conseil
                  juridique ou l'expertise comptable ou RH.
                </p>
                <BulletList
                  items={[
                    "Pierre ne prend jamais de décision de licenciement, de sanction ou de mesure disciplinaire de manière autonome.",
                    "Pierre ne génère pas de bulletins de paie officiels, ne soumet pas de DSN et ne se substitue pas à un logiciel de paie certifié.",
                    "Les documents générés par Pierre sont des brouillons nécessitant validation humaine avant usage officiel.",
                    "Pierre ne garantit pas la conformité légale, l'absence d'erreur ou la parfaite applicabilité de ses outputs.",
                    "Pierre ne peut pas envoyer d'emails de façon autonome — toute communication est soumise à approbation humaine.",
                    "L'utilisateur est seul responsable des décisions prises sur la base des suggestions de Pierre.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="5. Données RH sensibles">
                <p>
                  Le service peut être utilisé dans des contextes impliquant des données
                  professionnelles sensibles (santé, situation disciplinaire, salaires, contrats,
                  absences, etc.).
                </p>
                <BulletList
                  items={[
                    "L'utilisateur s'engage à ne transmettre que les données strictement nécessaires à la tâche demandée.",
                    "Les données de salariés traitées via Pierre restent sous la responsabilité de l'employeur.",
                    "Le client accepte que le service ne peut garantir la conformité à des réglementations spécifiques sans validation juridique préalable.",
                    "Les cas sensibles (harcèlement, discrimination, santé) déclenchent automatiquement un mécanisme de validation humaine obligatoire.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="6. Usages interdits">
                <BulletList
                  items={[
                    "Utiliser le service pour automatiser des actions illégales, discriminatoires ou contraires à la réglementation du travail applicable.",
                    "Présenter des outputs de Pierre comme des avis juridiques, des documents officiels certifiés ou des décisions managériales sans validation humaine.",
                    "Accéder au service de manière non autorisée, contourner les mécanismes de sécurité ou tenter d'usurper l'identité d'un autre compte.",
                    "Revendre, sous-licencier ou exploiter commercialement le service sans accord préalable.",
                    "Utiliser le service pour envoyer des emails non sollicités (spam) ou dans des campagnes commerciales non encadrées.",
                    "Stocker dans le service des données sans base légale ou en violation de droits de tiers.",
                  ]}
                />
              </LegalSection>
            </div>

            <div className="space-y-6">
              <LegalSection title="7. Disponibilité du service">
                <p>
                  CloneStore s'efforce d'assurer la disponibilité du service, mais ne garantit pas
                  une disponibilité continue, sans interruption ni sans erreur.
                </p>
                <BulletList
                  items={[
                    "Des maintenances planifiées peuvent temporairement interrompre l'accès.",
                    "Des incidents techniques peuvent survenir de manière imprévue.",
                    "CloneStore ne saurait être tenu responsable des pertes ou préjudices résultant d'une indisponibilité du service.",
                    "L'utilisateur est invité à ne pas s'appuyer exclusivement sur le service pour des tâches critiques sans sauvegarde indépendante.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="8. Suspension et résiliation">
                <BulletList
                  items={[
                    "L'utilisateur peut résilier son abonnement depuis son espace client ou en contactant le support.",
                    "CloneStore peut suspendre ou résilier l'accès en cas de violation des CGU, de fraude, d'impayé ou de comportement contraire à l'ordre public.",
                    "En cas de résiliation, les données peuvent être supprimées après un délai prévu dans la politique de confidentialité.",
                    "Les conditions de remboursement sont précisées dans les CGV applicables.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="9. Support">
                <p>
                  Le support est accessible via les canaux indiqués dans l'espace client ou sur le
                  site de CloneStore. CloneStore s'engage à traiter les demandes dans un délai
                  raisonnable selon la nature de la demande et le niveau d'abonnement.
                </p>
              </LegalSection>

              <LegalSection title="10. Propriété intellectuelle">
                <p>
                  CloneStore, ses employés IA, son infrastructure, ses algorithmes, ses interfaces et
                  ses contenus sont la propriété de l'éditeur du service. L'utilisation du service ne
                  confère aucun droit de propriété sur ces éléments.
                </p>
                <p>
                  Les données et contenus fournis par l'utilisateur restent sa propriété. En les
                  soumettant au service, l'utilisateur accorde à CloneStore une licence d'utilisation
                  limitée et nécessaire au fonctionnement du service.
                </p>
              </LegalSection>

              <LegalSection title="11. Modifications des CGU">
                <p>
                  CloneStore se réserve le droit de modifier les présentes CGU. Les modifications
                  seront notifiées à l'utilisateur par email ou via l'interface du service avec un
                  préavis raisonnable. La poursuite de l'utilisation du service après notification
                  vaut acceptation des nouvelles conditions.
                </p>
              </LegalSection>

              <LegalSection title="12. Droit applicable et juridiction">
                <p>
                  <strong>Placeholder à valider juridiquement.</strong> Les présentes CGU sont
                  soumises au droit applicable dans la juridiction de l'éditeur du service, tel
                  qu'identifié dans les mentions légales. Tout litige sera soumis aux juridictions
                  compétentes selon les règles applicables.
                </p>
                <p>
                  Ce point doit être validé par un conseil juridique en tenant compte de la
                  localisation de l'éditeur, des clients cibles et des obligations réglementaires
                  applicables.
                </p>
              </LegalSection>

              <LegalSection title="13. Contact">
                <p>
                  Pour toute question relative aux présentes CGU, l'utilisateur peut contacter
                  CloneStore via les canaux indiqués dans les mentions légales ou depuis l'espace
                  client.
                </p>
              </LegalSection>
            </div>
          </div>

          <LegalValidationBanner version="Draft 1.0" />
        </div>
      </div>
    </div>
  );
}
