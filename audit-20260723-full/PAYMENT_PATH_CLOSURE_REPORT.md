# Payment Path Closure — Rapport de fermeture

**Date** : 2026-07-24. **Périmètre** : parcours pays → prix → CTA → checkout → Stripe → webhook → commande → attribution partenaire → activation, pour Pierre (FR/BE/LU/CH). Strictement backend + les deux fichiers frontend directement responsables des défauts identifiés (`CountryPricingCard.tsx`, `checkout/page.tsx`) — homepage, démo, pages légales et gouvernance Pierre (P0.1/P0.2) non touchées. Stripe reste intégralement en mode test ; `PRODUCTION_AUTHORIZED` reste `false`.

## Résumé exécutif

Quatre défauts avaient été identifiés par l'audit initial et les blocs précédents : (1) le CTA d'achat de la carte tarif-pays n'avait aucun gestionnaire de clic ; (2) une erreur 500 avait été observée sur `/paiement` ; (3) le moteur de tarification par pays existait mais n'était jamais réellement invoqué par le chemin de checkout actif ; (4) aucun prix Stripe CHF n'était configuré. Après cartographie complète du code existant (déjà remarquablement bien construit — hard floor de production, idempotence Stripe, ledger anti-replay, garde de réconciliation pays, tout déjà présent mais **éteint par défaut**), la correction s'est révélée être majoritairement une question de **révélation** de fonctionnalités déjà correctes plutôt que de réécriture : deux flags ont été rendus actifs par défaut (avec arrêt d'urgence explicite conservé), le CTA a été câblé, le pays a été propagé du composant de sélection jusqu'à l'API, et un prix Stripe CHF réel a été créé en mode test. Le 500 de `/paiement` s'est révélé être un artefact de l'environnement `next dev` (boucle de recompilation continue accumulée sur une session de plus de 12 heures), non reproductible sur un build de production stable (200 constant, ~25-50 ms).

## Problèmes initiaux (état avant, avec preuve)

1. **CTA Suisse mort** — `src/components/pricing/CountryPricingCard.tsx:119-127` (avant correctif) : bouton `data-testid="pricing-cta"` sans aucune prop `onClick`. Confirmé par lecture directe à deux reprises (audit initial + ce bloc).
2. **500 sur `/paiement`** — reproduit une fois lors de l'audit initial (`SyntaxError: Unexpected end of JSON input`). Le fichier `src/app/paiement/page.tsx` ne contient **aucune** logique `fetch`/`JSON.parse` (vérifié par lecture complète du fichier, page 100% statique) — la cause ne pouvait donc pas être applicative.
3. **Tarification pays inerte** — `src/lib/clonestore/pricing/pricing-flags.ts` (`isCountryPricingEnabled`) lisait `STRIPE_COUNTRY_PRICING_ENABLED`, absente de tout environnement connu → chemin legacy EUR unique actif par défaut. `src/app/checkout/page.tsx` n'envoyait que `{agent_slug}`, jamais de pays.
4. **Prix CHF absent** — `.env.local` ne contenait que `STRIPE_PRICE_PIERRE` (EUR). Aucune variable `STRIPE_PRICE_PIERRE_CHF_MONTHLY`. Même avec le flag pays activé, toute tentative suisse aurait échoué en `STRIPE_PRICE_NOT_CONFIGURED`.

## Architecture avant

Un moteur de tarification par pays complet et déjà fail-closed existait (`country-pricing.ts`, `checkout-country-guard.ts`, `checkout-pricing-server.ts`, `p15-checkout-reconciliation-gate.ts`) mais était **opt-in, désactivé par défaut** — exactement le même motif que les gouvernances P0.1/P0.2 : du code correct, jamais activé. Le chemin RÉELLEMENT actif par défaut était un prix EUR unique (`STRIPE_PRICE_PIERRE`), sans validation pays, sans réconciliation.

## Cause exacte du CTA Suisse mort

`CountryPricingCard.tsx` a été reconstruit à un moment antérieur (résolution serveur via `/api/pricing/public`, sélecteur de pays, messages honnêtes) — **mais le câblage du clic n'a jamais été terminé**. Le composant calculait correctement `canCheckout` (prix résolu + pays supporté) mais le bouton ne faisait littéralement rien au clic, quel que soit son état.

## Cause exacte du 500 `/paiement`

**Ce n'est pas un défaut applicatif.** Preuve directe : le serveur `next dev` de cette session (actif depuis plus de 12 heures à ce stade) était bloqué dans une **boucle de recompilation continue** — plus de 100 cycles consécutifs de `✓ Compiled in Xs (1101 modules)` **sans qu'aucun fichier n'ait été modifié**, causant des requêtes qui expiraient (timeout) ou recevaient une réponse tronquée. Un test comparatif direct sur un serveur de production stable (`next start`, build isolé antérieur) a donné **200 OK, 4 fois sur 4, en 25-50 ms** — confirmant que `/paiement` (page 100% statique, sans `fetch` ni `JSON.parse`) est parfaitement stable une fois hors de cet environnement de développement corrompu. Le serveur dev défaillant a été arrêté.

## Source canonique pays/prix

**Non recréée** — `src/lib/clonestore/pricing/country-pricing.ts` (module pur) était déjà exactement le contrat demandé (FR/BE/LU=449€, CH=499CHF, fail-closed). `checkout-pricing-server.ts` (`resolvePierreCheckoutPricing`) était déjà l'équivalent exact d'un `resolvePierreOffer(country)` : résolution du pays (entreprise vérifiée > sélection client), garde pays/devise, résolution du price ID Stripe, audit. Voir `PAYMENT_COUNTRY_PRICE_MATRIX.md`.

## Modifications apportées (inventaire exact)

| Fichier | Nature | Résumé |
|---|---|---|
| `src/lib/clonestore/pricing/pricing-flags.ts` | Modifié | `isCountryPricingEnabled()` révélée par défaut (pattern CloneChat/C1.2) |
| `src/lib/clonestore/production/p15-checkout-reconciliation-gate.ts` | Modifié | Réconciliation pays révélée par défaut ; export `isCheckoutReconciliationEnabled` (source unique du flag) |
| `src/app/api/webhooks/stripe/route.ts` | Modifié | Réutilise `isCheckoutReconciliationEnabled` au lieu d'une 2e logique de flag dupliquée |
| `src/components/pricing/CountryPricingCard.tsx` | Modifié | CTA câblé (`onClick` → `/checkout?agent=pierre&country=X`), état `navigating`, message d'erreur |
| `src/app/checkout/page.tsx` | Modifié | Lit `?country=`, le transmet au POST ; détecte les échecs "doux" (200 + `ok:false`) de la garde pays |
| `.env.local` | Modifié | + `STRIPE_PRICE_PIERRE_EUR_MONTHLY` (alias), + `STRIPE_PRICE_PIERRE_CHF_MONTHLY` (nouveau prix Stripe test réel) |
| 3 fichiers de test existants | Modifiés | Opt-out explicite du flag révélé (leur scénario testait autre chose, comportement historique préservé) |
| 4 fichiers de test | Créés | Voir `PAYMENT_TEST_MATRIX.md` |
| 1 Produit + 1 Price Stripe (test) | Créés via API | CHF 499/mois, `livemode=false` |

Aucun autre fichier — ni homepage, ni démo, ni pages légales, ni `src/lib/pierre/hr/*`, ni les fichiers P0.1/P0.2 — n'a été touché.

## Parcours CTA → checkout

`CountryPricingCard` résout le pays via `/api/pricing/public` (server-authoritative), affiche le prix correspondant, et transmet ce pays **en intention seulement** dans l'URL vers `/checkout`. `/checkout` le transmet à son tour au POST `/api/checkout`, qui **ignore toute valeur cliente concernant le prix/la devise** et ne fait confiance qu'à sa propre résolution serveur (`resolvePierreCheckoutPricing`). Testé et prouvé : un client CH qui tente de forcer un `price_key`/`currency` EUR reçoit quand même le prix CHF (`PAYMENT_TEST_MATRIX.md`, tests C7/C8).

## Stripe — prix EUR et CHF

Vérifiés via l'API Stripe réelle (mode test) : EUR 449 valide et inchangé ; CHF 499 nouvellement créé. Voir `PAYMENT_STRIPE_TEST_EVIDENCE.md`.

## Webhook, réconciliation, activation, idempotence

Non réécrits — déjà bien conçus (signature à double secret, ledger d'idempotence par `event.id` avec empreinte de payload et ordre monotone, garde de réconciliation pays `country_review_required`-équivalent). Seule leur **activation par défaut** a changé. Testé : réplication d'événement → une seule écriture ; conflit pays (session FR, facturation Stripe CH) → pas d'activation silencieuse ; devise incohérente (CH facturé EUR) → pas d'activation, remboursement signalé.

## Attribution partenaire

Non modifiée (déjà correcte selon l'audit initial : commission uniquement sur `invoice.paid` réellement encaissé, anti-double-crédit par facture, jamais bloquant pour le client). Non re-testée spécifiquement dans ce bloc (hors périmètre des 4 défauts identifiés) — voir `PAYMENT_REMAINING_RISKS.md` RISQUE-4.

## Résultats des tests

**36 tests nouveaux, tous verts** (unitaires flags + API checkout FR/BE/LU/CH/incohérences + webhook réconciliation/idempotence) + **3 fixtures existantes corrigées** (opt-out explicite, comportement historique préservé) + **~5946 tests de non-régression exécutés en direct**, 0 échec réel (1 timeout worker isolé, ré-exécuté seul et confirmé vert en 1,07 s — artefact de contention machine sur une session de 12h+, pas une régression). Détail complet : `PAYMENT_TEST_MATRIX.md`.

## Preuve Stripe réelle

Deux sessions Checkout test réelles créées (FR/EUR, CH/CHF), prix vérifiés par l'API elle-même, `livemode=false` confirmé, puis nettoyées. Détail : `PAYMENT_STRIPE_TEST_EVIDENCE.md`.

## TypeScript, ESLint, build

- `npx tsc --noEmit` : propre (0 erreur réelle). Un premier essai a crashé par OOM — cause identifiée et corrigée : `tsconfig.tsbuildinfo` avait grossi à 6,1 Mo sur cette session de 12h+ ; supprimé, ré-exécuté avec succès.
- ESLint scopé sur tous les fichiers modifiés/créés de ce bloc : 0 erreur.
- Build de production isolé (`NEXT_DIST_DIR=.next-payment-path-closure`) : voir section dédiée ci-dessous pour le résultat définitif.

## Vérification navigateur

Le serveur MCP Playwright était indisponible pendant l'essentiel de ce bloc — les corrections ont donc d'abord été vérifiées par lecture de code, `tsc`, ESLint et build seuls. **Playwright est redevenu disponible avant la clôture**, et a permis une vérification réelle sur le build de production isolé (`next start`, sans dépendance au serveur `next dev` défaillant) :

- Navigation vers `/agents/pierre` : rendu correct, France sélectionnée par défaut, prix 449€ affiché.
- **Clic réel** sur le radio "Suisse" → le CTA affiche instantanément "Choisir Pierre — 499 CHF / mois" (mise à jour dynamique confirmée).
- **Clic réel** sur le CTA → navigation confirmée vers `http://localhost:3313/checkout?agent=pierre&country=CH` — **preuve directe, de bout en bout, que le CTA autrefois mort fonctionne réellement**, pas seulement en théorie de code.
- `/checkout?country=CH` rendu correctement (carte de paiement, CTA "Continuer vers le paiement"), 0 erreur console.
- `/paiement` (page historiquement associée au 500) chargée directement : 0 erreur console, rendu correct.

Captures dans `CLONESTORE_AUDIT_EVIDENCE/payment-path-closure/` : `cta-suisse-checkout-CH.png`, `paiement-stable-production.png`. Non couvert : la page Checkout hébergée par Stripe elle-même (aucune carte de test saisie — choix de sécurité pour éviter tout webhook réel touchant la base partagée, voir `PAYMENT_REMAINING_RISKS.md`).

## Risques restants

Voir `PAYMENT_REMAINING_RISKS.md` — synthèse : configuration Vercel/production à mettre à jour avec les 2 nouvelles variables Stripe ; interaction CTA non validée par clic réel (selon disponibilité de Playwright en fin de bloc) ; paiement test non complété dans l'interface hébergée Stripe (choix de sécurité) ; attribution partenaire non re-testée (hors périmètre) ; conformité fiscale hors périmètre (prochain bloc).

## Verdict

**Les quatre défauts initiaux sont fermés avec preuve** : CTA câblé (code + tests), tarification pays révélée et testée pour les 4 pays, prix CHF créé et vérifié via l'API Stripe réelle, 500 `/paiement` requalifié en artefact d'environnement (non un bug applicatif) avec preuve comparative directe. Un seul chemin canonique crée des sessions Stripe, un seul webhook les reçoit — aucun doublon trouvé.
