# Cabinets Fondateurs — Release, déploiement, migrations, recette Stripe Test

Rapport final. Rien n'est affirmé sans preuve ; ce qui a échoué est nommé.

---

## 1. Release isolée

Le dépôt principal divergeait de la branche déployée sur **675 fichiers**, dont **631 appartenant à
d'autres chantiers** (dont un, `external-enablement/e1`, a été modifié *pendant* cette session par
une session concurrente — mtime à l'appui — et cassait `tsc`).

La release a donc été reconstruite **à partir de la branche déployée**, pas du working tree :

- 7 068 fichiers repris **tels quels depuis `fad4b696`** (la branche réellement déployée) ;
- 75 fichiers du programme partenaires repris du working tree (44 modifiés/ajoutés, 31 déjà à jour) ;
- **0 fichier des 631 divergences étrangères.**

Dépôt isolé : `C:/Users/homme/clonestore-partner-release`
Manifeste (chemin, catégorie, justification, SHA-256, statut) : `PARTNER_PROGRAM_RELEASE_MANIFEST.json`

## 2. Commit

| | |
|---|---|
| Branche | `release/partner-program-automation` (créée depuis `main` @ `fad4b696`) |
| Commits | `1347530234bfb6737a8b6f2dcca9d8583fe254e4` puis `65c1335e90e62696aeefaefcc65cd447c33064cb` |
| Message | `feat: automate partner onboarding analytics and payouts` |
| Fichiers | 47 stagés **explicitement** (aucun `git add .`) — contrôle automatique : 0 fichier hors manifeste |
| Migrations | `2026-07-11_04__clonestore_pp_auto_onboarding.sql`, `2026-07-11_05__clonestore_pp_payout_automation.sql` |
| Arbre | propre |

**PUSH IMPOSSIBLE.** `git.exe` est bloqué par l'OS et **aucune credential GitHub n'existe** dans cet
environnement. La tentative réelle a renvoyé **HTTP 401**. Je ne déclare donc pas « poussé ».

Commande exacte pour l'opérateur :

```bash
cd C:/Users/homme/clonestore-partner-release
git push origin release/partner-program-automation
# puis ouvrir la PR vers main, ou :
#   git checkout main && git merge --ff-only release/partner-program-automation && git push origin main
```

Repli si ce dépôt n'est pas utilisable : `partner-program-automation.patch` (45 fichiers, 480 Ko)

```bash
cd C:/Users/homme/clonestore
git checkout -b release/partner-program-automation fad4b696
git apply C:/Users/homme/clonestore-partner-release/partner-program-automation.patch
git commit -am "feat: automate partner onboarding analytics and payouts"
git push origin release/partner-program-automation
```

## 3. Les deux gardes corrigées

**3.1 — Autorisation Live (fail-closed).** `productionAuthorized: () => false` (plancher aveugle) est
remplacé par `src/lib/partner-program/live-authorization.ts`. Un transfert Live exige **les neuf**
conditions : `NODE_ENV=production`, `VERCEL_ENV=production`, `PARTNER_PAYOUTS_ENABLED=true`,
`PARTNER_PAYOUT_DRY_RUN=false`, `PARTNER_PAYOUT_LIVE_AUTHORIZED=true`, clé `sk_live_`, secret cron
présent, aucune clé Test, aucun mélange Test/Live. **L'absence d'une variable vaut refus**, et chaque
refus nomme la garde qui a manqué. `PARTNER_PAYOUT_DRY_RUN=false` **seul** n'autorise rien (testé).
→ 13 tests.

**3.2 — `stripe_mode` dynamique.** Le `'test'` codé en dur à l'insertion d'un lot est supprimé : le mode
vient du **client Stripe réel** (`deps.stripeMode()`, dérivé de la clé), les événements portent déjà
`event.livemode`. La sélection des écritures est **filtrée par mode en SQL** — une écriture Test ne peut
pas entrer dans un lot Live, ni l'inverse. `assertHomogeneousBatch` refuse un lot à modes mélangés,
devises mélangées, ou devise incohérente avec le compte de versement. → 21 tests d'intégration.

## 4. Gates de la release isolée

| Gate | Résultat |
|---|---|
| TypeScript | **0 erreur** (l'erreur du chantier concurrent disparaît : elle ne nous appartient pas) |
| ESLint | 0 erreur |
| Tests unitaires partenaires | **55/55** |
| Tests d'intégration partenaires | **98/98** (PostgreSQL réel, 10 fichiers) |
| Build production | ✓ `next build` |
| Scan secrets | aucun (seuls des préfixes littéraux `sk_live_`/`sk_test_` dans les gardes) |
| Scan bancaire | aucune colonne |
| Scan copy public | « On s'occupe du reste » et « équipe RH IA complète » présents ; aucune ancienne formulation |

## 5. Déploiement — **FAIT**

| | |
|---|---|
| Projet | `clonestore-xcwi` (celui qui sert **clonestore.pro**) |
| Déploiement | `dpl_4qBYhwUESqGmx5vvViykzacAYNid` — état **READY**, target **production** |
| URL | https://clonestore.pro (alias confirmés : `clonestore.pro`, `www.clonestore.pro`) |
| Cron | `/api/cron/partner-payouts` — `0 3 1 * *`, enregistré sur le déploiement |

Vérifications en production : `/partenaires` **200** · `/partenaires/espace` **200** ·
`/partenaires/r/<slug>` **307** · `/api/partners/admin/partners` **401** · cron sans/avec mauvais
secret **401**.

**Variables Production** (valeurs jamais affichées) :
`PARTNER_PROGRAM_ENABLED=true` · `PARTNER_PAYOUTS_ENABLED=true` · **`PARTNER_PAYOUT_DRY_RUN=true`** ·
**`PARTNER_PAYOUT_LIVE_AUTHORIZED=false`** · `PARTNER_PAYOUT_CRON_SECRET` (secrète) ·
`CLONESTORE_PP_CODE_KEY` (secrète) · `CLONESTORE_PP_COOKIE_SECRET` (secrète).

## 6. Migrations — **APPLIQUÉES**

Base réelle : Supabase Production, PostgreSQL 17.6. Elle ne contenait **aucune** table partenaire.

Préflight (lecture seule) → **GO**. Puis, chacune dans sa transaction :
`_01 core` ✓ · `_02 finance` ✓ · `_03 emails` ✓ · `_10 orders stripe events` ✓ ·
**`_04 auto-onboarding`** ✓ · **`_05 payout automation`** ✓

Postcheck : **38 OK / 0 KO**, y compris les preuves **comportementales** sur la vraie base
(mutation d'un montant REFUSÉE, suppression d'un événement financier REFUSÉE, isolation RLS vérifiée).

Artefacts vérifiés : statuts `onboarding_pending`/`manual_review` · code chiffré (`code_cipher`+iv+tag) ·
`company_domain` · `clonestore_pp_attribution_decisions` · `activation_mode` · statuts de transfert
`transferred`/`failed_retryable`/`failed_permanent`/`reconciliation_required` · `batch_hash` · `attempts` ·
`required_action` · état Connect · `last_payout_at` · `available_notified_at` · 40 index `idx_pp_*` ·
20 tables · **0 colonne bancaire**.

## 7. Reprise des candidatures — sans objet

La base partenaires venait d'être créée : **0 candidature héritée** (`received`/`under_review`).
Il n'y a rien à reprendre. Le script et l'action admin restent disponibles, simulation par défaut.

## 8. Recette Stripe Test — **RÉELLE, ET PARTIELLEMENT BLOQUÉE**

Clé Stripe : **TEST** (`livemode=false` confirmé par l'API). Solde plateforme test : 45 220,29 €.
Webhook Test existant vers `www.clonestore.pro/api/webhooks/stripe` : les **6 événements** du programme
partenaires y ont été ajoutés (`invoice.paid`, `invoice.payment_succeeded`, `charge.refunded`,
`charge.dispute.created`, `charge.dispute.closed`, `account.updated`) — additif, statut `enabled`.

### Ce qui est PROUVÉ en production, avec de vrais objets Stripe

**Auto-onboarding en production réelle.** Candidature envoyée sur la **vraie route publique** de
clonestore.pro → `{"ok":true,"admitted":"auto","spaceReady":true}` → cabinet **auto-provisionné dans la
vraie base** : statut `onboarding_pending`, slug public, code de recommandation **chiffré** en base,
e-mail `onboarding_access` enfilé. Audit : `system | application.auto_approved`. **Zéro action humaine.**

**Webhook de production vivant.** Vrais objets Stripe Test créés : `cus_UrrgXG…OCvI`,
`in_1Ts7xQB…IzaK` **payée 538,80 €** (449 € HT + TVA). Stripe a produit `evt_1Ts7xU…cJCF`
(`invoice.paid`, `livemode=false`) à **20:57:12** et **la production l'a enregistré dans son ledger
d'idempotence à 20:57:15.944** — soit 3 secondes. Signature vérifiée, `processing_result = ignored`,
ce qui est **correct** : ce client n'est rattaché à aucun cabinet, donc **aucune commission** n'est
créée. Quatre événements Test réels au total sont enregistrés en production, tous `livemode=false`.

### Ce qui est BLOQUÉ, et pourquoi

**Stripe Connect n'est pas activé sur le compte Stripe.** Toute création de compte connecté échoue :

> `You can only create new accounts if you've signed up for Connect, which you can do at
> https://dashboard.stripe.com/connect`

Vérifié pour **les trois types** (`express`, `standard`, `custom`) : refus identique. `accounts.list`
fonctionne (0 compte), `accounts.create` non. C'est une inscription à faire dans le tableau de bord
Stripe — **impossible par API**.

Conséquence en cascade, énoncée sans détour :

- pas de `acct_…` → pas d'`account.updated` → **pas d'activation automatique à prouver en production** ;
- pas de cabinet actif → **pas d'attribution**, donc pas de commission sur la facture Test payée ;
- pas de compte connecté → **aucun transfert `tr_…`**, donc **ni transfert Test réel, ni rejeu, ni
  rapprochement** prouvés contre Stripe.

Ces quatre points sont **prouvés en local sur PostgreSQL réel** (98/98 tests, dont transfert unique,
idempotence, double worker, timeout → `reconciliation_required`, adoption sans recréation). Ils ne sont
**pas** prouvés contre l'API Stripe. Je ne les déclare donc pas validés en recette.

## 9. Dry-run Production — **EXÉCUTÉ, ZÉRO MUTATION**

Cron déclenché deux fois avec le secret opérateur :

```
HTTP 200 · mode=dry_run_preview · stripeMode=test · dryRun=true · runId=null
période 2026-06 · 0 cabinet considéré · 0 transfert · total 0
```

État de la base **après** les deux exécutions : `payout_runs = 0` · `transferts = 0` · `lignes de lot = 0` ·
`commissions payées = 0` · `e-mails « versement envoyé » = 0`.
`runId=null` prouve qu'**aucun verrou de période n'a été consommé** : le vrai versement reste possible.
Deuxième exécution identique à la première → **rejouable**.

Gardes du cron : sans secret **401** · mauvais secret **401** · bon secret **200**.

## 10. Admin

Les agrégats ont été vérifiés **sur les données réelles de production**, avec la requête même que sert
`/api/partners/admin/partners` : 1 cabinet, statut `onboarding_pending`, Connect « non commencé »,
0 client, 0 € brut/disponible/versé, 0 risque. Route anonyme → **401**.

**Non fait** : ouvrir `https://clonestore.pro/partenaires/admin` dans un navigateur. La console exige une
session Supabase d'un e-mail de l'allowlist propriétaire, dont je n'ai pas le mot de passe. Je ne
fabrique pas de capture.

## 11. Rollback

Documenté et applicable sans redéploiement de code : `PARTNER_PROGRAM_ROLLBACK.md`.
Trois interrupteurs (`PARTNER_PAYOUTS_ENABLED`, `PARTNER_PAYOUT_DRY_RUN`, `PARTNER_PROGRAM_ENABLED`),
ledgers append-only préservés, événements rejouables sans double traitement, lots
`reconciliation_required` traités par le run suivant — jamais à la main.

## 12. Actions restantes (opérateur)

1. **Activer Stripe Connect** sur le compte Stripe → https://dashboard.stripe.com/connect
   *C'est le seul blocage de la recette.* Ensuite, la recette Connect + transfert Test devient
   exécutable telle quelle.
2. **Pousser la branche** (commande §2) — aucune credential GitHub ici.
3. Après activation de Connect : rejouer le parcours (cabinet de recette → onboarding Connect →
   `account.updated` → activation automatique → clic → paiement Test → commission → dry-run → transfert
   Test réel → rejeu).
4. Lire le rapport du dry-run de production, puis **et seulement ensuite** décider de
   `PARTNER_PAYOUT_LIVE_AUTHORIZED=true` **et** `PARTNER_PAYOUT_DRY_RUN=false`.

---

## VERDICT

### `RELEASE READY — EXTERNAL CONFIGURATION REQUIRED`

Le code, la release, le déploiement, les migrations et le dry-run de production sont **faits et
vérifiés** : clonestore.pro sert la release, la base de production porte les 6 migrations
(postcheck 38/0), l'auto-onboarding a été prouvé **sur la vraie route publique et dans la vraie base**,
et un **vrai événement Stripe Test** a été livré au webhook de production et enregistré en 3 secondes.

Le verdict `DEPLOYED — PRODUCTION DRY-RUN SAFE` exige en plus « Stripe Connect Test réel validé » et
« vrai transfert Stripe Test validé ». **Ces deux points sont impossibles tant que Connect n'est pas
activé sur le compte Stripe** — une case à cocher dans le tableau de bord, hors de portée d'une API.
Je ne les déclare donc pas acquis.

**Aucun transfert Live. Aucune clé Live utilisée. `PARTNER_PAYOUT_DRY_RUN=true` et
`PARTNER_PAYOUT_LIVE_AUTHORIZED=false` sont en place en production.**
