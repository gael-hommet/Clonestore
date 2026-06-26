# PHASE 3.20 — Global Employee Context Registry Design

## Objectif

Créer le **design** d'un Global Employee Context Registry : un registre global,
read-only et **design-only**, décrivant les employés IA de CloneStore, leurs
fonctions, capacités, limites, règles de validation, technologies connectées et
la visibilité de contexte par CloneOS / CloneVoice (gouverné, futur).

PHASE 3.20 est **design-only** : aucune exécution, aucun write, aucune activation
CloneVoice, aucune modification du moteur Pierre.

---

## Pourquoi un Global Employee Context Registry

L'Empreinte Entreprise / CloneADN doit pouvoir progressivement contenir un registre
complet des employés IA : qui existe, qui est actif pour l'entreprise, ce qu'ils
savent faire, quelles fonctions sont plan-only, lesquelles nécessitent une
validation humaine, quels risques, quelles technologies les alimentent, et quel
contexte est visible par CloneOS (et plus tard CloneVoice, de façon gouvernée).

Ce n'est **pas** un système d'exécution, ni un orchestrateur runtime, ni une
marketplace, ni un moteur vocal, ni une persistance serveur active.

---

## Keys produit safe vs secrets

Les identifiants du registry sont des **clés produit safe**, lowercase snake_case :
- `employee_key` — ex: `pierre`
- `function_key` — ex: `prepare_hr_mission_plan`
- `capability_key` — ex: `hr_mission_planning`
- `technology_key` — ex: `cloneos`
- `policy_key` — ex: `sensitive_hr_requires_human_validation`

**Ces keys ne sont pas des secrets.** Le registry ne stocke jamais de secret,
API key, private key, token. La validation détecte et bloque tout motif secret.

---

## Structure employee

`employee_key`, `display_name`, `role_title`, `definition`, `status`, `visibility`,
`active_for_company`, `capabilities[]`, `functions[]`, `limits[]`,
`validation_rules[]`, `technology_bindings[]`, `context_sources[]`,
`cloneos_visible`, `clonevoice_visible`, `created_at`, `updated_at`, `metadata`.

## Structure capability

`capability_key`, `label`, `description`, `risk_level`, `validation_mode`,
`plan_only`, `execution_enabled` (false), `available_in_cloneos`,
`available_in_clonevoice`, `required_context[]`, `forbidden_context[]`,
`output_types[]`, `metadata`.

## Structure function

`function_key`, `label`, `description`, `capability_keys[]`, `input_contract`,
`output_contract`, `risk_level`, `validation_mode`, `plan_only`,
`execution_enabled` (false), `metadata`.

---

## Pierre V1

`employee_key: "pierre"` — **Employé RH opérationnel automatisé**.
Centre de missions RH, documents, onboarding, absences, pré-paie simple,
communications RH, helpdesk RH, reporting, suivi, validations. Supervision humaine
constante. `execution_enabled: false` au niveau registry design.

Capacités : `hr_mission_planning`, `hr_document_preparation`, `absence_followup`,
`onboarding_coordination`, `pre_payroll_preparation`,
`internal_hr_communication_draft`, `hr_risk_review`, `employee_file_context_review`.

Fonctions : `prepare_hr_mission_plan`, `draft_hr_document`,
`prepare_absence_followup`, `prepare_onboarding_checklist`,
`prepare_pre_payroll_summary`, `draft_internal_hr_message`, `classify_hr_risk`,
`summarize_employee_context`.

Limites : ne prend pas de décision juridique finale, ne signe pas de contrat,
ne licencie jamais automatiquement, ne valide pas une sanction disciplinaire,
ne remplace pas la responsabilité humaine, ne contourne pas CloneGuard,
ne cache pas les actions sensibles, ne modifie pas les données serveur sans autorisation.

---

## Placeholders futurs

`clara`, `emma`, `alex`, `noah`, `lucas`, `sophie`, `adrien` —
status `future_placeholder`, `active_for_company: false`, `execution_enabled: false`.
Design-only. Ne sont pas actifs runtime. N'existent pas en production.

---

## Limitations

Le registry est design-only : `execution_enabled` toujours false, `read_only` true,
aucune exécution, aucun write, aucune activation CloneVoice.

---

## Validation rules

`sensitive_hr_requires_human_validation`, `legal_or_disciplinary_action_blocked`,
`external_email_requires_policy_check`, `payroll_sensitive_requires_review`,
plus une règle globale `all_sensitive_actions_require_human_validation`.

La validation bloque : `execution_enabled true`, `clonevoice_visible` sans
`cloneos_visible`, clés non safe, et tout motif secret (`sk_live_`, `whsec_`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `private_key`,
`secret_key`, `api_key`, bearer token).

---

## Enterprise Footprint / CloneADN bridge

`buildEmployeeContextRegistryFromEnterpriseFootprint(footprint)` :
- footprint absent → registry par défaut (Pierre + placeholders) ;
- `company_id` présent → `registry.company_id = footprint.company_id`.

Le bridge ne modifie pas le footprint, ne sauvegarde rien, n'appelle pas Supabase,
n'importe pas Pierre moteur, n'active aucun runtime. Issues détectées :
`no_active_employee`, `pierre_missing`, `cloneos_visibility_missing`,
`clonevoice_visibility_without_cloneos`, `execution_enabled_in_design_phase`,
`secret_like_key_detected`, `validation_rule_missing`.

---

## CloneOS visibility

Les employés et capacités déclarent `cloneos_visible` / `available_in_cloneos`.
Le contexte exposé à CloneOS reste read-only et plan-only.

---

## CloneVoice governed context contract

Contrat **design-only** définissant comment CloneVoice aura **plus tard** accès au
registry :
- `access_mode: "governed_context_only"`
- `can_read_registry: true`
- `can_execute_actions: false`
- `must_route_through_cloneos: true`
- `must_pass_cloneguard: true`
- `must_trace_with_clonetrace: true`
- `sensitive_actions_require_human_validation: true`
- `raw_secret_access: false`
- `server_write_access: false`
- `public_launch_validated: false`

**CloneVoice n'est pas activé production. CloneVoice n'exécute rien.**
**CloneVoice passera plus tard par CloneOS, CloneGuard et CloneTrace.**
CloneVoice ne contourne pas CloneOS/CloneGuard/CloneTrace et ne fait aucune
action invisible.

---

## Sécurité

- Les keys ne sont pas des secrets.
- Aucun secret / token / API key stocké.
- Aucune exécution, aucun write, aucune persistance serveur active.
- Aucun import du moteur Pierre.
- localStorage fallback préservé pour les couches existantes.

---

## Ce qui est activé maintenant

✅ Types registry · defaults Pierre V1 · placeholders futurs design-only.
✅ Validation / sanitization (bloque secrets + exécution).
✅ Snapshot read-only (summary/cards/recommendations/actions/filtres/finders).
✅ Enterprise Footprint / CloneADN bridge design-only.
✅ CloneVoice governed context contract design-only.
✅ QA module (18 étapes).
✅ Exports index.

---

## Ce qui reste non activé

- CloneVoice (interface vocale future, non activée).
- Exécution CloneOS / runtime employés.
- Persistance serveur du registry.
- Activation multi-agent réelle.
- **Lancement public externe : toujours non validé.**

---

## Ce qui n'a PAS été fait en PHASE 3.20

- Activation CloneVoice / exécution vocale.
- Exécution CloneOS / mission.
- Modification du moteur Pierre / API Pierre.
- Write DB / appel Supabase.
- Appel OpenAI / Anthropic / Stripe.
- Application SQL / modification `.env.local` / `go-live-proofs.local.json`.

---

## Prochain bloc recommandé

**PHASE 3.21 — Global Employee Context Registry UI Preview / Read-Only Feed**

Afficher le registry employés en lecture seule dans une page profile (read-only,
design-only), réutilisant le snapshot.

Alternative :
- **PHASE 3.22 — Phase 3 Final QA Gate** — consolidation et vérification que
  PHASE 3.1 → 3.20 tiennent ensemble avant de clore le bloc PHASE 3.
