# Founder Access — Sécurité

## Cockpit : route réellement dynamique au slug secret

`src/app/internal/[slug]/command-center/page.tsx`

Ordre des contrôles (**fail-closed**, aucune donnée chargée avant la fin) :

1. **Slug** — `params.slug` doit exister et correspondre exactement à
   `CLONESTORE_OWNER_COCKPIT_SLUG`. Sinon `notFound()` (404 indistinct).
2. **Porte propriétaire** — cookie signé `cs_owner_gate`. Si la porte est configurée et
   non déverrouillée → écran `OwnerGate`, **aucun appel base**.
3. **Session Supabase** — sinon `redirect('/login')`.
4. **Allowlist** — email ∈ `CLONESTORE_OWNER_ADMIN_EMAILS` / `CLONESTORE_FOUNDER_ACCESS_ADMIN_EMAILS`,
   sinon `notFound()`.
5. **Données** — uniquement après 1→4.

L'ancien chemin statique `/internal/founder-command-center` a été **supprimé** : il
renvoie 404. La sécurité réelle = session + allowlist ; le slug et la porte sont des
couches d'obscurité/protection supplémentaires.

`metadata.robots = { index: false, follow: false }` ; réponses internes en
`cache-control: private, no-store`.

## Porte propriétaire (mot de passe)

- Hash **scrypt** + sel aléatoire (`src/lib/founder-access/owner-gate.ts`), jamais le mot
  de passe en clair. Comparaison en temps constant (`timingSafeEqual`).
- Génération du hash : `node scripts/security/hash-owner-cockpit-password.mjs`
  (saisie masquée, n'affiche que l'empreinte). Slug : `node scripts/security/generate-owner-cockpit-slug.mjs`.
- Route `POST /api/internal/owner-gate/unlock` (fail-closed) :
  1. configuration complète requise (`isOwnerGateConfigured`) sinon refus ;
  2. **base indispensable** : DB indisponible → 503 (l'anti-bruteforce ne peut pas
     s'appliquer, donc accès refusé) ;
  3. anti-bruteforce distribué : 5 tentatives / 15 min par IP hashée ;
  4. **slug obligatoire et exact** (jamais d'autorisation implicite via `slug && ...`) ;
  5. mot de passe vérifié en temps constant ;
  6. message générique « Accès refusé » — ne révèle jamais quel contrôle a échoué.
- Cookie `cs_owner_gate` : HttpOnly, Secure en prod, SameSite=Strict, durée 12 h max,
  signé HMAC. `POST /api/internal/owner-gate/lock` l'efface (`Max-Age=0`).

## Preuve de possession (qualification étape 2)

`POST /api/founder-access/reservations/:id/qualification` n'est pas protégé par le seul
UUID. Après l'étape 1, un cookie signé `cs_founder_reservation` (HttpOnly, SameSite=Lax,
HMAC, lié à l'id, TTL 2 h) est posé. La route exige ce cookie lié à **cette** réservation :
toute tentative sur une autre réservation, sans cookie ou avec un cookie falsifié/expiré
est refusée (403). Échec fermé si le secret n'est pas configuré.

## Append-only structurel

`clonestore_founder_funnel_events`, `clonestore_founder_admin_audit`,
`clonestore_web_events`, `clonestore_founder_stripe_events` :
`REVOKE update, delete` du rôle applicatif **et** triggers `before update or delete`
qui lèvent une exception. Vérifié par tests d'intégration et `check:phase-e-migrations`.

## Rate limiting distribué

`distributedRateLimit(db, key, max, windowMs)` : compteur partagé en table
`clonestore_rate_limits`, fenêtre fixe, incrément atomique `insert ... on conflict do
update`. Clé hashée (aucune IP brute). Le limiteur mémoire ne sert que de fallback de
dev. Couvre : réservation, qualification, resend, présence, unlock propriétaire, etc.
`Retry-After` renvoyé sur 429.

## Ce qui n'est jamais exposé

Secrets, tokens, hash, IP brute, payload Stripe complet, service role, erreurs internes
brutes. Les identifiants d'abonnement Stripe sont masqués (`sub_1234567…abcd`).

## E-R2 — fermeture sécurité

- **Journal Stripe non falsifiable par le rôle applicatif général** : la fonction
  d'écriture (`clonestore_record_founder_stripe_event`, SECURITY DEFINER, search_path fixe,
  payload validé/allowlisté) n'est EXECUTE que pour `clonestore_stripe_webhook_writer` ;
  `pierre_rt_app` n'a ni INSERT, ni UPDATE, ni DELETE, ni EXECUTE (vérifié par `SET ROLE`).
  Le webhook utilise une connexion dédiée (`getStripeWebhookDb`).
- **Preuve commerciale Stripe complète** (Price ID/produit/montant/devise/intervalle/livemode
  tous obligatoires pour accorder l'accès) ; statut inconnu fail-closed ; ordre déterministe ;
  transaction atomique. Voir [FOUNDER_STRIPE_ACTIVATION.md](FOUNDER_STRIPE_ACTIVATION.md).
- **Token de vérification non exploitable depuis un dump DB** (HMAC déterministe, jamais en
  clair, fail-closed prod sans secret). Voir [FOUNDER_EMAIL_AUTOMATION.md](FOUNDER_EMAIL_AUTOMATION.md).
- **Session analytics émise par le serveur** (cookie signé) ; tout id de session du corps est
  ignoré. Voir [FOUNDER_ANALYTICS.md](FOUNDER_ANALYTICS.md).
