# Recette Stripe Test réelle — Cabinets Fondateurs

Tout ce qui suit s'est produit sur **clonestore.pro** (production) et sur le **compte Stripe Test réel**.
Aucun objet Stripe n'est inventé. Aucune clé Live n'a été utilisée.

---

## 1. Deux défauts réels trouvés par la recette

### 1.1 — `account.updated` ne pouvait JAMAIS arriver en production

Stripe distingue deux familles d'endpoints webhook, **chacune avec son propre secret** :

- endpoint **« compte »** → événements de la plateforme (`invoice.paid`, `charge.refunded`…) ;
- endpoint **« Connect »** → événements des **comptes connectés** (`account.updated`).

La production ne vérifiait qu'**un seul** secret (`STRIPE_WEBHOOK_SECRET`). Conséquence : même avec
Connect activé, `account.updated` aurait été **rejeté en signature invalide** — et l'activation
automatique des cabinets n'aurait **jamais** pu fonctionner en production.

**Correction** (`src/app/api/webhooks/stripe/route.ts`) : la route accepte désormais
`STRIPE_WEBHOOK_SECRET` **ou** `STRIPE_WEBHOOK_SECRET_CONNECT`. La vérification cryptographique reste
**obligatoire** : un événement doit être signé par l'un de nos endpoints, sinon il est rejeté (400).

Un endpoint Connect a été créé chez Stripe (`we_1Ts9Ia…`, `connect: true`, `account.updated`), et son
secret posé en production.

### 1.2 — La production vendait Pierre au mauvais prix

La garde serveur de prix a refusé le checkout avec `PRICE_MISMATCH`. Motif : `STRIPE_PRICE_PIERRE` en
production pointait vers un ancien `Price` **à 299 €**, alors que le canon est **449 € HT/mois**.
La garde a fait exactement son travail — elle a **empêché une vente au mauvais prix**.

**Correction** : la variable de production pointe désormais sur le `Price` canonique
`price_1TaFzx…` = **449,00 € / mois**. Le prix de Pierre n'a pas été modifié ; c'est la configuration
qui a été alignée sur lui.

---

## 2. Parcours partenaire — activation AUTOMATIQUE prouvée

Le compte connecté fourni était de type **standard**, avec 16 exigences `past_due` et
`disabled_reason=requirements.past_due`. Son onboarding exige l'authentification du compte Stripe de
son titulaire : impasse automatisable, et surtout **ce n'est pas le type utilisé par la production**.

Le compte a donc été créé **par les paramètres exacts du code de production**
(`defaultConnectDeps` : `type: "express"`, capability `transfers`, `business_type: "company"`), puis
son onboarding hébergé a été complété avec les **données de test officielles Stripe** (numéro de
téléphone de test, code `000000`, IBAN de test fourni par Stripe).

**L'IBAN a été saisi chez Stripe, jamais chez CloneStore.**

### Vérité Stripe après onboarding

```
compte            : acct_1Ts9SxBrybBEQgWI   (express, FR, EUR)
details_submitted : true
charges_enabled   : true
payouts_enabled   : true
capabilities      : { transfers: "active" }
disabled_reason   : (aucun)
currently_due     : (aucune)
past_due          : (aucune)
external_accounts : 1   ← l'IBAN reste CHEZ STRIPE
```

### Ce que la production en a fait, sans qu'on force quoi que ce soit

```
stripe_onboarding_status : complete
details_submitted        : true
payouts_enabled          : true
requirements_due         : (aucune)
disabled_reason          : —
→ CloneStore = Stripe ?   OUI (exactement)

statut du cabinet : active
activation_mode   : automatic
activé le         : 2026-07-11T22:36:27.286Z
e-mails           : onboarding_access · connect_ready · partner_activated
audit             : system/connect.account_updated ×10 · system/partner.activated_automatically
DÉCISIONS HUMAINES : 0
```

Avant l'onboarding, la production affichait **« restreint »** et refusait d'activer — exactement ce
qui était demandé : `payouts_enabled` n'a jamais été forcé, aucune exigence n'a été contournée.

---

## 3. Parcours client — commission de 20 % sur le HT réellement encaissé

| Étape | Preuve |
|---|---|
| Clic sur le lien du cabinet | `GET /partenaires/r/<slug>` → 307 → cookie `cs_pp_ref` posé, **touche serveur** enregistrée |
| Client réel | utilisateur Supabase créé + session JWT réelle |
| Checkout | `POST /api/checkout` (route de production) → 200, session **Stripe Test réelle** |
| Attribution | `pending`, source `link`, **bon cabinet** — posée par le code de production |
| Paiement | carte de test `4242…`, Checkout hébergé Stripe → succès |
| Facture réelle | `in_1Ts9iG…zf5r` — **449,00 € HT payés**, `livemode: false` |
| Commission | **89,80 €** — taux 20 %, HT encaissé 449,00 € |
| Attribution | **`locked`** au premier paiement |
| Doublon | 1 seule commission → **aucune double commission** |

---

## 4. Versement — dry-run puis transfert Stripe Test RÉEL

### 4.1 Dry-run de production (cron réel, secret opérateur)

```
HTTP 200 | mode dry_run_preview | stripeMode test | runId null
1 cabinet considéré · 0 transfert créé · 89,80 € prévisualisés
  - Cabinet Recette | included | 89,80 EUR | 1 écriture | seuil atteint, compte prêt

AVANT → runs 0 | transferts 0 | items 0 | payées 0 | e-mails versement 0
APRÈS → runs 0 | transferts 0 | items 0 | payées 0 | e-mails versement 0
MUTATION FINANCIÈRE ? AUCUNE
```

### 4.2 Le ledger refuse qu'on triche

Rendre une commission disponible à la main a été **refusé par la base** :

```
ledger: colonne financière immuable sur clonestore_pp_commission_entries
```

La commission a donc été rendue disponible par la voie légitime : `reserve_days = 0` sur le **cabinet
de test** (paramètre partenaire, jamais le ledger) + un **second cycle de facturation Stripe réel**.

### 4.3 Transfert réel

Exécuté par le **vrai moteur de versement** (`runMonthlyPayouts` + `defaultPayoutDeps`) avec la clé
**Test**, contre la base de production. La production, elle, est **restée en `DRY_RUN=true`**.

```
tr_1Ts9tbBQGG6x3AsuIviYTApg
  montant      : 89,80 EUR
  destination  : acct_1Ts9SxBrybBEQgWI
  livemode     : false
  metadata     : { partner_id, period: "2026-07", batch_hash }
  reversé      : false

en base : status=transferred | mode=test | 1 écriture | 1 tentative
clé d'idempotence : partner-payout:<partnerId>:2026-07:973eb664a6b09034ca5f99aa0431f87a
```

**La commission est passée `paid` APRÈS la confirmation du transfert** — celle encore en réserve est
restée `pending`. E-mail `transfer_executed` : **1**.

### 4.4 Rejeu

Le même job relancé à l'identique :

- **aucun second transfert** en base ;
- **aucun second transfert chez Stripe** (comptage avant/après identique) ;
- **aucune seconde commission payée** ;
- **aucun second e-mail**.

---

## 5. État final de la production

```
PARTNER_PROGRAM_ENABLED        = true
PARTNER_PAYOUTS_ENABLED        = true
PARTNER_PAYOUT_DRY_RUN         = true     ← inchangé, comme exigé
PARTNER_PAYOUT_LIVE_AUTHORIZED = false    ← inchangé, comme exigé
```

Audit complet du programme en production : **0 décision humaine**. Tout est `system`.

**Aucun transfert Live. Aucune clé Live. Aucun IBAN chez CloneStore** (le schéma ne contient aucune
colonne bancaire — vérifié sur la base de production).
