# PHASE 6.5 — Pierre Customer Activation E2E Final / First Paid Customer Proof Path

## 1. Objectif

Prouver le **parcours client complet** de Pierre pour une **première vente contrôlée** :
un client peut découvrir Pierre, comprendre l'offre, payer/activer (ou simuler le paiement
contrôlé selon environnement), compléter l'onboarding, accéder à Pierre, voir les 5
scénarios RH, lancer une première mission contrôlée, obtenir un premier résultat utile,
voir les validations humaines, voir la trace et comprendre les limites.

**P6.5 = customer activation E2E proof path / first paid customer readiness path.** P6.5 ≠
public launch · P6.5 ≠ Stripe live proof réel · P6.5 ≠ runtime autonome. **Aucun paiement
live, aucune exécution autonome, aucun email réel, aucun appel Stripe live / Supabase prod
/ IA.**

## 2. État P6.4 (verrouillé)

Audit ready · 5 scénarios prêts · decision gate (local_first_controlled_sale) · channels &
identity ready · aucun email réel · aucun domaine connecté · runtime/server inactifs ·
Pierre non fully sellable · public launch non validé.

## 3. Parcours client (A → J)

| | Étape | Route |
|---|---|---|
| A | Discover Pierre (449€/mois, employé IA RH) | /agents/pierre |
| B | Demo Pierre (5 scénarios RH) | /demo/pierre |
| C | Checkout (449€/mois, CGV, Stripe live non prouvé) | /checkout |
| D | Payment success (CTA Configurer Pierre) | /paiement/success |
| E | Signup / account | /signup |
| F | Profile agents (Pierre visible, access gate) | /profile/agents |
| G | Setup Pierre (onboarding / empreinte) | /agents/pierre/setup |
| H | Use Pierre (cockpit / NoAccessGate) | /agents/pierre/use |
| I | First controlled mission (scénario RH, local, no exec) | /profile/messages |
| J | First useful output (brouillons, trace, limites) | /profile/messages |

## 4. First Value Path

Demo → achat/activation contrôlée → success (Configurer Pierre) → setup (empreinte
minimum) → use (choisir un scénario) → Pierre prépare une mission contrôlée → le client
voit tâches/validations/livrables/trace → **aucune exécution autonome** → valeur immédiate
comprise. `expected_time_to_value` : quelques minutes ; proof_artifacts, success_criteria,
failure_modes, fallback_steps définis ; `no_autonomous_execution: true`.

## 5. Access Control Matrix

| État | profile | setup | use | mission | runtime |
|---|---|---|---|---|---|
| unpaid | oui | non | non | non | **non** |
| paid_active | oui | oui | oui | oui | **non** |
| trialing | oui | oui | oui | oui | **non** |
| cancelled / expired | oui | non | non | non | **non** |
| internal_demo | oui | non | non | non | **non** |
| first_controlled_sale_customer | oui | oui | oui | oui | **non** |

`can_execute_runtime: false` pour **tous** les états · `can_send_email: false` partout.

## 6. Onboarding → Pierre Handoff / Scenario Entry Points / First Mission Flow

- **Handoff** : entreprise, contexte RH, employés minimal, approbateurs, règles, risk
  settings, scénarios préférés, missing fields, handoff setup/use,
  `no_server_persistence_confirmed: true`.
- **Scenario entry points** : S1 embauche · S2 absence · S3 pré-paie · S4 multi-site · S5
  cas sensible — chacun `no_autonomous_execution_confirmed: true`, validation humaine.
- **First mission flow** : select scenario → prefill → create local controlled draft →
  review → approve local → preflight → prepare output → trace → **stop before execution**
  (chaque step `can_execute_runtime: false` / `real_action: false` / `email: false` /
  `document_official: false`).

## 7. Traceability / Human Validation / Limites client

- **Trace** : customer_journey_started … controlled_mission_draft_created …
  no_runtime_execution_confirmed … first_value_reached · public_launch_not_validated.
- **Validation humaine** : recruitment contract/promise · absence sanction/payroll ·
  pré-paie DSN/payslip · multi-site forced assignment · sensitive HR disciplinary · email
  send · official document.
- **Limites client** : « Pierre prépare, l'humain valide. » · « Aucun email n'est envoyé
  sans validation. » · « Les documents officiels restent soumis à validation humaine. » ·
  « La pré-paie n'est pas une paie officielle. » · « Les actions sensibles sont bloquées ou
  escaladées. » · « Cette première activation ne vaut pas lancement public. »

## 8. UI

`/profile/messages` : panneau **« Pierre — Activation client E2E »** (activation_status,
parcours, first value path, access control, scenario entry points, first mission flow,
evidence checklist, public launch blockers, next phase P6.6). Actions autorisées : Voir
parcours · Voir première valeur · Voir accès · Voir scénarios · Voir preuves · Voir
blockers (lecture seule). Actions interdites : Déclarer paiement live · Activer Stripe live
· Activer Supabase prod · Exécuter runtime · Envoyer email réel · Générer document officiel
· Déclarer public launch · Déclarer fully sellable.

Microcopy : « Activation Pierre · parcours client contrôlé » · « Le parcours prouve la
première valeur, pas le lancement public. » · « Aucune exécution autonome n'est activée. »
· « Stripe live / production restent à prouver avant public launch. »

## 9. Invariants confirmés

- Parcours E2E **prêt** · `first_paid_customer_path_ready: true` · `ready_for_p6_6: true`.
- `first_paid_customer_e2e_proven_live`/`stripe_live_payment_performed`/
  `supabase_prod_verified`/`runtime_execution_active`/`server_persistence_active`/
  `real_email_sent`/`official_document_generated`/`ai_call_performed`/`env_modified`/
  `sql_applied` = **false**.
- Pierre **non** déclaré fully sellable · public launch **non** validé · scale 80k **non**
  prouvé.
- Aucun import Stripe/Supabase/IA · aucune nouvelle route créée · moteur Pierre
  `src/lib/pierre/**` et `src/app/api/pierre/**` **INTACTS** · `.env.local`/go-live proofs
  non modifiés.

## 10. Prochaine phase recommandée

**PHASE 6.6 — Pierre Sellable Gate 100% / Final Controlled Sellability Verdict.**

---

**Customer activation proof path. Aucun paiement live. Aucune exécution autonome. Aucun
email réel. Aucun document officiel. Stripe live / production à prouver avant public
launch. Pierre NON fully sellable. public launch NON validé. scale 80k NON prouvé.
Prochaine étape : P6.6.**
