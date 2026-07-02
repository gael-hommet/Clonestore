// src/lib/pierre/v1/provider-integrations/providers/yousign.ts
// PHASE 8.12 — Yousign e-signature. BLOCKED by external blocker P8.7.4 (sandbox org-membership) — it
// is never usable in P8.12 regardless of credentials. Signature missions take the governed manual
// signature path until the blocker is externally lifted.
import { defineProvider } from "../adapter";
export const YOUSIGN = defineProvider({
  id: "yousign", displayName: "Yousign (e-signature)",
  requiredEnvVars: ["YOUSIGN_API_KEY", "YOUSIGN_BASE_URL"],
  blockedByExternalBlocker: "P8.7.4 — Yousign sandbox org-membership blocker (FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED)",
  manualSteps: ["Export the prepared, approved document", "Send it for signature via the operator's governed manual channel", "Collect the signed copy + signing evidence", "Record the signature evidence + hash in the mission"],
  manualEvidence: "signed document + signing evidence recorded in the signature runtime",
  webhookSignatureHeader: "x-yousign-signature", webhookSecretEnvVar: "YOUSIGN_WEBHOOK_SECRET",
});
