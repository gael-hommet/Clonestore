# Analytics Privacy and Retention Matrix

Aucun tracker tiers ajouté (ni Google Analytics, ni Meta Pixel, ni TikTok Pixel, ni aucun autre)
— confirmé par conception : `src/lib/analytics/` n'importe aucune dépendance externe, aucun
script tiers n'est chargé.

## Cookies

| Nom | Rôle | Durée | HttpOnly | Secure | SameSite | Signé | Nécessaire | Consentement |
|---|---|---|---|---|---|---|---|---|
| `cs_visitor_id` | Identité visiteur | 90j (test) | Oui | Oui (prod) | Lax | Oui (HMAC) | Fonctionnel (mesure d'audience) | Catégorie "mesure", pas de bannière tierce requise (first-party, non publicitaire) |
| `cs_session_id` | Identité session | 30 min glissant | Oui | Oui (prod) | Lax | Oui (HMAC) | Fonctionnel | idem |

Aucun autre cookie analytics n'est ajouté. Les cookies existants (`cs_analytics_session`,
`cs_conversion_session`, `cs_anon_sid` en sessionStorage) ne sont ni supprimés ni modifiés dans
ce bloc — voir `ANALYTICS_LEGACY_MIGRATION_MATRIX.md`.

## Règles de données — vérifiées par construction du schéma (Phase 7)

| Donnée | Stockée ? | Comment c'est empêché |
|---|---|---|
| IP brute | **Non** | Jamais lue au-delà du hachage SHA-256 (réutilise `clonestore_rate_limits` pattern existant) ; aucune colonne IP dans `clonestore_analytics_events_v1` |
| User-agent brut | **Non** | Seule une catégorie grossière (`mobile`/`tablet`/`desktop`), un `browser_family` et un `os_family` coarse sont dérivés et stockés — jamais la chaîne complète |
| Géolocalisation précise | **Non** | Aucune API de géolocalisation appelée ; `country_code` uniquement si déjà résolu côté serveur pour un autre besoin (jamais une nouvelle résolution ajoutée pour l'analytics) |
| Query string libre | **Non par défaut** | Le tracker de page-view supprime toute query string sauf les 5 clés UTM allowlistées |
| Chemin avec token | **Non** | Normalisation de route (`routeKey` fermé, énuméré) — jamais l'URL brute |
| Saisie utilisateur / texte libre | **Non** | `properties` du schéma canonique n'accepte que des enums/booléens/nombres bornés — jamais `Record<string, unknown>` public |
| Nom, email, téléphone, adresse | **Non** | Aucune de ces clés n'existe dans l'allowlist de propriétés ; rejet actif si détecté (voir Phase 23, tests de sécurité) |
| Données bancaires / KYC | **Non** | Hors du périmètre analytics par construction — ces données ne transitent jamais par ce module |
| `textContent` comme identifiant | **Non** | Un événement sans `data-step-id` fermé n'est simplement pas tracké (pattern déjà établi et vérifié dans `DemoEventTracker.tsx`, reconduit) |

## Politique de durée de conservation

Aucune durée de production validée n'existe dans le code ou la documentation lue. Décision :
- Une configuration existe (`ANALYTICS_RETENTION_DAYS`, `.env.example`), avec une valeur
  **conservatrice en test uniquement** (90 jours pour `visitor_id`, 400 jours pour les lignes
  `clonestore_analytics_events_v1` — aligné sur la pratique standard du secteur, non validé
  juridiquement).
- La valeur de **production** est explicitement laissée en attente, marquée
  `OWNER_APPROVAL_REQUIRED` — ni activée ni appliquée automatiquement.
- Aucune tâche de purge automatique n'est activée par ce bloc (créer la fonction SQL de purge
  fait partie du schéma, mais aucun cron ne l'appelle en production tant que la durée n'est pas
  validée par le propriétaire/juridique).

## Consentement

Aucune bannière de consentement n'existe dans `src/app`/`src/components` (vérifié par la
recherche Phase 1). Ce bloc n'en ajoute pas — il ajoute un champ `consent_state`
(`"unknown" | "necessary_only" | "all"`, défaut `"unknown"`) dans l'enveloppe canonique,
pré-câblé pour une future bannière, sans lui donner de comportement bloquant aujourd'hui
(mesure first-party fonctionnelle, pas publicitaire — ne nécessite pas techniquement de
consentement préalable dans la plupart des cadres juridiques européens actuels, mais la
décision finale reste explicitement hors périmètre technique de ce bloc).
