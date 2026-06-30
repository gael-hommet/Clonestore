// PHASE 8.5-R1 §R1.9 — typed schedule rules with REAL timezone + DST. The next-run instant comes from
// the rule (never a hardcoded +2 days). daily/weekly local times resolve through the IANA tz database
// and shift correctly across DST; an invalid timezone / malformed rule yields no instant (caller blocks).
import { describe, it, expect } from "vitest";
import { buildScheduleRule, nextScheduleRunAt, type ScheduleRule } from "../runtime-schedule-rules";

describe("P8.5-R1 schedule rules + DST", () => {
  it("fixed_delay advances by the rule's delay (never a hardcoded +2 days)", () => {
    const r: ScheduleRule = { kind: "fixed_delay", delay_seconds: 172800 };
    const from = new Date("2026-07-01T00:00:00Z");
    expect(nextScheduleRunAt(r, from, 1)!.toISOString()).toBe("2026-07-03T00:00:00.000Z");
    const r2: ScheduleRule = { kind: "fixed_delay", delay_seconds: 3600 };
    expect(nextScheduleRunAt(r2, from, 2)!.toISOString()).toBe("2026-07-01T01:00:00.000Z");
  });

  it("daily_local_time resolves the correct UTC instant ACROSS DST (Europe/Paris)", () => {
    const r: ScheduleRule = { kind: "daily_local_time", local_time: "09:00", timezone: "Europe/Paris" };
    // winter (CET = UTC+1): 09:00 Paris = 08:00 UTC
    expect(nextScheduleRunAt(r, new Date("2026-01-15T00:00:00Z"), 0)!.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    // summer (CEST = UTC+2): 09:00 Paris = 07:00 UTC — the SAME wall-clock rule, a DIFFERENT UTC instant
    expect(nextScheduleRunAt(r, new Date("2026-07-15T00:00:00Z"), 0)!.toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("daily_local_time differs for Europe/Zurich vs Europe/Paris only by tz rules (same offset here)", () => {
    const zur: ScheduleRule = { kind: "daily_local_time", local_time: "09:00", timezone: "Europe/Zurich" };
    expect(nextScheduleRunAt(zur, new Date("2026-07-15T00:00:00Z"), 0)!.toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("weekly_local_time lands on the right weekday + local time", () => {
    const r: ScheduleRule = { kind: "weekly_local_time", weekday: 1, local_time: "09:00", timezone: "Europe/Paris" }; // Monday
    // 2026-07-15 is a Wednesday → next Monday 09:00 Paris = 2026-07-20T07:00Z (summer)
    const next = nextScheduleRunAt(r, new Date("2026-07-15T00:00:00Z"), 0)!;
    expect(next.toISOString()).toBe("2026-07-20T07:00:00.000Z");
    expect(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(next)).toBe("Mon");
  });

  it("the spring-forward gap rolls forward to a valid instant; an invalid timezone yields null", () => {
    // 2026-03-29 02:30 Paris does not exist (clocks jump 02:00→03:00) → a valid instant, never null
    const gap: ScheduleRule = { kind: "daily_local_time", local_time: "02:30", timezone: "Europe/Paris" };
    const got = nextScheduleRunAt(gap, new Date("2026-03-29T00:00:00Z"), 0);
    expect(got).toBeInstanceOf(Date);
    expect(got!.getTime()).toBeGreaterThan(new Date("2026-03-29T00:00:00Z").getTime());
    // invalid timezone → no instant (the caller blocks rather than guessing)
    expect(nextScheduleRunAt({ kind: "daily_local_time", local_time: "09:00", timezone: "Mars/Olympus" }, new Date(), 0)).toBeNull();
    expect(nextScheduleRunAt({ kind: "daily_local_time", local_time: "9h", timezone: "Europe/Paris" }, new Date(), 0)).toBeNull();
  });

  it("buildScheduleRule reads a typed schedule object + the legacy delay_seconds form", () => {
    expect(buildScheduleRule({ schedule: { kind: "daily_local_time", local_time: "09:00", timezone: "Europe/Paris" } }).kind).toBe("daily_local_time");
    expect(buildScheduleRule({ delay_seconds: 60 })).toEqual({ kind: "fixed_delay", delay_seconds: 60, timezone: "UTC" });
    expect(buildScheduleRule({}).kind).toBe("once");
  });
});
