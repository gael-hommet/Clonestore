# Analytics Pierre Demo Wiring Report

## `/demo/pierre` — `src/app/demo/pierre/_variant/DemoEventTracker.tsx`

Émissions canoniques **additives** via `track()`, aux hooks existants (`markStarted`,
`emitStep`, `markCompleted`).

| Événement canonique | Point | Dédup |
|---|---|---|
| `pierre_demo_started` | 1re interaction (`markStarted`) | `dedupeKey = pierre_demo_started:<demo_run_id>` |
| `pierre_demo_step_completed` | bouton à `data-step-id` fermé dans le cockpit (`emitStep`) | `stepsSeenRef` (unicité) + `dedupeKey` par run+label |
| `pierre_demo_completed` | ≥ 5 étapes OU CustomEvent completed (`markCompleted`) | `dedupeKey = pierre_demo_completed:<demo_run_id>`, once |

## Identité

- `demo_run_id` (type `demo_pierre`), distinct du run `/demo` générique. Réutilise le run de
  session existant s'il y en a un (un rechargement de `/demo/pierre` conserve le run — documenté),
  sinon en crée un. Insensible au double-montage.
- Une étape n'est comptée qu'une fois par run (`stepsSeenRef` + `dedupeKey`), cap à 12.
- `stepId` = `data-step-id` fermé (`scenario:<id>`, `hero-start`, `phase:<id>`…) filtré au charset
  autorisé — jamais `textContent`, jamais de contenu généré ou de donnée RH.

## Disclaimers conservés

Aucun disclaimer ni limitation honnête de `/demo/pierre` n'a été retiré — seule de
l'instrumentation additive a été ajoutée. Aucune donnée d'entreprise, aucun contenu généré, aucun
texte de mission n'entre dans un événement.

## Fin valide uniquement après séquence suffisante

`markCompleted` ne se déclenche qu'après ≥ 5 étapes distinctes (`DEMO_COMPLETED_AFTER_STEPS`) ou un
CustomEvent explicite — une fin de démo ne peut pas être « fabriquée » par un seul événement final
isolé sans étapes cohérentes.
