// B48 — Environment Variables Readiness
// Checks that required env vars are defined (non-empty string).
// Pure: reads process.env, no side effects. No throw.

export type EnvVarStatus = "set" | "missing" | "placeholder";

export type EnvVarCheck = {
  key: string;
  status: EnvVarStatus;
  required_for_production: boolean;
  surface: string;
  notes: string | null;
};

const PLACEHOLDER_VALUES = new Set([
  "your-key-here",
  "change-me",
  "todo",
  "placeholder",
  "xxx",
  "<your-key>",
  "INSERT_HERE",
]);

function checkEnvVar(key: string, required: boolean, surface: string, notes: string | null = null): EnvVarCheck {
  const val = typeof process !== "undefined" ? process.env[key] : undefined;
  let status: EnvVarStatus = "missing";
  if (val && val.trim().length > 0) {
    status = PLACEHOLDER_VALUES.has(val.trim()) ? "placeholder" : "set";
  }
  return { key, status, required_for_production: required, surface, notes };
}

export function getEnvReadinessChecks(): EnvVarCheck[] {
  return [
    // Supabase
    checkEnvVar("NEXT_PUBLIC_SUPABASE_URL", true, "auth", "Supabase project URL"),
    checkEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", true, "auth", "Supabase anon key"),
    checkEnvVar("SUPABASE_SERVICE_ROLE_KEY", true, "security", "Service role key — server only"),
    // Stripe
    checkEnvVar("STRIPE_SECRET_KEY", true, "billing", "Stripe secret key — must be live key in production"),
    checkEnvVar("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", true, "checkout", "Stripe publishable key"),
    checkEnvVar("STRIPE_WEBHOOK_SECRET", true, "billing", "Stripe webhook signature verification"),
    checkEnvVar("NEXT_PUBLIC_STRIPE_PRICE_ID", true, "checkout", "Stripe price ID for subscription"),
    // Email / SMTP
    checkEnvVar("RESEND_API_KEY", true, "email", "Resend API key — never live in tests"),
    checkEnvVar("NEXT_PUBLIC_APP_URL", true, "public_site", "Production app URL for links/redirects"),
    // Pierre & guardrails
    checkEnvVar("PIERRE_LEGAL_GUARDRAILS_ENABLED", false, "pierre", "Enable legal guardrails in production"),
    checkEnvVar("PIERRE_MONTHLY_PRICE_EUR", false, "billing", "449 — must match Stripe price"),
    checkEnvVar("PIERRE_DEMO_MODE", false, "demo", "true in demo/sandbox, false in production"),
    checkEnvVar("PIERRE_OUTPUT_VALIDATION_ENABLED", false, "pierre", "Enable output validation"),
    // Security
    checkEnvVar("NEXTAUTH_SECRET", false, "security", "NextAuth secret — required if using NextAuth"),
    // B48 launch flags
    checkEnvVar("CLONESTORE_LAUNCH_READINESS_ENABLED", false, "operations", "Enable B48 readiness dashboard"),
    checkEnvVar("CLONESTORE_PUBLIC_LAUNCH_APPROVED", false, "operations", "Manual flag: set true only after all blockers resolved"),
  ];
}

export function getEnvReadinessSummary(): {
  total: number;
  set: number;
  missing: number;
  placeholder: number;
  required_missing: number;
} {
  const checks = getEnvReadinessChecks();
  const set = checks.filter((c) => c.status === "set").length;
  const missing = checks.filter((c) => c.status === "missing").length;
  const placeholder = checks.filter((c) => c.status === "placeholder").length;
  const required_missing = checks.filter((c) => c.required_for_production && c.status !== "set").length;
  return { total: checks.length, set, missing, placeholder, required_missing };
}

export function getMissingRequiredEnvVars(): EnvVarCheck[] {
  return getEnvReadinessChecks().filter(
    (c) => c.required_for_production && c.status !== "set"
  );
}

export function isEnvProductionReady(): boolean {
  return getMissingRequiredEnvVars().length === 0;
}
