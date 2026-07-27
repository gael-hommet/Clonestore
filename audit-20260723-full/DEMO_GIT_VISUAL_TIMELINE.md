# Demo Git Visual Timeline

Chronologie structurelle de `src/components/demo/DemoExperience.tsx` (changements réels du blob
committé, du plus ancien au plus récent).

| Date | Commit | 1ᵉʳ chapitre rendu | ValueShock présent ? | Message |
|---|---|---|---|---|
| 2026-06-26 | `d0a9b89bf` | (autre) | Non | feat: finalize CloneStore public polish |
| 2026-07-02 | `feed3c467` | **`<Act1Opening>`** | Non | feat(demo): refondre les demos CloneStore et Pierre |
| 2026-07-03 | `382003bc6` | `<Act1Opening>` (copy) | Non | copy(demo): renforcer le positionnement employes IA |
| 2026-07-13 | `02cf93180` | **`<Act1Opening>`** | Non | deploy CloneChat C1.7 |
| **2026-07-25** | **`90932a0bc`** | **`<ValueShock>`** | **Oui** | feat(analytics): wire demo, Pierre, guided-tour and commercial intent events |
| 2026-07-25 | `a998eba58` | `<ValueShock>` (inchangé) | Oui | fix(reproducibility): commit uncommitted demo presentation closure |
| 2026-07-27 (HEAD) | `62cbb6fb` | `<ValueShock>` (`unmodified`) | Oui | — |

## Lecture

- Jusqu'au **`02cf93180` (2026-07-13)** inclus, le dépôt committé était **institutionnel** :
  `Act1Opening` en premier écran (« N'achetez plus seulement des logiciels… Ouvrez des postes
  d'employés IA. »), pas de choc de valeur.
- La refonte **value-first** (ValueShock — 11 h 35 → 12 min, 1,6 M€/an — en premier écran) existait
  dans le worktree mais **n'a été committée qu'au `90932a0bc` (2026-07-25)** : ce commit analytics a
  capturé, en modifiant `DemoExperience.tsx` pour l'instrumentation, la structure value-first déjà
  présente sur disque.
- Depuis `90932a0bc`, le dépôt committé est **value-first** et l'est **toujours** au HEAD actuel
  (`62cbb6fb`, `DemoExperience.tsx` `unmodified`, `<ValueShock>` avant `<Act1Opening>`).

## Composants clés

- `src/components/demo/acts/ValueShock.tsx` — `id="demo-act-choc"`, « CH.1 (NOUVEAU PREMIER ÉCRAN) :
  LE CHOC DE VALEUR ». Rend 11 h 35 → 12 min + « Jusqu'à 1,6 M€ de capacité libérée par an » +
  « CloneStore ouvre des postes d'employés IA » + CTA « Voir ce que Pierre absorbe ».
- `src/components/demo/acts/Act1Opening.tsx` — `id="demo-act-open"`, hero institutionnel
  (« N'achetez plus seulement des logiciels »). **2ᵉ chapitre** dans la version value-first.
- `src/components/demo/shared.ts` — `DEMO_SCENE_NAV[0] = { id: "demo-act-choc", label: "La preuve" }`
  (donnée fermée confirmant l'ordre value-first).
