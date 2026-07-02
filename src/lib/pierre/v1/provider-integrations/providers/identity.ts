// src/lib/pierre/v1/provider-integrations/providers/identity.ts
// PHASE 8.12 — identity provider (account/access provisioning + revocation). Not integrated; access
// provisioning/revocation takes the governed manual path until an IdP is configured.
import { defineProvider } from "../adapter";
export const IDENTITY = defineProvider({
  id: "identity", displayName: "Identity provider (accounts & access)",
  requiredEnvVars: ["IDENTITY_PROVIDER_API_KEY", "IDENTITY_PROVIDER_BASE_URL"],
  manualSteps: ["Request account/access changes via the operator's governed IT channel", "Confirm provisioning/revocation completion", "Record access state in the mission"],
  manualEvidence: "access provisioning/revocation confirmation recorded",
  webhookSignatureHeader: "x-idp-signature", webhookSecretEnvVar: "IDENTITY_WEBHOOK_SECRET",
});
