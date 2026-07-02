// src/lib/pierre/v1/provider-integrations/providers/time-attendance.ts
// PHASE 8.12 — time & attendance system. Not integrated; attendance is imported via the governed
// manual path until a provider is configured.
import { defineProvider } from "../adapter";
export const TIME_ATTENDANCE = defineProvider({
  id: "time_attendance", displayName: "Time & attendance system",
  requiredEnvVars: ["TIME_ATTENDANCE_API_KEY", "TIME_ATTENDANCE_BASE_URL"],
  manualSteps: ["Import attendance export from the time system", "Normalize to worked time + flag anomalies", "Record normalized time in the mission"],
  manualEvidence: "normalized worked-time recorded",
  webhookSignatureHeader: "x-time-signature", webhookSecretEnvVar: "TIME_ATTENDANCE_WEBHOOK_SECRET",
});
