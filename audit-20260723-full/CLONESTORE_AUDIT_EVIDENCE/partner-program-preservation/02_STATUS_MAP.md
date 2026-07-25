# Partner Program — Status Map (committed vs. disk)

Généré 2026-07-25 par `pp-full-status-map.cjs` puis `pp-crlf-check.cjs` (isomorphic-git,
comparaison octet par octet blob HEAD ↔ fichier disque, aucune approximation par nom/mtime).

Périmètre scanné : `src/lib/partner-program/**`, `src/app/api/partners/**`,
`src/app/partenaires/**`, `src/components/partenaires/**`, `src/app/api/cron/partner-payouts/**`
(programme commercial Cabinets Fondateurs) + `src/lib/clonestory/founding-partners/**`,
`src/app/founding-partners/**`, `src/app/api/founding-partners/**`,
`src/components/clonestory/**` (CloneStory / Founding Partners, univers institutionnel séparé)
+ migrations, scripts et docs liés — **225 fichiers** au total.

## Résultat

| Catégorie | Nombre | Signification |
|---|---:|---|
| `UNMODIFIED` | 72 | Committé, disque identique octet pour octet |
| `*modified` — CRLF seul | 152 | Committé (LF), disque réécrit en CRLF par un outil non identifié après le commit du 07-11 — **0 différence de contenu réelle** après normalisation `\r\n`→`\n` |
| `*modified` — vraie différence | 1 | `docs/clonestory/BLOC_2_INSCRIPTIONS.md` — une phrase de doc (date de lancement) |
| Untracked / jamais committé | **0** | — |
| Dans HEAD mais absent du disque | **0** | — |

**Aucun `.gitattributes` n'est présent** dans le dépôt — la normalisation de fin de ligne n'est
pas configurée, ce qui explique la dérive CRLF non maîtrisée constatée sur 152 fichiers.

## La seule vraie différence de contenu

`docs/clonestory/BLOC_2_INSCRIPTIONS.md`, ligne 3 :
- Committé : « …avant le lancement commercial de Pierre, le 5 août. »
- Disque : « …avant le lancement commercial de Pierre, le 12 août — reporté depuis le 5 août
  2026 initial. »

Vérifié cohérent avec la source de vérité déjà committée pour cette date
(`src/lib/demo/presentation/commercial-state.ts`, `DEMO_LAUNCH_ISO = "2026-08-12T00:00:00+02:00"`,
commenté « Dates verrouillées par le master prompt … reporté depuis le 5 août 2026 initial »).
La version disque est donc la version correcte ; la version committée était en retard d'une
mise à jour déjà propagée ailleurs dans le code. Corrigée par un commit dédié, minimal,
non-code, dans ce même bloc.

## Conclusion

Le Partner Program (les deux sous-programmes) n'a **aucun contenu de valeur non préservé**. La
classification P0 LOSS_CRITICAL du bloc précédent (`LEGACY_WORKTREE_PRESERVATION_PRIORITY.md`,
ISSUE-42) était un faux positif provenant de la confusion entre `git status = modified` et
`jamais commité`, elle-même amplifiée par une dérive de fin de ligne non détectée. Les deux
documents ont été corrigés dans ce bloc (2026-07-25).
