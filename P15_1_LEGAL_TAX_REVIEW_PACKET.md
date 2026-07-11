# P15.1 — Legal / Tax Review Packet (to send to lawyer + accountant)

**Purpose:** structure the external legal/tax review needed before a paid public launch. **This is not legal advice** — it lists what must be reviewed and the questions to answer. Nothing here authorizes production; payment is disabled.

## 1. Launch countries
- **France (FR)** · **Belgique (BE)** · **Luxembourg (LU)** · **Suisse (CH)**.

## 2. Pricing (server-authoritative, P10 canon)
- FR / BE / LU → **449 EUR / month** (recurring, monthly).
- CH → **499 CHF / month** (recurring, monthly).
- A Swiss customer cannot be billed the EUR offer; FR/BE/LU cannot be billed CHF (checkout guard + payment-time billing-country reconciliation, fail-closed).

## 3. Commercial claims to review (P14 truth matrix — must remain honest)
- Pierre is an **AI HR employee** (never "assistant/chatbot/copilote").
- Pierre **absorbs the operational HR workload** (documents, follow-ups, files, validations, onboarding, absences, pre-payroll).
- Pierre **does not replace final legal/human/disciplinary/managerial responsibility**.
- Pierre **does not guarantee legal compliance**.
- Pierre **is not payroll software** (no DSN / official payslips).
- **Sensitive decisions require human validation.**

## 4. Documents to review (per country where applicable)
| Artifact | Scope | Needs review |
|---|---|---|
| CGU (terms of use) | all | ☐ |
| CGV (terms of sale) | all | ☐ |
| DPA / RGPD | all | ☐ |
| Privacy policy | all | ☐ |
| Mentions légales | all | ☐ |
| HR commercial claims disclaimer | all | ☐ |
| AI / sensitive-HR-use disclaimer (AI Act) | all | ☐ |
| Legal review FR / BE / LU / CH | per country | ☐☐☐☐ |
| VAT / tax review FR / BE / LU / CH | per country | ☐☐☐☐ |

## 5. Questions for the lawyer / accountant
1. **CGU / CGV / DPA / privacy / mentions légales** — are they valid and sufficient for FR/BE/LU/CH SaaS B2B sales?
2. **VAT / tax** — treatment of a monthly SaaS subscription in FR, BE, LU, CH; B2B reverse-charge where applicable; invoicing requirements.
3. **CHF billing** — Swiss VAT treatment; can a French/EU entity bill a Swiss customer in CHF, and what tax obligations follow? (currency = CHF for CH per pricing.)
4. **EUR billing** — BE/LU specifics vs FR; any local invoicing/consumer-protection nuances.
5. **Entity** — selling from the current entity vs a Swiss entity later; migration implications.
6. **HR/AI disclaimers** — are the "Pierre prepares, human validates; not payroll; no compliance guarantee; sensitive decisions human-only" disclaimers legally sufficient? AI Act sensitive-HR-use considerations.
7. **Electronic signature** — until a live e-signature provider is verified, documents are "prepared, to be signed manually" (fallback). Any constraints?
8. **Refund / cancellation** — required policy; handling of a billing-country conflict (e.g. Swiss customer billed EUR → refund / re-invoice in CHF).

## 6. Deliverable back (per artifact)
For each artifact, return: **status** (reviewed / approved / rejected), **reviewer** (name/firm), **date**, and a **content hash** (so the readiness registry can record it). Owner then records these in the P15 legal-tax artifact registry — a bare boolean is never sufficient.

> Until external review is returned + recorded (hash/date/source), `legalTaxReady` stays **false** and public paid launch stays blocked.
