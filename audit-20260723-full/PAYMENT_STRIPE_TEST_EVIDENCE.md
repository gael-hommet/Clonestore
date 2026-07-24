# Payment Path Closure — Preuve Stripe test réelle

Preuve brute (redacted) : `CLONESTORE_AUDIT_EVIDENCE/payment-path-closure/stripe-real-test-proof.txt`. Toutes les valeurs ci-dessous proviennent d'appels réels au SDK Stripe officiel avec la clé `sk_test_` de cet environnement (refus programmatique du script si la clé n'était pas `sk_test_`) — aucune donnée fabriquée.

## Price EUR (existant, vérifié — pas recréé)

| Champ | Valeur |
|---|---|
| Price ID | `price_1TaFzx...` (redacted) |
| Montant | 44900 (449,00 €) |
| Devise | `eur` |
| Récurrence | mensuelle |
| `livemode` | `false` (mode test confirmé) |

## Price CHF (nouveau, créé dans ce bloc)

| Champ | Valeur |
|---|---|
| Price ID | `price_1TwVJo...` (redacted) |
| Produit | "Pierre — Employé IA RH (CHF, Suisse)" |
| Montant | 49900 (499,00 CHF) |
| Devise | `chf` |
| Récurrence | mensuelle |
| `livemode` | `false` (mode test confirmé) |
| Variable d'env | `STRIPE_PRICE_PIERRE_CHF_MONTHLY` (ajoutée à `.env.local` de cet environnement — **la configuration Vercel/production devra recevoir la même variable avant tout déploiement**, voir `PAYMENT_REMAINING_RISKS.md`) |

## Session Checkout test — France (EUR)

| Champ | Valeur |
|---|---|
| Session ID | `cs_test_a1rPN9...` (redacted) |
| `livemode` | `false` |
| `mode` | `subscription` |
| `currency` | `eur` |
| `metadata.selected_country` | `FR` |
| URL Checkout hébergée | présente (non ouverte dans un navigateur — voir limite ci-dessous) |
| Nettoyage | session expirée + customer test archivé après vérification |

## Session Checkout test — Suisse (CHF)

| Champ | Valeur |
|---|---|
| Session ID | `cs_test_a1SZzu...` (redacted) |
| `livemode` | `false` |
| `mode` | `subscription` |
| `currency` | `chf` |
| `metadata.selected_country` | `CH` |
| URL Checkout hébergée | présente |
| Nettoyage | session expirée + customer test archivé après vérification |

## Ce que cette preuve démontre — et ce qu'elle NE démontre PAS

**Démontré (réel, vérifié par l'API Stripe elle-même, pas par notre propre code)** : la résolution serveur du prix/devise par pays fonctionne réellement contre le vrai environnement Stripe test — le Price CHF existe désormais, le Price EUR est valide, les deux sont en mode test, une session Checkout se crée sans erreur pour chacun des deux prix avec les metadata attendues.

**Non démontré ici (bornes explicites de cette preuve)** :
- Le parcours de paiement DANS l'interface Checkout hébergée par Stripe (saisie d'une carte de test, soumission) n'a pas été exécuté — cela exigerait un navigateur pilotant réellement la page hébergée par Stripe. Playwright a été redevenu disponible en fin de bloc (voir `PAYMENT_REMAINING_RISKS.md`) mais son usage a été borné aux pages CloneStore, pas à la page Stripe elle-même.
- Le webhook `checkout.session.completed` réel correspondant à CES deux sessions précises n'a pas été reçu (les sessions ont été expirées avant complétion, par sécurité — aucune carte de test n'a été soumise). La preuve du couple **webhook → activation → idempotence** est apportée **séparément**, par les tests d'intégration avec Supabase mocké (`payment-path-country-reconciliation.test.ts`, voir `PAYMENT_TEST_MATRIX.md`) — une distinction assumée et documentée, pas un raccourci caché : la preuve Stripe directe couvre "le serveur résout le bon prix/la bonne devise/le bon pays" ; la preuve mockée couvre "le webhook active une fois, jamais deux, et bloque les incohérences pays" — les deux ensemble couvrent le chemin complet sans écrire dans la base Supabase partagée avec la production.
