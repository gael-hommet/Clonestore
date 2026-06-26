# CS-FINAL 3 — Contribution commerciale vérifiée

Transforme une attribution durable (compte/entreprise → partenaire fondateur) en
**contribution commerciale prouvée** par une source serveur autoritative :

```
attribution → commande → paiement Stripe signé → activation produit → validation → vérifiée
```

> N'invente **aucune** commission, **aucun** payout, **aucun** crédit. Les avantages
> financiers/commissions restent une couche ultérieure séparée. Montants en **unités
> mineures entières** (centimes) — aucun float financier.

## 1. Audit Stripe / checkout
- Checkout = `stripe.checkout.sessions.create`, **`mode: "subscription"`**, `trial_period_days: 7`
  (`src/app/api/checkout/route.ts`). Metadata portée sur session **et** abonnement :
  `user_id`, `agent_slug` (+ `founder_reservation_id`/conversion optionnels). **Pas** de
  `client_reference_id`, **pas** d'`order_id`, **pas** de société.
- Stripe en **mode test** (`sk_test_…`). Seul **pierre** est réellement vendable (449 €/mois,
  garde `EXPECTED_PIERRE_PRICE_AMOUNT = 44900`).

## 2. Audit commandes
- Table réelle `public.orders` (Supabase REST — **aucune** migration repo ; gérée côté cloud),
  clé d'upsert `(user_id, agent_slug)` → **une ligne par (utilisateur, agent)**, pas par achat.
  Colonnes : `user_id, agent_slug, status, stripe_subscription_id, stripe_customer_id,
  started_at, ended_at`. **Aucun** montant/devise/session/PI/colonne entreprise.
- RLS : SELECT propre ligne pour `authenticated` ; écritures `service_role` seulement.
- ⚠️ `/api/orders/activate` est **non authentifiée et falsifiable** → la vérité du paiement
  **n'est jamais** lue depuis `orders.status`, mais depuis le **webhook Stripe signé**.

## 3. Audit activation
- Le seul moment serveur-autoritatif d'accès produit = `orders.status ∈ {active, trialing}`
  écrit par le **webhook** (`checkout.session.completed`). Pas d'état « activation terminée »
  distinct côté CloneStore. Pas de tenant/`pierre_rt_companies` créé à l'activation (absent en prod).

## 4. Source de vérité retenue (verrouillée)
| Signal | Décision |
|---|---|
| `invoice.paid` (montant payé > 0) | **`purchase_captured`** — paiement réel capturé |
| `checkout.session.completed` (essai, montant 0) | `activation_pending` — accès essai, **aucun** argent |
| `checkout.session.completed` payé (montant > 0, hors essai) | capture directe |
| accès produit confirmé après paiement | `activation_completed` |
| contrôles incomplets / fenêtre de sécurité ouverte | `validation_pending` |
| toutes preuves satisfaites + délai écoulé | `verified` |
| remboursement total / litige perdu | `refunded` |
| litige ouvert | `disputed` |
| annulation avant capture / session expirée | `canceled` |

**Décision documentée (modèle abonnement + essai 7 j)** : l'accès (activation) précède le
1ᵉʳ paiement réel. Le signal de PAIEMENT autoritatif est donc **`invoice.paid` (montant > 0)**,
jamais `checkout.session.completed`. L'introduction ne progresse vers `purchase_captured`
qu'au paiement réel ; l'état `activation_pending` (essai) ne compte **pas** comme contribution.

## 5. Architecture commerciale
- **Modèle** (migration `_07`) : `clonestory_fp_commercial_contributions` (état autoritatif,
  une par abonnement) + `clonestory_fp_commercial_events` (append-only) +
  `clonestory_fp_stripe_events` (ledger d'idempotence) + `clonestory_fp_commercial_outbox`
  (notifications, **isolée** de l'outbox de vérification).
- **Moteur** : `server/commercial.ts` — machine d'états, capture/activation/vérification,
  remboursement/litige, promotion `registry_number` atomique, distinctions, réconciliation, outbox.
- **Pont webhook** : `server/stripe-commercial-bridge.ts`, branché **additivement** sur le
  webhook canonique `src/app/api/webhooks/stripe/route.ts` (best-effort, jamais bloquant).

## 6–7. Fichiers
**Créés** : `migrations/2026-06-26_07__…`, `server/commercial.ts`, `server/commercial-emails.ts`,
`server/stripe-commercial-bridge.ts`, `app/api/cron/clonestory-commercial-outbox/route.ts`,
`supabase/sql/clonestory_commercial_outbox_supabase_cron.sql`,
`__integration__/commercial.itest.ts`, `__integration__/commercial-webhook.itest.ts`,
`profile/__tests__/cs-final-3-commercial.test.ts`, ce document.
**Modifiés** : `app/api/webhooks/stripe/route.ts` (pont), `server/config.ts` (délai/seuil/produits/secret),
`server/cockpit.ts` (stats commerciales + repli), `server/admin-store.ts` + `api/.../admin/action/route.ts`
(contrat admin), `profile/_ui/CloneStoryCockpitCard.tsx` (tuiles honnêtes).

## 8. Migration `_07`
Additive, idempotente, PostgreSQL 17 / PGlite, RLS **forcée**, événements **append-only**
(trigger partagé `clonestory_forbid_mutation`), aucun DELETE, montants `bigint`, unicité par
abonnement et par event Stripe, rollback documenté. Ordre **`_05 → _06 → _07`**.

## 9. Audit final `_05`/`_06`
Inchangées et cohérentes : `_05` (`account_user_id` UNIQUE, catalogue distinctions seedé dont
`first_client/builder_5/ambassador_10/founding_partner`, `clonestory_fp_partner_awards`
révocable) ; `_06` (attribution unifiée, statuts d'introduction `purchase_captured → verified`
déjà définis, `registry_number` sur partenaires). Aucune correction nécessaire.

## 10. Événements Stripe supportés
`checkout.session.completed`, `invoice.paid`/`invoice.payment_succeeded`, `charge.refunded`
(cumul absolu), `charge.dispute.created`, `charge.dispute.closed`, `checkout.session.expired`,
`customer.subscription.deleted`. Tous les autres → ignorés proprement.

## 11. Idempotence webhook
Ledger `clonestory_fp_stripe_events` (`stripe_event_id` **unique**) : insert `on conflict do
nothing` → rejeu Stripe = `duplicate`, **aucun double effet**. Contribution **unique par
abonnement**. Remboursement traité en **montant absolu cumulé** (`max`) → sûr en cas de rejeu
ou d'événements hors ordre.

## 12. Modèle de contribution
États : `activation_pending → purchase_captured → activation_completed → validation_pending →
verified` ; exceptions terminales `refunded`, `canceled`, `disputed`, `invalidated`.
`verified_active` (booléen) = compte pour les distinctions uniquement si **vérifiée ET active**.

## 13–15. Liaisons
- **Commande** : `order_ref = "<user_id>:<agent_slug>"` + `stripe_subscription_id` (identité réelle).
  Jamais un e-mail du navigateur comme preuve principale.
- **Attribution** : résolue par `account_user_id` (= `user_id` Stripe metadata) → partenaire.
  Aucune attribution → **aucune** contribution (la commande CloneStore reste valide).
- **Entreprise** : `company_id`/`company_fingerprint` repris de l'attribution (`_06`).

## 16. Activation
`activation_completed` = accès confirmé actif après paiement (signal webhook serveur,
idempotent, lié à l'abonnement). Démarre ensuite `validation_pending`.

## 17. Validation
Conditions minimales (toutes déterministes) : paiement autoritatif, attribution active,
partenaire éligible, montant net > 0, devise présente, produit éligible, pas de
remboursement/litige/conflit, compte cohérent, **délai de sécurité écoulé**. Sinon
`validation_pending` (réconciliation/admin). Jamais d'hypothèse transformée en `verified`.
Délai par défaut **7 jours** (`CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS`, configurable).

## 18. registry_number
Alloué **atomiquement** (verrou `pg_advisory_xact_lock` + index unique partiel en filet) à la
**1ʳᵉ contribution vérifiée**. **Permanent** : jamais réutilisé ni supprimé, même après retrait.
Statut/distinction `founding_partner` permanents (doctrine honorifique).

## 19. Distinctions
Comptées sur les contributions **vérifiées actives** uniquement : `first_client` (≥1),
`builder_5` (≥5), `ambassador_10` (≥10). **Révocables** si un remboursement/litige fait passer
sous le seuil. Jamais comptées : prospect, compte, checkout, paiement échoué, remboursée, disputée.
Persistées dans `clonestory_fp_partner_awards` (`revoked_at`, jamais de DELETE).

## 20. Emails / outbox
Outbox **dédiée** `clonestory_fp_commercial_outbox` (idempotency_key unique, `FOR UPDATE SKIP
LOCKED`, backoff exponentiel → `dead`, `provider_message_id`, `last_error`). Worker
`processCommercialOutbox`, cron protégé `/api/cron/clonestory-commercial-outbox` (Bearer,
fail-closed) + `supabase/sql/clonestory_commercial_outbox_supabase_cron.sql`. Aucun
`try/catch {}` silencieux, aucun double envoi. **Aucune** promesse financière.

## 21. Remboursement
Total → `refunded`, `net_amount = 0`, retrait du compteur actif, distinctions recalculées,
historique conservé. Partiel < **50 %** (`CLONESTORY_PARTIAL_REFUND_REVIEW_PCT`) → conservé
(net ajusté) ; ≥ seuil → `validation_pending` (revue). Règle documentée, configurable.

## 22. Litiges
`charge.dispute.created` → `disputed` (validation suspendue, `verified_active=false`, prior
status mémorisé). `charge.dispute.closed` gagné → **restauré** au statut antérieur ; perdu →
`refunded`. Aucun effacement.

## 23. Réconciliation
`reconcileCommercial` (idempotente, non destructive, observable) : vérifie les
`validation_pending` échus dont toutes les preuves sont satisfaites. Action admin
`reconcile_commercial`. (Limite : un événement perdu *avant* écriture du ledger n'est pas
rejouable sans re-pull Stripe — voir Limites.)

## 24. Cockpit / registre
Stats réelles, libellés honnêtes : Introductions · Prospects confirmés · Comptes créés ·
Entreprises créées · **Clients payés · Activations · En validation · Contributions vérifiées**
· (Remboursées/En litige si > 0) · Distinctions. Le partenaire ne voit **jamais** : carte,
PaymentIntent, secret, metadata interne, IP, fingerprint, antifraude, e-mail complet. Repli
gracieux si `_07` non activée (stats d'introduction).

## 25. RLS
Tables commerciales : RLS **forcée**, politiques GUC. Ledger Stripe + outbox = **service
seulement**. Contributions + événements = service complet **ou** partenaire lit ses propres
lignes (jamais le prospect, jamais un autre partenaire). Le navigateur ne peut **jamais** créer
`purchase_captured` : seul le webhook signé est autoritatif.

## 26. Résultats des tests
- `__integration__/commercial.itest.ts` : **27** (idempotence, paiement, activation,
  vérification+délai, registry, distinctions 5/10, remboursement/annulation/litige, hors ordre,
  RLS, append-only, réconciliation, outbox, stats).
- `__integration__/commercial-webhook.itest.ts` : **3** (signature obligatoire, autorité du
  webhook signé, idempotence du rejeu).
- `profile/__tests__/cs-final-3-commercial.test.ts` : **14** (source de vérité, modèle bigint,
  RLS forcée, append-only, no DELETE, registry atomique, cron fail-closed, additif, admin, config, cockpit).

## 27. TypeScript / build / scanner secrets
`tsc --noEmit` OK ; build OK ; aucun secret en clair dans les modules commerciaux.

## 28. Configuration externe requise
| Variable | Rôle | Défaut |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | signature webhook (existant) | — |
| `CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS` | délai avant `verified` | 7 jours |
| `CLONESTORY_PARTIAL_REFUND_REVIEW_PCT` | seuil revue remboursement partiel | 50 |
| `CLONESTORY_COMMERCIAL_CRON_SECRET` | secret cron outbox commerciale (repli OUTBOX/CRON) | — |

## 29. Procédure d'activation contrôlée (séparée — NON appliquée)
```bash
MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg   # _05 → _06 → _07
```
Puis (opérateur, Supabase SQL Editor) : Vault + `supabase/sql/clonestory_commercial_outbox_supabase_cron.sql`.
**Aucun changement du webhook Stripe distant n'est requis** (la route webhook est inchangée
côté Stripe). Sans `_07`, le moteur est **inerte** (le pont avale les erreurs) et le cockpit
retombe sur les stats d'introduction (repli gracieux) — le code est déployable tel quel.

## 30. Rollback
```sql
drop table if exists clonestory_fp_commercial_outbox;
drop table if exists clonestory_fp_commercial_events;
drop table if exists clonestory_fp_commercial_contributions;
drop table if exists clonestory_fp_stripe_events;
```

## 31. Matrice événement réel → transition
| Événement réel | Transition CloneStory |
|---|---|
| Paiement Stripe confirmé (`invoice.paid` > 0) | `purchase_captured` |
| Accès produit réellement actif | `activation_completed` |
| Contrôles incomplets / délai | `validation_pending` |
| Toutes preuves satisfaites | `verified` |
| Remboursement total | `refunded` |
| Chargeback | `disputed` |
| Annulation avant paiement | `canceled` |

## 32. Limites honnêtes
- Le pont commercial est **best-effort** : si la base CloneStory est **totalement** indisponible
  *avant* l'écriture du ledger, l'événement n'est pas rejouable côté CloneStory sans re-pull
  Stripe (la commande CloneStore principale reste, elle, intacte). Compromis assumé pour ne
  jamais casser le checkout.
- Pas d'entité « entreprise » persistée (héritage `_06`) : liaison par empreinte/`company_name`.
- Test mode uniquement ; aucun paiement réel, aucun webhook distant modifié, aucune migration
  prod appliquée, inscriptions fermées.

## 33. Transition vers le bloc final
**CS-FINAL 4 — Hardening final, administration complète, conformité, production E2E et
fermeture définitive de CloneStory** : durcissement (rate-limit/abus, observabilité,
alerting), console admin complète (revue contributions/litiges/réconciliation), conformité
(RGPD, mentions légales, rétention/anonymisation), répétition E2E production contrôlée
(paiement test réel → contribution vérifiée → distinction), et clôture définitive.
