export type PierreMissionScheduleKind =
  | "immediate"
  | "scheduled_today"
  | "scheduled_specific_time"
  | "scheduled_tomorrow"
  | "after_validation"
  | "conditional_follow_up"
  | "unspecified";

export type PierreMissionScheduleInput = {
  input: string;
  approval_required?: boolean;
};

export type PierreMissionScheduleResult = {
  kind: PierreMissionScheduleKind;
  scheduled_for: string | null;
  follow_up_delay_hours: number | null;
  requires_validation_before_execution: boolean;
  conditional_trigger: string | null;
  reasons: string[];
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clampToFuture(date: Date, now: Date): Date {
  if (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function setTime(base: Date, hours: number, minutes: number): Date {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function parseExplicitHour(lower: string, now: Date): Date | null {
  const hourMatch = lower.match(/\b(\d{1,2})h(\d{2})?\b/);
  if (!hourMatch) return null;

  const hours = Number(hourMatch[1]);
  const minutes = hourMatch[2] ? Number(hourMatch[2]) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return clampToFuture(setTime(now, hours, minutes), now);
}

function parseTomorrow(lower: string, now: Date): Date | null {
  if (!lower.includes("demain")) return null;

  const next = new Date(now);
  next.setDate(next.getDate() + 1);

  const explicitHour = parseExplicitHour(lower, next);
  if (explicitHour) return explicitHour;

  next.setHours(9, 0, 0, 0);
  return next;
}

function parseTodayLater(lower: string, now: Date): Date | null {
  if (
    !lower.includes("plus tard aujourd'hui") &&
    !lower.includes("plus tard aujourd hui") &&
    !lower.includes("cet apres midi") &&
    !lower.includes("cet aprÃ¨s midi") &&
    !lower.includes("ce soir")
  ) {
    return null;
  }

  if (lower.includes("ce soir")) {
    const date = new Date(now);
    date.setHours(18, 0, 0, 0);
    return clampToFuture(date, now);
  }

  if (lower.includes("cet apres midi") || lower.includes("cet aprÃ¨s midi")) {
    const date = new Date(now);
    date.setHours(15, 0, 0, 0);
    return clampToFuture(date, now);
  }

  const date = new Date(now);
  date.setHours(Math.max(now.getHours() + 2, 16), 0, 0, 0);
  return clampToFuture(date, now);
}

function parseRelativeDelay(lower: string, now: Date): Date | null {
  const minuteMatch = lower.match(/\bdans\s+(\d{1,3})\s+minutes?\b/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    if (Number.isFinite(minutes) && minutes > 0) {
      return new Date(now.getTime() + minutes * 60_000);
    }
  }

  const hourMatch = lower.match(/\bdans\s+(\d{1,2})\s+heures?\b/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return new Date(now.getTime() + hours * 3_600_000);
    }
  }

  return null;
}

export function detectMissionSchedule(
  input: PierreMissionScheduleInput,
): PierreMissionScheduleResult {
  const lower = normalizeText(input.input);
  const now = new Date();
  const reasons: string[] = [];
  const requires_validation_before_execution = Boolean(input.approval_required);

  const explicitTomorrow = parseTomorrow(lower, now);
  if (explicitTomorrow) {
    reasons.push("La demande mentionne une exÃ©cution demain.");
    return {
      kind: "scheduled_tomorrow",
      scheduled_for: explicitTomorrow.toISOString(),
      follow_up_delay_hours: null,
      requires_validation_before_execution,
      conditional_trigger: null,
      reasons,
    };
  }

  const explicitRelative = parseRelativeDelay(lower, now);
  if (explicitRelative) {
    reasons.push("La demande contient un dÃ©lai relatif explicite.");
    return {
      kind: "scheduled_specific_time",
      scheduled_for: explicitRelative.toISOString(),
      follow_up_delay_hours: null,
      requires_validation_before_execution,
      conditional_trigger: null,
      reasons,
    };
  }

  const explicitHour = parseExplicitHour(lower, now);
  if (explicitHour) {
    reasons.push("La demande contient un horaire explicite.");
    return {
      kind: "scheduled_specific_time",
      scheduled_for: explicitHour.toISOString(),
      follow_up_delay_hours: null,
      requires_validation_before_execution,
      conditional_trigger: null,
      reasons,
    };
  }

  const explicitToday = parseTodayLater(lower, now);
  if (explicitToday) {
    reasons.push("La demande implique une exÃ©cution plus tard aujourdâ€™hui.");
    return {
      kind: "scheduled_today",
      scheduled_for: explicitToday.toISOString(),
      follow_up_delay_hours: null,
      requires_validation_before_execution,
      conditional_trigger: null,
      reasons,
    };
  }

  if (
    lower.includes("apres validation") ||
    lower.includes("aprÃ¨s validation") ||
    lower.includes("une fois valide") ||
    lower.includes("une fois validÃ©") ||
    lower.includes("une fois validee") ||
    lower.includes("une fois validÃ©e")
  ) {
    reasons.push("La demande impose une validation prÃ©alable avant exÃ©cution.");
    return {
      kind: "after_validation",
      scheduled_for: null,
      follow_up_delay_hours: null,
      requires_validation_before_execution: true,
      conditional_trigger: null,
      reasons,
    };
  }

  if (
    lower.includes("si pas de reponse") ||
    lower.includes("si pas de rÃ©ponse") ||
    lower.includes("en l'absence de reponse") ||
    lower.includes("en l'absence de rÃ©ponse")
  ) {
    let follow_up_delay_hours: number | null = 48;

    const daysMatch = lower.match(/\b(\d{1,2})\s+jours?\b/);
    if (daysMatch) {
      const days = Number(daysMatch[1]);
      if (Number.isFinite(days) && days > 0) {
        follow_up_delay_hours = days * 24;
      }
    } else {
      const hoursMatch = lower.match(/\b(\d{1,2})\s+heures?\b/);
      if (hoursMatch) {
        const hours = Number(hoursMatch[1]);
        if (Number.isFinite(hours) && hours > 0) {
          follow_up_delay_hours = hours;
        }
      }
    }

    reasons.push("La demande contient une logique conditionnelle de relance.");
    return {
      kind: "conditional_follow_up",
      scheduled_for: null,
      follow_up_delay_hours,
      requires_validation_before_execution,
      conditional_trigger: "no_reply_detected",
      reasons,
    };
  }

  if (requires_validation_before_execution) {
    reasons.push("Aucune heure explicite, mais la validation humaine bloque lâ€™exÃ©cution immÃ©diate.");
    return {
      kind: "after_validation",
      scheduled_for: null,
      follow_up_delay_hours: null,
      requires_validation_before_execution: true,
      conditional_trigger: null,
      reasons,
    };
  }

  reasons.push("Aucune contrainte temporelle explicite dÃ©tectÃ©e.");
  return {
    kind: "immediate",
    scheduled_for: null,
    follow_up_delay_hours: null,
    requires_validation_before_execution: false,
    conditional_trigger: null,
    reasons,
  };
}
export function detectPierreScheduleIso(input: string) {
  const result = detectMissionSchedule({ input } as any) as any;
  return result.scheduled_for ?? result.scheduledFor ?? null;
}

export function isScheduledIsoInFuture(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

