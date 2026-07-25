# Partner Program Preservation Closure — Baseline

Recorded 2026-07-25.

## HEAD
- Attendu : `64e12d4b3fa8b741d546c557fe81ba9a0fda2c96`. Check 1 : correspond exactement.
- Attente 20s. Check 2 : identique. **HEAD stable.**
- Branche : `main`. Remote `origin` configuré, non contacté.

## Processus / mémoire / disque
- Un processus `node.exe` à 862 Mo trouvé, mais appartenant à un **répertoire totalement
  différent** (`C:\Users\homme\clonestore-clonechat-unified\...jest-worker\processChild.js`) —
  pas notre dépôt, pas touché (n'est pas à moi de l'arrêter).
- Aucun processus lourd dans `C:\Users\homme\clonestore` lui-même.
- Mémoire libre : ~2,44 Go / 16,57 Go. Disque libre : ~26,7 Go.

## Garde-fous reconfirmés
- `PRODUCTION_AUTHORIZED = false as const` : reconfirmé.
- `.env.local` : uniquement `sk_test_` (aucune `sk_live_`).
- P0.1 (`execute/route.ts`), P0.2 (`action/route.ts`, `router/route.ts`) : tous `unmodified`
  contre le HEAD — intacts.

## Localisation de la liste des 122 fichiers `PARTNER_PROGRAM`

Retrouvée directement dans la source du triage précédent (pas reconstruite par mot-clé) :
`CLONESTORE_AUDIT_EVIDENCE/clean-head-reproducibility/09_legacy_classified_full.tsv`,
122 lignes exactes avec la catégorie `PARTNER_PROGRAM`. Copie de travail :
`partner-122-raw.tsv` (scratchpad).

## Premier constat structurel (avant toute classification fine)

Les 122 fichiers se répartissent en **deux arborescences distinctes**, confirmant l'alerte de
la Phase 5 du prompt maître :
1. `src/lib/partner-program/**`, `src/app/api/partners/**`, `src/app/partenaires/**`,
   `src/components/partenaires/**`, `src/app/api/cron/partner-payouts/**` — le programme
   commercial **Cabinets Fondateurs** proprement dit (commission, payout, Stripe Connect).
2. `src/lib/clonestory/founding-partners/**`, `src/app/founding-partners/**`,
   `src/app/api/founding-partners/**` — **CloneStory / Founding Partners**, un univers
   institutionnel séparé (registration→verify→registre→introduction), déjà noté en mémoire de
   session comme distinct.
3. 6 rapports racine + 1 doc + 1 script, communs aux deux ou documentaires.

Aucune modification effectuée à ce stade.
