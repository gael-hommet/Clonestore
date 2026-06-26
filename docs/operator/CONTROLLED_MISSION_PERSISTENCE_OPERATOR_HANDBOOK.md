# Controlled Mission Persistence — Operator Handbook (design-only · still no execution)

> **Handbook opérateur design-only · Aucune activation.**
> Cette documentation explique l'exploitation sûre, pas l'activation serveur.
> La source active reste localStorage. Aucun GET/POST serveur. Aucune exécution.

**Audience** : opérateur humain · gouvernance · revue technique.
**Périmètre** : comprendre et exploiter en sécurité la chaîne P5.1 → P5.8 sans rien activer.

---

## 1. Principe fondamental

- **persistence ≠ execution** · **restore ≠ execution** · **sync ≠ execution**.
- localStorage reste la **source active** jusqu'à une activation serveur gouvernée future.
- Le moteur Pierre n'est **jamais** appelé dans P5 (`src/lib/pierre/**` intact).
- Aucune activation sans **revue manuelle gouvernée**.

## 2. État actuel

| Élément | État |
|---|---|
| Source de données active | localStorage |
| Safe apply local (P5.1) | actif |
| Review local (P5.2) | actif |
| Preflight local (P5.3) | actif |
| Server persistence design (P5.4) | ready (inactif) |
| Manual activation QA (P5.5) | ready (inactif) |
| Restore UI design (P5.6) | ready (inactif) |
| Final gate (P5.7) | ready |
| Transition plan (P5.8) | ready |
| Server persistence / restore / sync | **inactif** |
| Runtime execution / Pierre / IA / email / document / CloneVoice | **inactif** |

## 3. Ce qui est ACTIF (local uniquement)

Créer une Controlled Mission locale · review local · approval local · request changes
local · preflight local · voir server draft design · voir manual activation QA · voir
restore UI design · voir final gate · voir transition plan.

## 4. Ce qui est INACTIF (futur / interdit en P5)

Server persistence · server restore · server sync · runtime execution · Pierre execution ·
IA execution · génération email/document/PDF · CloneVoice execution.

## 5. Glossaire (extrait)

- **Controlled Mission** — mission gouvernée préparée ; jamais une mission réelle exécutée.
- **Preflight** — readiness gate locale ; *ready = candidate future, jamais exécution*.
- **Server Persistence Draft** — design serveur (P5.4) ; SQL non appliqué, flag off.
- **persistence ≠ execution / restore ≠ execution / sync ≠ execution** — ne jamais confondre.
- **RLS** — Row Level Security ; obligatoire avant toute persistance serveur.
- **idempotency** — requise pour les futures routes write serveur.

## 6. Workflows opérateur (W1 → W10)

1. **W1** Create Local Controlled Mission
2. **W2** Review & Approve Locally
3. **W3** Run Local Preflight
4. **W4** Inspect Server Draft Design
5. **W5** Inspect Manual Activation QA
6. **W6** Inspect Restore UI
7. **W7** Inspect Final Gate
8. **W8** Inspect Transition Plan
9. **W9** Collect Evidence Pack
10. **W10** Decide No-Go / Future Phase

Chaque workflow : `expected_result` défini · `forbidden_actions` (Appliquer SQL / Activer
flag / Créer route / Exécuter) · `no_execution_confirmed: true`.

## 7. Verification playbooks

Vérifier : localStorage source active · SQL non appliqué (DO NOT APPLY) · flag false · no
route · no GET/POST serveur · no execution · no Pierre/IA/email/document/CloneVoice ·
public launch externe non validé · scale 80k non prouvé.

## 8. Incident playbooks

SQL appliqué accidentellement · flag activé · route créée · GET/POST serveur détecté ·
mission exécutée · moteur Pierre touché · go-live proofs modifiés.
→ **Action commune** : documenter, appliquer le rollback, ne jamais déclencher le runtime.

## 9. Rollback global

1. Désactiver le flag serveur (disable flag → false).
2. Revenir à localStorage-only.
3. Supprimer/désactiver la route future si nécessaire.
4. Ignorer les server rows.
5. Vérifier la RLS.
6. Ne **jamais** déclencher le runtime.

## 10. Decision matrix

| Situation | Autorisé | Interdit |
|---|---|---|
| SQL non appliqué | Continuer en design | Déclarer le serveur actif |
| Flag false | Rester local-only | Attendre une persistance serveur |
| Preflight ready | Candidate future | **execute** |
| Final gate go_for_next_design_phase | Phase de design suivante | **production launch** |
| Transition plan ready | Préparation doc/opérateur | Activation |
| Lancement public externe non validé | Readiness interne | Lancement public |

## 11. Command reference

`test:phase5-9` · `check:controlled-mission-persistence-operator-handbook` · `tsc` ·
`test:phase5-8` … `test:phase5-1` · checks P5.1 → P5.8 · `test:pfinal02` · `npm test` ·
`npm run build`.

---

> **Rappel** : documentation design-only. Aucune activation. SQL non appliqué. Flag off.
> Aucune route. Aucun GET/POST serveur. localStorage source active. Aucune exécution.
> scale 80k non prouvé. lancement public externe non validé.
