# P0.1 — Execute Route Governance Re-Closure — Rapport de clôture

**Date** : 2026-07-24. **Périmètre** : réconciliation forensique et remise en sécurité réelle de
`src/app/api/pierre/execute/route.ts`, correction des rapports historiques. Aucune refonte du
produit commercial, aucune modification homepage/pricing/légal/Stripe, `PRODUCTION_AUTHORIZED`
inchangé (`false as const`).

## Ce qui a été trouvé (Phases 0–3)

`P0_GOVERNANCE_CLOSURE_REPORT.md` (2026-07-23) affirmait la fermeture complète du contournement
de gouvernance sur `/api/pierre/execute`. Au début de ce bloc, le code présent contredisait
cette affirmation : `route.ts` appelait Make.com directement pour `email.send`/`doc.generate`/
`hris.sync`, sans aucune évaluation CloneGuard/gouvernance, exactement comme avant le correctif
historique supposé. Deux méthodes forensiques indépendantes (hash de contenu par commit Git via
`isomorphic-git` ; `git.status` par fichier croisé avec les mtimes réelles sur disque) ont permis
d'établir avec certitude que :
- Le module de gouvernance (`src/lib/pierre/legacy-execute-governance.ts`), ses 8 tests
  unitaires, les 10 tests d'intégration, et la règle additive de `cloneguard.ts`
  (`integration_sync`/`integration_sync_require`) ont réellement été écrits le 2026-07-23 et
  sont restés intacts, non commités, jusqu'au début de ce bloc.
- `route.ts` lui-même, en revanche, était revenu à un état byte-identique à son dernier commit
  réel (`8b0b5c5f7`, 2026-05-24) — sa mtime sur disque (24/07 16:44:32) prouve qu'il a été
  réécrit le lendemain de la clôture historique, dans la fenêtre exacte des commits externes
  concurrents de refactor lazy-init (`bea7a7dd1`/`0b3d79e61`).
- Classification retenue : **`GOVERNED_VERSION_EXISTED_AND_WAS_OVERWRITTEN`** — détail complet
  dans `P0_1_GIT_FORENSIC_TIMELINE.md`.

`/api/pierre/tick` a été confirmé comme appelant interne réel de `execute` (HMAC auto-signé pour
chaque tâche de la file `pierre_queue`) — cartographié une première fois par le rapport
historique et reconfirmé ici ; `/api/pierre/run` a été identifié comme un second appelant
interne non cartographié auparavant (boucle `generate → execute`). Détail dans
`P0_1_CALLER_AND_SURFACE_MATRIX.md`.

## Ce qui a été corrigé (Phases 4–8)

`route.ts` réutilise désormais `evaluateLegacyExecuteGovernance` (aucun second évaluateur créé)
avant toute action connue. Décisions :
- `email.send` → **DENY** (403, `GOVERNANCE_BLOCKED`) — floor CloneGuard non-contournable.
- `doc.generate` → **REQUIRE_APPROVAL** (202, `HUMAN_APPROVAL_REQUIRED`) — CloneTrust bas par
  défaut sans contexte de confiance réel.
- `hris.sync` → **REQUIRE_APPROVAL**/**DENY**, jamais ALLOW — plancher route additionnel qui
  force REQUIRE_APPROVAL même si le moteur retournait ALLOW par erreur.
- Action inconnue → 400 `UNKNOWN_ACTION`, inchangé.

Le connecteur Make direct (`callMake`, 3 `MAKE_*_WEBHOOK_URL`, et le code de dispatch par action)
a été **retiré entièrement** du fichier (option préférée du prompt maître, puisqu'aucune action
n'atteint `ALLOW` aujourd'hui) plutôt que laissé comme code mort inatteignable. Un plancher
explicite (`501 EXECUTION_NOT_AVAILABLE`) couvre le cas structurel où `ALLOW` surviendrait malgré
tout. Le pattern d'initialisation paresseuse (`getRuntime()`, jamais évalué au chargement du
module) introduit par les commits externes légitimes a été intégralement préservé — seules les 3
variables `MAKE_*` ont été retirées de la liste requise, devenues inutiles. Auth HMAC,
anti-rejeu, `assertPierreAccess`, idempotence, audit best-effort : inchangés bit pour bit. Détail
ligne par ligne dans `P0_1_CURRENT_ROUTE_BEFORE_AFTER.md` et `P0_1_GOVERNANCE_DECISION_MATRIX.md`.

## Preuve (Phases 9–12)

- **18/18** tests P0.1 (8 unitaires + 10 intégration) verts — comptage identique à celui annoncé
  par le rapport historique, cette fois réellement exécuté avec succès.
- **15/15** tests transversaux P0.1/P0.2 verts (`/api/pierre/action` et `/api/router` confirmés
  intacts et cohérents).
- **5611/5613** tests de la zone Pierre complète verts (1 flake de parallélisme préexistant sans
  rapport, confirmé vert en isolation ; 1 ignoré).
- **9165/9165** tests de la suite `npm test` curatée verts (périmètre majoritairement hors
  Pierre — legal/launch-readiness/technologies/go-live/checkout/auth/billing/cloneos/webhooks).
- `tsc --noEmit` : **0 erreur** (répertoire entier).
- ESLint scopé aux 2 fichiers modifiés : **0 finding**.
- Build isolé (`NEXT_DIST_DIR=.next-p0-1-reclosure`, `NODE_OPTIONS="--max-old-space-size=6144"`) :
  voir `P0_1_BUILD_EVIDENCE.md` pour le résultat détaillé.

Détail complet, sans double comptage, dans `P0_1_TEST_MATRIX.md`.

## Documentation reconciliée (Phase 13)

`P0_GOVERNANCE_CLOSURE_REPORT.md` a reçu une bannière de supersession en tête — non supprimé,
son contenu reste une preuve fidèle du travail du 23/07. `P0_1_PREVIOUS_REPORT_RECONCILIATION.md`
classe chaque affirmation historique (CORRECT / VRAI_UNE_FOIS_PUIS_PERDU / INVÉRIFIABLE — aucune
n'est classée INCORRECT, le travail décrit était réel). `CLONESTORE_FULL_AUDIT.md`,
`CLONESTORE_TECHNICAL_AUDIT.md`, `CLONESTORE_LAUNCH_READINESS.md`,
`CLONESTORE_ISSUE_REGISTER.md`, `CLONESTORE_OPTIMIZATION_BACKLOG.md`, `DEMO_REMAINING_RISKS.md`
mis à jour pour refléter la clôture réelle (ISSUE-40 fermée).

## Verdict

Voir `P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_VERDICT.md` pour les 24 réponses obligatoires du
prompt maître.
