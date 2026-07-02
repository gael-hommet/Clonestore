// src/lib/pierre/v1/provider-integrations/providers/training.ts
// PHASE 8.12 — training / LMS provider. Not integrated; enrollment takes the governed manual path
// until a provider is configured.
import { defineProvider } from "../adapter";
export const TRAINING = defineProvider({
  id: "training", displayName: "Training / LMS provider",
  requiredEnvVars: ["TRAINING_PROVIDER_API_KEY", "TRAINING_PROVIDER_BASE_URL"],
  manualSteps: ["Send enrollment convocations", "Enroll employees via the training provider's governed channel", "Record completion + certification"],
  manualEvidence: "training enrollment/completion recorded",
  webhookSignatureHeader: "x-training-signature", webhookSecretEnvVar: "TRAINING_WEBHOOK_SECRET",
});
