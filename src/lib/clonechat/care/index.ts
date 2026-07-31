// src/lib/clonechat/care/index.ts — surface publique de CloneCare (BLOC 7).
export { assessCare, careFromVoiceResult } from "./care";
export { decideDiagnoseGuideAndCare, type CaredDecision } from "./care-with-context";
export {
  CLONECHAT_CARE_VERSION, CLONECHAT_TICKET_VERSION,
  type CareStatus, type CareConfidence, type CarePriority, type TicketCategory,
  type SupportTicketDraft, type CloneCareResult, type CareInput,
} from "./types";
export {
  CLONECHAT_KNOWN_ISSUES_VERSION, KNOWN_ISSUES, getKnownIssue, matchKnownIssue,
  type KnownIssue, type IssueSeverity, type IssueStatus,
} from "./known-issues";
export {
  buildTicketDraft, dedupeTickets, createTicketDeduper, submitTicket,
  mockSupportProvider, unavailableSupportProvider,
  type TicketDraftInput, type TicketDeduper, type SupportTicketProvider, type TicketSubmitOutcome,
} from "./ticket";
export { redactText, redactList, safeErrorCode } from "./redaction";
