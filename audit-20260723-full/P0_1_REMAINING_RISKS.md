# P0.1 — Risques résiduels après re-clôture

## R1 — `src/app/api/pierre/run/route.ts` n'est pas gouverné à la source

`run/route.ts` appelle `/api/pierre/generate` puis boucle sur `/api/pierre/execute` pour
chaque action produite. Comme `/api/pierre/execute` est désormais gouverné (ce bloc), toute
action transitant par `run` hérite automatiquement de la même protection — **aucun
contournement possible aujourd'hui**. Le risque résiduel est architectural, pas fonctionnel :
`run/route.ts` lui-même ne contient aucune logique de gouvernance propre (il délègue entièrement
à `execute`) ; si `execute` était un jour remplacé par un autre connecteur sans le même garde,
`run` hériterait silencieusement du même trou. Hors périmètre de ce bloc (qui porte sur
`execute`/`action`/`router`, pas sur `run`) — à auditer si `run` est un jour modifié.

## R2 — `/api/pierre/tick` authentifie par secret partagé en query string, pas HMAC

`GET /api/pierre/tick?secret=...` compare `secret` à `CRON_SECRET` en clair dans l'URL (pas de
HMAC, pas de fenêtre anti-rejeu). Ceci est une pré-existance non liée à la gouvernance de
`execute` (l'appelant reste authentifié, juste par un mécanisme plus faible qu'HMAC) — noté ici
car `tick` est l'appelant réel qui alimente `execute`, mais sa correction est hors périmètre de
ce bloc (aucune instruction du prompt maître ne couvre `tick`).

## R3 — Aucun contexte CloneTrust réel n'est câblé sur la route legacy

`doc.generate`/`hris.sync` sont aujourd'hui **toujours** REQUIRE_APPROVAL, jamais ALLOW, parce
que CloneTrust retombe sur un niveau de confiance par défaut bas en l'absence d'un score/contexte
réel. C'est une protection maximaliste actuellement correcte (aucun dispatch possible), mais cela
signifie aussi qu'**aucune action légitime ne peut jamais s'auto-exécuter via cette route** tant
qu'un vrai contexte de confiance n'est pas conçu et câblé — un chantier futur distinct, hors
périmètre de ce bloc (le prompt maître demande de restaurer la gouvernance existante, pas d'en
concevoir une nouvelle).

## R4 — Le connecteur Make retiré devra être réintroduit avec revue si `ALLOW` redevient nécessaire

Phase 6 a retiré `callMake`/les 3 `MAKE_*_WEBHOOK_URL` entièrement (option préférée du prompt
maître, puisqu'aucune action n'atteint `ALLOW` aujourd'hui). Si une évolution future du moteur
CloneTrust permet un jour `ALLOW`, un connecteur devra être réintroduit **délibérément et avec
revue** (pas récupéré depuis l'historique Git, puisqu'il n'y existe pas non plus — voir
`P0_1_GIT_FORENSIC_TIMELINE.md`). Le plancher `EXECUTION_NOT_AVAILABLE` (501) actuel est
volontairement bloquant pour forcer cette revue plutôt que de laisser un dispatch non réévalué
réapparaître silencieusement.

## R5 — Aucun commit Git n'a encore été fait (rappel du contexte plus large)

`git.exe` reste bloqué au niveau OS dans cet environnement (mémoire "Git Blocked Gotcha") — tous
les correctifs de ce bloc, comme ceux de P0.1/P0.2 d'origine, restent des modifications de
l'arborescence de travail non commitées. C'est exactement le mécanisme qui a permis la perte
initiale documentée dans ce bloc (Phase 2) : tant qu'aucun commit réel n'existe, tout chantier
concurrent futur qui retravaille les mêmes fichiers risque de répéter la même perte. Ce risque
dépasse le périmètre de ce bloc mais est le plus important à signaler au propriétaire : **une
vérification post-bloc que ces changements sont bien committés, via un outil git fonctionnel,
est fortement recommandée avant tout autre chantier touchant ces fichiers.**

## R6 — Flake de test préexistant, sans rapport avec ce bloc

`document-preview-jurisdiction-p20.test.ts` échoue de façon intermittente en exécution parallèle
massive (134 fichiers simultanés) mais passe 7/7 en isolation. Documenté dans
`P0_1_TEST_MATRIX.md` — aucune action requise dans ce bloc (aucun lien de code avec les fichiers
modifiés), mais signalé pour suivi CI général.
