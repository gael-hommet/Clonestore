// GO-LIVE 03 — Legal Pages Final Fixtures
// Test content for legal page scanning. Pure: no Supabase, no Next, no async.

export const FIXTURE_CGU_COMPLETE = `
CloneStore est une plateforme SaaS. Pierre ne remplace pas un avocat ou un expert-comptable.
La validation humaine est obligatoire pour tout document officiel.
Pierre traite des données RH à la demande du client (sous-traitant RGPD).
La responsabilité de CloneStore est limitée conformément aux présentes CGU.
Pierre ne génère pas de bulletins de paie officiels. Pierre ne garantit pas la conformité légale.
Droit applicable: droit français. Juridiction: Tribunal compétent.
Version 1.0 — Validée juridiquement le 2026-01-01.
`;

export const FIXTURE_CGU_WITH_PLACEHOLDER = `
Pierre ne remplace pas un avocat.
La validation humaine est obligatoire.
Placeholder à valider juridiquement. Droit applicable dans la juridiction de l'éditeur du service.
Draft 1.0 — À faire valider par un conseil juridique.
`;

export const FIXTURE_CGV_COMPLETE = `
Tarif Pierre : 449 € / mois. Abonnement mensuel récurrent.
Démo illustrative gratuite — sans données réelles, sans engagement.
Pas d'essai gratuit de production illimité.
Résiliation à tout moment depuis l'espace client.
`;

export const FIXTURE_DPA_COMPLETE = `
Accord de Traitement des Données conforme au RGPD.
Sous-traitance : données RH traitées pour le compte du client.
Droits RGPD : accès, rectification, suppression, portabilité.
Données des salariés : suppression sur demande. Export disponible.
Sous-traitants : Supabase (base de données), Stripe (paiements), OpenAI (IA), Vercel (hébergement).
`;

export const FIXTURE_CONFIDENTIALITE_COMPLETE = `
Politique de Confidentialité. Collecte de données : email, données RH, données de paiement.
Hébergement : Vercel. Base de données : Supabase. Paiements : Stripe. IA : OpenAI.
Sécurité : chiffrement, accès restreint, audit trail.
Export et purge des données sur demande.
Droits RGPD : accès, rectification, suppression, portabilité.
`;

export const FIXTURE_MENTIONS_COMPLETE = `
Éditeur : CloneStore SAS au capital de 10 000 €.
SIREN : 123 456 789 — RCS Paris.
Adresse : 12 rue de la Paix, 75001 Paris.
Directeur de publication : Gaël Hommet.
Contact : contact@clonestore.fr.
Hébergement : Vercel Inc., 340 Pine Street, San Francisco, CA 94104.
TVA : FR12 123456789.
Propriété intellectuelle : CloneStore SAS — tous droits réservés.
`;

export const FIXTURE_MENTIONS_WITH_PLACEHOLDERS = `
Éditeur : [À renseigner] — forme juridique [SAS, SASU, auto-entrepreneur].
Directeur de publication : [Placeholder — à renseigner].
Hébergeur : [À préciser] — Vercel Inc. adresse officielle.
Contact : [À renseigner] — adresse email officielle.
`;
