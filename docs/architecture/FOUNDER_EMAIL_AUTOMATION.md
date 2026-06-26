# Founder Access — Automatisation email

## File de jobs (`clonestore_founder_email_jobs`)

Clé idempotente `job_key = reservation_id:kind` (unique) → un seul job par
(réservation × type). États : `pending → sending → sent | failed | skipped | dead`.
Colonnes worker : `locked_at`, `locked_by`, `attempts`, `next_attempt_at`, `last_error`,
`provider_message_id`, `sent_at`, `skipped_at`, `skip_reason`.

## Worker (`src/lib/founder-access/email-worker.ts`)

`runEmailTick(db, provider, opts)` :

1. **Reprise des verrous périmés** — jobs `sending` dont `locked_at` > 15 min →
   remis `pending` (reprise après worker interrompu).
2. **Enfilement programmé** — `enqueueDueScheduledEmails` insère un job par réservation
   éligible pour chaque envoi dû (idempotent `on conflict do nothing`).
3. **Claim atomique** — `update ... where id in (select ... for update skip locked)` :
   `pending → sending`, `attempts++`. Empêche le double traitement entre instances.
4. **Traitement** par job :
   - vérification : ré-émet un **token frais** à l'envoi (seul le hash est stocké, le
     worker ne peut pas reconstruire l'ancien token), met à jour le hash, envoie ;
   - skip si réservation absente, désinscrite, déjà confirmée (vérification), non
     confirmée ou client actif (relances) — `skip_reason` renseigné ;
   - succès → `sent` + `provider_message_id` ; échec → retry exponentiel
     (`next_attempt_at`, `send_at` repoussés) jusqu'à `MAX_ATTEMPTS=5`, puis `dead`.

Un job `dead` ne revient jamais en `pending` automatiquement.

## Déclenchement

- **Cron** : `POST /api/internal/founder-access/email-tick`, secret
  `CLONESTORE_FOUNDER_EMAIL_CRON_SECRET` comparé en temps constant. En production sans
  Resend → 503 explicite (jamais de faux envoi).
- **Cockpit** (manuel, gouverné) : `POST /api/internal/founder-access/email-run`, protégé
  par porte + session + allowlist (aucun secret cron requis), audité.

## Fournisseur

`resolveFounderEmailProvider()` : Resend en production via `RESEND_API_KEY`, mode local
explicite en dev. **Throw en production sans clé** — aucun faux succès. Worker accepte un
provider injecté (tests).

## Resend / Unsubscribe

- `POST /api/founder-access/resend-verification` — réponse uniforme `{ ok: true }`, ne
  révèle jamais si l'adresse existe ou est déjà confirmée. Rate-limité.
- `GET|POST /api/founder-access/unsubscribe?rid&token` — jeton HMAC stable
  (`mailing-links.ts`). Idempotent : statut `unsubscribed`, jobs en attente annulés.
  Une réservation désinscrite ne reçoit plus aucun email.

## Séquence (heure de Paris)

immédiat (vérification) · 17/07 J-5 · 20/07 J-2 · 21/07 J-1 · 22/07 ouverture ·
24/07 suivi · 17/08 J-14 · 26/08 J-5 · 30/08 J-1 · 31/08 fermeture.
Relances : destinataire confirmé requis, client actif exclu, jamais de double envoi.

## URLs

Liens absolus construits depuis `CLONESTORE_PUBLIC_APP_URL`. Aucun secret côté client.

## E-R2 — token déterministe & idempotence réelle

- **Token de vérification non exploitable au repos** (`token.ts`
  `deterministicVerificationToken`) : HMAC(secret, `v{version}:{reservationId}`). Reconstruit
  par le serveur à chaque retry — **jamais stocké en clair** (la colonne `verification_token`
  reste NULL). Seul le hash SHA-256 vit sur la réservation ; la confirmation compare en temps
  constant. Un resend explicite **incrémente** `verification_token_version` → l'ancien lien
  devient invalide. Secret : `CLONESTORE_FOUNDER_EMAIL_TOKEN_SECRET` (fallback
  `…_EMAIL_LINK_SECRET`/`…_RESERVATION_COOKIE_SECRET`). **Fail-closed en production** : sans
  secret réel, aucun token n'est émis et le worker `skip` le job (`token_secret_missing`).
- **Idempotency key fournisseur** : `founder-email:<job_key>:<generation>` réellement
  transmise à Resend (`emails.send(payload, { idempotencyKey })`), stable entre retries
  (même `generation` = version), nouvelle au resend. Persistée :
  `provider_idempotency_key`, `provider_attempt_id`, `provider_message_id`,
  `last_provider_response_at`. Sémantique honnête : **at-least-once**.
