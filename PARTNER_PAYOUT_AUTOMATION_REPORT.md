# Analytique admin par partenaire + versements automatiques Stripe Connect

Rapport de mission. Chaque affirmation est adossée à un test, un build ou une réponse HTTP réelle.

---

## 0. La correction critique : le dry-run mentait

L'audit demandé au §4 a trouvé exactement ce qu'il cherchait. L'ancien dry-run, sur une commission mature :

1. créait une ligne de transfert,
2. y rattachait les commissions,
3. **passait les écritures en `paid`**,
4. marquait le transfert `paid` avec `stripe_transfer_id = 'dry_run'`.

Autrement dit : une simulation « versait » l'argent dans les livres sans jamais l'envoyer, et **empêchait définitivement le vrai versement** (la période était déjà « payée »). Pire, deux tests d'intégration **assertaient ce comportement** (`expect(bal.paidMinor).toBe(8_980)` après un dry-run) : le bug était verrouillé par la suite de tests.

Un second défaut, aussi grave, existait en mode réel : les écritures passaient à `paid` **avant** l'appel Stripe. Si le transfert échouait, les commissions restaient marquées payées — jamais versées, jamais récupérables.

Les deux sont corrigés, et les tests qui protégeaient le bug ont été retournés en tests de non-régression.

## 1. Le nouveau circuit

```
invoice.paid → commission (20 % du HT encaissé) → réserve → disponible
   → cron mensuel → prévisualisation OU transfert réel → paid APRÈS confirmation Stripe
```

**Dry-run = prévisualisation pure.** Aucune écriture nulle part : pas de lot, pas de transfert, pas de statut modifié, pas d'e-mail, pas de verrou de période, pas d'appel Stripe. Rejouable à l'infini. Le test injecte des dépendances qui **lèvent une exception si Stripe est seulement effleuré**.

**Mode réel.** Réservation atomique du lot (les commissions restent `pending`, le verrou anti-double-versement est l'index unique `uq_pp_item_entry_live`, jamais le statut `paid`) → appel Stripe avec la clé déterministe `partner-payout:<partnerId>:<periodKey>:<batchHash>` → **et seulement alors** les écritures passent à `paid`.

**Échecs.** Trois issues explicites, jamais un « échec » vague :
- `failed_retryable` (solde plateforme insuffisant, rate limit) → le lot est **libéré**, les commissions retournent au pool du mois suivant ;
- `failed_permanent` (compte Connect refusant les transferts) → lot libéré, commissions préservées ;
- `reconciliation_required` (**timeout, erreur réseau**) → on ne conclut rien : **rien n'est payé, rien n'est libéré**. Le lot reste verrouillé, et le run suivant **interroge Stripe avant toute recréation**. Si le transfert était bien parti, il est adopté (`reconciled`) ; sinon il est réémis sur la même ligne avec la même clé.

## 2. Coordonnées bancaires : CloneStore n'en a aucune

Le cabinet saisit ses informations **exclusivement chez Stripe**, via l'Account Link hébergé. CloneStore ne reçoit, ne stocke, n'affiche et ne transmet **aucune** donnée bancaire.

Ce n'est pas une intention, c'est une propriété du schéma, et elle est **testée** :

```sql
select column_name from information_schema.columns
 where table_name like 'clonestore_pp_%'
   and column_name ~* '(^|_)(iban|bic|rib|bank|swift|routing|account_number|card_number|last4)($|_)'
-- → 0 ligne
```

CloneStore ne *peut pas* stocker un IBAN : aucune colonne ne le permet. Un second test vérifie que le JSON du détail admin ne contient aucun de ces termes.

Ce qui est stocké de Stripe : l'**état** (`payouts_enabled`, `details_submitted`, statut d'onboarding) et la liste des **noms de champs** encore dus (`external_account`, `individual.verification.document`…) — jamais leurs valeurs. L'admin ne voit que : *Connect non commencé · en cours · informations manquantes · restreint · prêt à recevoir*.

## 3. Ce que l'admin voit désormais, par cabinet

Route `GET /api/partners/admin/partners` (paginée, triée, filtrée **côté serveur** — agrégats calculés par PostgreSQL, jamais reconstruits dans le navigateur).

Colonnes de la liste : Cabinet · Statut · Clients actifs · Clients totaux · MRR clients · MRR commission · En réserve · Disponible · Versé · Stripe Connect · Dernière activité.
Recherche, filtres (statut / pays / Connect), tris (clients actifs / MRR clients / MRR commission / disponible), pagination 25 par page.

`GET /api/partners/admin/partners/[id]` ouvre le détail : identité, onboarding (étapes restantes, exigences Stripe dues), acquisition (clics, introductions, prospects, attributions, conflits, clients perdus), entreprises apportées **paginées** avec premier/dernier paiement, argent complet (brut, remboursements, réserve, disponible, gelé, versé, **prochain versement estimé** avec la raison exacte s'il est bloqué), versements (avec motif et action nécessaire), commissions, introductions, risques, audit.

Aucune requête ne charge tous les partenaires **et** tous leurs clients : les agrégats sont des sous-requêtes latérales évaluées pour la page demandée, et les clients ne se chargent qu'à l'ouverture d'un détail.

## 4. Preuves

Tout sur **PostgreSQL réel** (PGlite), via les vraies fonctions et de vrais webhooks signés.

| Exigence | Preuve |
|---|---|
| **§4 dry-run sans mutation** | `payout-automation.itest.ts` : `transfers=0`, `transfer_items=0`, `payout_runs=0`, `paid=0`, `available` inchangé à 89,80 €. Les dépendances Stripe **lèvent** si appelées |
| **§4 rejouable** | Trois prévisualisations successives → même montant, toujours zéro écriture |
| **§4 le vrai versement reste possible après simulation** | Le run réel qui suit transfère bien 89,80 € : la simulation n'a rien consommé |
| **§5 transfert réel unique** | Un seul appel Stripe ; clé conforme à `partner-payout:<id>:<AAAA-MM>:<hash 32>` |
| **§5 double worker** | Deux runs concurrents (`Promise.all`) → **un seul** détient le verrou, **un seul** appel Stripe, **un seul** transfert en base |
| **§5 rejeu du cron** | Second run même période → `already_running_or_done`, zéro appel Stripe |
| **§6 solde insuffisant** | `failed_retryable` → lot **libéré**, `paid=0`, `available=8980`, e-mail `payout_blocked` (jamais `transfer_executed`). Le mois suivant, la commission **est bien versée** |
| **§6 timeout Stripe** | `reconciliation_required` → `paid=0`, lot **non libéré** (verrou conservé), `required_action` explicite |
| **§6 reprise après timeout** | Stripe avait créé le transfert → **retrouvé et adopté** (`reconciled`), **zéro recréation**, `paid` seulement alors |
| **§6 Connect incomplet / seuil / litige** | `skipped` avec `stripe_not_ready` / `below_threshold` / `open_dispute`, aucune écriture consommée |
| **§9-D rapprochement** | somme disponible = montant du lot = somme des lignes du lot = montant transféré = montant passé en `paid` |
| **§9-A admin 0 client** | Tous les agrégats à 0, aucune valeur inventée |
| **§9-A admin 100 clients** | MRR clients = 100 × 449 € HT, MRR commission = 100 × 89,80 €, clients paginés 25/page, aucun doublon entre pages |
| **§9-A agrégats exacts** | 3 clients dont 1 annulé : MRR ne compte que les 2 actifs, mais le brut compte bien les 3 factures payées |
| **§9-A isolation** | Les chiffres d'un cabinet ne fuient jamais chez un autre |
| **§9-B aucun IBAN** | 0 colonne bancaire dans le schéma ; 0 terme bancaire dans le JSON admin |
| **§8 e-mails** | `connect_ready` exactement une fois quand payouts s'activent ; `commission_available` une seule fois, sans toucher au montant ; **aucun** `transfer_executed` en dry-run |
| **§7 cron** | Secret obligatoire, comparaison **timing-safe** ; sans secret et avec mauvais secret → `401` (vérifié sur le serveur de production) |
| Routes admin protégées | `GET /api/partners/admin/partners` et `/[id]` anonymes → **401** |

**Chiffres** : `tsc --noEmit` 0 erreur · `next build` ✓ (routes `/api/partners/admin/partners` et `/[id]` compilées) · ESLint 0 erreur · **93/93** tests d'intégration partenaires (10 fichiers, dont **16/16** pour les versements et **12/12** pour l'analytique) · **17 149** tests unitaires passants.

**Échecs préexistants, hors périmètre, inchangés** : 4 tests dans `pierre/__tests__/premium-document-system.test.ts` (fichier du 19/05/2026) et 1 test instable en suite complète dans `pierre/v1/__tests__/fair-claim.test.ts` (vert isolément, fichier du 02/07/2026). Strictement les mêmes 5 avant et après cette mission.

## 5. Fichiers

**Migration** — `supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql` (additive, idempotente) : statuts de transfert explicites, `batch_hash` / `attempts` / `required_action`, index unique de lot vivant, `available_notified_at`, état Connect (`stripe_details_submitted`, `stripe_requirements_due`, `stripe_disabled_reason`, `last_payout_at`), e-mails `connect_ready` / `payout_blocked`, index d'analytique.

**Règles pures** — `payout-rules.ts` : `payoutIdempotencyKey`, `classifyTransferFailure` (issue inconnue ⇒ jamais un échec), `TransferStatus`.

**Serveur** — `payouts.ts` (réécrit : `previewPayouts`, `runMonthlyPayouts`, `settle` après confirmation, `failBatch`, rapprochement, `notifyAvailableCommissions`), `admin-analytics.ts` (nouveau), `connect.ts` (requirements + `connect_ready`), `stripe-bridge.ts` (transmet les requirements), `emails.ts`.

**Routes** — `GET /api/partners/admin/partners`, `GET /api/partners/admin/partners/[id]`, `/api/cron/partner-payouts` (mode explicite + notification de maturité).

**Interface** — `AdminConsole.tsx` : onglet Partenaires (liste analytique + filtres + tri + pagination + panneau de détail) et onglet Versements (prévisualisation honnête : « seraient versés », jamais « versés »).

## 6. Actions Production restantes

Rien de ce qui suit n'a été exécuté ici, et rien ne sera prétendu fait.

1. Appliquer les migrations `2026-07-11_04__…` (auto-onboarding) puis `2026-07-11_05__…` (versements).
2. Définir `CLONESTORE_PP_CODE_KEY`.
3. Configurer Stripe Connect (Express, capability `transfers`) et le webhook `account.updated`.
4. Installer le cron mensuel sur `/api/cron/partner-payouts` avec `PARTNER_PAYOUT_CRON_SECRET`.
5. Passer un cycle complet en **Stripe Test Mode** avec un vrai compte connecté de test.
6. Premier cycle Production en **dry-run** ; lire le rapport de prévisualisation.
7. Validation humaine explicite de ce rapport.
8. **Seulement ensuite** : `PARTNER_PAYOUT_DRY_RUN=false` et `PARTNER_PAYOUTS_ENABLED=true`.

Rappel des gardes qui subsistent quoi qu'il arrive : avec une clé `sk_live_`, le job **refuse** tout transfert tant que la production n'est pas autorisée (`productionAuthorized()` renvoie `false` dans le code — le plancher P10 ne se lève pas depuis le code).

**Aucun transfert Live n'a été déclenché. Aucun commit, aucun déploiement** (`git.exe` reste bloqué par l'OS sur ce poste ; aucun accès production n'y existe).

---

## VERDICT

**PARTNER PAYOUT AUTOMATION READY.**

Le circuit de versement est automatique de bout en bout : la commission naît d'un paiement Stripe confirmé, mûrit, devient disponible, et le cron mensuel la transfère vers le compte Connect du cabinet sans que personne n'ait à demander quoi que ce soit. Le dry-run ne ment plus : il ne touche à rien. Une commission ne peut plus être marquée payée sans transfert confirmé, ni partir deux fois, ni disparaître sur un timeout. Et CloneStore ne détient aucune coordonnée bancaire — le schéma le rend impossible.

Ce qui reste est **externe** (migrations, Stripe Connect, cron, cycle Test Mode, validation humaine) et strictement listé en §6. Aucun transfert réel ne peut partir avant que ces étapes ne soient franchies par un humain.
