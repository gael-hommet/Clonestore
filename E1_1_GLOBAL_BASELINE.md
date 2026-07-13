# E1.1 — Diagnostic de référence (avant toute réparation)

Pris **après** que le chantier `partner-program` ait corrigé sa propre dérive, et **avant** toute
réparation par E1.1. Aucune supposition : chaque ligne est une commande réellement exécutée.

---

## 1. Ce que C1.4 avait laissé — et qui n'existe plus

| Défaut signalé (fin C1.4) | État au diagnostic E1.1 |
|---|---|
| 7 erreurs TypeScript sous `partner-program` / `api/partners` | **DISPARUES** |
| `listIntroductions` vs `listIntroductionsPaged` | **RÉCONCILIÉ** — un seul export canonique, tous les consommateurs alignés |
| Échec de validation de type de route sur `api/partners/contract/accept` | **RÉSOLU** — `CONTRACT_VERSION` déplacé dans `src/lib/partner-program/contract.ts` |
| `npm run build` en échec | **exit 0** |

**Corrigé par qui ?** Par le **chantier partner lui-même**, entre 17:18 et 17:33 — **pas par E1.1**.
E1.1 a **vérifié** (aucun doublon, aucun emballage de compatibilité inventé, aucune sécurité
affaiblie) et **n'a édité aucun fichier partner**.

---

## 2. Diagnostic exact

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npx vitest run src/lib/partner-program src/app/api/partners` | **47 / 47** |
| `npm run build` | **exit 0** — compilation ✓, validation de routes ✓, 192/192 pages, 396 routes |
| `npx vitest run src/lib/pierre/__tests__/premium-document-system.test.ts` | **4 ÉCHECS** |
| `npx vitest run src/lib/pierre/v1` *(sans `--testTimeout`)* | **1 ÉCHEC** (`fair-claim`) |

---

## 3. Les deux défauts réels — classés avec preuve

### A. Inférence documentaire Pierre — **défaut produit déterministe pré-existant**

| | |
|---|---|
| Fichier | `src/lib/pierre/documents/premium-document-system.ts` |
| Symptôme | `absence`, `performance`, `offboarding`, `employee_summary` retombent **silencieusement** sur `generic_hr` |
| mtime | source **20/05/2026**, test **19/05/2026** — soit ~2 mois **avant** la session |
| Propriétaire probable | Pierre (hors périmètre C1.4 : n'importe pas `lib/pierre/access`) |
| Introduit avant/après C1.4 | **AVANT** |
| Reproductibilité | **100 %** — échoue **aussi en isolation** |
| Classification | **deterministic pre-existing defect** |
| Action | **Corriger le comportement produit** (§6) |

### B. `fair-claim` — **instabilité d'environnement, pas un défaut produit**

| | |
|---|---|
| Fichier | `src/lib/pierre/v1/__tests__/fair-claim.test.ts` |
| Symptôme | `Error: Test timed out in 5000ms.` |
| Reproductibilité | **uniquement sous charge parallèle** — **3/3 verts en isolation** |
| Cause | test d'intégration **PGlite** (~215 travaux insérés) dépassant le **délai vitest par défaut (5 000 ms)** ; le dépôt ne configure aucun `testTimeout` |
| Classification | **flaky / environmental** |
| Action | **Stabiliser le harnais** — sans toucher à l'assertion d'équité (§7) |

---

## 4. Collision de chantier concurrent

| | |
|---|---|
| Détectée | **oui** |
| Fichiers partner édités par E1.1 | **0** |
| Classification | **concurrent-workstream collision** (aucune édition d'E1.1 en cause) |
| Preuve | 4 salves d'écriture partner pendant la session ; `tsc` a oscillé **5 erreurs → 0** sans aucune action de ma part |
| Action | Ne pas éditer un périmètre en mouvement ; ne pas arrêter l'autre chantier ; **re-mesurer** ; **refuser de certifier un vert volatil** |

→ Détail complet : **`E1_1_CONCURRENT_WORKSTREAM_BLOCKER.md`**
