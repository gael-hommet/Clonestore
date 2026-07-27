# Demo Regression — Root Cause

## Réponses avec preuve

| Question | Réponse prouvée |
|---|---|
| Quel commit avait la dernière bonne version value-first ? | `90932a0bc` (2026-07-25) et tous ses descendants, **jusqu'au HEAD actuel `62cbb6fb`**. C'est le commit qui a fait passer le blob committé de `DemoExperience.tsx` à `<ValueShock>` en premier écran. |
| Quel commit a « réintroduit » l'ancienne version textuelle **dans le dépôt** ? | **Aucun.** Le blob committé de `DemoExperience.tsx` est value-first depuis `90932a0bc` et n'a jamais été réverti (HEAD `unmodified`, `<ValueShock>` avant `<Act1Opening>`). |
| Pourquoi `clonestore.pro/demo` montre-t-il l'ancienne version ? | Parce que le **déploiement en production est périmé** : il correspond à un build antérieur au `90932a0bc` (ère `02cf93180`, 2026-07-13, ou avant), où `Act1Opening` (institutionnel) était le premier écran. Le dépôt a été refondu value-first APRÈS ce déploiement, et aucun redéploiement n'a eu lieu (push GitHub 401 / déploiements hors périmètre de ces blocs, cf. mémoire). |
| `a998eba5…` a-t-il causé ou seulement préservé la régression ? | **Ni l'un ni l'autre vis-à-vis de `DemoExperience`.** `a998eba5` a committé la clôture démo (38 fichiers, dont `ValueShock`/`ModesChapter`) pour la reproductibilité — il a **préservé la version value-first** déjà présente, il n'a **pas** ré-introduit l'ancienne. `DemoExperience.tsx` était déjà value-first (committé par `90932a0bc`), `a998eba5` ne l'a pas modifié. |
| Quels fichiers exacts contrôlaient le premier écran régressif (sur le build déployé) ? | `src/components/demo/DemoExperience.tsx` (ordre des chapitres) + `src/components/demo/acts/Act1Opening.tsx` (`id="demo-act-open"`, texte « N'achetez plus… ») — quand `ValueShock` n'existait pas encore comme premier chapitre. |

## Conclusion

**La régression est un artefact de déploiement, pas une régression du dépôt.** Le dépôt (committé,
HEAD) est déjà exactement la démo value-first validée — **prouvé visuellement** dans un vrai
navigateur (desktop 1440 + mobile 390, voir `DEMO_VISUAL_RESTORATION_COMPARISON.md`).

**Aucune restauration de code n'est nécessaire dans le dépôt.** L'action qui corrigerait la
production est un **redéploiement** du HEAD actuel — hors périmètre de ce bloc (aucun push, aucun
déploiement autorisé). Ce bloc ajoute un **verrou anti-régression** (test d'ordre value-first) pour
empêcher toute régression silencieuse future du dépôt, et produit la preuve visuelle.
