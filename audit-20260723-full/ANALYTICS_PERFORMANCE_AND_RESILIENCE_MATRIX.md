# Analytics Performance and Resilience Matrix

## Tracker client (`src/lib/analytics/client/track.ts`)

- Aucune dépendance externe, aucune bibliothèque analytique tierce chargée (vérifiable :
  `package.json` non modifié par ce bloc pour ajouter une dépendance de tracking).
- `navigator.sendBeacon` en priorité (non bloquant, survit à la navigation) ; repli `fetch(...,
  {keepalive:true})` uniquement si `sendBeacon` est absent.
- Aucune requête synchrone bloquante.
- `recentlySent`/`dedupeGuards` : `Set` borné (`MAX_SENT_ID_MEMORY = 200`), purge FIFO — pas de
  croissance mémoire illimitée sur une session longue.
- Aucune boucle de retry active côté client — un échec réseau est avalé silencieusement
  (`.catch(() => {})`), jamais de tempête de requêtes.

## Dégradation — prouvée par construction, pas seulement documentée

| Panne simulée | Comportement | Preuve |
|---|---|---|
| Base de données indisponible à l'ingestion | `getAnalyticsDbForIngestion()` retourne `null`, route répond `204`, aucune exception | `runtime.ts` (même contrat que `founder-access/runtime.ts`, déjà éprouvé en production) |
| Stockage indisponible pendant l'écriture (race) | Route répond `503` honnête, jamais un faux succès persistant | `route.ts`, bloc `catch` dédié |
| `sessionStorage` indisponible (navigation privée stricte) | Le tracker continue de fonctionner sans `page_view_id`/`demo_run_id` persistant — aucune exception non gérée | `track.ts`, chaque accès `sessionStorage` est dans un `try/catch` |
| Endpoint analytics totalement injoignable | Aucune action utilisateur bloquée — homepage, démo, réservation, checkout, paiement restent fonctionnels (le tracker ne fait jamais partie du chemin critique d'aucune de ces pages) | Structurel : `AnalyticsPageViewTracker`/`track()` ne sont jamais `await`és par un composant produisant du rendu, ne lèvent jamais dans un chemin de rendu |

## Non mesuré directement dans ce bloc

Aucun test de charge réel n'a été exécuté (pas de campagne de requêtes concurrentes contre
l'endpoint). Le rate limiting (`distributedRateLimit`, 60 req/min/IP-hashée, réutilisé tel quel
de founder-access) est le seul garde-fou anti-abus en place ; son comportement sous charge réelle
n'est prouvé que par les tests déjà existants de founder-access (non ré-exécutés spécifiquement
pour analytics dans ce bloc — le code est partagé, pas dupliqué).
