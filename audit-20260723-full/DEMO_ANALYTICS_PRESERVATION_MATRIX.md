# Demo Analytics Preservation Matrix

Vérifié : les branchements Analytics canoniques de `/demo` sont **conservés intacts** (aucune
modification runtime dans ce bloc — seul un test a été ajouté).

| Élément Analytics | Présent dans `DemoExperience.tsx` (HEAD) | Préservé ? |
|---|---|---|
| `demo_run_id` (`newDemoRunId("demo")`, guard ref) | Oui (ligne ~60) | ✅ |
| `track("demo_started", …)` (premier scroll) | Oui | ✅ |
| `track("demo_completed", …)` (fin de run, once) | Oui | ✅ |
| `track("demo_step_completed", …)` (par scène, `stepId` fermé) | Oui | ✅ |
| `track("demo_pierre_reveal_viewed", …)` | Oui | ✅ |
| `track("discover_pierre_clicked", …)` (CTA vers Pierre) | Oui | ✅ |
| Déduplication par run (`dedupeKey`) | Oui | ✅ |
| `stepId` = `demo-act-*` fermé, jamais `textContent` | Oui | ✅ |
| Aucune PII, best-effort | Oui | ✅ |
| Émissions legacy parallèles (emitDemoEvent/emitConversionEvent/emitFounderEvent) | Oui | ✅ (aucun double comptage : le funnel canonique ne lit que `clonestore_analytics_events_v1`) |

## Garanties

- **Analytics n'a modifié aucun ordre narratif** : l'ordre value-first (ValueShock premier) est
  antérieur et indépendant de l'instrumentation.
- Aucun paragraphe ajouté, aucun composant visuel créé par Analytics, aucun retard de rendu
  (émissions best-effort, jamais bloquantes), aucune imposition d'une ancienne `DemoExperience`.
- Le test anti-régression ajouté n'importe ni ne modifie l'Analytics — il lit `DEMO_SCENE_NAV`
  (donnée fermée), le source de `DemoExperience`, et le value-model.
