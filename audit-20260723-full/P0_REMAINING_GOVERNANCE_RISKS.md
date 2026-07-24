# P0 — Risques de gouvernance restants (après fermeture du P0 initial)

Ce document liste ce qui restait ouvert après le bloc P0.1. **Mise à jour 2026-07-23 (soir) : RISQUE-1 et RISQUE-2 ci-dessous sont désormais FERMÉS par le bloc P0.2** — voir `P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md` et `P0_2_REMAINING_EXECUTION_RISKS.md` pour le détail et les nouveaux risques résiduels (distincts de ceux-ci). Conservés ci-dessous à titre d'historique de traçabilité, marqués fermés.

## RISQUE-1 — ~~`src/app/api/pierre/action/route.ts` (1037 lignes) : 0 référence CloneGuard/gouvernance, 3 webhooks Make dédiés~~ **FERMÉ (bloc P0.2)**

**Sévérité (avant P0.2) : P0/P1 — même classe de défaut que le contournement fermé, non traité dans P0.1 (hors périmètre explicite de ce bloc-là : "ferme-le seulement s'il relève exactement du même contrat ; sinon enregistre-le séparément").**

- Preuve : `grep "cloneguard|governance|CloneGuard|evaluateGovernance" src/app/api/pierre/action/route.ts` → 0 résultat.
- Le fichier résout ses propres variables de webhook (`resolveWebhook`, lignes 264-268 et 735-737) : `MAKE_PIERRE_ACTION_WEBHOOK_URL`, `MAKE_PIERRE_EMAIL_WEBHOOK_URL`, `MAKE_PIERRE_DOC_WEBHOOK_URL` — un jeu de variables **différent** de celui retiré de `/api/pierre/execute`, confirmant une **troisième architecture parallèle de dispatch Make** pour des actions Pierre (en plus d'`/api/pierre/execute` et `/api/router`).
- Non traité ici car : (a) le fichier fait 1037 lignes — une lecture complète + une correction sûre équivalente à ce bloc dépasserait le scope explicitement borné de ce P0 ("ne dilue pas le périmètre dans d'autres optimisations") ; (b) son contrat d'entrée (types d'actions, schéma de payload, modèle d'authentification) n'a pas été vérifié comme identique à celui d'`/api/pierre/execute` — une correction hâtive risquerait de casser un usage réel non identifié.
- **Action recommandée** : bloc de fermeture dédié, avec la même méthode (cartographie des appelants réels, puis adaptateur fin vers `evaluateLegacyExecuteGovernance` ou équivalent).

## RISQUE-2 — ~~`src/app/api/router/route.ts` (205 lignes) : 0 référence CloneGuard/gouvernance~~ **FERMÉ (bloc P0.2, neutralisation 410 Gone)**

**Sévérité (avant P0.2) : P0/P1 — déjà documenté dans l'audit du 2026-07-23 (CLONESTORE_ISSUE_REGISTER.md ISSUE-18) comme un défaut de sécurité distinct (URL Make codée en dur + auth par token en clair sur une table absente des migrations suivies). Confirmé ici comme relevant AUSSI du même défaut de gouvernance (0 CloneGuard/gouvernance).**

- Non traité dans ce bloc pour la même raison de discipline de périmètre.
- **Action recommandée** : à traiter dans le même bloc de fermeture que RISQUE-1, ou dans un bloc dédié combinant la correction de sécurité (ISSUE-18) et la fermeture de gouvernance.

## RISQUE-3 — Aucune preuve de l'absence d'appelant EXTERNE réel sur `/api/pierre/execute`

Ce bloc a prouvé, par lecture de code exhaustive, qu'aucun appelant INTERNE nécessaire ne dépend du comportement permissif retiré (voir P0_EXECUTION_PATH_MATRIX.md — `tick` n'a pas de producteur, les scripts sont des outils manuels de dev). **Il n'est en revanche pas possible de prouver, depuis le code seul, qu'aucun scénario Make.com externe (configuré côté SaaS Make, hors dépôt) n'appelle aujourd'hui cette route avec un vrai secret HMAC.** C'est pourquoi la route n'a pas été supprimée (Option A) mais transformée en adaptateur fin fail-closed (Option B) : un tel appelant externe recevrait désormais systématiquement DENY/REQUIRE_APPROVAL au lieu d'un contournement silencieux — le risque de contournement est fermé, mais un éventuel appelant externe legacy cesserait de fonctionner comme avant (ce qui est le résultat recherché, pas un risque résiduel).

## RISQUE-4 — `/api/pierre/tick` reste un chemin HTTP interne signé, non testé de bout en bout

`tick` relaie désormais transitivement vers la gouvernance canonique (aucune modification directe nécessaire), mais son propre comportement de retry/dead-lettering (6 tentatives puis `status:"dead"`) n'a pas été re-testé en conditions réelles avec une tâche en file, faute de producteur existant pour `pierre_queue`. Risque faible (chemin déjà inerte en pratique), à revalider si `pierre_queue` est un jour réellement alimenté.

## RISQUE-5 — CloneTrust "supervised par défaut" masque la distinction entre "aucune donnée" et "confiance réellement faible"

Le mécanisme qui ferme ce P0 s'appuie en partie sur le fait que CloneTrust retombe sur "supervised" (40/100) quand aucun `company_trust_score` n'est fourni. C'est un comportement sûr (fail-closed) mais qui **confond** "nous n'avons pas mesuré la confiance" et "la confiance mesurée est moyenne" — un futur mainteneur qui câblerait un jour un score de confiance réel pour cette route legacy verrait son comportement changer (potentiellement vers ALLOW pour `doc.generate`) sans qu'aucune alarme ne se déclenche. Documenté ici pour vigilance future, pas un défaut actif.

## Ce qui N'EST PAS un risque restant (vérifié, pour éviter tout doute)

- Le pipeline mission/tâche canonique (`execute-task.ts`, `mission-service.ts`) : non modifié, non-régression prouvée (5389 tests).
- La fragmentation de gouvernance en 4 implémentations documentée dans l'audit initial (ISSUE-07) : non résolue par ce bloc (hors périmètre — ce bloc ferme UN contournement précis, pas la fragmentation architecturale globale), reste dans le backlog P1 existant.
