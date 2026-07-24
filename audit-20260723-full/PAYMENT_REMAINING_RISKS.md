# Payment Path Closure — Risques restants

## RISQUE-1 — Configuration production/Vercel non mise à jour

`.env.local` (cet environnement local uniquement) contient désormais `STRIPE_PRICE_PIERRE_CHF_MONTHLY` et `STRIPE_PRICE_PIERRE_EUR_MONTHLY`. **La configuration Vercel/production réelle devra recevoir ces mêmes variables avant tout déploiement** — sans quoi la tarification par pays, révélée par défaut dans le code, tomberait sur `STRIPE_PRICE_NOT_CONFIGURED` pour la Suisse en production tant que la variable n'y est pas ajoutée. Action recommandée : ajouter les 2 variables au tableau de bord Vercel (mêmes valeurs redacted que dans ce rapport).

## RISQUE-2 — ~~Interaction visuelle du CTA non validée en navigateur~~ **FERMÉ** — clic réel confirmé

Playwright est redevenu disponible en fin de bloc. **Clic réel exécuté** sur le build de production isolé : sélection du radio "Suisse" → le CTA affiche "Choisir Pierre — 499 CHF / mois" → clic → navigation confirmée vers `http://localhost:3313/checkout?agent=pierre&country=CH`, 0 erreur console, page `/checkout` rendue correctement. Captures : `cta-suisse-checkout-CH.png`, `paiement-stable-production.png` (0 erreur console également). Reste non piloté : la page Checkout hébergée par Stripe elle-même (aucune carte de test saisie — choix de sécurité, voir RISQUE-3).

## RISQUE-3 — Paiement test non complété dans l'interface Checkout hébergée

Les deux sessions Stripe test réelles (FR/EUR, CH/CHF) ont été créées, vérifiées, puis **expirées volontairement sans soumettre de carte de test** — par choix de sécurité (éviter tout webhook réel touchant la base Supabase partagée avec la production). La preuve webhook → activation → idempotence repose donc sur des tests d'intégration avec Supabase **mocké**, pas sur un événement Stripe authentique de bout en bout. C'est un choix assumé et documenté (voir `PAYMENT_STRIPE_TEST_EVIDENCE.md`), pas un oubli — mais cela reste, techniquement, une limite de preuve à noter.

## RISQUE-4 — Attribution partenaire non re-testée spécifiquement dans ce bloc

Le code d'attribution partenaire (`bridgePartnerCommercial`, anti-double-crédit sur `invoice.paid` uniquement) n'a pas été modifié — il était déjà correct selon l'audit initial — et n'a pas reçu de nouveaux tests dans ce bloc, car aucun défaut n'y avait été identifié dans le périmètre (CTA/500/tarification pays). Si un futur bloc touche ce chemin, le re-vérifier reste recommandé par prudence.

## RISQUE-5 — Validation juridique/fiscale du paiement non couverte

Ce bloc est strictement technique (checkout/webhook/activation). La conformité fiscale (TVA par pays, `tax_behavior`, obligations de facturation FR/BE/LU/CH) n'a pas été auditée ici — elle relève du prochain bloc annoncé (**LEGAL AND COMMERCIAL TRUST CLOSURE**) ou d'un bloc fiscal dédié.

## RISQUE-6 — Stripe live volontairement désactivé (rappel, pas un défaut)

`PRODUCTION_AUTHORIZED = false` (const, inchangée) continue de bloquer tout mode live indépendamment de la configuration d'environnement — confirmé inchangé dans ce bloc. Ce n'est pas un risque à fermer, c'est un garde-fou intentionnel à préserver.

## Ce qui N'EST PLUS un risque (fermé dans ce bloc, pour éviter tout doute)

- CTA Suisse mort → **corrigé et confirmé par clic réel en navigateur** (voir RISQUE-2 ci-dessus).
- Tarification pays inerte par défaut → **révélée par défaut**, testée (26 tests API).
- Absence de Price CHF → **fermé**, prix Stripe test réel créé et vérifié.
- 500 sur `/paiement` → **requalifié** : artefact d'environnement `next dev` (boucle de recompilation continue accumulée sur la session), non reproductible en build de production (200 stable, 4/4, ~25-50ms) — ce n'est pas un défaut applicatif corrigé par une modification, c'est un diagnostic d'infrastructure prouvé par un test comparatif direct.
- Réconciliation pays au webhook inerte par défaut → **révélée par défaut**, testée (5 tests webhook).
- Deux chemins parallèles de création de session → **aucun trouvé** ; `/api/checkout/confirm` confirmé comme fallback légitime (retrieve uniquement, jamais create).
