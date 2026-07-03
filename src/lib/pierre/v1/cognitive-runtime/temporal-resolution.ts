// src/lib/pierre/v1/cognitive-runtime/temporal-resolution.ts
// PHASE 8.14 — deterministic temporal resolution (owner §7). Turns free-text dates (FR + EN, since the
// product speaks French) into an ISO date (yyyy-mm-dd) relative to an INJECTED "now" (no Date.now — pure
// and testable). Fail-closed: anything it cannot confidently resolve returns status "unresolved" with
// iso=null, so the planner asks instead of guessing. This complements the existing ISO/DD-MM parseDate.

import type { ResolvedTemporalReference } from "./types";

const MONTHS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, "août": 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, "décembre": 12,
};
const WEEKDAYS: Record<string, number> = {
  // 0=Sunday … 6=Saturday
  dimanche: 0, sunday: 0, lundi: 1, monday: 1, mardi: 2, tuesday: 2, mercredi: 3, wednesday: 3,
  jeudi: 4, thursday: 4, vendredi: 5, friday: 5, samedi: 6, saturday: 6,
};

function iso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(base: Date, n: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function strip(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Resolve a single free-text date expression against `nowIso`. Pure, fail-closed. */
export function resolveTemporal(original: string, nowIso: string): ResolvedTemporalReference {
  const raw = (original ?? "").trim();
  const now = new Date(nowIso);
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const none = (reason: string): ResolvedTemporalReference => ({ status: "unresolved", original: raw, iso: null, kind: "none", reason });
  if (!raw) return none("empty");
  if (Number.isNaN(now.getTime())) return none("invalid_now");
  const t = strip(raw);

  // 1) ISO yyyy-mm-dd
  const isoM = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoM) {
    const d = new Date(Date.UTC(+isoM[1], +isoM[2] - 1, +isoM[3]));
    if (!Number.isNaN(d.getTime())) return { status: "resolved", original: raw, iso: iso(d), kind: "absolute", reason: "iso" };
  }
  // 2) dd/mm/yyyy or dd-mm-yyyy
  const dmy = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
    const d = new Date(Date.UTC(yr, +dmy[2] - 1, +dmy[1]));
    if (!Number.isNaN(d.getTime())) return { status: "resolved", original: raw, iso: iso(d), kind: "absolute", reason: "dmy" };
  }
  // 3) "1er aout" / "15 septembre" (year = this year, or next year if already passed)
  const dm = t.match(/\b(\d{1,2})(?:er)?\s+([a-z]+)\b/);
  if (dm && MONTHS_FR[dm[2]]) {
    const day = +dm[1]; const mon = MONTHS_FR[dm[2]];
    let d = new Date(Date.UTC(base.getUTCFullYear(), mon - 1, day));
    if (d.getTime() < base.getTime()) d = new Date(Date.UTC(base.getUTCFullYear() + 1, mon - 1, day));
    if (!Number.isNaN(d.getTime())) return { status: "resolved", original: raw, iso: iso(d), kind: "absolute", reason: "day_month" };
  }
  // 4) relative single day
  if (/\b(aujourd|today)\b/.test(t)) return { status: "resolved", original: raw, iso: iso(base), kind: "relative_day", reason: "today" };
  if (/\b(demain|tomorrow)\b/.test(t) && !/apres|after/.test(t)) return { status: "resolved", original: raw, iso: iso(addDays(base, 1)), kind: "relative_day", reason: "tomorrow" };
  if (/\b(apres-demain|day after tomorrow)\b/.test(t)) return { status: "resolved", original: raw, iso: iso(addDays(base, 2)), kind: "relative_day", reason: "after_tomorrow" };
  if (/\b(hier|yesterday)\b/.test(t)) return { status: "resolved", original: raw, iso: iso(addDays(base, -1)), kind: "relative_day", reason: "yesterday" };
  // 5) "dans N jours" / "in N days" ; weeks/months
  const inN = t.match(/\b(?:dans|in)\s+(\d{1,3})\s+(jours?|days?|semaines?|weeks?|mois|months?)\b/);
  if (inN) {
    const n = +inN[1]; const unit = inN[2];
    const mult = /semaine|week/.test(unit) ? 7 : /mois|month/.test(unit) ? 30 : 1;
    return { status: "resolved", original: raw, iso: iso(addDays(base, n * mult)), kind: "relative_period", reason: `in_${n}_${unit}` };
  }
  // 6) "la semaine prochaine" / "next week" → next Monday
  if (/\b(semaine prochaine|next week)\b/.test(t)) {
    const delta = ((1 - base.getUTCDay() + 7) % 7) || 7; // upcoming Monday (at least +1)
    return { status: "resolved", original: raw, iso: iso(addDays(base, delta)), kind: "relative_period", reason: "next_week_monday" };
  }
  if (/\b(mois prochain|next month)\b/.test(t)) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
    return { status: "resolved", original: raw, iso: iso(d), kind: "relative_period", reason: "next_month_first" };
  }
  // 7) weekday, optionally "prochain/next"
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      const wantNext = /prochain|next/.test(t);
      let delta = (dow - base.getUTCDay() + 7) % 7;
      if (delta === 0 || wantNext) delta = delta === 0 ? 7 : delta; // "prochain"/same-day → the upcoming one
      return { status: "resolved", original: raw, iso: iso(addDays(base, delta || 7)), kind: "weekday", reason: `weekday_${name}` };
    }
  }
  return none("no_pattern");
}
