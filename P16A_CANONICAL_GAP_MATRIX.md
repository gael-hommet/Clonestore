# P16A — Canonical Gap Matrix (evidence-derived)

**Recovered from:** `src/lib/clonestore/ultimate/p16-master-split.ts` (`P16_MASTER_SPLIT` category `pierre_ultimate`, authored in P16.0) cross-checked against `P16A_PIERRE_ULTIMATE_COMPLETION_PLAN.md` and the P14 vision catalog. The item **set** is the single source of truth: `getPierreUltimateItems()` — `crossCheckCanonicalItems()` fails if P16A ever drifts (no invention, no omission).

**Canonical count:** **12** Pierre Ultimate items. **Capability canon:** **215** (derived from `HR_CAPABILITIES.length`, never hardcoded).

**Doctrine.** Pierre-owned P16A behavior = *understand → retrieve relevant capabilities (bounded) → decompose into a governed mission → classify autonomy with the human-only floor → expose provider/legal truth → declare the T1/T2/CloneChat needs*. The **live delivery** (T1/T2 wiring) is **P16C**; external providers stay **blocked**. A row is `complete` when its Pierre-owned behavior is **proven by a real probe** (not "a file exists"), with the P16C/external dependency recorded honestly.

**Status legend.** `featureStatus` = master-split feature-level truth. `pierreOwned` = the P16A-owned behavior status, evidence-derived.

| # | Canonical id | Label | featureStatus | pierreOwned | Evidence (probe over the REAL reused runtime) | P16C dependency | External blocker | Forbidden claim |
|---|---|---|---|---|---|---|---|---|
| 1 | `pierre.mission_depth` | Profondeur du moteur de missions RH | verified | **complete** | `compileMissionPlan` compiles a 3-step DAG, fingerprint set | T1:workflow · T2:clonecontinuum | — | Exécution autonome d'actes RH sensibles |
| 2 | `pierre.document_depth` | Profondeur documentaire RH | partial | **complete** | 16 caps retrieved; `contract.create_amendment` → disposition `prepare` (jamais `execute_local`) | T1:document,export · T2:cloneadn,clonebrief,clonereview | — | Contrat/avenant légalement garanti |
| 3 | `pierre.dossier_360` | Dossier salarié 360 | partial | **complete** | 14 `employee360` capacités; MemoryTech/EvidenceTech déclarées | T1:memory,evidence · T2:cloneadn,clonetrace | — | Registre RH officiel de vérité |
| 4 | `pierre.onboarding_offboarding` | Onboarding / offboarding | partial | **complete** | 12 caps; domaine onboarding/offboarding présent | T1:workflow,notification,document · T2:clonebrief | — | Remplacement des décisions du manager |
| 5 | `pierre.absences_prepayroll` | Absences + pré-paie | partial | **complete** | 16 caps; paie externe/légale **jamais autonome** | T1:document,export | Provider SIRH/paie live (transmission) | Moteur de paie / DSN |
| 6 | `pierre.interview_perf_training` | Entretiens / performance / formation | partial | **complete** | 18 caps perf/training/career; date « la semaine prochaine » résolue | T1:calendar,document · T2:clonelearn,clonereview | Provider calendrier live | Décider notations/promotions |
| 7 | `pierre.employee_relations_sensitive` | Cas RH sensibles (préparation) | partial | **complete** | floor `humanOnly=true`, catégorie `sanction` isolée | T1:evidence · T2:cloneguard,clonetrace,clonepolicy | — | Décision disciplinaire finale |
| 8 | `pierre.proactive_followup` | Suivi RH proactif | partial | **complete** | 10 caps `proactive`; intent `status` → `requiresAuthoritativeRead` | T1:notification · T2:clonesignals | Push temps réel live (rappels cockpit only) | Agir sans validation |
| 9 | `pierre.monthly_value_report` | Rapport de valeur/ROI mensuel | architecture_ready | **complete** | 6 caps `reporting`; AnalyticsTech déclarée; ROI = estimations | T1:analytics | — | Économies garanties |
| 10 | `pierre.sector_adaptation` | Adaptation sectorielle RH | architecture_ready | **complete** (honnête) | dépendance externe déclarée ; **refus d'inventer le droit** + disclosure | T1:connector | Sourcing légal/sectoriel externe | Conforme au droit [secteur/pays] |
| 11 | `pierre.hr_helpdesk_quality` | Qualité du helpdesk RH | verified | **complete** | 16 caps ancrées récupérées (borné) | T1:memory | — | Conseil juridique garanti |
| 12 | `pierre.hr_quality_control` | Contrôle qualité RH (CloneGuard) | partial | **complete** | gate réel : sensible→`black`(bloqué), sûr→`green` | T1:evidence · T2:cloneguard | — | Garantie de conformité |

## Rollup

- **Already complete before P16A (feature verified):** 1 (mission_depth), 11 (hr_helpdesk_quality).
- **Partial before P16A, Pierre-owned completed in P16A:** 2, 3, 4, 5, 6, 7, 8, 12.
- **Architecture-ready before P16A, Pierre-owned completed in P16A:** 9 (value report — honest estimates), 10 (sector — honest refusal + disclosure).
- **Pierre-owned status:** **12/12 complete** (`exactPartialItems = []`, `exactBlockers = []`).
- **External/live blocked (feature-level, by design):** 5 (payroll transmission), 6 (calendar live), 8 (real-time push), 10 (sector legal sourcing). These do **not** invalidate the locally-complete Pierre-owned behavior; they are explicit.
- **Reserved for P16C (tech wiring, not a P16A gap):** every T1/T2 need above — declared, never wired here.

## What P16A actually did (per item)

For every item, P16A added an **additive orchestration** over the ONE verified P8.14 runtime — **no second HR brain, no second registry, no second planner, no CloneOS duplication, no T1/T2 wiring**:

1. `PierreUltimateIntegrationContract` (the P16C deliverable) that, for any HR request, reuses `interpretRequest` (understanding), `retrieveCapabilities` (bounded), `computeClarifications`, `evaluateGuard` + `decideValidation` (autonomy), and produces the governed disposition + T1/T2/CloneChat needs + provider/legal truth + next safe step.
2. A **deepened human-only floor** (`sensitive-floor.ts`) that closes a real detection gap — the base rule matched the noun *augmentation* but not the verb *augmente*; it also lacked promotion / explicit legal-conclusion / protected-class cues. It only ever **raises** the floor and reuses `evaluateGuard`.
3. A pure **continuity-intent** classifier that resolves *which authoritative mission/artifact* a follow-up ("continue", "corrige ça", "utilise la dernière version", "qu'est-ce qui bloque ?") refers to, distinguishing a correction from a new mission, surfacing ambiguity, and demanding an authoritative re-read (never trusting chat text).
4. A **capability adapter** that preserves the canon's domain/risk/autonomy/human-only/legal/provider/closure metadata and derives the honest per-capability disposition — with the count **derived** from the registry.
5. An **evidence-derived gap matrix** + **command center** that compute readiness from real behavior (probes over the reused runtime), not from static status objects.
