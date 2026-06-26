// src/lib/clonestore/messages/index.ts
// PHASE 3.1 — Messages Real Data Read-Only Hook — Exports publics
// PHASE 3.4 — CloneOS History bridge intégré
//
// Couche messages CloneStore — lecture seule.
// Aucune écriture en DB. Aucune exécution. Pierre moteur intact.

export type {
  MessageCenterTab,
  MessageCenterPriority,
  MessageCenterStatus,
  MessageCenterSource,
  MessageCenterActionKind,
  MessageCenterDataMode,
  MessageCenterLoadState,
  MessageCenterItem,
  MessageCenterReadOnlyResult,
} from "./message-center-types";

export {
  ALERT_TAB_STATUSES,
  ALERT_STATUS_STRINGS,
  MESSAGE_CENTER_MAX_ITEMS_PER_TABLE,
  MESSAGE_CENTER_MAX_TOTAL_ITEMS,
  UNSAFE_WORDING_PATTERNS,
} from "./message-center-types";

export {
  buildDemoMessageCenterItems,
  buildEmptyMessageCenterItems,
  buildFallbackMessageCenterResult,
  DATA_MODE_LABELS,
} from "./message-center-demo-data";

export {
  mapPierreMissionToMessageItem,
  mapPierreTaskToMessageItem,
  mapPierreTaskLogToMessageItem,
  mapPierreDocumentToMessageItem,
  mapPierreOutboundEmailToMessageItem,
  mapAgentRunToMessageItem,
  mapUnknownRowToMessageItem,
} from "./message-center-mappers";

export {
  loadMessageCenterReadOnlyItems,
  loadPierreMessageCenterRows,
  mergeRealAndFallbackMessages,
  sortMessageCenterItems,
  groupMessageCenterItemsByTab,
  filterMessageCenterItems,
} from "./message-center-readonly-client";

export {
  validateMessageCenterItem,
  validateMessageCenterItems,
  assertMessageCenterReadOnly,
  detectUnsafeMessageCenterWording,
  countCloneOSHistoryMessageItems,
  hasCloneOSHistoryMessageItems,
  assertMessageCenterNoWriteActions,
} from "./message-center-validation";

// ── PHASE 3.4 — CloneOS History bridge ───────────────────────────────────────
export {
  loadCloneOSHistoryMessageItemsReadOnly,
  mergePierreAndCloneOSMessageItems,
} from "./message-center-cloneos-history-bridge";

// ── PHASE 3.17 — CloneOS History Feed (localStorage, read-only) ───────────────
export type {
  ProfileMessagesCloneOSHistorySource,
  ProfileMessagesCloneOSHistoryStatus,
  ProfileMessagesCloneOSHistoryItem,
  ProfileMessagesCloneOSHistorySummary,
  ProfileMessagesCloneOSHistoryAction,
  ProfileMessagesCloneOSHistoryReadResult,
} from "./profile-messages-cloneos-history-feed";

export {
  loadProfileMessagesCloneOSHistoryFeed,
  buildProfileMessagesCloneOSHistorySummary,
  buildProfileMessagesCloneOSHistoryItems,
  buildProfileMessagesCloneOSHistoryActions,
  buildEmptyProfileMessagesCloneOSHistoryFeed,
  getProfileMessagesCloneOSHistoryStatusLabel,
  getProfileMessagesCloneOSHistorySourceLabel,
} from "./profile-messages-cloneos-history-feed";

// ── PHASE 3.17 — Context Feed unifié (Empreinte + CloneOS history) ────────────
export type {
  ProfileMessagesContextFeedSource,
  ProfileMessagesContextFeedStatus,
  ProfileMessagesContextFeedItem,
  ProfileMessagesContextFeedSectionKind,
  ProfileMessagesContextFeedSection,
  ProfileMessagesContextFeedRecommendation,
  ProfileMessagesContextFeedAction,
  ProfileMessagesContextFeedSummary,
  ProfileMessagesContextFeedReadResult,
} from "./profile-messages-context-feed";

export {
  loadProfileMessagesContextFeed,
  buildProfileMessagesContextFeedSummary,
  buildProfileMessagesContextFeedSections,
  buildProfileMessagesContextFeedItems,
  buildProfileMessagesContextFeedRecommendations,
  buildProfileMessagesContextFeedActions,
  buildEmptyProfileMessagesContextFeed,
  getProfileMessagesContextFeedStatusLabel,
  getProfileMessagesContextFeedSourceLabel,
} from "./profile-messages-context-feed";

// ── PHASE 3.17 — Context Feed QA ──────────────────────────────────────────────
export type {
  ProfileMessagesContextFeedQaStepId,
  ProfileMessagesContextFeedQaStep,
  ProfileMessagesContextFeedQaVerdict,
  ProfileMessagesContextFeedQaChecklist,
  ProfileMessagesContextFeedQaSummary,
} from "./profile-messages-context-feed-qa";

export {
  buildProfileMessagesContextFeedQaChecklist,
  buildProfileMessagesContextFeedQaVerdict,
  getProfileMessagesContextFeedBlockingSteps,
  summarizeProfileMessagesContextFeedQaVerdict,
} from "./profile-messages-context-feed-qa";
