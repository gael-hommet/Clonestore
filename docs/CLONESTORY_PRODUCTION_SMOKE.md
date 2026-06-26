# CloneStory — Smoke E2E production contrôlé (CS-FINAL 4)

> **STATUT (2026-06-26) : NON EXÉCUTÉ — différé.** Le déploiement, les routes, les crons, la
> santé et l'intégrité sont validés en production, mais le **smoke commercial complet
> (paiement → contribution → trophée) n'a pas été lancé** (décision). Le **premier client
> réel/contrôlé** servira de preuve E2E commerciale finale. Tant qu'il n'a pas eu lieu, ne
> jamais écrire « CLONESTORY PRODUCTION E2E PASSED ». Prérequis pour le lancer : activer
> temporairement `CLONESTORY_FF_COMMERCIAL_BRIDGE` (+ `AUTO_VERIFICATION` ou délai à 0), puis
> **restaurer** les flags/délai à l'état sécurisé après le test.

Prouve le cycle complet en production avec **Stripe TEST** (aucun argent réel) sur la route
production. Données préfixées `Smoke-CS4-<timestamp>`. **Un seul checkpoint humain à la fois.**

## Prérequis (préflight vert)
- `_05/_06/_07/_08` appliquées en prod ; code déployé ; crons OK ; Resend OK ; inscriptions fermées.
- Environnement : `CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS=0` **temporairement** pour permettre la
  vérification immédiate pendant le smoke (à restaurer après).
- Boîtes email réelles contrôlées (partenaire A, prospect B).

## Parcours (avec checkpoints 👤 = action humaine indispensable)
1. Partenaire A vérifié (ou inscription contrôlée dans une fenêtre flag ouverte puis refermée).
2. A fait une **introduction** de B (entreprise test) → email de confirmation à B (outbox).
3. 👤 B ouvre le lien → **page intermédiaire** → clique « Oui, je confirme » (POST). → `prospect_confirmed`.
4. B crée un **compte CloneStore** (même email) → attribution liée (`account_linked`/`company_linked`).
5. B lance le **checkout Stripe TEST** du produit Pierre.
6. 👤 B complète le paiement test (carte test Stripe) → abonnement créé (essai) puis **première facture payée**.
7. Webhook signé `invoice.paid` → contribution `purchase_captured` → `activation_completed` → `validation_pending`.
8. Réconciliation (cron/admin) → `verified` (délai=0) → **registry_number** alloué → distinction **first_client**.
9. Vérifier le **cockpit** de A (`/profile`) : Clients payés ≥ 1, Contributions vérifiées ≥ 1, distinction visible.
10. Vérifier l'**admin** : contribution `verified`, audit présent.
11. 👤 Vérifier la **réception réelle** des emails (confirmation B, vérifié A).
12. (Optionnel) Remboursement test sur une 2ᵉ contribution → `refunded`, distinction recalculée (rollback métier prouvé).

## Preuves à consigner (SANS secret)
- `stripe_event_id` (masqué), statut ledger, `contribution_id` (masqué), transitions + timestamps,
  `provider_message_id` (masqué), `registry_number`, distinction, compteurs avant/après. Aucune donnée bancaire.

## Après le smoke
- Restaurer `CLONESTORY_CONTRIBUTION_VALIDATION_DELAY_MS` (ex. 7 jours).
- Inscriptions **fermées**. Données smoke conservées, marquées test (aucun DELETE).
- `GET /health` → aucune alerte.

## Verdicts attendus
`SMOKE-CS4 PARTNER FLOW OK` · `PAYMENT CAPTURED (TEST)` · `CONTRIBUTION VERIFIED` ·
`REGISTRY NUMBER ALLOCATED` · `FIRST_CLIENT DISTINCTION GRANTED` · `EMAILS RECEIVED` ·
`REGISTRATIONS CLOSED` · `CLONESTORY PRODUCTION E2E PASSED`.
