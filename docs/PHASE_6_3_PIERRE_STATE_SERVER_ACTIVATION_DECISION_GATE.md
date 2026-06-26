# PHASE 6.3 — Pierre State/Server Activation Decision Gate / Controlled Sellable Runtime Decision

## 1. Objectif

Créer le **Decision Gate gouverné** qui décide clairement — **sans activer
automatiquement** — quelle stratégie d'état / serveur / runtime Pierre doit utiliser pour
devenir vendable sans mensonge produit. Il répond à :

> « Pour une première vente contrôlée de Pierre, doit-on garder une chaîne
> local-only/demo-proof, activer une persistance serveur minimale gouvernée, ou préparer
> un runtime contrôlé — et sous quelles conditions exactes ? »

**P6.3 ne déclenche rien.** Il produit une décision claire, traçable, testée, avec
conditions, risques, interdits et next steps. **C'est un DECISION GATE, pas une
activation.**

## 2. Décision recommandée

`recommended_strategy: "local_first_controlled_sale"`.

- Les 5 scénarios RH (P6.2) sont prêts pour démo / première vente contrôlée.
- La persistance serveur **n'est pas obligatoire** pour une première vente honnête.
- Le **lancement public** exige serveur/prod/RLS/Stripe/domaine/email prouvés.
- Le **runtime autonome** ne doit pas être activé avant une couche validation/trace/rollback/observability plus forte.
- Éviter de **ralentir la vente** par une activation serveur prématurée — tout en préparant P6.4/P6.5/P6.6.

## 3. Distinction explicite

- **A. Première vente contrôlée** — local-first / demo-proof / human-in-the-loop · pas de
  runtime autonome · pas de promesse d'autonomie complète · résultats en scénarios
  contrôlés · humain valide les actions sensibles · support manuel transparent.
- **B. Public launch** — serveur prod · RLS prod · Stripe live · domaine/email · paid
  customer E2E · legal copy review · monitoring · scale proof séparé.
- **C. Runtime autonome** — non activé maintenant · futur après P6.4/P6.5/P6.6 ·
  seulement avec CloneGuard + CloneTrace + validation + rollback + observability.

## 4. Modèle

`PierreStateServerActivationDecisionGate` : `phase: "6.3"`, `gate_status`,
`recommended_strategy`, `decision_summary`, `first_sale_state_strategy`,
`public_launch_state_strategy`, `runtime_strategy`, `server_persistence_strategy`,
`state_strategy_items`, `activation_conditions`, `no_go_conditions`,
`approval_requirements`, `risk_matrix`, `rollback_strategy`, `audit_trace_requirements`,
`p6_dependency_map`, `next_phase_recommendation`, `final_verdict`, et les invariants
littéraux : `ready_for_p6_4: true`, `server_persistence_activated: false`,
`runtime_execution_activated: false`, `sql_applied: false`, `server_flag_enabled: false`,
`route_created/server_get_created/server_post_created: false`, `email_sent: false`,
`official_document_generated: false`, `ai_call_performed: false`,
`pierre_fully_sellable_declared: false`, `public_launch_validated: false`,
`scale_80k_proven: false`.

Strategy item : `applies_to` (first_sale/public_launch/runtime/scale), `decision`
(allow/allow_with_limits/block/future), `reason`, `required_conditions`,
`forbidden_shortcuts`. Décisions : **première vente = allow_with_limits**, **public launch
= future**, **runtime = future**, **server persistence = future**.

## 5. Conditions d'activation (avant toute activation serveur)

SQL appliqué manuellement avec evidence · RLS verified · feature flag explicitement
activé · routes GET/POST relues · idempotency keys · audit events · rollback documenté ·
aucune surpromesse · approbation manuelle opérateur · tests verts + build vert.

## 6. No-Go

SQL not applied · RLS not verified · flag false · aucune revue de route · no rollback ·
aucune trace d'audit · aucune validation humaine RH sensible · copie légale non relue ·
public launch external not validated · scale 80k not proven.

## 7. Approvals (jamais self-approve pour catégories sensibles)

server_persistence_activation · runtime_execution · email_sending ·
official_document_generation · payroll_actions · legal_disciplinary_actions ·
public_launch · scale_claims. `can_be_self_approved: false` pour toutes.

## 8. Risk matrix / Rollback / Audit trace

- **Risques** : activating server too early · confusing controlled sale with public launch
  · runtime without guardrails · email/document side effects · payroll/legal side effects ·
  data persistence without RLS · false sellable claim · scale claim without proof.
- **Rollback** : disable flag · revert to local-first · ignore server rows · freeze runtime
  · block email/document execution · review audit logs · restore UI · communicate
  internally no public launch.
- **Audit trace** : decision_gate_created · strategy_selected · activation_not_performed ·
  risks_listed · approvals_required · rollback_defined · no_public_launch_confirmed ·
  no_runtime_execution_confirmed · ready_for_p6_4.

## 9. P6 Dependency Map

P6.4 Channels & Identity Final · P6.5 Customer Activation E2E Final · P6.6 Sellable Gate
100% (+ optionnels P6.4A Email/Domain · P6.5A Stripe/Supabase Paid Proof · P6.6A Public
Launch External Proof).

## 10. UI

`/profile/messages` : panneau **« Pierre — Decision Gate état / serveur / runtime »**
(gate_status, recommended_strategy, stratégies, conditions, no-go, approvals, risks,
rollback, P6). Actions autorisées : Voir décision · Voir conditions · Voir no-go · Voir
approvals · Voir rollback · Voir P6 (lecture seule). Actions interdites : Appliquer SQL ·
Activer serveur · Créer route · Exécuter runtime · Envoyer email réel · Générer document
officiel · Déclarer public launch · Déclarer fully sellable.

Microcopy : « Decision Gate Pierre · Aucune activation » · « Première vente contrôlée ≠
lancement public. » · « Le runtime autonome reste inactif. » · « La persistance serveur
reste inactive tant que les conditions ne sont pas prouvées. »

## 11. Invariants confirmés

- Decision gate **prêt** · `recommended_strategy: local_first_controlled_sale` ·
  `ready_for_p6_4: true`.
- **Aucune** activation serveur/runtime · aucun SQL appliqué · flag off · aucune route ·
  aucun GET/POST · aucun email réel · aucun document officiel · aucun appel IA.
- Pierre **non** déclaré fully sellable · public launch **non** validé · scale 80k **non**
  prouvé.
- Moteur Pierre `src/lib/pierre/**` et `src/app/api/pierre/**` **INTACTS** ·
  `.env.local`/go-live proofs non modifiés.

## 12. Prochaine phase recommandée

**PHASE 6.4 — Pierre Channels & Identity Final / Email Domain & Contact Surface
Readiness.**

---

**Decision gate. Aucune activation. Aucune route. Aucun SQL appliqué. Aucune exécution.
Première vente contrôlée ≠ lancement public. Le runtime autonome reste inactif. La
persistance serveur reste inactive. Pierre NON déclaré fully sellable. public launch NON
validé. scale 80k NON prouvé. Prochaine étape : P6.4.**
