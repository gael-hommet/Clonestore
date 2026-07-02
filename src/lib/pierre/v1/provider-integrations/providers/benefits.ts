// src/lib/pierre/v1/provider-integrations/providers/benefits.ts
// PHASE 8.12 — benefits provider (mutuelle/prévoyance/vouchers). Not integrated; benefits enrollment
// takes the governed manual path until a provider is configured.
import { defineProvider } from "../adapter";
export const BENEFITS = defineProvider({
  id: "benefits", displayName: "Benefits provider",
  requiredEnvVars: ["BENEFITS_PROVIDER_API_KEY", "BENEFITS_PROVIDER_BASE_URL"],
  manualSteps: ["Prepare the benefit/voucher enrollment or expense record", "Submit to the benefits provider via the operator's governed channel", "Reconcile the provider return"],
  manualEvidence: "benefits enrollment/reimbursement confirmation recorded",
  webhookSignatureHeader: "x-benefits-signature", webhookSecretEnvVar: "BENEFITS_WEBHOOK_SECRET",
});
