# Analytics Identity Contract v1

Quatre identités distinctes, jamais confondues. Implémenté par `src/lib/analytics/identity.ts`,
réutilisant le pattern HMAC-cookie déjà éprouvé par `founder-access/signed-cookie.ts` et
`clonestore/conversion/session.ts` (mêmes primitives, nouveau secret dédié
`CLONESTORE_ANALYTICS_SESSION_SECRET`, jamais partagé avec les identités existantes pour éviter
toute confusion inter-systèmes).

## `visitor_id`

- UUID v4, généré **serveur** à la première requête sans cookie valide.
- Jamais dérivé de l'IP, du user-agent, ou de toute combinaison d'en-têtes (aucun
  fingerprinting).
- Cookie `cs_visitor_id` : signé HMAC-SHA256, `HttpOnly`, `Secure` (prod), `SameSite=Lax`,
  `path=/`.
- Durée : **90 jours en test, configurable** — aucune durée de production n'est choisie ici,
  classée décision propriétaire/juridique (voir Politique de rétention). La constante
  `VISITOR_COOKIE_MAX_AGE_DAYS` est un unique point de configuration.
- Ne contient jamais d'email ni de `user_id`.

## `session_id`

- Nouvelle session si aucun cookie valide OU si la dernière activité connue dépasse
  **30 minutes** (aucune règle canonique préexistante trouvée dans le code lu ; valeur standard
  du secteur retenue par défaut, documentée comme telle, non présentée comme une décision
  définitive).
- Cookie `cs_session_id` : signé HMAC-SHA256, first-party, `HttpOnly`, `Secure` (prod),
  `SameSite=Lax`, rotation à chaque nouvelle session (jamais réutilisation d'un id expiré).
- Aucune confusion avec les cookies d'authentification Supabase — vérifié : ce cookie ne
  transporte jamais de jeton de session applicatif.

## `page_view_id`

- UUID v4, **un par navigation App Router réelle**.
- Généré côté client par le tracker (`AnalyticsPageViewTracker`), envoyé au serveur à
  l'ingestion — le serveur ne le régénère pas mais le valide (format UUID strict, rejeté sinon).
- Une seule vue par transition : garde anti-double-émission en React Strict Mode (`useRef`
  set-once), pas de double vue SSR + hydratation (le tracker ne s'exécute qu'après montage
  client, jamais pendant le rendu serveur).
- Comportement bfcache documenté : un retour arrière navigateur qui restaure la page depuis le
  cache (`pageshow` avec `event.persisted === true`) génère un **nouveau** `page_view_id` — c'est
  une navigation réelle du point de vue de l'utilisateur, elle doit compter.

## `demo_run_id`

- UUID v4, généré au commencement d'une exécution de démo (`/demo` ou `/demo/pierre`),
  **distinct de `session_id`** — une session peut contenir plusieurs `demo_run_id` (redémarrage
  explicite).
- Un `demo_type` (`"demo"` | `"demo_pierre"`) accompagne toujours le `demo_run_id` pour
  distinguer les deux surfaces.
- Réutilisé pour toute la durée d'une exécution ; un nouveau `demo_run_id` n'est émis que sur un
  redémarrage explicite (navigation fraîche vers `/demo`/`/demo/pierre`, pas un simple scroll).

## `user_id`

- Uniquement lorsque l'utilisateur est authentifié (Supabase `auth.uid()`).
- Jamais l'email, jamais exposé côté client dans le payload analytics si non nécessaire à
  l'affichage du dashboard propriétaire lui-même.
- Ne remplace jamais `visitor_id` — un utilisateur authentifié conserve son `visitor_id`
  d'origine (continuité pré/post-authentification), attaché en plus, pas à la place.

## `reservation_id`, `checkout_session_id`, `order_id`

- Ajoutés **uniquement par le serveur**, jamais acceptés d'un payload client comme valeur de
  vérité (un `reservation_id` envoyé par le client dans un événement `CLIENT_OBSERVED` est
  accepté comme *référence d'affichage* mais ne peut jamais, seul, faire progresser une étape
  `SERVER_TRUTH` du funnel).
- Jamais loggés en clair dans les journaux applicatifs accessibles publiquement (déjà la
  pratique existante de `founder-access`/`conversion`, reconduite ici).

## Table récapitulative

| Identité | Généré par | Cookie | Durée | Rotation |
|---|---|---|---|---|
| `visitor_id` | Serveur | `cs_visitor_id` | 90j test / production en attente | Jamais (persistant) |
| `session_id` | Serveur | `cs_session_id` | 30 min inactivité | À chaque nouvelle session |
| `page_view_id` | Client, validé serveur | Non — dans le payload uniquement | Durée de la navigation | Chaque navigation réelle |
| `demo_run_id` | Client, validé serveur | Non — dans le payload uniquement | Durée de l'exécution démo | Redémarrage explicite |
| `user_id` | Supabase auth | Cookie de session Supabase existant (non dupliqué) | Session d'authentification | Gérée par Supabase |

Aucune de ces identités ne remplace ou ne fusionne avec `cs_analytics_session` (founder-access)
ou `cs_conversion_session` (BLOC3) — elles coexistent, réconciliées uniquement via les
adaptateurs (`ANALYTICS_LEGACY_MIGRATION_MATRIX.md`), jamais par fusion de cookies.
