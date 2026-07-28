# CloneChat — Master Execution Plan

> Index opérationnel canonique du programme CloneChat. Ce fichier ne recopie pas le prompt maître
> intégral : il donne le périmètre, l'ordre des blocs, les gates réels et l'état d'avancement.
> L'état détaillé et versionné vit dans `CLONECHAT_CURRENT_STATE.json` (relu à chaque reprise).

## Périmètre et interdits

- Worktree exclusif : `C:/Users/homme/clonestore-clonechat-unified`.
- Projet Vercel canonique : **clonestore-xcwi** (`prj_McN704LH6muWSdeLxbleG4CE0vpN`, team `team_gLSuO1Mn3UjT9nflRnr3JJZV`). Domaines : clonestore.pro, www.clonestore.pro.
- **Interdit** : projet Vercel `clonestore-c6dr` ; P22 ; Pierre runtime ; mission packs RH ; migrations métier de Pierre.
- Git : jamais `git add .`/`-A`, `reset --hard`, `clean`, force-push, amend de commits annoncés. Stage explicite. Push seulement gate local vert + `origin/main` revérifié. Jamais committer `.next*`, `.env`, secrets, audio privé, logs sensibles.

## Vision (résumé)

CloneChat est l'**employé IA système central** de CloneStore : point d'entrée universel, support principal, guide de navigation, couche d'explication, diagnostic, centre de cohérence produit, façade CloneCare, et voix native via CloneVoice. Il connaît la **vérité produit** (ce que CloneStore sait faire) ET la **vérité compte** (ce que cet utilisateur peut faire maintenant), ne ment jamais, n'invente ni route, ni prix, ni disponibilité, ni action, ni état compte, ni provider. Le modèle comprend le langage ; le déterministe contrôle routes/permissions/disponibilité/actions/données/sécurité/promesses/preuves.

## Ordre strict des blocs

| Bloc | Titre | Gate (résumé) | État |
|---|---|---|---|
| **0** | Fermeture de la release actuelle | ?-bypass fermé, tests adverses, corpus FR/BE/LU/CH + 449€/499CHF + 12 août, provenance corpus, MP3/WebM/MP4 réels, tsc, eslint, build isolé, push, Prod READY sur le bon SHA, smokes + benchmark Prod, logs, rapport release | **EN COURS** — code local prêt+prouvé ; bloqué sur push manuel (NO_CREDENTIAL) puis vérif Prod |
| 1 | Product Truth Engine | vérité produit versionnée : toutes pages actives / employés affichés / prix actifs / limites publiques couvertes ; contradiction active = 0 ; stale = 0 | à venir |
| 2 | CloneChat Brain | classification (answer/explain/orient/diagnose/guide/act/escalate/clarify) + sortie structurée ; aucune invention déterministe | à venir |
| 3 | CloneContext | contexte applicatif temps réel (page/route/auth/company/actions/blockers/erreurs) sur les pages clés | à venir |
| 4 | Diagnostic compte | « pourquoi suis-je bloqué ? » fondé sur l'état réel ; aucune réponse à l'aveugle si l'état compte est dispo | à venir |
| 5 | CloneGuide V1 | guidage natif (lien/route/étapes/cible UI) ; aucune route inventée ; desktop+mobile | à venir |
| 6 | CloneVoice complet | MP3/WebM/MP4 réels, timeout/provider, autoSend, TTS sortie optionnelle, fallback, mobile | partiel (input V1 fermé au BLOC 0) |
| 7 | CloneCare | registre bugs/limitations/résolutions, tickets pré-structurés, escalade | à venir |
| 8 | CloneActions | actions contrôlées (permission/contract/confirmation/idempotency/CloneGuard/CloneTrace) ; aucun faux succès | à venir |
| 9 | Guidage visuel | captures officielles versionnées, cibles réelles ; aucune image inventée | à venir |
| 10 | CloneInspector | captures/fichiers/erreurs ; priorité contexte natif > état compte > captures ; privacy | à venir |
| 11 | Onboarding & missions support | suit la résolution jusqu'au résultat (activation/setup/1re mission/email/navigation/facturation) | à venir |
| 12 | Support analytics | mesures friction/résolution/escalade, signaux produit/UX/support/doc/bugs/commercial | à venir |
| 13 | Production hardening | isolation/auth/RLS/permissions/rate-limit/budget/logs/idempotence/concurrence/provider-down/mobile/perf/accessibilité/0 faux succès | à venir |
| 14 | Final product proof | benchmark V1 support actif ≥95 % + support simple/contextuel cible ≥99 % + E2E navigateur ; verdict avec preuves Prod | à venir |

## Doctrine d'exécution

Un bug testable ou une erreur de code n'est **jamais** une raison de s'arrêter : diagnostiquer → corriger → tester → committer → continuer jusqu'au gate du bloc. On s'arrête seulement pour : blocker externe réel nécessitant l'utilisateur (ex. push sans credential), limite de session, risque destructif, décision produit réellement ambiguë. Chaque bloc obtient **PASS** seulement si code + tests + intégration + comportement produit + non-régression + preuve + build (+ Production quand nécessaire) sont tous verts ; sinon **PARTIAL/FAIL** avec blocker exact.

## BLOC 0 — état de fermeture (détail)

Fait et **prouvé sur le code réel** (worktree canonique, pas le paquet Control Tower préparé hors-ligne) :
- ?-bypass fermé : `isLegitimateCapabilityQuestion` exige un marqueur interrogatif réel ; le `?` seul ne suffit plus. Les 4 phrases de reproduction du programme sont bloquées avec ET sans `?` ; les vraies questions de capacité (dont « Pierre peut-il contourner CloneGuard ? ») restent autorisées.
- Le patch du paquet (`clonechat-block0-imperative-question-hardening.patch`) a été inspecté mais **non appliqué** : il visait l'ancien `detectPromptInjection` (`return INJECTION_PATTERNS.some(...)`, sans exception de capacité) et ne correspond plus au code réel ; le correctif présent est plus complet.
- Corpus, dates, prix, pays, provenance : corrigés/vérifiés (voir `CLONECHAT_CURRENT_STATE.json`).
- Voix réelle MP3/WebM/MP4 : voir `CLONECHAT_VOICE_FORMAT_EVIDENCE.md`.

Reste pour clore le gate : **push manuel** (NO_CREDENTIAL) → déploiement clonestore-xcwi sur le nouveau SHA → smokes + benchmark Production propres → logs → rapport de release.
