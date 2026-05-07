export type AssistantAccountContext = {
  isAuthenticated: boolean;
  hasPierreAccess: boolean;
  onboardingCompleted: boolean;
  companyName: string;
  contactFirstName: string;
  contactJobTitle: string;
  usualTone: string;
  preferredLanguage: string;
  senderMode: string;
  senderStatus: string;
  domainStatus: string;
  senderEmailRequested: string;
  senderEmailEffective: string;
  replyToEmail: string;
};

export type AssistantIntent =
  | "clone_choice"
  | "post_payment"
  | "onboarding"
  | "use_page"
  | "email_identity"
  | "email_pdf_action"
  | "limits"
  | "status_other_employees"
  | "pricing"
  | "navigation"
  | "support"
  | "product_vision"
  | "general";

export type AssistantStatusTone = "default" | "success" | "warn" | "violet";

export type AssistantStatusCard = {
  label: string;
  value: string;
  tone?: AssistantStatusTone;
};

export type AssistantLinkCard = {
  label: string;
  href: string;
  description: string;
};

export type AssistantConversationItem = {
  role: "assistant" | "user" | "system";
  content: string;
};

export type AssistantKnowledgeMatch = {
  id: string;
  title: string;
  score: number;
};

export type AssistantRouteBody = {
  message?: string;
  input?: string;
  query?: string;
  conversation?: AssistantConversationItem[];
  context?: Partial<AssistantAccountContext>;
};

export type AssistantResponsePayload = {
  ok: true;
  answer: string;
  response: string;
  message: string;
  text: string;
  intent: AssistantIntent;
  quickAsks: string[];
  statusCards: AssistantStatusCard[];
  links: AssistantLinkCard[];
  contextSnapshot: AssistantAccountContext;
  usedKnowledge: AssistantKnowledgeMatch[];
  knowledgeDigest: string;
};
export type AssistantRequestBody = AssistantRouteBody;


export type AssistantResponseBody = {
  ok: boolean;
  message?: string;
  answer?: string;
  response?: string;
  cards?: unknown[];
  actions?: unknown[];
  context?: unknown;
  error?: string | { code?: string; message?: string; details?: unknown };
  [key: string]: unknown;
};
