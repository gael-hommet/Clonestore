# Founder Command Center — Runbook opérateur

## Variables d'environnement (aucune valeur réelle ici)

| Variable | Rôle |
|---|---|
| `CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET` | HMAC du cookie de preuve de possession (étape 2). |
| `CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH` | Empreinte scrypt du mot de passe propriétaire. |
| `CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET` | HMAC du cookie de porte propriétaire. |
| `CLONESTORE_OWNER_COCKPIT_SLUG` | Slug secret de la route du cockpit. |
| `CLONESTORE_FOUNDER_EMAIL_LINK_SECRET` | HMAC des liens email (désinscription). |
| `CLONESTORE_FOUNDER_EMAIL_CRON_SECRET` | Secret du tick email (cron). |
| `CLONESTORE_PUBLIC_APP_URL` | URL publique pour liens absolus. |
| `CLONESTORE_OWNER_ADMIN_EMAILS` / `CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS` | Allowlist administrateur. |
| `CLONESTORE_IP_HASH_SALT` | Sel de hachage des IP (rate limit). |
| `RESEND_API_KEY` / `CLONESTORE_FOUNDER_EMAIL_FROM` | Envoi email réel. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_PIERRE` | Activation & revenus. |
| `STRIPE_PRODUCT_PIERRE` | (Optionnel) preuve produit explicite ; sinon prouvé par le Price ID. |
| `CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL` | (Recommandé prod) connexion dédiée du webhook, rôle membre de `clonestore_stripe_webhook_writer` (moindre privilège pour écrire le journal Stripe). |
| `CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET` | Secret HMAC des tokens de vérification (fail-closed prod si absent). |
| `CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET` | Secret HMAC de la session analytics serveur. |

Sans configuration, chaque sous-système échoue **proprement** (pas de faux succès).

## Mise en service

1. **Slug** : `node scripts/security/generate-owner-cockpit-slug.mjs` → coller dans
   `CLONESTORE_OWNER_COCKPIT_SLUG`.
2. **Mot de passe** : `node scripts/security/hash-owner-cockpit-password.mjs` (saisie
   masquée) → coller l'empreinte dans `CLONESTORE_OWNER_COCKPIT_PASSWORD_HASH`.
3. **Secrets cookies** : générer des secrets aléatoires forts pour
   `CLONESTORE_OWNER_COCKPIT_COOKIE_SECRET` et `CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET`.
4. **Migrations** (manuel, jamais auto en prod) :
   `MIGRATIONS_FILTER=clonestore_founder DATABASE_URL=... npm run db:migrate:pg`.
   Vérification post-migration locale : `npm run check:phase-e-migrations`.
5. **Resend / Stripe** : configurer les clés ; tester le webhook avec la Stripe CLI.
6. **Cron email** : planifier un appel régulier de
   `POST /api/internal/founder-access/email-tick` avec l'en-tête
   `x-cron-secret: <CLONESTORE_FOUNDER_EMAIL_CRON_SECRET>`.

## Accès au cockpit

URL : `/internal/<CLONESTORE_OWNER_COCKPIT_SLUG>/command-center`.
Saisir le mot de passe propriétaire (écran sobre, aucune donnée préchargée), puis être
connecté avec un email de l'allowlist. **Verrouiller le cockpit** : bouton « Verrouiller »
(efface le cookie de porte). Mauvais slug → 404. Non-allowlisté → 404.

## Sections

Vue d'ensemble · Revenus (Stripe webhook) · Prospects (filtres, table, détail, actions
gouvernées, export CSV) · Clients actifs · Funnel · Acquisition · Présence (estimation) ·
Emails (file, prochains envois, erreurs, tick manuel gouverné) · Alertes · Sources/fraîcheur.

## Diagnostic

- **Emails bloqués** : onglet Emails → statuts pending/sending/dead, dernières erreurs.
  « Lancer un tick » draine la file (gouverné, audité). Jobs `dead` = échec définitif à
  inspecter.
- **Paiements** : onglet Revenus → si « Source non connectée », vérifier
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`. Onglet Alertes liste les manques.
- **Présence vide** : trafic réel requis ; « Rafraîchir » relit la fenêtre.
- **Rotation des secrets** : régénérer le hash/slug/secrets, redéployer ; les cookies
  existants deviennent invalides (re-login requis). 
- **Rollback migration** : les migrations sont additives et idempotentes ; en cas de
  besoin, restaurer depuis une sauvegarde Postgres (aucune suppression destructive
  effectuée par les migrations Founder Access).

## Garde-fous

Aucune simulation d'envoi, aucun revenu inventé, aucune donnée prospect/client publique,
aucun secret dans le code ou les réponses, aucune URL secrète utilisée comme seule
sécurité.
