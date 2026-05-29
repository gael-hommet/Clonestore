// P-FINAL 01 — Phase 8 — Copy scanner test fixtures.
// Pure: no Supabase, no Next, no async, no throw.

// Clean homepage copy — no violations
export const FIXTURE_CLEAN_HOMEPAGE = `
Pierre est votre employé IA RH opérationnel. Il vous aide à préparer des brouillons de documents,
à gérer les tâches RH et à organiser votre équipe. La validation humaine est obligatoire pour
tout document officiel. Pierre ne remplace pas un avocat ou un expert RH.
Abonnement Pierre à 449€ / mois. Démo illustrative disponible.
`;

// Homepage with forbidden claims
export const FIXTURE_FORBIDDEN_HOMEPAGE = `
Pierre garantit la conformité légale de tous vos documents RH.
Zéro erreur sur vos contrats. Essai gratuit de 7 jours disponible.
Pierre remplace un avocat et un expert-comptable pour toutes vos démarches.
Résultats garantis en 30 jours ou remboursé.
`;

// Pricing page with forbidden trial
export const FIXTURE_FORBIDDEN_PRICING = `
Pierre à 449€/mois. Essai gratuit illimité disponible.
Satisfait ou remboursé. Compliance garantie.
`;

// Legal CGU content — clean
export const FIXTURE_CLEAN_CGU = `
Pierre est un outil d'assistance. La validation humaine est obligatoire pour tout document officiel.
Pierre ne remplace pas un avocat, un juriste ou un expert RH.
Pierre ne garantit pas la conformité légale de ses outputs.
Pierre ne peut pas envoyer des emails de façon autonome.
`;

// Demo page — clean with illustrative mention
export const FIXTURE_CLEAN_DEMO = `
Démonstration illustrative de Pierre. Toutes les données présentées sont fictives.
Aucun appel IA réel n'est effectué. Pierre prépare des brouillons soumis à validation humaine.
La démo est sans engagement et peut être interrompue à tout moment.
`;

// Email template with forbidden autonomous sends
export const FIXTURE_FORBIDDEN_EMAIL = `
Pierre envoie des emails automatiquement à vos candidats et salariés.
Pierre prend des décisions autonomes pour votre paie.
`;
