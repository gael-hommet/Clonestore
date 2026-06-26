# CloneStory — Runbook d'incident

Principe : **le checkout CloneStore ne doit jamais être bloqué par CloneStory.** Le pont
commercial est best-effort ; en cas de doute, couper le flag concerné (sans redéploiement).

## Diagnostic rapide
`GET /api/internal/clonestory/health` → `alerts`. Logs structurés : table
`clonestory_fp_observability_events` (level `warn`/`error`, sans PII/secret).

## Scénarios

### Base CloneStory indisponible pendant un webhook Stripe
- Effet : le pont commercial échoue silencieusement (best-effort) ; l'ordre CloneStore (Supabase REST) reste intact.
- Action : restaurer la base ; **réconcilier** (`reconcile_commercial`) — re-traite les `validation_pending`.
- Limite : un event perdu *avant* écriture du ledger n'est pas rejouable sans re-pull Stripe.

### Resend indisponible / clé invalide / domaine non vérifié
- Effet : emails en `failed_retryable` puis `dead` après 6 tentatives (aucune perte de compte/intro — l'outbox conserve la commande).
- Action : corriger Resend (clé/domaine) → action admin `replay_emails` (re-arme `dead`, même idempotency_key → pas de double envoi).

### Stripe rejoue un événement
- Idempotent par `stripe_event_id` (ledger) → aucun double effet. Rien à faire.

### Cron arrêté / job absent
- Effet : backlog outbox grandit (`/health` → `*Backlog`). 
- Action : réinstaller le job Supabase Cron (Vault + SQL) ; déclencher manuellement `POST /api/cron/clonestory-{outbox,commercial-outbox,notifications}` (Bearer).

### Event Stripe en échec (`processing_result='failed'`)
- Action : `reconcile_commercial` ; inspecter `clonestory_fp_stripe_events` (sans secret). Si données incohérentes → action admin `invalidate_contribution` (raison + audit).

### Migration appliquée mais code pas déployé (ou l'inverse)
- **Migration avant code** (ordre correct) : OK, le code antérieur ignore les nouvelles tables.
- **Code avant migration** (INTERDIT) : `createIntroduction`/`verify` échoueraient (table absente). 
  Mitigation immédiate : redéployer la version antérieure OU appliquer `_08` d'urgence. Respecter l'ordre.

### Litige / chargeback en masse
- Suspendre la vérification auto : `CLONESTORY_FF_AUTO_VERIFICATION=off`. Traiter les disputes (le ledger gère won→restauré / lost→refunded). Réactiver après.

## Rollback
- Code : redéploiement version N-1.
- `_08` : voir en-tête de la migration (drop tables + drop columns ; non destructif des données métier _01.._07).
- Kill-switch immédiat : `CLONESTORY_FF_*=off`.

## Re-fermeture d'urgence
Si une anomalie critique survient pendant une fenêtre d'inscription ouverte :
`CLONESTORY_REGISTRATION_OPEN=false` (Vercel) → `/api/founding-partners/register` renvoie 503, zéro écriture.
