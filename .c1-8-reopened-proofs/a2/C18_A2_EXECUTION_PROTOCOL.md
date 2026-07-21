# C1.8 A2 — Protocole d'exécution du jugement, token-safe

Ce document décrit le protocole recommandé. **Aucun juge n'est lancé par ce document lui-même** —
il attend une autorisation explicite et distincte par lot (`GO C1.8 — JUDGE A / PACKETS 001-004`,
etc.).

## Juge primaire A

- Modèle : **Claude Sonnet 5**, effort **High**.
- **Sessions neuves** à chaque lancement — jamais une continuation de la session de préparation.
- **Aucun `/context all`**, **aucune lecture du repository**.
- Fichiers fournis à la session, uniquement :
  - `C18_A2_CANONICAL_REFERENCE.md` ;
  - `C18_A2_BLIND_JUDGING_RUBRIC.md` ;
  - `C18_A2_RESULT_SCHEMA.json` ;
  - les paquets assignés (`packets-primary/C18_A2_PRIMARY_PACKET_0NN.json`).
- **Maximum 4 paquets par session** (100 cas).
- `/usage` exécuté au début et à la fin de la session.
- Un fichier de résultat JSON sauvegardé **par paquet** (schéma `C18_A2_RESULT_SCHEMA.json`, un
  objet par cas, tableau ordonné par `id`).
- **Aucune continuation vers le paquet suivant** tant que le résultat du paquet précédent n'est pas
  sauvegardé sur disque et validé (1 objet par cas, ids exacts, aucun champ hors schéma).

## Juge secondaire B

**Ne juge pas immédiatement les 1003 cas.** Reçoit uniquement, après compilation des verdicts A :
- tous les `FAIL` ;
- tous les `AMBIGUOUS` ;
- tous les `UNJUDGEABLE` ;
- tous les `confidence: low` (quel que soit le verdict) ;
- tous les `MINOR` avec `requires_second_judge: true` ;
- un **échantillon déterministe de 10 % des `PASS`**, sélectionné localement (pas manuellement) avec
  une graine dérivée du hash du corpus (`full_answer_hash_aggregate` du manifeste) — par exemple
  `seed = parseInt(full_answer_hash_aggregate.slice(0, 8), 16)` puis un tirage pseudo-aléatoire
  déterministe reproductible sur cette graine, jamais `Math.random()`.

Conditions :
- Modèle : **Claude Sonnet 5**, effort **High**.
- **Session séparée** du juge A.
- **Même aveuglement** exact (mêmes champs visibles, mêmes champs interdits).
- **Ne voit jamais le verdict du juge A** avant de produire le sien.

## Arbitre C

Uniquement pour :
- les désaccords de verdict entre A et B ;
- les défauts à fort impact identifiés par l'un des deux juges.

Conditions :
- Modèle recommandé : **Opus 4.8**.
- Effort **High** — **jamais `xhigh`**.
- Ne voit **jamais** les anciens labels (`generator_label`/`category`/`must_refuse`) ni les raisons
  A1D.
- Produit **son propre verdict indépendant AVANT** de voir les verdicts A et B (procédure en deux
  étapes : (1) jugement aveugle indépendant, (2) comparaison et décision finale une fois son propre
  verdict déjà écrit) — jamais un arbitrage qui commence par lire les deux verdicts en même temps que
  le cas.

## Séquencement recommandé

1. Juge A traite les 41 paquets par lots de ≤4, sur plusieurs sessions successives, chacune validée
   avant la suivante.
2. Une fois les 41 résultats A compilés : sélection déterministe du sous-ensemble B (FAIL +
   AMBIGUOUS + UNJUDGEABLE + low confidence + MINOR escaladés + échantillon 10 % des PASS).
3. Juge B traite ce sous-ensemble, en sessions séparées, même règles de lot/validation que A.
4. Comparaison A/B : accords directs conservés ; désaccords + défauts à fort impact envoyés à
   l'Arbitre C.
5. Synthèse finale — **hors périmètre de ce document**, autorisation distincte requise.

Aucune étape de ce protocole n'est exécutée par la préparation A2P elle-même.
