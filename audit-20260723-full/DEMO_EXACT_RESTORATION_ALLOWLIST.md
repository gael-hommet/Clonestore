# Demo Exact Restoration — Allowlist (classification fichier par fichier)

Le dépôt étant **déjà** à la bonne version value-first, aucun fichier de démo n'a besoin d'être
« restauré » depuis un ancien blob. Classification honnête :

| Fichier / groupe | Classe | Justification |
|---|---|---|
| `src/components/demo/DemoExperience.tsx` | **RESTORE_EXACT_GOOD_VERSION — DÉJÀ PRÉSENT** | Blob committé (HEAD) rend déjà `<ValueShock/>` en premier, avant `<Act1Opening/>`. `unmodified`. Rien à changer. |
| `src/components/demo/acts/ValueShock.tsx` | **RESTORE_EXACT_GOOD_VERSION — DÉJÀ PRÉSENT** | Premier écran value-first (11 h 35 → 12 min, 1,6 M€). `unmodified`. |
| `src/components/demo/acts/Act1Opening.tsx` | **KEEP (2ᵉ chapitre)** | Contient le hero institutionnel mais n'est plus premier écran. Fait partie de la bonne version. `unmodified`. |
| `src/components/demo/acts/ModesChapter.tsx`, `ValueChapter.tsx`, `Act2…Act6*.tsx` | **KEEP_CURRENT_BUILD_DEPENDENCY** | Chapitres de la bonne version, committés (`a998eba5`). Nécessaires au build et à la démo value-first. |
| `src/lib/demo/presentation/*` (value-model, content, cost-model, analytics…) | **KEEP** | Données/dérivations de la bonne version. `value-model.ts` alimente les chiffres value-first. |
| Instrumentation Analytics dans `DemoExperience.tsx` (`track`, `newDemoRunId`, …) | **KEEP_CURRENT_ANALYTICS** | Branchements canoniques récents à conserver tels quels. |
| `src/components/demo/__tests__/demo-value-first-order.test.ts` | **NOUVEAU — verrou anti-régression** | Seul ajout de ce bloc : verrouille l'ordre value-first. |
| Homepage / hero / slogan / checkout / webhook / Partner / Pierre runtime | **UNRELATED_DO_NOT_TOUCH** | Hors périmètre, non modifiés. |
| Ancien premier écran institutionnel (`Act1Opening` en 1ʳᵉ position) | **CURRENT_REGRESSIVE_REMOVE — DÉJÀ RETIRÉ** | N'existe plus dans le dépôt (retiré au `90932a0bc`). Rien à faire. |

## Conséquence

Aucune restauration de blob n'est effectuée (aucun `readBlob` d'un ancien commit réinjecté) —
ce serait inutile et risquerait d'écraser l'Analytics actuelle. Le seul changement de ce bloc est
l'ajout d'un **test anti-régression** + la documentation + les preuves visuelles.
