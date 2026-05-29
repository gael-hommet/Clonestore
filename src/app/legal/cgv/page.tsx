// P-FINAL 01 — /legal/cgv — Conditions Générales de Vente
// DRAFT — À faire valider par un conseil juridique avant usage contractuel.

import { ShoppingCart } from "lucide-react";
import {
  BulletList,
  LegalHero,
  LegalNavBar,
  LegalSection,
  LegalValidationBanner,
} from "../_shared/legal-components";

export default function CgvPage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6">
          <LegalHero
            pill="Conditions Générales de Vente"
            title={
              <>
                CGV CloneStore —
                <br />
                <span className="cs-gradient-text">Conditions commerciales et tarifaires.</span>
              </>
            }
            subtitle="Ces conditions régissent les modalités d'abonnement, de paiement, de renouvellement et de résiliation du service CloneStore, notamment l'offre Pierre à 449 € / mois."
            icon={<ShoppingCart className="h-3.5 w-3.5 text-[var(--cs-violet)]" />}
            backHref="/"
            backLabel="Retour à l'accueil"
          />

          <LegalNavBar />
          <LegalValidationBanner version="Draft 1.0" />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <LegalSection title="1. Objet">
                <p>
                  Les présentes Conditions Générales de Vente (CGV) s'appliquent à toute souscription
                  à l'offre commerciale CloneStore, et notamment à l'abonnement Pierre.
                </p>
                <p>
                  En procédant au paiement, le client accepte les présentes CGV dans leur intégralité.
                  Les CGV prévalent sur tout autre document commercial non expressément accepté par
                  CloneStore.
                </p>
              </LegalSection>

              <LegalSection title="2. Offre et tarifs">
                <p>
                  L'offre principale est l'abonnement <strong>Pierre</strong>, employé IA RH
                  opérationnel de CloneStore.
                </p>
                <BulletList
                  items={[
                    "Tarif standard : 449 € / mois (hors taxes applicables).",
                    "Abonnement mensuel, renouvelé automatiquement chaque mois.",
                    "Paiement sécurisé via Stripe.",
                    "Le prix affiché au moment du checkout est celui applicable à la souscription.",
                  ]}
                />
                <p>
                  <strong>Tarification fondateur (si activée) :</strong> Un tarif préférentiel
                  peut être proposé aux premiers clients (early adopters) dans le cadre d'une offre
                  fondateur à durée et conditions limitées. Ce tarif est garanti pour la durée
                  mentionnée explicitement lors de la souscription.
                </p>
              </LegalSection>

              <LegalSection title="3. Démonstration gratuite">
                <p>
                  CloneStore peut proposer une démonstration illustrative gratuite du service.
                  Cette démonstration est strictement illustrative, sans données réelles, sans
                  engagement commercial, sans accès complet aux fonctionnalités et sans essai
                  gratuit de 7 jours en production.
                </p>
                <BulletList
                  items={[
                    "La démo ne constitue pas un accès à la version production du service.",
                    "Aucune donnée client réelle n'est utilisée ou conservée en mode démo.",
                    "La démo peut être interrompue à tout moment par CloneStore.",
                    "La démo ne crée aucune obligation contractuelle pour l'une ou l'autre des parties.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="4. Facturation et paiement">
                <BulletList
                  items={[
                    "La facturation est mensuelle, prélevée le jour de la souscription ou de renouvellement.",
                    "Le paiement s'effectue par carte bancaire via la plateforme sécurisée Stripe.",
                    "En cas d'échec du paiement, CloneStore peut suspendre l'accès jusqu'à régularisation.",
                    "Les factures sont accessibles depuis l'espace client.",
                    "Les prix sont exprimés hors taxes. La TVA applicable selon la réglementation en vigueur peut s'ajouter au prix HT.",
                  ]}
                />
                <p>
                  <strong>TVA et taxes — Placeholder à valider :</strong> Les obligations fiscales
                  (TVA, taxes locales, etc.) dépendent de la localisation de l'acheteur et de
                  l'éditeur. Ce point doit être précisé par un conseil juridique ou fiscal.
                </p>
              </LegalSection>

              <LegalSection title="5. Renouvellement et résiliation">
                <BulletList
                  items={[
                    "L'abonnement se renouvelle automatiquement chaque mois jusqu'à résiliation.",
                    "La résiliation peut être effectuée depuis l'espace client ou en contactant le support avant la date de renouvellement.",
                    "La résiliation prend effet à la fin de la période en cours — aucun remboursement prorata n'est prévu par défaut.",
                    "CloneStore peut résilier l'abonnement en cas de violation des CGU ou des CGV.",
                    "En cas de résiliation, l'accès au service est maintenu jusqu'à la fin de la période payée.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="6. Politique de remboursement">
                <p>
                  <strong>Placeholder à valider juridiquement.</strong> En principe, les abonnements
                  mensuels ne font pas l'objet de remboursement une fois la période commencée.
                  Des exceptions peuvent être accordées à la discrétion de CloneStore en cas de
                  problème technique majeur imputable au service.
                </p>
                <p>
                  Le droit de rétractation applicable aux contrats conclus à distance peut s'appliquer
                  selon la réglementation en vigueur (notamment pour les consommateurs, sous réserve
                  de vérification). Ce point doit être validé par un conseil juridique.
                </p>
              </LegalSection>
            </div>

            <div className="space-y-6">
              <LegalSection title="7. Périmètre du service inclus">
                <p>
                  L'abonnement Pierre à 449 € / mois comprend l'accès aux fonctionnalités décrites
                  dans la documentation produit au moment de la souscription, notamment :
                </p>
                <BulletList
                  items={[
                    "Accès à Pierre, l'employé IA RH opérationnel.",
                    "Missions RH, tâches, documents, emails (brouillons soumis à validation).",
                    "Cockpit, traçabilité, audit trail.",
                    "Gestion des employés, absences, pré-paie préparatoire.",
                    "Accès aux technologies CloneStore activées (selon configuration).",
                    "Support standard selon les conditions en vigueur.",
                  ]}
                />
                <p>
                  CloneStore se réserve le droit de faire évoluer les fonctionnalités incluses dans
                  l'abonnement, avec notification préalable raisonnable en cas de changement
                  significatif.
                </p>
              </LegalSection>

              <LegalSection title="8. Ce que le service ne comprend pas">
                <BulletList
                  items={[
                    "Conseil juridique, avis d'avocat ou expertise réglementaire.",
                    "Logiciel de paie officiel ou génération de bulletins de paie certifiés.",
                    "Soumission de DSN ou déclarations officielles.",
                    "Garantie de conformité légale des documents générés.",
                    "Remplacement d'un professionnel RH, d'un juriste ou d'un expert-comptable.",
                    "Essai gratuit production illimité.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="9. Modifications tarifaires">
                <p>
                  CloneStore se réserve le droit de modifier ses tarifs. Toute modification sera
                  notifiée avec un préavis d'au moins 30 jours. Le client peut résilier son
                  abonnement avant l'entrée en vigueur de la nouvelle tarification.
                </p>
                <p>
                  Les tarifs fondateur acceptés sont maintenus pour la durée contractuellement
                  garantie, sans modification unilatérale.
                </p>
              </LegalSection>

              <LegalSection title="10. Limitation de responsabilité">
                <p>
                  <strong>Placeholder à valider juridiquement.</strong> La responsabilité de
                  CloneStore est limitée aux dommages directs et prévisibles résultant d'une
                  défaillance avérée du service. Elle ne saurait excéder le montant des sommes
                  versées par le client au cours des 3 derniers mois d'abonnement.
                </p>
                <p>
                  CloneStore ne saurait être tenu responsable des dommages indirects, pertes de
                  données, pertes d'exploitation, préjudices liés à des décisions prises sur la
                  base des outputs de Pierre, ni des conséquences d'une utilisation non conforme
                  aux présentes CGV ou aux CGU.
                </p>
              </LegalSection>

              <LegalSection title="11. Force majeure">
                <p>
                  CloneStore ne saurait être tenu responsable en cas d'inexécution due à un
                  événement de force majeure au sens de la réglementation applicable (catastrophe
                  naturelle, coupure d'infrastructure, panne de prestataire tiers, etc.).
                </p>
              </LegalSection>

              <LegalSection title="12. Droit applicable">
                <p>
                  <strong>Placeholder à valider juridiquement.</strong> Les présentes CGV sont
                  régies par le droit applicable dans la juridiction de l'éditeur du service.
                  Tout litige relatif aux présentes sera soumis aux juridictions compétentes après
                  tentative de résolution amiable.
                </p>
              </LegalSection>

              <LegalSection title="13. Contact commercial">
                <p>
                  Pour toute question relative à la facturation, à l'abonnement ou aux conditions
                  commerciales, le client peut contacter CloneStore via l'espace client ou les
                  coordonnées figurant dans les mentions légales.
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
