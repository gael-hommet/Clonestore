// P-FINAL 01 — /legal/mentions — Mentions Légales
// DRAFT — À faire valider par un conseil juridique avant usage contractuel.

import { Info } from "lucide-react";
import {
  LegalHero,
  LegalNavBar,
  LegalSection,
  LegalValidationBanner,
} from "../_shared/legal-components";

export default function MentionsPage() {
  return (
    <div className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-6">
          <LegalHero
            pill="Mentions Légales"
            title={
              <>
                Mentions Légales —
                <br />
                <span className="cs-gradient-text">Informations légales et éditeur.</span>
              </>
            }
            subtitle="Informations légales obligatoires relatives à l'éditeur du service CloneStore, à l'hébergement, à la propriété intellectuelle et aux contacts officiels."
            icon={<Info className="h-3.5 w-3.5 text-[var(--cs-violet)]" />}
            backHref="/"
            backLabel="Retour à l'accueil"
          />

          <LegalNavBar />
          <LegalValidationBanner version="Draft 1.0" />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <LegalSection title="1. Éditeur du service">
                <p>
                  <strong>Placeholder — à compléter avant lancement officiel.</strong>
                </p>
                <p>
                  Le service CloneStore est édité par :
                </p>
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-800 border border-amber-200">
                  <strong>À renseigner :</strong> Dénomination sociale, forme juridique (SAS, SASU, auto-entrepreneur…),
                  capital social, adresse du siège social, numéro d'immatriculation (RCS, SIREN, SIRET),
                  numéro de TVA intracommunautaire (si applicable), coordonnées officielles.
                </p>
              </LegalSection>

              <LegalSection title="2. Directeur de la publication">
                <p>
                  <strong>Placeholder — à renseigner.</strong>
                </p>
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-800 border border-amber-200">
                  <strong>À renseigner :</strong> Nom et prénom du directeur de publication (généralement
                  le représentant légal de la société éditrice), ou adresse email de contact officielle.
                </p>
              </LegalSection>

              <LegalSection title="3. Hébergement">
                <p>
                  <strong>Placeholder — à compléter.</strong> Le service CloneStore est hébergé
                  par les prestataires suivants :
                </p>
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-800 border border-amber-200">
                  <strong>À préciser :</strong> Nom de l'hébergeur (ex. Vercel Inc.), adresse,
                  coordonnées officielles de l'hébergeur. Pour la base de données : Supabase Inc.
                  Pour les paiements : Stripe Inc.
                </p>
              </LegalSection>

              <LegalSection title="4. Contact">
                <p>
                  Pour toute question relative au service CloneStore, aux présentes mentions
                  légales, à la facturation ou au support, le Client peut contacter CloneStore :
                </p>
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-800 border border-amber-200">
                  <strong>À renseigner :</strong> Adresse email de contact officielle, adresse
                  postale, éventuellement numéro de téléphone. Ces informations sont obligatoires
                  dans les mentions légales selon la réglementation française.
                </p>
              </LegalSection>

              <LegalSection title="5. Propriété intellectuelle">
                <p>
                  L'ensemble des éléments constituant le service CloneStore — interface, contenus,
                  marques, logos, algorithmes, employés IA dont Pierre — sont protégés par le droit
                  de la propriété intellectuelle et sont la propriété exclusive de l'éditeur du
                  service ou de ses partenaires.
                </p>
                <p>
                  Toute reproduction, représentation, modification, publication, adaptation de tout
                  ou partie des éléments du service, par quelque moyen que ce soit, est interdite
                  sans autorisation écrite préalable de l'éditeur.
                </p>
                <p>
                  Les contenus et données fournis par les utilisateurs restent leur propriété.
                  En les transmettant au service, l'utilisateur concède à CloneStore une licence
                  d'utilisation limitée nécessaire au fonctionnement du service, conformément aux
                  CGU.
                </p>
              </LegalSection>
            </div>

            <div className="space-y-6">
              <LegalSection title="6. Protection des données personnelles">
                <p>
                  Le traitement des données personnelles réalisé via le service CloneStore est
                  encadré par :
                </p>
                <p>
                  La <strong>Politique de Confidentialité</strong> décrit les catégories de données
                  collectées, les finalités du traitement, les droits des personnes concernées et
                  les modalités d'exercice de ces droits.
                </p>
                <p>
                  L'<strong>Accord de Traitement des Données (DPA)</strong> régit les conditions
                  dans lesquelles CloneStore traite les données personnelles en qualité de
                  sous-traitant pour le compte de ses clients professionnels.
                </p>
                <p>
                  Pour exercer vos droits (accès, rectification, suppression, portabilité,
                  opposition), contactez CloneStore via les coordonnées mentionnées dans la
                  politique de confidentialité ou l'espace client.
                </p>
              </LegalSection>

              <LegalSection title="7. Cookies et traceurs">
                <p>
                  <strong>Placeholder — à compléter.</strong> Le service CloneStore peut utiliser
                  des cookies et traceurs techniques nécessaires au fonctionnement du service
                  (authentification, sécurité).
                </p>
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-800 border border-amber-200">
                  <strong>À préciser :</strong> Types de cookies utilisés, finalités, durée de
                  conservation, modalités d'acceptation/refus. Une politique cookies distincte
                  ou une bannière de consentement peut être requise selon la réglementation
                  applicable (CNIL, ePrivacy). À valider par un conseil juridique.
                </p>
              </LegalSection>

              <LegalSection title="8. Droit applicable et médiation">
                <p>
                  <strong>Placeholder à valider juridiquement.</strong> Les présentes mentions
                  légales sont soumises au droit français.
                </p>
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-800 border border-amber-200">
                  <strong>À préciser :</strong> En application du Code de la consommation,
                  pour les clients consommateurs, mentionner la procédure de médiation à la
                  consommation applicable. Pour les clients professionnels, préciser la juridiction
                  compétente. Ces éléments doivent être validés par un conseil juridique.
                </p>
              </LegalSection>

              <LegalSection title="9. Limitation de responsabilité">
                <p>
                  CloneStore met en œuvre tous les moyens raisonnables pour assurer l'accès et
                  la qualité du service. Cependant, la responsabilité de CloneStore ne peut être
                  engagée en cas d'interruption, d'inaccessibilité ou de force majeure.
                </p>
                <p>
                  Les informations présentes sur le site sont fournies à titre indicatif et peuvent
                  être modifiées à tout moment. CloneStore ne saurait être tenu responsable de
                  l'utilisation faite de ces informations.
                </p>
                <p>
                  Le service Pierre et ses outputs (documents, brouillons, suggestions RH) ne
                  constituent pas des avis juridiques, comptables ou réglementaires. La validation
                  humaine est obligatoire avant tout usage officiel. Pierre n'est pas un avocat,
                  un expert-comptable, ni un logiciel de paie certifié.
                </p>
              </LegalSection>

              <LegalSection title="10. Signalement de contenus illicites">
                <p>
                  <strong>Placeholder — à compléter si applicable.</strong> En application
                  de la réglementation applicable (notamment DSA — Digital Services Act — pour
                  les plateformes opérant dans l'UE), les modalités de signalement de contenus
                  illicites doivent être précisées si applicable au service CloneStore. À valider
                  par un conseil juridique.
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
