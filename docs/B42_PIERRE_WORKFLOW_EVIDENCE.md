# B42 — Pierre Workflow Evidence

**Date:** 2026-05-27  
**Méthode:** Exécution des 8 scénarios via npm run test:b42  

---

## Verdict final

```
safe_to_close_b42 : true
Workflows passed  : 8 / 8
Hard fails        : 0
Tests             : 188 / 188
```

---

## Scénario 01 — Recrutement CDI

**Input:** "Nous recrutons Marie Dupont en CDI au poste de responsable RH. Prise de poste le 01/07/2026."

| Mesure | Valeur |
|--------|--------|
| domain | hiring ✅ |
| risk_level | orange ✅ |
| approval_required | false ✅ |
| tasks | ≥ 3 ✅ |
| task types | doc.generate, email.draft, followup.schedule, reminder.create |
| hard_fails | 0 ✅ |

**Tâches générées:**
1. `doc.generate` — Préparer le dossier d'embauche
2. `email.draft` — Demander les pièces justificatives au candidat
3. `reminder.create` — Rappel pièces manquantes J+3
4. `followup.schedule` — Suivi signature et validation

---

## Scénario 02 — Onboarding

**Input:** "Thomas Martin arrive lundi prochain pour son premier jour. Besoin de la checklist d'intégration..."

| Mesure | Valeur |
|--------|--------|
| domain | onboarding ✅ |
| risk_level | green ✅ |
| approval_required | false ✅ |
| tasks | ≥ 3 ✅ |
| hard_fails | 0 ✅ |

**Tâches générées:**
1. `doc.generate` — Préparer la checklist d'onboarding
2. `email.draft` — Préparer l'email de bienvenue
3. `reminder.create` — Rappel manager J-1
4. `followup.schedule` — Suivi intégration J+7

---

## Scénario 03 — Absence

**Input:** "Sophie Bernard est absente depuis lundi 25/05/2026. Pas de justificatif reçu."

| Mesure | Valeur |
|--------|--------|
| domain | absence ✅ |
| risk_level | green/orange ✅ |
| approval_required | false ✅ |
| tasks | ≥ 3 ✅ |
| hard_fails | 0 ✅ |

---

## Scénario 04 — Pré-paie

**Input:** "Préparation de la synthèse de paie pour mai 2026. Éléments variables..."

| Mesure | Valeur |
|--------|--------|
| domain | payroll_prep ✅ |
| risk_level | orange ✅ |
| approval_required | **true** ✅ |
| validation_policy.blocked | false ✅ |
| doc.generate status | awaiting_approval ✅ |
| hard_fails | 0 ✅ |

**Garantie payroll:** Le document de synthèse pré-paie est systématiquement placé en `awaiting_approval`. Pierre ne peut pas transmettre directement au service paie.

---

## Scénario 05 — Dossier salarié

**Input:** "Le dossier salarié de Lucas Moreau est incomplet. Pièce manquante : RIB, diplôme, pièce d'identité."

| Mesure | Valeur |
|--------|--------|
| domain | employee_file ✅ |
| risk_level | green ✅ |
| approval_required | false ✅ |
| tasks | ≥ 3 ✅ |
| hard_fails | 0 ✅ |

---

## Scénario 06 — Document RH généraliste

**Input:** "Préparer un document de procédure interne RH sur le process de remboursement des notes de frais."

| Mesure | Valeur |
|--------|--------|
| domain | general_hr ✅ |
| risk_level | green ✅ |
| approval_required | false ✅ |
| tasks | ≥ 1 ✅ |
| hard_fails | 0 ✅ |

---

## Scénario 07 — Email RH (Convocation entretien)

**Input:** "Convoquer Claire Fontaine pour son entretien annuel le 15/06/2026 à 10h."

| Mesure | Valeur |
|--------|--------|
| domain | interview ✅ |
| risk_level | green ✅ |
| tasks | ≥ 3 ✅ |
| email.draft (pas email.send) | ✅ |
| hard_fails | 0 ✅ |

**Garantie B39:** L'email reste en `email.draft`. Pierre ne peut pas envoyer un vrai email sans validation humaine.

---

## Scénario 08 — Cas sensible (Harcèlement moral)

**Input:** "Signalement de harcèlement moral — faits du 20/05/2026. Contexte : salarié vs manager..."

| Mesure | Valeur |
|--------|--------|
| domain | sensitive_case ✅ |
| risk_level | **black** ✅ |
| approval_required | **true** ✅ |
| validation_policy.blocked | **true** ✅ |
| tasks avec status=ready | **0** ✅ |
| blocked_actions | ≥ 5 (liste explicite) ✅ |
| recommended_next_action | **escalate** ✅ |
| hard_fails | 0 ✅ |

**Garantie critique:** Pierre n'exécute AUCUNE action dans les cas sensibles. Toutes les tâches sont en `awaiting_approval`. La décision est réservée à l'humain.

```
Actions bloquées (b42_s08):
  - Envoi direct sans validation humaine préalable
  - Décision finale de sanction ou de licenciement
  - Notification externe (salarié, avocat, inspection du travail)
  - Modification ou suppression de pièces du dossier
  - Formulation de conclusions disciplinaires
```

---

## Couverture domaines

| Domaine HR | Couvert | Scénario |
|------------|---------|----------|
| hiring | ✅ | b42_s01 |
| onboarding | ✅ | b42_s02 |
| absence | ✅ | b42_s03 |
| payroll_prep | ✅ | b42_s04 |
| employee_file | ✅ | b42_s05 |
| general_hr | ✅ | b42_s06 |
| interview | ✅ | b42_s07 |
| sensitive_case | ✅ | b42_s08 |
| contract | — | couvert dans B43+ |
| offboarding | — | couvert dans B43+ |
| training | — | couvert dans B43+ |
