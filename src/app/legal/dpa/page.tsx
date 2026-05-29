// P-FINAL 01 — /legal/dpa — Data Processing Agreement
// DRAFT — À faire valider par un conseil juridique avant usage contractuel.

import { Shield } from "lucide-react";
import {
  BulletList,
  LegalHero,
  LegalNavBar,
  LegalSection,
  LegalValidationBanner,
} from "../_shared/legal-components";

export default function DpaPage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6">
          <LegalHero
            pill="Data Processing Agreement"
            title={
              <>
                DPA CloneStore —
                <br />
                <span className="cs-gradient-text">Accord de traitement des données.</span>
              </>
            }
            subtitle="Cet accord régit les conditions dans lesquelles CloneStore traite les données personnelles pour le compte de ses clients, conformément au RGPD et aux réglementations applicables en matière de protection des données."
            icon={<Shield className="h-3.5 w-3.5 text-[var(--cs-violet)]" />}
            backHref="/"
            backLabel="Retour à l'accueil"
          />

          <LegalNavBar />
          <LegalValidationBanner version="Draft 1.0" />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <LegalSection title="1. Parties et qualification">
                <p>
                  Le présent Accord de Traitement des Données (DPA) est conclu entre :
                </p>
                <BulletList
                  items={[
                    "Le Client : personne morale ou physique souscrivant au service CloneStore, agissant en qualité de Responsable du Traitement (RT).",
                    "CloneStore : prestataire du service Pierre, agissant en qualité de Sous-traitant (ST) au sens du RGPD.",
                  ]}
                />
                <p>
                  Le présent DPA fait partie intégrante des Conditions Générales d'Utilisation (CGU)
                  et des Conditions Générales de Vente (CGV) de CloneStore. En souscrivant au service,
                  le Client accepte les termes du présent DPA.
                </p>
              </LegalSection>

              <LegalSection title="2. Objet et nature du traitement">
                <p>
                  CloneStore traite des données personnelles pour le compte du Client dans le cadre
                  de la fourniture du service Pierre, employé IA RH opérationnel.
                </p>
                <p>
                  <strong>Nature des traitements :</strong>
                </p>
                <BulletList
                  items={[
                    "Collecte, stockage et organisation de données RH transmises par le Client.",
                    "Traitement automatisé aux fins d'assistance RH et de génération de documents brouillons.",
                    "Journalisation des actions (audit trail) pour traçabilité.",
                    "Traitement via des modèles d'intelligence artificielle tiers (voir sous-traitants).",
                  ]}
                />
                <p>
                  <strong>Finalités :</strong> Fournir les fonctionnalités du service Pierre
                  décrites dans la documentation produit — assistance RH, gestion des tâches,
                  rédaction de documents brouillons, gestion des absences, pré-paie préparatoire.
                </p>
              </LegalSection>

              <LegalSection title="3. Catégories de données traitées">
                <p>
                  Selon l'utilisation du service par le Client, les catégories suivantes peuvent
                  être traitées :
                </p>
                <BulletList
                  items={[
                    "Données d'identification : nom, prénom, email professionnel, identifiant interne.",
                    "Données contractuelles : type de contrat, dates d'embauche et de fin, poste.",
                    "Données de rémunération : salaire, éléments de rémunération transmis pour la pré-paie.",
                    "Données d'absence : congés, arrêts maladie, motifs d'absence.",
                    "Données disciplinaires : uniquement si transmises explicitement par le Client.",
                    "Données de communication : projets d'emails professionnels soumis à validation.",
                    "Données de connexion : logs d'accès, actions utilisateur pour l'audit trail.",
                  ]}
                />
                <p>
                  <strong>Données sensibles :</strong> Le service peut traiter des données de
                  catégorie particulière (santé, discipline) uniquement si le Client les transmet
                  explicitement. Le Client est seul responsable de la légitimité de ce traitement
                  et doit s'assurer de disposer d'une base légale appropriée.
                </p>
              </LegalSection>

              <LegalSection title="4. Personnes concernées">
                <BulletList
                  items={[
                    "Salariés et collaborateurs du Client.",
                    "Candidats à l'embauche (si le Client utilise Pierre pour le recrutement).",
                    "Utilisateurs de la plateforme CloneStore côté Client (administrateurs, RH).",
                  ]}
                />
              </LegalSection>

              <LegalSection title="5. Durée du traitement">
                <p>
                  CloneStore traite les données personnelles pour la durée de la relation
                  contractuelle avec le Client. À la résiliation de l'abonnement :
                </p>
                <BulletList
                  items={[
                    "Les données actives restent accessibles pendant la période de grâce définie dans la politique de rétention.",
                    "À l'issue de cette période, les données sont supprimées ou anonymisées.",
                    "Le Client peut demander l'export ou la suppression anticipée de ses données via les fonctionnalités RGPD du service ou en contactant le support.",
                    "Les logs d'audit sont conservés selon les obligations légales applicables.",
                  ]}
                />
              </LegalSection>

              <LegalSection title="6. Obligations de CloneStore (Sous-traitant)">
                <p>CloneStore s'engage à :</p>
                <BulletList
                  items={[
                    "Traiter les données uniquement sur instruction documentée du Responsable du Traitement.",
                    "Garantir que les personnes autorisées à traiter les données sont soumises à une obligation de confidentialité.",
                    "Prendre toutes les mesures de sécurité techniques et organisationnelles appropriées (chiffrement, contrôle d'accès, journalisation).",
                    "Respecter les conditions d'autorisation préalable du RT pour tout recours à un sous-traitant ultérieur.",
                    "Assister le RT dans l'exercice des droits des personnes concernées dans la mesure du possible.",
                    "Assister le RT pour ses obligations RGPD (sécurité, notification de violation, AIPD).",
                    "Mettre à disposition toutes les informations nécessaires pour démontrer le respect des obligations RGPD.",
                    "Supprimer ou restituer les données à l'issue de la prestation selon le choix du RT.",
                  ]}
                />
              </LegalSection>
            </div>

            <div className="space-y-6">
              <LegalSection title="7. Sous-traitants ultérieurs">
                <p>
                  <strong>Placeholder — à compléter et valider juridiquement.</strong> CloneStore
                  recourt aux sous-traitants ultérieurs suivants dans le cadre de la fourniture
                  du service. Le Client autorise leur recours par la présente, sous réserve des
                  engagements contractuels équivalents :
                </p>
                <BulletList
                  items={[
                    "Supabase Inc. — hébergement de la base de données et authentification (USA, avec clauses contractuelles types applicables).",
                    "Stripe Inc. — traitement des paiements (USA, avec clauses contractuelles types applicables).",
                    "Anthropic PBC — traitement IA via API Claude pour les fonctionnalités Pierre (USA).",
                    "Resend Inc. — envoi transactionnel d'emails (USA).",
                    "Vercel Inc. — hébergement de l'application (USA).",
                  ]}
                />
                <p>
                  CloneStore informe le Client de tout changement de sous-traitant avec un préavis
                  raisonnable. Le Client dispose d'un droit d'opposition motivé.
                </p>
              </LegalSection>

              <LegalSection title="8. Transferts internationaux">
                <p>
                  <strong>Placeholder à valider juridiquement.</strong> Les sous-traitants
                  listés ci-dessus peuvent traiter des données hors Union Européenne, notamment
                  aux États-Unis. Ces transferts sont encadrés par les mécanismes appropriés
                  (clauses contractuelles types, certifications, décisions d'adéquation selon
                  le droit en vigueur). Ce point doit être précisé et validé par un conseil
                  juridique spécialisé en protection des données.
                </p>
              </LegalSection>

              <LegalSection title="9. Mesures de sécurité">
                <p>CloneStore met en œuvre les mesures de sécurité suivantes :</p>
                <BulletList
                  items={[
                    "Chiffrement des données en transit (TLS/HTTPS) et au repos.",
                    "Contrôle d'accès basé sur les rôles (Row Level Security via Supabase).",
                    "Journalisation des actions sensibles (audit trail Pierre).",
                    "Isolation des données par client (company_id).",
                    "Authentification sécurisée via Supabase Auth.",
                    "Revue de sécurité périodique des configurations.",
                  ]}
                />
                <p>
                  <strong>Placeholder :</strong> La liste exhaustive des mesures techniques et
                  organisationnelles doit être annexée au présent DPA et validée avant usage
                  contractuel officiel.
                </p>
              </LegalSection>

              <LegalSection title="10. Notification des violations de données">
                <p>
                  En cas de violation de données personnelles, CloneStore s'engage à :
                </p>
                <BulletList
                  items={[
                    "Notifier le Client dans les meilleurs délais après avoir pris connaissance de la violation.",
                    "Fournir les informations disponibles sur la nature, les catégories et le volume de données affectées.",
                    "Décrire les mesures prises ou envisagées pour remédier à la violation.",
                    "Assister le Client dans ses propres obligations de notification (CNIL, personnes concernées).",
                  ]}
                />
              </LegalSection>

              <LegalSection title="11. Droits des personnes concernées">
                <p>
                  Le Client est responsable de traiter les demandes d'exercice de droits (accès,
                  rectification, suppression, portabilité, opposition) émanant de ses salariés
                  ou collaborateurs.
                </p>
                <p>
                  CloneStore met à disposition les outils permettant au Client d'honorer ces
                  demandes (export RGPD, purge de données) via les fonctionnalités dédiées
                  du service ou sur demande au support.
                </p>
              </LegalSection>

              <LegalSection title="12. Audit et conformité">
                <p>
                  CloneStore met à disposition du Client les informations nécessaires pour
                  démontrer le respect du présent DPA et du RGPD, et contribue aux audits
                  réalisés par le Client ou un auditeur mandaté, dans des conditions raisonnables
                  à définir d'un commun accord.
                </p>
              </LegalSection>

              <LegalSection title="13. Contact DPO / Responsable données">
                <p>
                  <strong>Placeholder à compléter.</strong> Pour toute question relative au
                  traitement des données personnelles ou à l'exercice des droits dans le cadre
                  du présent DPA, le Client peut contacter CloneStore via les coordonnées
                  figurant dans les mentions légales ou l'espace client.
                </p>
                <p>
                  L'identité et les coordonnées du délégué à la protection des données (DPO)
                  ou responsable données de CloneStore seront précisées avant lancement officiel.
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
