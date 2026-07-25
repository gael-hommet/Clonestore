# Analytics GuidedTour Wiring Report

## `src/components/guided-tour/GuidedTourProvider.tsx`

Instrumentation **purement observationnelle** de la machine à états du tour, dans un `useEffect`
dédié keyé sur `state.status`/`state.tourId`/`state.stepIndex`. **Aucun comportement visuel
modifié**, aucune règle de collision de prompt touchée.

| Événement canonique | Transition observée | Dédup |
|---|---|---|
| `guided_tour_started` | passage en `running` pour un nouveau `tourId` | `dedupeKey` par tourId + ref `startedFor` |
| `guided_tour_step_completed` | changement de `stepIndex` en `running` | `dedupeKey` par tourId+index |
| `guided_tour_completed` | status → `completed` | `dedupeKey` par tourId + ref `endedFor` |
| `guided_tour_skipped` | status → `skipped` | `dedupeKey` par tourId |

## Propriétés fermées

- `tourId` (borné 64 car.).
- `stepId` = `<tourId>:<index>`.
- Source de lancement dans `ctaKey` : `manual` (via `startTour`/`acceptWelcome`) ou `automatic`
  (reprise au montage). Le `tourLaunchSourceRef` est positionné `manual` uniquement par
  `startTour`, remis à `automatic` quand le tour revient à `idle`.

## Collision prompt contextuel — inchangée

La règle existante (prompt contextuel actif → welcome auto homepage supprimé ; tour manuel
toujours disponible) n'est **pas** touchée : l'instrumentation n'ajoute aucun rendu, aucun
écouteur DOM, aucune modification de `shouldSuppressHomepageAutoWelcome`. Zéro risque de
réintroduire une collision UI.

## Lacune comblée

GuidedTour n'avait **aucune** télémétrie avant ce bloc (confirmé par le bloc précédent). C'est un
pur ajout — aucun doublon possible.
