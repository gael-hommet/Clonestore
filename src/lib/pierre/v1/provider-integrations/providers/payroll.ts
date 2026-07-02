// src/lib/pierre/v1/provider-integrations/providers/payroll.ts
// PHASE 8.12 — payroll provider (certified engine + social declarations). Not integrated in P8.12:
// Pierre never computes official payroll. Payroll missions prepare + validate, then take the governed
// manual transmission path until a certified provider is integrated + configured.
import { defineProvider } from "../adapter";
export const PAYROLL = defineProvider({
  id: "payroll", displayName: "Certified payroll engine / social declarations",
  requiredEnvVars: ["PAYROLL_PROVIDER_API_KEY", "PAYROLL_PROVIDER_BASE_URL"],
  manualSteps: ["Export the human-validated payroll variables recap", "Transmit to the certified payroll provider via the operator's governed channel", "Receive computed payslips + declaration confirmations", "Reconcile the provider return + distribute payslips securely"],
  manualEvidence: "provider confirmation + reconciled payroll run recorded",
  webhookSignatureHeader: "x-payroll-signature", webhookSecretEnvVar: "PAYROLL_WEBHOOK_SECRET",
});
