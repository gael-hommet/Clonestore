# P16C — Pierre × Technologies Integration Plan

**This plan does NOT build.** It defines how Pierre consumes the T1 technologies through **adapters** (the integration gate, Session C — opened only after P16A + T1 are ready and tested). **Doctrine:** if a technology is not live, Pierre **degrades safely**; every effectful/sensitive action passes a validation gate and is audited; Pierre stays the HR brain (adapters are plumbing, not reasoning).

## The 10 adapters

| Adapter | Input | Output | Source of truth | Validation gate | Audit | Failure behavior | Safe fallback |
|---|---|---|---|---|---|---|---|
| **PierreDocumentTechAdapter** | mission + template + data | prepared document | DocumentTech + company footprint | human validates before use | EvidenceTech | return "prepared, unvalidated" | document prepared, human validates |
| **PierreMailTechAdapter** | recipient + draft intent | drafted email (+ send if live+validated) | MailTech | human validates; live send flag-gated | EvidenceTech | draft only | Pierre drafts, human sends manually |
| **PierreCalendarTechAdapter** | interview/event intent | prepared event | CalendarTech | human validates | EvidenceTech | prepared object only | Pierre prepares, human copies/validates |
| **PierreSignatureTechAdapter** | validated document | signature request (live) OR prepared-for-manual | SignatureTech (fallback/live) | human validates; live gated | EvidenceTech | fallback path | prepared doc, manual/external signature (no live claim) |
| **PierreVoiceTechAdapter** | voice input | transcribed request → mission | VoiceTech | same as text mission | EvidenceTech | reject → ask text | text input authoritative |
| **PierreNotificationTechAdapter** | signal/reminder | notification (cockpit/push) | NotificationTech | proposed reminder | EvidenceTech | cockpit-only | cockpit reminders only |
| **PierreAnalyticsTechAdapter** | company scope | value/ROI report | AnalyticsTech (analytics.compute) | report reviewed | EvidenceTech | raw metrics only | cockpit metrics |
| **PierreEvidenceTechAdapter** | any effectful action | audit/trace entry | EvidenceTech | n/a (always audit) | self | log locally | existing V1 timeline |
| **PierreWorkflowTechAdapter** | mission plan | workflow run | WorkflowTech (generic) — **HR reasoning stays in V1** | governed autonomy | EvidenceTech | V1 engine | existing V1 mission engine |
| **PierrePermissionTechAdapter** | actor + scope | allow/deny | PermissionTech | n/a (enforcement) | EvidenceTech | deny (fail-closed) | RLS + requireCompanyUser |

## Integration invariants
- **Degrade safely:** every adapter has a fallback; a non-live technology never blocks Pierre — it downgrades to "prepared, human completes".
- **Human validation:** effectful/sensitive outputs pass Pierre's existing autonomy/validation engine (P8/P9.5) — the adapter does not bypass it.
- **Audit everything:** every adapter routes through EvidenceTech (audit trail).
- **No second HR brain:** WorkflowTech is a generic engine; the HR reasoning + governance stay in Pierre V1. The adapter delegates orchestration, not judgment.
- **Reusability:** the same technology contracts back a future employee's adapters — the adapter is the only Pierre-specific glue.

## Tests + browser proofs (at build time)
- Unit: each adapter's validation gate + fallback + audit; forged input ignored; effect only after validation.
- Browser: at least the Document + Mail + Signature-fallback adapters proven end-to-end in the cockpit on real V1 data (prepared → validate → audited), with the "prepared, not sent/signed" copy when not live.
- Non-regression: launch-ready Pierre + P8–P15.1 unchanged; all adapters flag-gated OFF by default; production off.

**Next prompt to run this gate (after P16A + T1):** `START P16C — PIERRE x TECHNOLOGIES INTEGRATION`.
