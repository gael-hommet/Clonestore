// src/lib/pierre/v1/runtime-schedule-rules.ts
// PHASE 8.5-R1 §R1.9 — TYPED, CLOSED schedule rules with real timezone + DST handling. The next-run
// instant is computed from the rule (never a hardcoded +2 days). Supported kinds: once · fixed_delay ·
// daily_local_time · weekly_local_time. No free cron syntax. Timezone math uses the platform IANA tz
// database via Intl (no extra dependency). DST policy: a non-existent local time (spring-forward gap)
// rolls FORWARD to the first valid instant; an ambiguous local time (fall-back overlap) takes the
// FIRST occurrence. An invalid timezone / malformed rule yields no instant → the caller blocks.

export type ScheduleRule =
  | { kind: "once"; timezone?: string }
  | { kind: "fixed_delay"; delay_seconds: number; timezone?: string }
  | { kind: "daily_local_time"; local_time: string; timezone: string }
  | { kind: "weekly_local_time"; weekday: number; local_time: string; timezone: string };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function buildScheduleRule(payload: Record<string, unknown>): ScheduleRule {
  const raw = (payload.schedule && typeof payload.schedule === "object") ? (payload.schedule as Record<string, unknown>) : null;
  if (raw) {
    const kind = String(raw.kind ?? "");
    if (kind === "fixed_delay") return { kind, delay_seconds: Number(raw.delay_seconds ?? 0), timezone: (raw.timezone as string) ?? "UTC" };
    if (kind === "daily_local_time") return { kind, local_time: String(raw.local_time ?? ""), timezone: String(raw.timezone ?? "") };
    if (kind === "weekly_local_time") return { kind, weekday: Number(raw.weekday ?? -1), local_time: String(raw.local_time ?? ""), timezone: String(raw.timezone ?? "") };
    return { kind: "once", timezone: (raw.timezone as string) ?? "UTC" };
  }
  // legacy follow-up payload (delay_seconds / recurrence)
  if (payload.delay_seconds !== undefined) return { kind: "fixed_delay", delay_seconds: Number(payload.delay_seconds), timezone: "UTC" };
  return { kind: "once", timezone: "UTC" };
}

function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** The offset (ms) of `tz` at the given UTC instant: localWallClock(date) - date. */
function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value;
  const h = m.hour === "24" ? 0 : Number(m.hour);
  const asUTC = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), h, Number(m.minute), Number(m.second));
  return asUTC - date.getTime();
}

/** The UTC instant whose local wall time in `tz` is the given Y/M/D H:M — DST-correct for BOTH the
 *  spring-forward GAP and the fall-back OVERLAP (R4.12, exact). The wall time is bracketed by the two
 *  offsets in force around it; each yields a candidate UTC instant that is *valid* iff the local time at
 *  that instant (with that offset) equals the requested wall time. Disambiguation:
 *   • two valid candidates  → ambiguous fall-back overlap → take the FIRST (earliest UTC) occurrence.
 *   • one valid candidate   → an ordinary instant.
 *   • zero valid candidates → non-existent spring-forward gap → roll FORWARD past the gap. */
function zonedWallToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number): Date {
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  // sample the offset well clear of the transition on each side (DST shift ≤ a few hours; 12h is safe)
  const offEarly = tzOffsetMs(tz, new Date(wall - 12 * 3600000)); // offset in force just before the wall time
  const offLate = tzOffsetMs(tz, new Date(wall + 12 * 3600000)); //  offset in force just after the wall time
  const candEarly = wall - offEarly;
  const candLate = wall - offLate;
  const earlyValid = tzOffsetMs(tz, new Date(candEarly)) === offEarly;
  const lateValid = tzOffsetMs(tz, new Date(candLate)) === offLate;
  if (earlyValid && lateValid) return new Date(Math.min(candEarly, candLate)); // overlap → first occurrence
  if (earlyValid) return new Date(candEarly);
  if (lateValid) return new Date(candLate);
  return new Date(Math.max(candEarly, candLate)); // gap → first valid instant after the missing wall time
}

/** Local Y/M/D and weekday of a UTC instant in `tz`. */
function localParts(tz: string, date: Date): { y: number; mo: number; d: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value;
  const W: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(m.year), mo: Number(m.month), d: Number(m.day), weekday: W[m.weekday] ?? 0 };
}

/** The next run instant strictly after `from` (occurrenceIndex = the count already fired). null = no more / invalid. */
export function nextScheduleRunAt(rule: ScheduleRule, from: Date, occurrenceIndex: number): Date | null {
  const tz = (rule as { timezone?: string }).timezone ?? "UTC";
  if (rule.kind !== "fixed_delay" && rule.kind !== "once" && !isValidTimezone(tz)) return null;
  if (rule.kind === "once") return occurrenceIndex === 0 ? from : null;
  if (rule.kind === "fixed_delay") {
    if (!Number.isFinite(rule.delay_seconds) || rule.delay_seconds < 0) return null;
    return new Date(from.getTime() + rule.delay_seconds * 1000);
  }
  if (rule.kind === "daily_local_time" || rule.kind === "weekly_local_time") {
    const mt = HHMM.exec(rule.local_time);
    if (!mt) return null;
    const h = Number(mt[1]); const mi = Number(mt[2]);
    // start from the local calendar day of `from`, walk forward up to ~8 days for the first instant > from
    for (let add = 0; add <= 8; add++) {
      const base = new Date(from.getTime() + add * 86400000);
      const lp = localParts(tz, base);
      if (rule.kind === "weekly_local_time" && lp.weekday !== rule.weekday) continue;
      const cand = zonedWallToUtc(tz, lp.y, lp.mo, lp.d, h, mi);
      if (cand.getTime() > from.getTime()) return cand;
    }
    return null;
  }
  return null;
}
