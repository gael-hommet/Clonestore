# Exact Demo Restoration — Baseline

Enregistré 2026-07-27.

## HEAD

- HEAD live au démarrage : `62cbb6fb7c522094fc2249762bd6e310371c1e2a` (puis stable). Branche `main`.
- Remote `origin` configuré, non contacté.
- `PRODUCTION_AUTHORIZED = false as const` — intact.
- `.env.local` : uniquement `sk_test_`.

## Constat immédiat (avant toute modification)

- La phrase régressive « N'achetez plus seulement des logiciels » **n'est PAS le premier écran du
  dépôt** : elle vit dans `Act1Opening.tsx` qui est le **2ᵉ** chapitre.
- Le **1ᵉʳ** chapitre du dépôt est `ValueShock.tsx` (`id="demo-act-choc"`, « La preuve ») — le choc
  de valeur value-first (11 h 35 → 12 min, 1,6 M€/an). `DemoExperience.tsx` (committé,
  `unmodified`) rend `<ValueShock/>` avant `<Act1Opening/>`.
- **Conclusion préliminaire (à prouver visuellement)** : le dépôt est DÉJÀ value-first ; la
  régression observée sur `clonestore.pro/demo` provient d'un **déploiement périmé**, pas du dépôt.

## Processus

Aucun `next dev`/`build`/`vitest` CloneStore actif au démarrage. Un `next dev` a été lancé
temporairement (port 3711) pour la preuve visuelle, puis arrêté ; il avait auto-modifié
`tsconfig.json` (ajout `.next-demo-verify/types`), **rétabli immédiatement** à la version committée
(`unmodified`).

Aucun push, aucun déploiement.
