# B36 — Pierre Gap Register

**Date:** 2026-05-25  
**Total gaps:** 13  
**Blockers:** 0  
**High criticality:** 4  
**Medium criticality:** 7  
**Low criticality:** 2

---

## Légende criticité

| Criticité | Signification |
|---|---|
| `blocker` | Doit être résolu avant tout lancement — verdict devient `blocked` |
| `high` | Dégrade fortement la vendabilité si non résolu |
| `medium` | Réduit le polish mais le produit fonctionne |
| `low` | Nice to have |

---

## Gaps HIGH (non-bloquants pour le verdict)

### gap_real_email — Real email delivery not connected
**Area:** email_send | **Criticité:** HIGH  
**Description:** Email sending (SendGrid, Resend, SMTP) is fully mocked in all test and build environments. Pierre generates email drafts but cannot deliver them autonomously to real recipients.  
**Impact:** Pierre cannot autonomously send emails. Every email draft must be copied and sent manually by the HR manager.  
**Mitigation:** Launch with explicit disclaimer: "Pierre rédige, vous envoyez." Connect Resend or SendGrid as Sprint 1 post-launch.

---

### gap_real_file_extraction — PDF/DOCX text extraction is mocked
**Area:** files | **Criticité:** HIGH  
**Description:** File extraction in B34 returns mock content. No pdf-parse, mammoth, or equivalent library is installed. Pierre cannot read the content of uploaded contracts, pay slips, or HR documents.  
**Impact:** Pierre classifies files by metadata (name, type, risk) but cannot cross-reference content.  
**Mitigation:** Add pdf-parse (npm) for PDFs and mammoth for DOCX as Sprint 1 post-launch.

---

### gap_ui_e2e — No end-to-end browser test for cockpit UI
**Area:** ui_cockpit | **Criticité:** HIGH  
**Description:** The Pierre cockpit has unit tests for normalizers and API state, but no Playwright or Cypress test proves the user flow end-to-end in a real browser.  
**Impact:** Visual bugs, form interactions, or navigation flows may be broken without being caught.  
**Mitigation:** Run manual test of critical paths before first client demo.

---

### gap_ai_quality — Real AI response quality not benchmarked
**Area:** ai_runtime | **Criticité:** MEDIUM  
(Listed under medium below — initial assessment was high, downgraded because governance layer compensates for AI errors.)

---

## Gaps MEDIUM

### gap_real_sms — Real SMS provider not connected
**Area:** real_providers | **Criticité:** MEDIUM  
**Mitigation:** Low priority for v1. Add in v1.1.

### gap_hris_sync — No HRIS connector
**Area:** real_providers | **Criticité:** MEDIUM  
**Mitigation:** API-first is acceptable for launch. Silae/BambooHR connector as post-launch.

### gap_payroll_sync — No direct payroll software integration or DSN
**Area:** real_providers | **Criticité:** MEDIUM  
**Mitigation:** Position Pierre as "payroll assistant" not "payroll engine." DSN is V2.

### gap_legal_templates — HR templates not legally certified
**Area:** documents | **Criticité:** MEDIUM  
**Mitigation:** Add disclaimer: "Modèles fournis à titre indicatif." Partner with HR law firm for V2.

### gap_esign — No eSign integration
**Area:** documents | **Criticité:** MEDIUM  
**Mitigation:** Position as "document generation," not "contract signing." Add Yousign V2.

### gap_calendar — No calendar integration
**Area:** real_providers | **Criticité:** MEDIUM  
**Mitigation:** Pierre writes dates, HR creates events. Add .ics generation in V2.

### gap_ai_quality — Real AI response quality not benchmarked
**Area:** ai_runtime | **Criticité:** MEDIUM  
**Mitigation:** Run closed pilot with 5-10 real HR missions before commercial launch.

---

## Gaps LOW

### gap_workflow_training — Training and CPF not covered
**Area:** hr_workflows | **Criticité:** LOW  
**Mitigation:** Exclude from V1 feature list. Add in V2.

### gap_workflow_reporting — HR reporting and KPI dashboard not covered
**Area:** hr_workflows | **Criticité:** LOW  
**Mitigation:** Exclude from V1. Mention as roadmap item.

### gap_workflow_multi_site — Multi-site coordination minimal
**Area:** hr_workflows | **Criticité:** LOW  
**Mitigation:** V2 feature for larger clients.

---

## Workflows avec couverture partielle (score < 4/4)

| Workflow | Score | Principaux gaps |
|---|---|---|
| wf_onboarding_checklist | 2/4 | Pas de suivi UI, pas de calendrier |
| wf_hiring_contract | 2/4 | Template only, pas d'eSign, pas de DPAE |
| wf_contract_amendment | 2/4 | Pas de diff contrat original |
| wf_trial_extension | 2/4 | Pas d'enforcement max légal |
| wf_absence_request | 2/4 | Pas de sync calendrier, pas de solde |
| wf_leave_management | 1/4 | Pas de suivi solde, pas de calendrier légal |
| wf_payroll_variables | 2/4 | Pas de calcul, pas de plafond légal |
| wf_offboarding_process | 2/4 | Pas de séquence formelle, pas d'IT deprovision |
| wf_offboarding_docs | 2/4 | Attestation partielle, solde tout compte non automatisé |
| wf_training_plan | 1/4 | Pas de CPF, pas d'OPCO |
| wf_interview_scheduling | 1/4 | Pas de calendrier, pas de lien vidéo |
| wf_performance_review | 1/4 | Pas de template structuré, pas de suivi objectifs |
| wf_hr_helpdesk | 2/4 | Pas de base de connaissance |
| wf_disciplinary_case | 2/4 | Pas de séquençage légal |
| wf_compliance_check | 1/4 | Pas de base juridique |
| wf_reporting | 1/4 | Pas de moteur de rapport |
| wf_multi_site_coordination | 1/4 | Pas de règles différenciées par site |

---

## Résumé

Pierre n'a **aucun blocant**. Les gaps actuels sont tous mitigeables par une communication commerciale honnête et des workarounds manuels. La stratégie de lancement recommandée est **bêta fermé (5-10 clients pilotes)** avec disclaimer explicite sur les limites.
