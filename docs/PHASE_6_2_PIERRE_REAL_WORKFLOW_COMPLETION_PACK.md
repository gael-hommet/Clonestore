# PHASE 6.2 — Pierre Real Workflow Completion Pack / 5 Sellable HR Scenarios

## 1. Objectif

Construire le **pack réel de 5 workflows RH vendables** de Pierre — prouver une valeur RH
claire sur 5 scénarios entreprise concrets, **par des scénarios contrôlés, sûrs,
démontrables, sans mensonge produit et sans exécution autonome**.

**P6.2 ne fait PAS semblant d'exécuter** ce qui n'est pas activé. Il prouve la valeur
vendable first-sale, **il ne valide pas le public launch** et **ne déclare pas Pierre
fully sellable**.

## 2. État P6.1 (verrouillé)

Audit prêt · Pierre non déclaré vendable · niveau ≠ fully_sellable · public launch non
validé · scale 80k non prouvé · 5 scénarios non prouvés (gap identifié) · runtime/server
inactifs · P5 local mission chain uniquement.

## 3. Modèle

`PierreRealWorkflowCompletionPack` : `phase: "6.2"`, `pack_status`, `scenario_count: 5`,
`scenarios`, `scenario_matrix`, `sellable_proof_summary`, `human_validation_matrix`,
`legal_risk_matrix`, `traceability_matrix`, `demo_readiness_matrix`,
`first_sale_readiness`, `remaining_gaps`, `recommended_next_phase`, `final_verdict`, et
les invariants littéraux : `ready_for_p6_3: true`, `pierre_fully_sellable_declared:
false`, `public_launch_validated: false`, `scale_80k_proven: false`,
`server_persistence_active: false`, `runtime_execution_active: false`, `ai_call_performed:
false`, `email_sent: false`, `official_document_generated: false`.

Chaque scénario : `customer_request`, `pierre_understanding`, `mission_title/summary`,
`tasks`, `required_inputs`, `missing_information`, `human_validations`,
`sensitive_actions`, `blocked_actions`, `allowed_outputs`, `forbidden_outputs`,
`expected_deliverables`, `trace_events`, `legal_guardrails`, `cloneguard_decision`,
`sellable_value`, `demo_script`, `success_criteria`, `first_sale_proof_status`,
`execution_status`, `no_autonomous_execution_confirmed: true`. Chaque task :
`approval_required`, `can_be_demoed`, `can_be_executed_now: false`.

## 4. Les 5 scénarios

- **S1 — Embauche / création de poste / onboarding RH** (Lyon, assistant administratif).
  Bloque : contrat officiel signé · promesse d'embauche officielle sans validation.
- **S2 — Absence imprévue / organisation équipe / communication manager**. Bloque :
  sanction automatique · paie modifiée · email envoyé sans autorisation.
- **S3 — Pré-paie / variables mensuelles / anomalies à valider**. Bloque : DSN · bulletin
  officiel · modification de paie réelle.
- **S4 — Multi-site / manque d'effectif / coordination RH** (Dijon). Bloque : affectation
  imposée · planning officiel modifié sans validation.
- **S5 — Cas sensible RH / recadrage / risque juridique**. Bloque : sanction officielle ·
  licenciement · accusation non prouvée.

Chaque scénario produit : mission, interprétation, tâches structurées, risques,
informations manquantes, validations humaines, livrables, trace, valeur vendable, limites
honnêtes, résultat démo / first-sale proof.

## 5. Sellable proof summary

`scenarios_ready_for_demo: true` · `first_sale_candidate: true` · `public_launch_ready:
false` · `pierre_fully_sellable_declared: false`. Les 5 scénarios existent, sont
compréhensibles par un client, prouvent une valeur RH, évitent les promesses mensongères,
sont démontrables et prêts pour une première vente contrôlée. Reste bloquant avant public
launch : Stripe live / Supabase prod / domaine / email / paid E2E / copie publique /
scale 80k.

## 6. Matrices

- **Human Validation Matrix** : par scénario, actions autorisées / nécessitant validation
  / interdites + motif.
- **Legal Risk Matrix** : contrat officiel · promesse d'embauche · sanction disciplinaire
  · licenciement · paie officielle · DSN · changement planning obligatoire · données
  personnelles · données sensibles · discrimination recrutement.
- **Traceability Matrix** : chaque scénario inclut `mission_created`,
  `understanding_generated`, `tasks_created`, `guardrails_applied`,
  `human_validation_required`, `deliverables_prepared`, `no_autonomous_execution_confirmed`.

## 7. UI

`/profile/messages` : panneau **« Pierre — 5 scénarios RH vendables »** (pack_status, 5
scénarios, valeur, risques, validations, livrables, first_sale_candidate,
public_launch_ready false, prochaine phase P6.3). Actions autorisées : **Voir scénarios** ·
**Voir livrables** · **Voir validations** · **Voir risques** · **Voir preuve de valeur**
(lecture seule). Actions interdites : Exécuter runtime · Envoyer email réel · Générer
document officiel · Déclarer public launch · Activer serveur · Modifier paie · Sanctionner
automatiquement.

Microcopy : « Pack scénarios Pierre · Aucune exécution autonome » · « Ces scénarios
prouvent la valeur RH vendable sans activer le runtime. » · « Les actions sensibles restent
bloquées ou soumises à validation humaine. » · « Pierre n'est pas encore public-launch
complete. »

## 8. Invariants confirmés

- 5 scénarios RH vendables **prêts pour démo / première vente contrôlée**.
- Chaque scénario `no_autonomous_execution_confirmed: true` · actions sensibles bloquées /
  validées humainement.
- `pierre_fully_sellable_declared: false` · `public_launch_validated: false` ·
  `scale_80k_proven: false`.
- server/runtime inactifs · `ai_call_performed`/`email_sent`/`official_document_generated`
  false · SQL non appliqué · flag off · aucune route.
- Moteur Pierre `src/lib/pierre/**` et `src/app/api/pierre/**` **INTACTS** ·
  `.env.local`/go-live proofs non modifiés.

## 9. Prochaine phase recommandée

**PHASE 6.3 — Pierre State/Server Activation Decision Gate / Controlled Sellable Runtime
Decision.**

---

**Proof pack. 5 scénarios RH vendables. Aucune exécution autonome. Actions sensibles
bloquées / validation humaine. Aucun email réel. Aucun document officiel réel. Pierre NON
déclaré fully sellable. public launch NON validé. scale 80k NON prouvé. Prochaine étape :
P6.3.**
