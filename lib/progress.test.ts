import { describe, expect, it } from "vitest";
import { DayState, Targets } from "./types";
import {
  dailySeries,
  fromKey,
  isCommitted,
  nextMilestone,
  pendingWeekendDays,
  reminderIcs,
  summarize,
  weekStrip,
  weekdayStreak,
  weeklyRate,
  weightTrend,
} from "./progress";

const targets: Targets = { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 };

const good = { kcal: 1950, protein: 145, fat: 55, carbs: 200 };
const lowProtein = { kcal: 1900, protein: 100, fat: 40, carbs: 250 };

function days(map: Record<string, typeof good>): Record<string, DayState> {
  return Object.fromEntries(
    Object.entries(map).map(([date, macros]) => [date, { date, entries: [{ id: date, kind: "custom", label: "x", macros, at: "" }] }])
  );
}

// 2026-09-21 is a Monday.
const week1 = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];
const week2 = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"];

describe("isCommitted", () => {
  it("needs protein hit, fat under max, and calories within tolerance", () => {
    expect(isCommitted(good, targets)).toBe(true);
    expect(isCommitted(lowProtein, targets)).toBe(false);
    expect(isCommitted({ ...good, fat: 61 }, targets)).toBe(false);
    expect(isCommitted({ ...good, kcal: 2100 }, targets)).toBe(true);
    expect(isCommitted({ ...good, kcal: 2101 }, targets)).toBe(false);
    expect(isCommitted(null, targets)).toBe(false);
  });
});

describe("weekdayStreak (Mon–Fri only)", () => {
  it("counts 5 for a full week, then 10 after the next Mon–Fri — weekend skipped", () => {
    const all = days(Object.fromEntries([...week1, ...week2].map((d) => [d, good])));
    expect(weekdayStreak(all, targets, fromKey("2026-09-25"))).toBe(5);
    expect(weekdayStreak(all, targets, fromKey("2026-09-27"))).toBe(5); // Sunday: unchanged
    expect(weekdayStreak(all, targets, fromKey("2026-10-02"))).toBe(10);
  });

  it("an unfinished today doesn't break the streak", () => {
    const all = days(Object.fromEntries(week1.map((d) => [d, good])));
    expect(weekdayStreak(all, targets, fromKey("2026-09-28"))).toBe(5);
  });

  it("a missed weekday resets it", () => {
    const all = days({ ...Object.fromEntries(week1.map((d) => [d, good])), "2026-09-23": lowProtein });
    expect(weekdayStreak(all, targets, fromKey("2026-09-25"))).toBe(2);
  });

  it("weekend logging never counts", () => {
    const all = days({ "2026-09-26": good, "2026-09-27": good });
    expect(weekdayStreak(all, targets, fromKey("2026-09-27"))).toBe(0);
  });
});

describe("weekStrip", () => {
  it("marks done / missed / today / future for Mon–Fri", () => {
    const all = days({ "2026-09-28": good, "2026-09-29": lowProtein });
    const strip = weekStrip(all, targets, fromKey("2026-09-30"));
    expect(strip.map((s) => s.status)).toEqual(["done", "missed", "today", "future", "future"]);
    expect(strip[0].date).toBe("2026-09-28");
  });
});

describe("milestones", () => {
  it("next milestone is the next multiple of 5", () => {
    expect(nextMilestone(0)).toBe(5);
    expect(nextMilestone(4)).toBe(5);
    expect(nextMilestone(5)).toBe(10);
  });
});

describe("dailySeries + summarize", () => {
  it("builds a gap-filled series and averages only logged days", () => {
    const all = days({ "2026-09-28": good, "2026-09-30": lowProtein });
    const pts = dailySeries(all, 7, targets, fromKey("2026-09-30"));
    expect(pts).toHaveLength(7);
    expect(pts[6].date).toBe("2026-09-30");
    expect(pts.filter((p) => p.totals)).toHaveLength(2);
    const s = summarize(pts, targets);
    expect(s.loggedDays).toBe(2);
    expect(s.avg!.kcal).toBe((1950 + 1900) / 2);
    expect(s.proteinHitDays).toBe(1);
    expect(s.bestDay!.date).toBe("2026-09-28");
  });
});

describe("weight", () => {
  it("smooths with a 14-day trailing average", () => {
    const t = weightTrend([
      { date: "2026-09-01", kg: 90 },
      { date: "2026-09-08", kg: 88 },
      { date: "2026-09-30", kg: 86 },
    ]);
    expect(t.map((x) => x.avg)).toEqual([90, 89, 86]);
  });

  it("computes kg/week slope", () => {
    const rate = weeklyRate(
      [
        { date: "2026-09-02", kg: 90 },
        { date: "2026-09-09", kg: 89.5 },
        { date: "2026-09-16", kg: 89 },
        { date: "2026-09-23", kg: 88.5 },
      ],
      fromKey("2026-09-28")
    );
    expect(rate).toBe(-0.5);
    expect(weeklyRate([{ date: "2026-09-23", kg: 88 }], fromKey("2026-09-28"))).toBeNull();
  });
});

describe("pendingWeekendDays", () => {
  const sat = "2026-09-26";
  const sun = "2026-09-27";
  it("asks from Sunday 18:00 about unlogged Sat and Sun", () => {
    expect(pendingWeekendDays({}, [], new Date(2026, 8, 27, 17))).toEqual([]);
    expect(pendingWeekendDays({}, [], new Date(2026, 8, 27, 19))).toEqual([sat, sun]);
  });
  it("still asks on Monday if missed, but not on Tuesday", () => {
    expect(pendingWeekendDays({}, [], new Date(2026, 8, 28, 8))).toEqual([sat, sun]);
    expect(pendingWeekendDays({}, [], new Date(2026, 8, 29, 8))).toEqual([]);
  });
  it("skips days already logged or explicitly skipped", () => {
    expect(pendingWeekendDays(days({ [sat]: good }), [], new Date(2026, 8, 28, 8))).toEqual([sun]);
    expect(pendingWeekendDays({}, [sat, sun], new Date(2026, 8, 28, 8))).toEqual([]);
  });
});

describe("reminderIcs", () => {
  it("includes a Sunday weekend check-in", () => {
    expect(reminderIcs("https://x.app")).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
  });

  it("repeats Mon–Fri with an alarm", () => {
    const ics = reminderIcs("https://example.app", 21, 0, new Date(2026, 8, 28, 10));
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(ics).toContain("DTSTART:20260928T210000");
    expect(ics).toContain("BEGIN:VALARM");
  });
});
