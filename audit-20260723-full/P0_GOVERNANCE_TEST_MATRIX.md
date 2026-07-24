# P0 — Matrice de tests de gouvernance

18 tests réels ajoutés et exécutés (8 unitaires + 10 d'intégration), tous verts. Aucun test n'a envoyé d'email réel, appelé un webhook externe, ni contacté un provider live — `fetch` est stubé et son absence d'appel est vérifiée explicitement dans chaque test d'intégration.

## Tests unitaires — `src/lib/pierre/__tests__/legacy-execute-governance.test.ts`

| ID | Entrée | Résultat attendu | Résultat obtenu | Effet externe | Preuve | Verdict |
|---|---|---|---|---|---|---|
| U1 | `email.send`, payload valide | DENY | **DENY** | aucun | `summary.guard_decision === "block"` | ✅ |
| U2 | `hris.sync`, payload valide | pas ALLOW | **REQUIRE_APPROVAL** | aucun | `allowed_to_auto_execute === false` | ✅ |
| U3 | action inconnue (`employee.create`) | non-ALLOW-par-défaut du module (le routage fail-closed réel est assuré par route.ts, hors périmètre de ce module pur) | outcome ∈ {ALLOW, REQUIRE_APPROVAL, DENY} sans crash | aucun | test de non-crash | ✅ |
| U4 | `doc.generate`, texte "procédure de licenciement" | non-ALLOW | **REQUIRE_APPROVAL** | aucun | signal texte "licenci" détecté | ✅ |
| U5 | `doc.generate`, texte "signalement de harcèlement" | DENY | **DENY** (règle black, `can_override:false`) | aucun | `outcome === "DENY"` | ✅ |
| U6 | `doc.generate`, contenu bénin ("bienvenue dans l'équipe") | **REQUIRE_APPROVAL** (pas ALLOW — confirmé empiriquement, voir note) | **REQUIRE_APPROVAL** | aucun | `guard_decision="allow_with_warning"`, `governance_decision="supervised"` | ✅ |
| U7 | deux appels identiques | déterminisme | résultats identiques | aucun | `d1.summary` === `d2.summary` | ✅ |
| U8 | `email.send` | événements d'audit exploitables | `cloneGuardAudit`/`governanceAudit` peuplés | aucun | présence des champs | ✅ |

**Note U6 (finding important)** : sans donnée de confiance/historique réelle (`company_trust_score` non transmis par cette route legacy), CloneTrust retombe systématiquement sur le niveau "supervised" (40/100), qui prime sur le "allow_with_warning" de CloneGuard. Conséquence vérifiée : **aucune des 3 actions ne s'auto-exécute jamais en conditions réelles actuelles**, pas seulement email/HRIS.

## Tests d'intégration — `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts`

| ID | Scénario | Résultat attendu | Résultat obtenu | Effet externe (`fetch`) | Verdict |
|---|---|---|---|---|---|
| I1 | Requête sans signature HMAC | 401 UNAUTHORIZED | **401** | 0 appel | ✅ |
| I2 | Signature HMAC invalide | 401 UNAUTHORIZED | **401** | 0 appel | ✅ |
| I3 | `client_id` du corps ≠ header signé | 403 CLIENT_ID_MISMATCH | **403** | 0 appel | ✅ |
| I4 | `client_id` sans accès Pierre (`agent_configs` vide) | 403 FORBIDDEN | **403** | 0 appel | ✅ |
| I5 | `email.send` payload valide, accès valide | GOVERNANCE_BLOCKED, jamais envoyé | **403, GOVERNANCE_BLOCKED**, audit `ok:false` | **0 appel** | ✅ |
| I6 | `doc.generate` bénin | REQUIRE_APPROVAL (202), aucun document publié | **202, decision="REQUIRE_APPROVAL"**, `documentsRows.length===0` | **0 appel** | ✅ |
| I7 | `hris.sync` | jamais exécuté directement | **ok:false**, code ∈ {GOVERNANCE_BLOCKED, HUMAN_APPROVAL_REQUIRED} | **0 appel** | ✅ |
| I8 | Action inconnue (`employee.create`) | 400 UNKNOWN_ACTION (comportement pré-existant, inchangé) | **400** | 0 appel | ✅ |
| I9 | Replay du même `request_id` déjà enregistré `ok:true` | résultat précédent renvoyé, pas de ré-exécution | **200, idempotent:true, document_id du cache**, 0 nouvelle insertion | 0 appel | ✅ |
| I10 | Double requête simultanée, même `request_id`, pas encore en cache | aucune exécution externe dans les deux cas | les deux réponses ≠ 200, **0 appel** dans les deux cas | 0 appel | ✅ |

## Tests de non-régression (suites existantes, non modifiées, exécutées en direct)

| Suite | Fichiers | Tests | Résultat |
|---|---|---|---|
| `hr-governance.test.ts` + `hr-governance-runtime.test.ts` + `hr-cloneguard.test.ts` + `hr-cloneguard-runtime.test.ts` + `hr-employee-actions.test.ts` | 5 | 464 | ✅ 464/464 verts |
| `src/lib/pierre/**` (sweep complet, moteur v1/hr) | 119 (+1 skip pré-existant) | 5390 | ✅ 5389/5389 verts (1 skip pré-existant, non lié) |
| `src/app/api/pierre/**` (toutes routes API Pierre) | 12 | 211 | ✅ 211/211 verts |

**Total** : 18 tests nouveaux + 6064 tests de non-régression existants exécutés en direct dans cette session — **0 échec, 0 régression**.

## Ce qui n'a PAS été testé (limites explicites)

- Test d'un appelant externe réel (ex. un scénario Make.com configuré pour appeler `/api/pierre/execute` avec un vrai secret HMAC) — impossible à vérifier depuis le code seul ; hors périmètre d'un audit en lecture/test local.
- `/api/pierre/tick` en conditions réelles avec un producteur `pierre_queue` — aucun producteur n'existe actuellement dans le code (voir P0_EXECUTION_PATH_MATRIX.md), donc ce chemin n'a pas pu être exercé de bout en bout avec une vraie tâche en file.
- Comportement sous kill-switch/feature-flag global de Pierre (`AI_EMERGENCY_SHUTDOWN` etc.) — cette route n'appelle aucun provider IA, ce contrôle ne s'applique pas directement à elle.
