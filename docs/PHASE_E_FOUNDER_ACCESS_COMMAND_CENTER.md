# Phase E — Founder Access, Activation, Analytics & Command Center

Système commercial réel de CloneStore pour Pierre : réservation → confirmation email
→ qualification → activation Stripe → client actif, plus un cockpit interne privé
(Founder Command Center) entièrement fondé sur des données réelles.

## Principes non négociables

- **Aucune donnée simulée.** Ce qui n'est pas connecté affiche « Source non connectée » ;
  un zéro mesuré reste un zéro. Aucun revenu, client, visiteur ou conversion inventé.
- **Vérité serveur.** Un prospect ne devient client actif que sur preuve webhook Stripe.
  Le client ne fixe jamais le prix, le montant, la devise ou le statut.
- **Fail-closed.** Toute action sensible/interne échoue fermé si une condition manque
  (secret, base, configuration).
- **Append-only.** Funnel, audit, web_events et stripe_events sont append-only au niveau
  base (REVOKE + triggers), pas seulement par convention.
- **Vie privée.** Sessions anonymes, aucune IP brute persistée, métadonnées bornées,
  aucun fingerprinting invasif.

## Invariants commerciaux verrouillés

| Élément | Valeur |
|---|---|
| Lancement (ouverture activations) | 5 août 2026 |
| Fermeture accès fondateur | 31 août 2026 23:59 Europe/Paris |
| Prix Pierre | 449 € HT / mois (44900 centimes, EUR) |
| Conservation tarif | tant que l'abonnement reste continuellement actif |

La réservation ne déclenche aucun paiement et ne verrouille pas définitivement le tarif.
Le tarif fondateur est conservé lorsque l'abonnement est **activé** avant la fermeture.

## Sous-systèmes

| Bloc | Doc |
|---|---|
| Sécurité (owner gate, cookies, append-only, rate limit) | [architecture/FOUNDER_ACCESS_SECURITY.md](architecture/FOUNDER_ACCESS_SECURITY.md) |
| Automatisation email (file, worker, séquence) | [architecture/FOUNDER_EMAIL_AUTOMATION.md](architecture/FOUNDER_EMAIL_AUTOMATION.md) |
| Activation & vérité Stripe | [architecture/FOUNDER_STRIPE_ACTIVATION.md](architecture/FOUNDER_STRIPE_ACTIVATION.md) |
| Analytics first-party, présence, funnel | [architecture/FOUNDER_ANALYTICS.md](architecture/FOUNDER_ANALYTICS.md) |
| Exploitation du cockpit | [operator/FOUNDER_COMMAND_CENTER_RUNBOOK.md](operator/FOUNDER_COMMAND_CENTER_RUNBOOK.md) |

## Migrations (ordre lexical réel)

```
supabase/migrations/2026-06-19__clonestore_founder_access.sql
supabase/migrations/2026-06-19__clonestore_founder_access_hardening.sql
supabase/migrations/2026-06-20__clonestore_founder_email_queue.sql
supabase/migrations/2026-06-21__clonestore_founder_activation.sql
```

Les tables Founder Access vivent dans le **Postgres runtime** (`getRuntimeDb` /
`DATABASE_URL`), non exposées via l'API REST Supabase : un navigateur ne peut pas les
lire. RLS forcée + grants restreints à `pierre_rt_app` = couche secondaire.

Application locale (PGlite) : `npm run check:phase-e-migrations`.
Application production (manuelle, opérateur) :
`MIGRATIONS_FILTER=clonestore_founder DATABASE_URL=... npm run db:migrate:pg`.

## Variables d'environnement

Voir [operator/FOUNDER_COMMAND_CENTER_RUNBOOK.md](operator/FOUNDER_COMMAND_CENTER_RUNBOOK.md).
Aucune valeur réelle n'est committée. Sans configuration, chaque sous-système échoue
proprement (pas de faux succès).

## Tests

```
npm run test:phase-e                # unit + intégration Founder Access
npm run test:phase-e-hardening
npm run test:phase-e-owner-gate
npm run test:phase-e-email
npm run test:phase-e-stripe
npm run test:phase-e-analytics
npm run test:phase-e-command-center
npm run check:phase-e-migrations
```
