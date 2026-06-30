// PHASE 8.5-R4 §R4.12 — EXACT DST gap/overlap resolution (not just "a valid instant"). For Europe/Paris:
//   • normal winter / summer wall times resolve to the exact UTC instant;
//   • the spring-forward GAP (02:30 on 2026-03-29, which does not exist) rolls forward past the gap;
//   • the fall-back OVERLAP (02:30 on 2026-10-25, which occurs twice) takes the FIRST occurrence.
import { describe, it, expect } from "vitest";
import { nextScheduleRunAt, type ScheduleRule } from "../runtime-schedule-rules";

const daily = (local_time: string): ScheduleRule => ({ kind: "daily_local_time", local_time, timezone: "Europe/Paris" });

describe("P8.5-R4 DST exact", () => {
  it("normal winter and summer wall times resolve to the exact UTC instant", () => {
    expect(nextScheduleRunAt(daily("09:00"), new Date("2026-01-15T00:00:00Z"), 0)!.toISOString()).toBe("2026-01-15T08:00:00.000Z"); // CET +1
    expect(nextScheduleRunAt(daily("09:00"), new Date("2026-07-15T00:00:00Z"), 0)!.toISOString()).toBe("2026-07-15T07:00:00.000Z"); // CEST +2
  });

  it("a wall time on the transition DAY but outside the gap/overlap is exact", () => {
    // 09:00 on the spring-forward day is unambiguous CEST → 07:00Z
    expect(nextScheduleRunAt(daily("09:00"), new Date("2026-03-29T05:00:00Z"), 0)!.toISOString()).toBe("2026-03-29T07:00:00.000Z");
    // 09:00 on the fall-back day is unambiguous CET → 08:00Z
    expect(nextScheduleRunAt(daily("09:00"), new Date("2026-10-25T05:00:00Z"), 0)!.toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });

  it("the spring-forward GAP (02:30, non-existent) rolls FORWARD past the gap", () => {
    // Paris clocks jump 02:00→03:00 on 2026-03-29; 02:30 does not exist. Roll forward: 03:30 CEST = 01:30Z.
    const got = nextScheduleRunAt(daily("02:30"), new Date("2026-03-29T00:00:00Z"), 0)!;
    expect(got.toISOString()).toBe("2026-03-29T01:30:00.000Z");
    // and it is, indeed, AFTER the missing local hour (≥ the 03:00 transition = 01:00Z)
    expect(got.getTime()).toBeGreaterThanOrEqual(new Date("2026-03-29T01:00:00Z").getTime());
  });

  it("the fall-back OVERLAP (02:30, ambiguous) takes the FIRST occurrence", () => {
    // Paris clocks fall back 03:00→02:00 on 2026-10-25; 02:30 occurs twice (CEST 00:30Z, then CET 01:30Z).
    // R4.12: take the FIRST occurrence → 00:30Z (the CEST side), never the later 01:30Z.
    const got = nextScheduleRunAt(daily("02:30"), new Date("2026-10-25T00:00:00Z"), 0)!;
    expect(got.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(got.toISOString()).not.toBe("2026-10-25T01:30:00.000Z");
  });
});
