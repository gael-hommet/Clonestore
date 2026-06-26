# PHASE 3.21 — Global Employee Context Registry UI Preview / Read-Only Feed

## Objectif

Afficher le **Global Employee Context Registry** (P3.20) en lecture seule dans
`/profile/agents` : Pierre V1, ses capacités/fonctions/limites/validations, les
placeholders futurs, le contrat CloneVoice gouverné, et les garde-fous sécurité.

PHASE 3.21 = **UI Preview / Read-Only Feed** uniquement. Design-only. Aucune
exécution, aucun write, aucune activation CloneVoice.

---

## État avant PHASE 3.21

- P3.20 : registry design-only (types, defaults Pierre V1, validation, snapshot,
  enterprise bridge, CloneVoice contract, QA). Aucun affichage UI.
- `/profile/agents` : affiche déjà l'Empreinte Entreprise read-only (P3.9).

---

## Profile feed bridge

Fichier : `src/lib/clonestore/employee-context-registry/employee-context-registry-profile-feed.ts`

Réutilise les builders P3.20 :
`buildDefaultEmployeeContextRegistry`, `buildEmployeeContextRegistrySnapshot`,
`buildEmployeeContextRegistryFromEnterpriseFootprint`,
`buildCloneVoiceEmployeeContextContract`, `sanitizeEmployeeContextRegistry`,
`validateEmployeeContextRegistry`.

Fonctions : `loadEmployeeContextRegistryProfileFeed`,
`buildEmployeeContextRegistryProfileFeed`, summary/sections/employees/
capabilities/functions/warnings/actions builders, empty feed, labels.

Invariants : pas de Supabase, pas de fetch, pas de write, pas d'import Pierre
moteur, pas d'exécution CloneOS, pas d'activation CloneVoice, client-safe.

---

## Data source registry

`loadEmployeeContextRegistryProfileFeed()` :
1. registry par défaut (Pierre + placeholders) ;
2. lecture localStorage de l'Empreinte via `loadEnterpriseFootprintForCockpit` ;
3. si footprint → `buildEmployeeContextRegistryFromEnterpriseFootprint` (rattache `company_id`) ;
4. sanitize + validate ;
5. snapshot + contrat CloneVoice ;
6. feed read-only.

---

## Enterprise Footprint bridge éventuel

Si l'Empreinte est présente en localStorage, le registry hérite du `company_id`
(`source: enterprise_footprint`). Sinon `source: default_registry`. Le footprint
n'est jamais modifié ni sauvegardé.

---

## Intégration /profile/agents

Panneau **"Registre employés IA"** ajouté après la section Empreinte Entreprise :
- badges, summary cards, Pierre V1, capacités/fonctions, limites/validations,
  placeholders futurs, CloneVoice governed context, warnings, microcopy, CTAs.
- Le panneau Empreinte P3.9 et les autres sections ne sont pas modifiés.

---

## Cards summary

Employés actifs · capacités · validations · visibilité CloneOS/CloneVoice +
`execution_enabled_count` (toujours 0).

---

## Pierre V1 preview

`employee_key: pierre`, Employé RH opérationnel automatisé. 8 capacités + 8
fonctions plan-only, 8 limites ("ce que Pierre ne peut pas faire"), 4 règles de
validation. CloneOS visible, CloneVoice gouverné. `execution_enabled: false`.

---

## Placeholders futurs

Clara, Emma, Alex, Noah, Lucas, Sophie, Adrien — affichés comme design-only,
non actifs en production.

---

## CloneVoice governed context preview

`access_mode: governed_context_only`, `can_execute_actions: false`,
`must_route_through_cloneos/cloneguard/clonetrace: true`, `raw_secret_access: false`,
`server_write_access: false`, `public_launch_validated: false`.

**CloneVoice n'est pas actif production. CloneVoice n'exécute rien. CloneVoice
passera plus tard par CloneOS, CloneGuard et CloneTrace.**

---

## Badges / microcopy

Badges : "Lecture seule", "Design-only", "Aucune action exécutée",
"Aucun write serveur", "CloneVoice non actif".

Microcopy : "Les keys employee_key, function_key, capability_key ne sont pas des
secrets.", "CloneVoice n'est pas actif production.", "Aucune action exécutée.",
"Aucun write serveur.", "Lancement public externe non validé."

---

## Read-only invariant

Le panneau ne fait aucun write DB, aucun POST, aucun import Supabase ajouté,
aucun import Pierre moteur. Lecture seule, design-only.

---

## No execution / no write

`execution_enabled` toujours false. Aucune exécution CloneOS. Aucune activation
CloneVoice. Aucun write serveur. Aucune mission exécutée.

---

## QA module

Fichier : `employee-context-registry-profile-feed-qa.ts` — 17 étapes
(`profile_feed_bridge_exists` → `public_launch_external_not_validated`).

---

## Ce qui est activé maintenant

✅ Profile feed bridge read-only · QA 17 étapes.
✅ Panneau "Registre employés IA" dans `/profile/agents`.
✅ Pierre V1 + placeholders futurs design-only visibles.
✅ CloneVoice governed context preview (non actif).
✅ Badges / microcopy sécurité · exports index.

---

## Ce qui reste non activé

- CloneVoice (non activé production).
- Exécution CloneOS / runtime employés.
- Persistance serveur du registry.
- Placeholders futurs (non actifs).
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 3.21

- Activation CloneVoice / exécution vocale.
- Exécution CloneOS / mission.
- Modification du moteur Pierre / API Pierre.
- Write DB / appel Supabase / POST enterprise-footprint.
- Appel OpenAI / Anthropic / Stripe.
- Application SQL / modification `.env.local` / `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 3.22 — Phase 3 Final QA Gate**

Consolidation et vérification que PHASE 3.1 → 3.21 tiennent ensemble avant de
clore le bloc PHASE 3 (audit des invariants read-only, no-write, no-execution,
lancement public externe non validé).
