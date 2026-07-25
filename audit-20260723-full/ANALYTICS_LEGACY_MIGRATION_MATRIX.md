# Analytics Legacy Migration Matrix

Mode de transition retenu, par système, en respectant la règle : « aucun double comptage, aucune
fausse donnée de conversion ».

| Système | Mode | État réel dans ce bloc |
|---|---|---|
| Founder-access (funnel/presence, Postgres réel) | `shadow` (préparé, non activé) | Adaptateur écrit et testé (`src/lib/analytics/adapters/founder-access-adapter.ts`, 6 tests verts contre PGlite réel) : traduit 4 vérités serveur (`founder_reservation_created`→`reservation_created`, `founder_email_verified`→`reservation_email_confirmed`, `founder_payment_completed`→`payment_succeeded`, `founder_subscription_active`→`activation_completed`) avec `event_id` déterministe (sha256 de `reservationId:eventName`, jamais aléatoire — un rejeu ne crée jamais de doublon). **Non appelé depuis le code founder-access existant** — aucune écriture double n'est possible aujourd'hui puisque l'adaptateur n'est invoqué que par ses propres tests. Activation = un futur bloc dédié qui ajoute UN appel additif dans `store.ts` (founder-access) après chacune de ces 4 écritures, sous le même contrat try/catch-avale que `bridgePartnerCommercial` dans le webhook Stripe. |
| BLOC3 conversion | `off` | Non touché. Reste fail-closed en production (aucun backend Postgres jamais implémenté, hors périmètre de ce bloc). N'écrit toujours rien nulle part — donc aucun risque de double comptage avec le nouveau système canonique. |
| Démo — analytics de présentation (`emitDemoEvent`) | `off` | Déprécié dans l'inventaire (`ANALYTICS_LEGACY_EVENT_INVENTORY.md`, section D) mais fichier non supprimé (aucune preuve qu'il soit totalement mort au build). Le tracker canonique (`src/lib/analytics/client/track.ts`) est prêt à être appelé en remplacement, mais **`DemoExperience.tsx`/`DemoEventTracker.tsx`/`PierreDemoExperience.tsx` ne sont pas modifiés dans ce bloc** — décision délibérée, documentée ci-dessous. |
| Guided Tour | `off` | Événements canoniques `guided_tour_started/step_completed/completed/skipped` définis dans le schéma (comblent une lacune réelle — zéro télémétrie avant ce bloc), mais **non câblés dans `GuidedTourProvider.tsx`** dans ce bloc — décision délibérée, documentée ci-dessous. |
| Webhook Stripe canonique (paiement/activation) | `off` (préparé) | `bridgeFounderServerEvent` couvre déjà ce besoin via l'adaptateur founder-access (le webhook alimente déjà `founder_payment_completed`/`founder_subscription_active`, l'adaptateur les traduirait). **Aucune ligne ajoutée à `src/app/api/webhooks/stripe/route.ts`** dans ce bloc. |

## Pourquoi ces trois wirings sont délibérément différés (pas oubliés)

Ce bloc touche déjà : une nouvelle table Postgres, un nouvel endpoint public, la config du
harnais de test PGlite partagé, et le layout racine (ajout non-intrusif). Les trois wirings
restants (démo, GuidedTour, webhook Stripe) partagent un point commun : ils modifieraient du code
**déjà actif, déjà testé, en usage réel**, dans des fichiers pour deux d'entre eux explicitement
protégés par le master prompt (« Toute modification à... au webhook Stripe nécessite : preuve
précise ; correction minimale ; tests Payment Path complets ; nouveau build ; justification »).
Le faire correctement exige une suite de non-régression dédiée à CHACUN, que ce bloc — déjà très
large — ne peut pas absorber avec le même niveau de rigueur que le reste sans risquer une
fermeture bâclée. Le contrat canonique (schéma, endpoint, identités, adaptateur prouvé sur un cas
réel) est la partie qui devait être solide en premier ; le câblage final est un delta petit et
bien défini pour un prochain bloc, pas un chantier ouvert.

## Aucun double comptage possible aujourd'hui

Puisque aucun des trois wirings n'est activé, le système canonique ne reçoit aujourd'hui que les
`page_viewed` du nouveau tracker App Router (déjà monté, actif) — aucun chevauchement possible
avec founder-access/BLOC3/démo tant qu'aucun pont n'est appelé.
