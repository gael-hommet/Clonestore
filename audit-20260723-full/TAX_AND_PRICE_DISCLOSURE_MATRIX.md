# Tax and Price Disclosure Matrix

Full technical facts: evidence file `06-pricing-checkout-fiscal-raw.md`. No tax conclusion is drawn here — only what is currently displayed, what is missing, and what a professional must decide.

## Current display, per country

| Pays | Prix affiché | Devise | Mention actuelle | Collecte TVA client | Stripe Tax configuré |
|---|---|---|---|---|---|
| France | 449 €/mois | EUR | "Prix HT, hors taxes applicables" (CountryPricingCard) ; CGV: "hors taxes... TVA applicable... peut s'ajouter" | Non | Non |
| Belgique | 449 €/mois | EUR | Identique à FR | Non | Non |
| Luxembourg | 449 €/mois | EUR | Identique à FR | Non | Non |
| Suisse | 499 CHF/mois | CHF | Identique (même composant, même disclaimer HT) | Non | Non |

## Informations manquantes
- Aucun calcul, collecte ou affichage de TVA réel n'existe dans le parcours d'achat pour aucun des 4 pays.
- Aucune collecte de numéro de TVA client (`tax_id_collection` absent de la configuration Stripe).
- La Suisse a son propre régime de TVA (MWST), totalement distinct du régime TVA de l'UE — non traité séparément dans le code actuel.
- Aucun mécanisme d'autoliquidation (reverse charge) n'est implémenté ; le sujet est explicitement noté "à décider avec l'avocat/comptable" dans le code interne (`p11-stripe-country-reconciliation.ts:117`, `p11-legal-tax-readiness.ts:87`).

## Décision professionnelle nécessaire
Le traitement TVA correct dépend de facteurs qu'aucun audit de code ne peut trancher :
1. Statut fiscal réel du fournisseur (CloneStore est-il assujetti à la TVA ? sous le seuil de franchise ? immatriculé où ?).
2. Statut B2B/B2C réel du client (voir `LEGAL_APPLICABILITY_MATRIX.md` — actuellement non garanti B2B).
3. Pays d'établissement du client et validité de son numéro de TVA (non collecté aujourd'hui).
4. Seuils et obligations d'immatriculation dans chaque pays de vente.
5. Configuration Stripe Tax à activer ou non.

## Matrice des cas (pour orientation professionnelle, pas une conclusion)

| Cas | Règle générale probable (à confirmer) | Statut actuel du code |
|---|---|---|
| Client B2B FR/BE/LU avec n° TVA valide | Autoliquidation possible (Directive 2006/112/CE Art. 44/196 — voir sources officielles) | Non implémenté (pas de collecte de n° TVA) |
| Client B2C FR/BE/LU | TVA du pays du fournisseur ou du consommateur selon les règles de vente à distance/services électroniques — à confirmer | Non implémenté |
| Client CH | Régime TVA suisse distinct, seuil d'assujettissement propre pour un fournisseur étranger | Non implémenté, non distingué du régime UE dans le code |

## Recommandation d'affichage provisoire non trompeur
La mention actuelle ("Prix HT, hors taxes applicables. Le pays de facturation est revérifié au paiement.") est **factuellement honnête** dans son état actuel : elle ne prétend PAS que la TVA est calculée ou incluse, elle indique correctement que le prix est hors taxes et que des taxes peuvent s'ajouter. **Aucune correction technique n'est requise dans ce bloc** pour rester non-trompeur — le risque n'est pas un mensonge actuel, mais l'absence de mécanisme réel de collecte/calcul le jour où une vente doit légalement inclure la TVA. Ce point reste `PROFESSIONAL_REVIEW_REQUIRED` avant toute activation en mode live (`PRODUCTION_AUTHORIZED` reste `false`).

## Factures
Aucune facture générée par CloneStore lui-même (délégué entièrement au Billing Portal Stripe hébergé) — l'identité, le numéro, la date, le fournisseur, le client, la devise et la taxe applicable dépendront donc de la configuration Stripe elle-même (compte, Stripe Tax) une fois activée, pas du code de ce dépôt. Aucun Price ID Stripe n'est jamais affiché comme information commerciale (confirmé par test existant, voir `LEGAL_TEST_MATRIX.md`).
