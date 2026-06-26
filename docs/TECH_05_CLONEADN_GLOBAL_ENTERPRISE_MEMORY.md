# TECH-05 — CloneADN Global / Enterprise Memory

## 1. Objectif

TECH-05 crée la couche **GlobalEnterpriseMemory** au niveau de la plateforme CloneStore.

**Avant TECH-05 :** CloneADN existait partiellement dans Pierre (`src/lib/pierre/adn/`) comme
adaptateur Pierre-spécifique de B28 (`src/lib/clonestore/adn/`). Aucun employé IA autre que
Pierre ne pouvait consommer cette mémoire de façon structurée.

**Après TECH-05 :** `GlobalEnterpriseMemory` est une couche plateforme indépendante de Pierre.
Pierre devient "le premier consommateur RH" via le `pierre-adn-bridge`. Les futurs employés IA
(Emma, Lucas, Sophie) consommeront la même couche via le même mécanisme.

**IMPORTANT :**
- Les `EnterpriseHumanProfile` sont les **vrais humains** de l'entreprise cliente.
- Ces humains **ne sont PAS des employés IA CloneStore** (Pierre, Emma, Lucas…).
- CloneADN n'est pas un CRM. CloneADN n'est pas un SIRH complet.

---

## 2. Architecture

```
CloneStore Platform
  └── GlobalEnterpriseMemory (TECH-05)
        ├── global-enterprise-memory.ts     — types purs
        ├── global-enterprise-memory-defaults.ts  — constructeurs
        ├── global-enterprise-memory-validation.ts — 25 règles
        ├── global-enterprise-memory-snapshot.ts   — résumé
        ├── global-enterprise-memory-storage.ts    — store in-memory V1
        ├── employee-adn-access.ts          — profils d'accès employés IA
        ├── pierre-adn-bridge.ts            — bridge Pierre ↔ GlobalEnterpriseMemory
        └── index.ts                        — exports publics

Couches existantes (NON modifiées par TECH-05) :
  src/lib/clonestore/adn/types.ts        — CloneADNProfile (B28)
  src/lib/clonestore/adn/profile.ts      — B28 defaults/utils
  src/lib/clonestore/empreinte/types.ts  — EnterpriseEmpreinte (B44)
  src/lib/pierre/                        — moteur Pierre inchangé
```

---

## 3. Type principal : GlobalEnterpriseMemory

```typescript
interface GlobalEnterpriseMemory {
  memory_id: string;          // "mem_<id>"
  company_id: string;

  // Blocs fondamentaux
  identity: EnterpriseIdentityProfile;
  tone: EnterpriseToneProfile;
  communication: EnterpriseCommunicationProfile;

  // Gouvernance
  validation_circuits: EnterpriseValidationCircuit[];

  // Annuaire humain (VRAIS humains, pas des employés IA)
  humans: EnterpriseHumanRegistry;

  // Structure organisationnelle
  sites: EnterpriseSiteProfile[];
  departments: EnterpriseDepartmentProfile[];

  // Documents
  documents: EnterpriseDocumentProfile[];

  // Règles et préférences
  rules: EnterpriseRuleProfile[];
  preferences: EnterprisePreferenceProfile[];

  // Patterns opérationnels
  operational_patterns: EnterpriseOperationalPattern[];

  // Items de mémoire génériques
  memory_items: EnterpriseMemoryItem[];

  // Accès des employés IA
  employee_access_profiles: EnterpriseEmployeeAccessProfile[];

  // Métadonnées
  metadata: GlobalEnterpriseMemoryMetadata;
}
```

---

## 4. Distinction fondamentale : humains vs employés IA

| Entité | Type | Description |
|--------|------|-------------|
| `EnterpriseHumanProfile` | Vrais humains clients | DRH, managers, collaborateurs — personnes réelles |
| Employé IA (Pierre, Emma…) | Agents CloneStore | Consomment la mémoire via leurs contrats de runtime |

Les `EnterpriseHumanProfile` sont dans `humans.humans[]`.
Les employés IA accèdent à la mémoire via `employee_access_profiles`.

**Ce que CloneADN N'est PAS :**
- Ce n'est pas un CRM (pas de leads, prospects, pipeline commercial).
- Ce n'est pas un SIRH complet (pas de bulletins de paie, contrats complets, congés).
- Ce n'est pas un système de gestion documentaire (pas de stockage de fichiers).

---

## 5. Couche d'accès employés IA (V1)

**Règle V1 fondamentale :** Aucun employé IA ne peut écrire librement dans
`GlobalEnterpriseMemory`. `writable_categories = []` pour tous.

```
CloneLearn (roadmap) activera les écritures autonomes contrôlées plus tard.
```

| Profil d'accès | Catégories lisibles | Humains | Documents | Sensible |
|----------------|---------------------|---------|-----------|----------|
| Base (tous) | identity, tone, communication | Non | Non | Non |
| Standard | + rules | Non | Non | Non |
| RH (Pierre) | + humans, documents, processes, hr | Oui | Oui | Non |
| Finance | + documents, finance | Non | Oui | Non |
| Legal | + documents, legal | Non | Oui | Non |

---

## 6. Pierre ADN Bridge

Le `pierre-adn-bridge.ts` connecte `GlobalEnterpriseMemory` au runtime Pierre.
Ce bridge **ne modifie pas** le moteur Pierre.

```typescript
// Distille la mémoire globale en contexte Pierre
const ctx = buildPierreEnterpriseContextDirect(memory);
// → { company_name, language, timezone, default_tone, accessible_memory_items, ... }
```

Pierre reste "le premier employé IA RH consommateur de mémoire globale".

---

## 7. Validation — 25 règles

| Code | Champ | Sévérité | Description |
|------|-------|----------|-------------|
| R01 | memory_id | error | memory_id requis |
| R02 | company_id | error | company_id requis |
| R03 | identity.company_name | error | Nom entreprise requis |
| R04 | identity.country | error | Code ISO 3166-1 alpha-2 |
| R05 | identity.language | error | Code ISO 639-1 |
| R06 | identity.timezone | error | Timezone IANA requis |
| R07 | tone.default_tone | warning | Ton par défaut manquant |
| R08 | tone.forbidden_tones | error | Doit être un tableau |
| R09 | communication.default_channel | warning | Canal par défaut manquant |
| R10 | communication.allowed_channels | warning | Aucun canal défini |
| R11 | validation_circuits | error | circuit_id requis, sla_hours ≥ 0 |
| R12 | humans.total_count | warning | Cohérence total_count / active_count |
| R13 | humans.humans | error | human_id uniques |
| R14 | humans[].full_name | error | Nom complet requis |
| R15 | sites | error | site_id uniques |
| R16 | sites | warning | Maximum 1 siège social actif |
| R17 | departments | error | department_id uniques |
| R18 | documents | error | document_id uniques |
| R19 | rules | error | rule_id uniques |
| R20 | memory_items[].confidence | error | 0.0 ≤ confidence ≤ 1.0 |
| R21 | memory_items | error | item_id uniques |
| R22 | employee_access_profiles | error | employee_slug uniques |
| R23 | writable_categories | warning | Doit être vide en V1 |
| R24 | validation_circuits | warning | Approbateurs dans le registre |
| R25 | metadata.version | error | Version requise |

---

## 8. Storage V1 (in-memory)

La couche `global-enterprise-memory-storage.ts` expose un store en mémoire.

```typescript
// Écrire
setEnterpriseMemory(memory);
patchEnterpriseMemory(companyId, patch);

// Lire
getEnterpriseMemory(companyId);       // null si absent
getOrCreateEnterpriseMemory(companyId); // crée vide si absent

// Accès filtré pour employé IA
getMemoryItemsForEmployee(companyId, "pierre");
getHumansForEmployee(companyId, "pierre");
```

**Ce qui n'est PAS fait en V1 :**
- Aucune persistance Supabase.
- Aucun endpoint API.
- Aucune migration DB.

**TECH-06+ branchera le stockage Supabase.**

---

## 9. Score de couverture

Le `coverage_score` (0–100) mesure la complétude de la mémoire selon 7 blocs :

| Bloc | Poids | Critère |
|------|-------|---------|
| Identité | 20 | company_name, country, language, timezone |
| Ton | 15 | default_tone, formality, vocabulary |
| Communication | 10 | allowed_channels, default_channel |
| Validation | 15 | circuits avec approbateurs |
| Humains | 20 | humains actifs enregistrés |
| Règles | 10 | règles actives |
| Mémoire | 10 | items haute confiance |

---

## 10. Ce qui N'A PAS été fait dans TECH-05

| Ce qui n'a PAS été fait | Pourquoi |
|-------------------------|----------|
| Persistance Supabase | Pas de backend branché — TECH-06+ |
| Création Emma/Lucas/Sophie | Hors périmètre |
| Modification moteur Pierre | Pierre (B38-B48) est clos |
| Modification CloneADNProfile (B28) | Inchangé |
| Modification EnterpriseEmpreinte (B44) | Inchangée |
| UI lourde | TECH-05 = couche pure types/logique |
| Stockage de données sensibles en dur | Interdit |
| Migration DB réelle | Hors périmètre V1 |

---

## 11. Fichiers créés dans TECH-05

```
Créés :
  src/lib/clonestore/adn/global-enterprise-memory.ts          — types purs
  src/lib/clonestore/adn/global-enterprise-memory-defaults.ts — constructeurs
  src/lib/clonestore/adn/global-enterprise-memory-validation.ts — 25 règles
  src/lib/clonestore/adn/global-enterprise-memory-snapshot.ts  — snapshot
  src/lib/clonestore/adn/global-enterprise-memory-storage.ts   — store V1
  src/lib/clonestore/adn/employee-adn-access.ts               — profils accès
  src/lib/clonestore/adn/pierre-adn-bridge.ts                 — bridge Pierre
  src/lib/clonestore/adn/index.ts                             — exports publics
  src/lib/clonestore/adn/__tests__/global-enterprise-memory-tech05.test.ts — 45 tests
  docs/TECH_05_CLONEADN_GLOBAL_ENTERPRISE_MEMORY.md           — cette doc

Non modifiés (stables) :
  src/lib/clonestore/adn/types.ts         — CloneADNProfile (B28)
  src/lib/clonestore/adn/profile.ts       — B28 inchangé
  src/lib/clonestore/adn/rules.ts         — B28 inchangé
  src/lib/clonestore/adn/utils.ts         — B28 inchangé
  src/lib/clonestore/empreinte/           — B44 inchangé
  src/lib/pierre/                         — moteur Pierre inchangé
  go-live-proofs.local.json               — interdit
```

---

## 12. Prochain bloc recommandé : TECH-06

**TECH-06 — CloneGuard + ClonePolicy Global Rules**

Objectif : créer la couche globale des règles CloneGuard et ClonePolicy au niveau plateforme.
Aujourd'hui CloneGuard est partiellement implémenté par rapport à la spec.
TECH-06 crée le moteur de règles globales partageable entre tous les employés IA.

```
TECH-05 — CloneADN Global / Enterprise Memory (ce bloc) ✅
TECH-06 — CloneGuard + ClonePolicy Global Rules
TECH-07 — CloneTrace Global Audit Timeline
TECH-08 — CloneOS Command Center Alignment
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
