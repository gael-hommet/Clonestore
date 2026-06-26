# Founder Access — Analytics first-party, présence, funnel

Système interne, respectueux de la vie privée : session anonyme, aucune IP brute
persistée, aucun fingerprinting invasif, métadonnées bornées.

## Collecte

- Tracker client `PresencePing` (`src/components/founder/PresencePing.tsx`) : monté sur
  `/`, `/demo`, `/demo/pierre`, `/reserver/pierre`, `/activate/pierre`, `/checkout`.
  Session anonyme persistée en `sessionStorage` (`cs_anon_sid`), landing page, current
  path, referrer, UTM, device category, phase commerciale. Heartbeat ~45 s,
  `navigator.sendBeacon` (fallback `fetch keepalive`). Émet **une fois** un événement de
  page-vue au montage (pas de double comptage).
- Ingestion : `POST /api/founder-access/presence` → `upsertWebSession` (les champs
  d'origine — landing, referrer, UTM — ne sont posés qu'une fois) + `recordWebEvents`.
  Rate-limité, payload borné.

## Taxonomie (allowlist stricte)

`ANALYTICS_EVENTS` (web_events) et `FOUNDER_FUNNEL_EVENTS` (funnel_events) sont des
listes blanches centralisées (`src/lib/founder-access/types.ts`). Un événement inconnu est
**ignoré** côté serveur (`isAnalyticsEvent`). Les événements de paiement proviennent
exclusivement du **webhook Stripe**, jamais du navigateur.

## Liaison session ↔ réservation

À la création d'une réservation, `anonymous_session_id` est rattaché à la réservation
(serveur). La liaison sert au funnel et à l'acquisition sans exposer l'email dans les
analytics. Un client ne peut pas rattacher arbitrairement sa session à une autre
réservation.

## Présence (`presenceSnapshot`)

Définition : `session en ligne = last_seen_at dans la fenêtre` (défaut 120 s). Toujours
présentée comme **estimation first-party** (`estimate: true`, fenêtre, timestamp).
Compteurs par page (/demo, /demo/pierre, /reserver, /activate, checkout). Fonctionne sans
Realtime (polling). Realtime exact non branché → affiché « non connecté » dans Sources.

## Funnel (`funnelSnapshot`)

Étapes mesurées : site → démo → fin démo → démo Pierre → fin démo Pierre → CTA →
formulaire → réservation → confirmation → activation → checkout → paiement. Pour chaque
étape : volume (sessions distinctes), conversion depuis l'étape précédente, conversion
depuis le sommet. Union de `web_events` + `founder_funnel_events`. Paiement = vérité Stripe.

## Acquisition (`acquisitionBreakdown`)

Sessions et réservations par `utm_source` (jointure session ↔ réservation), conversion.
Aucune donnée inventée ; sources absentes regroupées en `(direct)`.

## API interne

- `GET /api/internal/founder-access/analytics` → funnel + acquisition + présence + source
  + fraîcheur.
- `GET /api/internal/founder-access/presence` → présence.

Toutes protégées par porte + session + allowlist, `cache-control: private, no-store`.

## E-R2 — session serveur, cohorté temporel, homepage

- **Session analytics ÉMISE PAR LE SERVEUR** (`signed-cookie.ts` /
  `analytics-session.ts`) : UUID v4 aléatoire serveur, signé HMAC dans le cookie
  `cs_analytics_session` (HttpOnly, SameSite=Lax, Secure en prod, TTL 30 j). Les routes
  publiques (`presence`, `funnel`, `reservations`) lisent CETTE session validée et **ignorent
  tout id de session du corps** ; un cookie absent/falsifié ⇒ nouvelle session émise. La
  liaison réservation↔session utilise la session serveur. Secret :
  `CLONESTORE_FOUNDER_ANALYTICS_SESSION_SECRET`.
- **Sanitisation centrale unique** : `sanitizeClientAnalyticsPayload` (privacy.ts) appliquée
  sur toutes les routes analytics (plus de `str()` brut). Aucune PII persistée.
- **Funnel cohorté TEMPOREL** : une session ne franchit l'étape k que si toutes les étapes
  1..k ont une **première occurrence** en ordre non décroissant. Cohorte = sessions
  `site_viewed`. Conversions depuis le sommet bornées ≤ 100 %. Les événements serveur sans
  session (paiement) sont hors cohorté (voir funnel événementiel).
- **Présence homepage** : `on_homepage` = `current_path = '/'` (chemin exact, pas tout `/…`).
