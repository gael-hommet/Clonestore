# B34 — Files & Document Intake Layer

**Status:** Complete  
**Date:** 2026-05-24  
**Tests:** 78 passed (files-b34: 61 + pierre-files-b34: 17)  
**tsc:** clean  
**build:** clean

---

## What is B34?

B34 transforms Pierre from a document generator into a system that can also **ingest, validate, extract, classify, attach, and trace** real HR files. Every file Pierre touches is treated as a first-class HR work item: company-scoped, risk-assessed, traceable, and actionable.

**Default mode:** `FILE_RUNTIME_MODE=mock` — no real storage, no real APIs, no real external calls. Safe for all dev and test environments.

---

## Architecture

```
src/lib/cloneos/files/                 ← Global layer, reusable by any agent
  types.ts                             — All shared types
  config.ts                            — FILE_RUNTIME_MODE + env config
  mime.ts                              — MIME detection, kind mapping, dangerous ext blocking
  security.ts                          — File security validation (size, MIME, extension, empty)
  fingerprint.ts                       — SHA-256 checksum + file ID generation
  extraction.ts                        — Text extraction (real: text/CSV, mock: PDF/DOCX/XLSX)
  classification.ts                    — HR file classification heuristics (18 categories)
  events.ts                            — CloneFileEvent builders (11 event types)
  attachment.ts                        — FileAttachDecision logic
  retention.ts                         — HR legal retention policies
  intake.ts                            — File record builder + B33 channel bridge
  runtime.ts                           — processFileIntake orchestrator (async)
  providers/
    mock.ts                            — Mock storage provider (no real storage)
  __tests__/
    files-b34.test.ts                  — 61 tests

src/lib/pierre/files/                  ← Pierre bridge (HR-specific)
  types.ts                             — PierreFileContext, PierreFileAttachContext
  classify-hr-file.ts                  — classifyPierreHrFile (Pierre risk escalation)
  attach-file-to-pierre.ts             — attachFileToPierre (Pierre approval rules)
  route-file-to-pierre.ts              — routeFileToPierre (full routing)
  build-file-context.ts                — buildPierreFileContext (context for downstream)
  (tested in: src/lib/pierre/__tests__/pierre-files-b34.test.ts — 17 tests)

docs/sql/B34_FILE_INTAKE.sql           — Proposed DB schema (reference only, not executed)
```

---

## Pipeline: receive → validate → fingerprint → extract → classify → attach → trace

```typescript
const result = await processFileIntake({
  filename: "contrat-cdi-alice.pdf",
  content: fileBuffer,           // Buffer or string
  mimeType: "application/pdf",
  sizeBytes: 85_000,
  companyId: "co_acme",
  agentSlug: "pierre",
  source: "upload",
  relatedMissionId: "miss_123", // optional
  relatedEmployeeId: "emp_001", // optional
});

// result.file            → CloneFileRecord (status: "ready" or "blocked")
// result.extraction      → FileExtractionResult
// result.classification  → FileClassificationResult (category, risk_level, confidence)
// result.attach_decision → FileAttachDecision (attach_to_mission | create_new_mission | block_sensitive | ...)
// result.trace_events    → CloneFileEvent[] (file_received, file_accepted, file_extracted, ...)
```

---

## Security Rules (Absolute)

| Rule | Enforcement |
|---|---|
| Dangerous extensions always blocked | `exe, bat, ps1, sh, jar, dll, ...` (30+ types) |
| Archives blocked by default | Unless `FILE_ALLOW_ARCHIVES=true` |
| Empty files rejected | 0-byte check |
| File size limit | `FILE_MAX_UPLOAD_MB=25` by default |
| PDF/image/office can be disabled | Via env vars |
| Sensitive files never auto-attached | `risk_level=sensitive|blocked` → `block_sensitive` action |
| Extracted text never stored by default | `FILE_LOG_EXTRACTED_TEXT=false` |
| Preview limited | `FILE_TEXT_PREVIEW_CHARS=4000` |
| Filename sanitized | Path traversal, special chars stripped |
| All operations company_id scoped | Multi-tenant, no cross-company leakage |

---

## HR Classification (18 Categories)

| Category | Risk | Detection |
|---|---|---|
| `legal_sensitive` | **sensitive** | licenciement, faute grave, harcèlement, prud'hommes, contentieux |
| `sick_leave` | **sensitive** | arrêt de travail, médecin, maladie |
| `identity_document` | **sensitive** | passeport, carte d'identité, titre de séjour |
| `contract` | high | contrat de travail, CDI, CDD, période d'essai |
| `amendment` | high | avenant, modification du contrat |
| `payroll_export` | high | bulletin de salaire, DSN, brut imposable |
| `payroll_variable` | high | variables de paie, heures supplémentaires, note de frais |
| `offboarding_document` | high | solde de tout compte, attestation pôle emploi |
| `employee_file` | medium | dossier salarié, dossier personnel |
| `interview_report` | medium | entretien annuel, évaluation |
| `absence_proof` | medium | justificatif d'absence, congés |
| `cv` | medium | curriculum vitae, expérience professionnelle |
| `certificate` | low | atteste que, certifie que |
| `onboarding_document` | low | onboarding, parcours d'intégration |
| `policy` | low | règlement intérieur, charte |
| `procedure` | low | procédure RH, mode opératoire |
| `job_description` | low | fiche de poste, profil recherché |
| `training_document` | low | attestation de formation, habilitation, CPF |

---

## Pierre Risk Escalation

Pierre escalates risk above baseline for these categories:
- `sick_leave`, `identity_document`, `legal_sensitive` → always **sensitive**
- `payroll_export`, `payroll_variable`, `contract`, `amendment`, `employee_file` → escalated to **high** if medium

Pierre requires human approval (`approval_required=true`) for: `legal_sensitive`, `sick_leave`, `identity_document`, `contract`, `amendment`, `payroll_export`, `payroll_variable`, `offboarding_document`.

---

## B33 Channel Integration

Files received as email/channel attachments can be piped directly through B34:

```typescript
import { buildFileRecordFromChannelAttachment } from "@/lib/cloneos/files/intake";

// envelope: MessageEnvelope (B33)
// attachment: MessageEnvelopeAttachment (B33)
const fileRecord = buildFileRecordFromChannelAttachment(envelope, attachment);
// → CloneFileRecord with source="channel_attachment", envelope_id, channel_identity_id set
```

---

## Attachment Actions

| Action | Trigger |
|---|---|
| `attach_to_mission` | `missionId` provided |
| `attach_to_task` | `taskId` provided |
| `attach_to_employee` | `employeeId` provided, no task/mission |
| `create_new_mission` | Actionable category (cv, contract, sick_leave...) + no context |
| `ask_for_more_info` | Low confidence or non-actionable category + no context |
| `archive_only` | Policy/procedure/training/other category + no context |
| `block_sensitive` | `risk_level=sensitive|blocked` — always requires human validation |

---

## Extraction

| File type | Extraction mode |
|---|---|
| `text/plain` | Real — full text, dates, amounts detected |
| `text/csv` | Real — columns, rows, preview |
| `application/pdf` | Mock — preview note, warnings, no crash |
| `docx`, `doc`, `xlsx` | Mock — preview note, warnings, no crash |
| `image/*` | Mock — OCR note |

Real PDF/DOCX extraction requires adding `pdf-parse`, `mammoth`, or `pdfjs-dist` — the pipeline is wired and ready to plug in without breaking existing code.

---

## Retention Policies (French Law)

| Category | Retention |
|---|---|
| contract, amendment, payroll, legal | 5 years |
| sick_leave, absence_proof | 3 years |
| cv, interview_report | 2 years |
| identity_document | 1 year (RGPD minimal) |
| other | 1 year (default) |

---

## Trace Events (11 types)

`file_received` → `file_accepted`/`file_rejected` → `file_extraction_started` → `file_extracted`/`file_extraction_failed` → `file_classified` → `file_sensitive_detected`? → `file_attached`/`file_blocked` → `file_archived`?

---

## Environment Variables

```bash
FILE_RUNTIME_MODE=mock           # mock|disabled|local|production (default: mock)
FILE_MAX_UPLOAD_MB=25
FILE_TEXT_PREVIEW_CHARS=4000
FILE_LOG_EXTRACTED_TEXT=false    # never true unless compliance requires it
FILE_ALLOW_IMAGES=true
FILE_ALLOW_OFFICE_DOCS=true
FILE_ALLOW_PDF=true
FILE_ALLOW_ARCHIVES=false        # never true without explicit need
FILE_STORAGE_BUCKET=pierre-documents
```

---

## Validation

```bash
npx tsc --noEmit             # clean
npm run test:files-b34       # 78 passed
npm test                     # 4619 passed
npm run build                # clean
```
