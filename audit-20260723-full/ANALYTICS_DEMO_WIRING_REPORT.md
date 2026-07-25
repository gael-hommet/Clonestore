# Analytics Demo Wiring Report

## `/demo` — `src/components/demo/DemoExperience.tsx`

Émissions canoniques **additives** via `track()`, aux points d'instrumentation legacy déjà
existants. Aucune émission legacy retirée (le sink canonique ne lit jamais les systèmes legacy).

| Événement canonique | Point | Dédup |
|---|---|---|
| `demo_started` | 1er scroll (`onScroll`, `startedRef`) | `dedupeKey = demo_started:<demo_run_id>` |
| `demo_step_completed` | scène vue (`IntersectionObserver`, `data-step-id` fermé) | `dedupeKey` par run+scène |
| `demo_completed` | profondeur ≥ seuil OU transition vers Pierre (`markDemoCompleted`, `completedRef`) | `dedupeKey = demo_completed:<demo_run_id>`, once |
| `demo_pierre_reveal_viewed` | CTA vers Pierre affiché (`handleRevealViewed`) | once |
| `discover_pierre_clicked` | CTA vers Pierre cliqué (`handleDiscoverPierre`) | once |

## Identité

- `demo_run_id` (type `demo`) créé **une seule fois par montage** via un `useRef` guard →
  insensible au double-montage React Strict Mode ; un simple re-render ne crée pas de nouveau run.
- Un rechargement de `/demo` crée un nouveau run (documenté).
- `stepId` = identifiant de scène fermé (`id.replace(/^demo-act-/,"")` filtré au charset autorisé)
  — **jamais** `textContent`, jamais de texte libre, jamais un chiffre saisi.

## Interdictions respectées

Aucun texte de réponse, aucun texte généré, aucun chiffre saisi, aucun nom d'entreprise, aucun
`textContent`, aucun nom d'événement dynamique — uniquement des noms canoniques fermés et des
`data-step-id` bornés.
