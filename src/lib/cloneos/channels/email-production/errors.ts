// src/lib/cloneos/channels/email-production/errors.ts
// B39 — Named error classes for email production layer.

export class EmailProductionError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "EmailProductionError";
    this.code = code;
  }
}

export class EmailBlockedError extends EmailProductionError {
  constructor(reason: string) {
    super(`Email envoi bloqué : ${reason}`, "EMAIL_BLOCKED");
    this.name = "EmailBlockedError";
  }
}

export class EmailRecipientBlockedError extends EmailProductionError {
  readonly recipient: string;
  constructor(recipient: string, reason: string) {
    super(`Destinataire bloqué (${recipient}) : ${reason}`, "EMAIL_RECIPIENT_BLOCKED");
    this.name = "EmailRecipientBlockedError";
    this.recipient = recipient;
  }
}

export class EmailRateLimitError extends EmailProductionError {
  readonly scope: "company_hourly" | "company_daily" | "user_hourly" | "user_daily";
  constructor(scope: EmailRateLimitError["scope"], limit: number) {
    super(`Limite de débit atteinte (${scope}) : max ${limit}`, "EMAIL_RATE_LIMIT");
    this.name = "EmailRateLimitError";
    this.scope = scope;
  }
}

export class EmailNotPaidError extends EmailProductionError {
  constructor(accessLevel: string) {
    super(`Niveau d'accès insuffisant pour envoyer des emails : ${accessLevel}`, "EMAIL_NOT_PAID");
    this.name = "EmailNotPaidError";
  }
}

export class EmailEmergencyShutdownError extends EmailProductionError {
  constructor() {
    super("Email bloqué — arrêt d'urgence actif (AI_EMERGENCY_SHUTDOWN=true).", "EMAIL_EMERGENCY_SHUTDOWN");
    this.name = "EmailEmergencyShutdownError";
  }
}

export class EmailSensitiveValidationRequiredError extends EmailProductionError {
  constructor() {
    super("Email sensible — validation humaine obligatoire avant envoi.", "EMAIL_SENSITIVE_REQUIRES_VALIDATION");
    this.name = "EmailSensitiveValidationRequiredError";
  }
}

export class EmailProviderNotConfiguredError extends EmailProductionError {
  constructor() {
    super("Provider email non configuré pour le mode live (RESEND_API_KEY manquant).", "EMAIL_PROVIDER_NOT_CONFIGURED");
    this.name = "EmailProviderNotConfiguredError";
  }
}
