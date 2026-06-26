# CloneStory — Activation production (runbook opérateur)

Ce document décrit les étapes RÉELLES pour ouvrir les inscriptions au Cercle des
Partenaires Fondateurs en production. Ces étapes utilisent des **secrets réels**,
appliquent une migration sur la **vraie base** et envoient de **vrais emails** :
elles sont réservées à l'opérateur (l'agent ne les exécute pas à votre place).

> Tant que ces étapes ne sont pas réalisées, les inscriptions restent **BLOQUÉES**
> (fail-closed). Le code est prêt : `npx tsc` 0, tests unitaires + intégration verts,
> build OK, RLS prouvée localement.

## 1. Générer et poser les secrets (jamais commités)

Deux secrets NOUVEAUX sont obligatoires (≥ 24 caractères forts) :

```bash
# Exemple de génération (à exécuter sur votre machine, ne pas partager les valeurs)
node -e "console.log('CLONESTORY_SESSION_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('CLONESTORY_COMPANY_SALT='   + require('crypto').randomBytes(48).toString('base64url'))"
```

Variables requises en production :

| Variable | Rôle |
|---|---|
| `CLONESTORY_SESSION_SECRET` | signature du cookie de session membre + révélation du lien |
| `CLONESTORY_COMPANY_SALT` | empreinte d'entreprise (déduplication, sans PII) |
| `DATABASE_URL` | Postgres runtime (rôle pouvant assumer `pierre_rt_app`) |
| `RESEND_API_KEY` | envoi des emails |
| `CLONESTORE_FOUNDER_EMAIL_FROM` | expéditeur réel (domaine vérifié Resend) |
| `CLONESTORY_OUTBOX_CRON_SECRET` *(ou `CRON_SECRET`)* | protège le déclencheur du worker d'outbox (§5) — **fail-closed** : sans secret, la route répond 503 |

Optionnel : `CLONESTORY_PUBLIC_BASE_URL` (défaut `NEXT_PUBLIC_SITE_URL` puis `https://clonestore.pro`) — base
des liens reconstruits par le worker hors requête HTTP.

Vérifier la présence (sans révéler les valeurs) :

```bash
npm run check:clonestory-readiness   # exit 0 = prêt, exit 1 = bloqué (détail booléen)
```

## 2. Appliquer la migration sur la vraie base

Idempotent, additif (aucune table existante modifiée/supprimée) :

```bash
MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
```

Tables créées : `clonestory_fp_partners`, `_introductions`, `_contribution_events`
(append-only), `_link_usage` (append-only), `_admin_audit` (append-only),
`_withdrawals`. RLS **forcée** + politiques GUC. Triggers append-only.

La migration `…_04__clonestory_fp_outbox_delivery.sql` (incluse dans le filtre
`clonestory_fp`, idempotente, additive) ajoute la **fiabilité de livraison** :
`verification_generation` sur les partenaires, et `generation` / `token_exp_ms` /
`locked_at` / `provider_message_id` + statuts (`pending`, `sending`, `sent`,
`failed_retryable`, `delivery_unknown`, `dead`, `superseded`) sur l'outbox email.

## 3. Vérifier réellement RLS

```bash
DATABASE_URL="<prod>" npm run check:clonestory-rls -- --pg
```

La preuve s'exécute dans une transaction **ROLLBACK** (aucune donnée persistée).
Elle prouve : isolation inter-membre, fail-closed sans GUC, append-only.

> Note : le rôle de connexion doit pouvoir `set local role pierre_rt_app`
> (superuser ou membre de `pierre_rt_app`). C'est le cas du déploiement existant.

## 4. Configurer Resend

- Domaine d'envoi vérifié (SPF/DKIM) correspondant à `CLONESTORE_FOUNDER_EMAIL_FROM`.
- `RESEND_API_KEY` posée. En production, sans clé, l'envoi est **fail-closed** (erreur explicite, jamais de faux succès).

## 5. Worker d'envoi des emails (outbox) — déclenchement après déploiement

L'envoi de l'email de vérification est **transactionnel + reprise garantie** : à
l'inscription, partenaire + commande d'envoi sont écrits dans une seule transaction
(aucun compte orphelin). Un envoi initial est tenté immédiatement « best-effort » ;
s'il échoue ou reste incertain, un **worker** reprend la commande.

**Déclencheur réel : Supabase Cron (pg_cron + pg_net).** Le projet est déployé sur
**Vercel Hobby**, qui n'autorise pas un cron « plusieurs fois par jour » — **plus aucun
cron ne subsiste dans `vercel.json`** (les deux déclencheurs sont portés par Supabase Pro :
`clonestory-outbox-every-5-minutes` ci-dessous et `founder-email-every-10-minutes`,
cf. runbook Phase E §6.1). Supabase appelle la route protégée (INCHANGÉE) toutes les 5 minutes.

Script opérateur : [`supabase/sql/clonestory_outbox_supabase_cron.sql`](../../supabase/sql/clonestory_outbox_supabase_cron.sql)
(hors `supabase/migrations/`, donc **jamais** appliqué par `npm run db:migrate:pg` —
à exécuter manuellement dans le SQL Editor Supabase). Il :

1. active `pg_cron` et `pg_net` si nécessaire (idempotent) ;
2. lit l'**URL** et le **secret** depuis **Supabase Vault** (jamais en clair dans le dépôt) ;
3. crée/rejoue **un seul** job `clonestory-outbox-every-5-minutes` (dé-planifie l'ancien par nom avant) ;
4. à chaque tick, `net.http_post` appelle `https://clonestore.pro/api/cron/clonestory-outbox`
   avec `Authorization: Bearer <secret>` — le secret est lu depuis Vault **à l'exécution**,
   il n'apparaît donc jamais dans `cron.job.command`.

Secrets Vault à créer une fois (placeholders dans le script) :
`clonestory_outbox_url` et `clonestory_outbox_cron_secret` (= `CLONESTORY_OUTBOX_CRON_SECRET`
posé côté Vercel, ou `CRON_SECRET`).

La route reste **fail-closed**, identique :

- aucun secret configuré (`CLONESTORY_OUTBOX_CRON_SECRET` ni `CRON_SECRET`) → **503**, jamais ouverte ;
- secret absent / erroné dans la requête → **401** (comparaison en temps constant) ;
- secret correct → traite un lot (`processVerificationOutbox`).

Déclenchement manuel (diagnostic) sans exposer le secret dans l'historique shell :

```bash
curl -fsS -X POST "https://clonestore.pro/api/cron/clonestory-outbox" \
  -H "Authorization: Bearer $CLONESTORY_OUTBOX_CRON_SECRET"
```

Contrôle des exécutions automatiques (requêtes opérateur en fin de script) :
`cron.job` (présence/état), `cron.job_run_details` (dernières exécutions + échecs),
`net._http_response` (codes HTTP renvoyés), et une requête qui affiche l'URL appelée
**sans** révéler le secret.

Garanties du worker (prouvées par `test:clonestory-bloc2` → `clonestory-outbox.itest.ts`) :

- **Réclamation concurrente sûre** : `FOR UPDATE SKIP LOCKED` + bail (`locked_at`) →
  deux workers simultanés ⇒ une seule prise en charge, jamais de double email logique.
- **Token stable par génération** : une reprise technique reconstruit et renvoie le
  **même lien** (HMAC stateless sur `partnerId+génération+expiration`, jamais stocké en clair) ;
  l'email déjà reçu reste valide.
- **Renvoi volontaire** = nouvelle génération (clé d'idempotence `csy-verification:<partnerId>:<génération>`) :
  l'ancien lien est révoqué, seul le nouveau est valide.
- **État incertain** (`sending` / `delivery_unknown`) : on **ne remplace jamais** le token ;
  reprise avec la même clé d'idempotence ; une ligne `sending` abandonnée (bail expiré)
  est récupérée sans invalider le lien.
- **Backoff + plafond** : après `max_attempts`, la commande passe `dead` (log d'alerte
  sans email complet ni token) — aucune boucle d'envoi infinie.

Logs : jamais d'email complet ni de token brut. Aucun secret n'est journalisé.

## 6. Déployer

Déployer la branche. **`devVerifyUrl` / `devConfirmUrl` ne sont JAMAIS exposés en
production** : ils dépendent de `CLONESTORY_LOCAL_PGLITE` ET de `NODE_ENV !== production`
(double garde). La base PGlite en process est également désactivée en production.

## 7. Smoke test réel (à réaliser par l'opérateur)

Avec deux vraies boîtes email contrôlées :

A. inscription `/founding-partners/join` avec une vraie adresse →
B. réception de l'email de vérification (déclenché par le worker §5 si l'envoi immédiat a échoué) →
C. clic du lien `/founding-partners/verify` →
D. ouverture de « Mon Registre » →
E. présence du lien (affiché une fois) + du code →
F. « Faire une introduction » vers une 2ᵉ vraie boîte →
G. réception de l'email prospect →
H. clic « Oui, je confirme » →
I. registre mis à jour (introduction confirmée + historique) →
J. contrôle admin `/founding-partners/admin` + inspection base →
K. test mobile.

## 8. Flag d'ouverture (décision opérateur explicite)

L'ouverture n'est JAMAIS déduite des secrets. Elle est commandée par une variable :

```
CLONESTORY_REGISTRATION_OPEN=false   # défaut — inscriptions fermées (503 contrôlé)
CLONESTORY_REGISTRATION_OPEN=true    # inscriptions ouvertes
```

Tant que `false` : la page principale affiche « Ouverture imminente du Cercle », le CTA
devient « Découvrir le Cercle », `/founding-partners/join` affiche un état fermé élégant,
et `POST /api/founding-partners/register` répond **503** sans créer aucun compte.

`npm run check:clonestory-readiness` affiche l'état (OUVERTES/FERMÉES) à titre informatif
— il n'entre pas dans le code de sortie (l'infra peut être prête alors que le flag reste à false).

## 9. Séquence d'ouverture (ordre impératif)

1. **Poser les secrets CloneStory** (§1) : `CLONESTORY_SESSION_SECRET`, `CLONESTORY_COMPANY_SALT`,
   `DATABASE_URL`, `RESEND_API_KEY`, `CLONESTORE_FOUNDER_EMAIL_FROM` (+ `npm run check:clonestory-readiness` → **exit 0**) ;
2. **Appliquer les migrations** `_01`, `_02`, `_03`, `_04` (§2) ;
3. **Vérifier la RLS production** : `check:clonestory-rls -- --pg` → **OK** (§3) ;
4. **Déployer avec `CLONESTORY_REGISTRATION_OPEN=false`** ;
5. **Créer les secrets de cron dans Supabase Vault** pour **les deux jobs** :
   - **A. `clonestory-outbox-every-5-minutes`** : `clonestory_outbox_url` + `clonestory_outbox_cron_secret`
     (= `CLONESTORY_OUTBOX_CRON_SECRET` côté Vercel, ou `CRON_SECRET`) (§5) ;
   - **B. `founder-email-every-10-minutes`** : `founder_email_cron_url` + `founder_email_cron_secret`
     (= `CRON_SECRET`) (runbook Phase E §6.1) ;
6. **Appliquer/configurer les jobs Supabase Cron** : exécuter
   [`supabase/sql/clonestory_outbox_supabase_cron.sql`](../../supabase/sql/clonestory_outbox_supabase_cron.sql)
   **et** [`supabase/sql/founder_email_supabase_cron.sql`](../../supabase/sql/founder_email_supabase_cron.sql) (§5) ;
7. **Appel manuel de contrôle** des deux routes : `curl` avec le secret → **HTTP 200** chacune (§5) ;
8. **Vérifier une exécution automatique** de chaque job dans `cron.job_run_details` (statut `succeeded`, §5) ;
9. **Smoke email A→K** contrôlé (deux boîtes, §7) ;
10. **Passer `CLONESTORY_REGISTRATION_OPEN=true`** (redémarrage/redéploiement) ;
11. **Inscription finale de contrôle**.

## 10. Verdict

- Secrets + readiness exit 0 + migrations + RLS OK + déploiement + **job Supabase Cron actif
  (HTTP 200 manuel + exécution auto `succeeded`)** + smoke A→K réussi, flag `false`
  ⇒ **CLONESTORY PRÊT — INSCRIPTIONS FERMÉES PAR FLAG**.
- Puis, après passage explicite du flag à `true` et inscription de contrôle réussie
  ⇒ **INSCRIPTIONS OUVERTES**.
