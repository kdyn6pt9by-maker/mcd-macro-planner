import { describe, expect, it } from "vitest";
import { defaultSettings } from "./data/defaultSettings";
import { EMPTY_RESERVE, ReserveState, dayAdjust, pendingOverage, pendingWeekendChoice, reserveBalance, weekendOver } from "./reserve";
import { DayState, Settings } from "./types";

const settings: Settings = { ...defaultSettings, goal: { mode: "maintain", pct: 0 } };
const day = (date: string, kcal: number): DayState => ({
  date,
  entries: [{ id: date, kind: "custom", label: "x", macros: { kcal, protein: 0, fat: 0, carbs: 0 }, at: "" }],
});
// Mon 2026-09-28 … Thu 2026-10-01 save 600 → 200 per Fri/Sat/Sun (2026-10-02/03/04).
const week = {
  "2026-09-28": day("2026-09-28", 1700),
  "2026-09-29": day("2026-09-29", 1800),
  "2026-10-01": day("2026-10-01", 1900),
};

describe("weekend use-or-store", () => {
  it("asks on Fri/Sat/Sun while there's a share and no answer yet", () => {
    expect(pendingWeekendChoice("2026-10-02", week, settings, EMPTY_RESERVE)).toEqual({ date: "2026-10-02", share: 200 });
    expect(pendingWeekendChoice("2026-10-01", week, settings, EMPTY_RESERVE)).toBeNull();
    const answered: ReserveState = { ...EMPTY_RESERVE, choices: { "2026-10-02": "use" } };
    expect(pendingWeekendChoice("2026-10-02", week, settings, answered)).toBeNull();
  });

  it("storing keeps normal calories and fills the reserve", () => {
    const r: ReserveState = { ...EMPTY_RESERVE, choices: { "2026-10-02": "store", "2026-10-03": "use", "2026-10-04": "store" } };
    expect(dayAdjust("2026-10-02", week, settings, r).total).toBe(0);
    expect(dayAdjust("2026-10-03", week, settings, r).total).toBe(200);
    expect(reserveBalance(week, settings, r).balance).toBe(400);
  });

  it("withdrawing adds to that day's target and lowers the balance", () => {
    const r: ReserveState = {
      ...EMPTY_RESERVE,
      choices: { "2026-10-02": "store" },
      moves: [{ id: "w", date: "2026-10-07", kcal: 150, kind: "withdraw" }],
    };
    expect(dayAdjust("2026-10-07", week, settings, r).total).toBe(150);
    expect(reserveBalance(week, settings, r).balance).toBe(50);
  });
});

describe("weekend overage", () => {
  const over = { ...week, "2026-10-02": day("2026-10-02", 2600), "2026-10-03": day("2026-10-03", 2500) };

  it("measures over against the allowance actually chosen", () => {
    // Fri 2600 vs 2200, Sat 2500 vs 2200 → 700 over
    expect(weekendOver("2026-10-05", over, settings, EMPTY_RESERVE)).toBe(700);
    const stored: ReserveState = { ...EMPTY_RESERVE, choices: { "2026-10-02": "store" } };
    expect(weekendOver("2026-10-05", over, settings, stored)).toBe(900);
  });

  it("asks Mon–Thu and spreads payback over the remaining days", () => {
    expect(pendingOverage("2026-10-05", over, settings, EMPTY_RESERVE)).toEqual({ monday: "2026-10-05", over: 700, remaining: 4, perDay: 175 });
    expect(pendingOverage("2026-10-07", over, settings, EMPTY_RESERVE)?.perDay).toBe(350);
    expect(pendingOverage("2026-10-09", over, settings, EMPTY_RESERVE)).toBeNull();
  });

  it("reduce takes kcal off Mon–Thu and never counts as savings", () => {
    const r: ReserveState = { ...EMPTY_RESERVE, paybacks: { "2026-10-05": { decision: "reduce", over: 700, perDay: 175, from: "2026-10-05" } } };
    expect(dayAdjust("2026-10-06", over, settings, r).total).toBe(-175);
    expect(dayAdjust("2026-10-09", over, settings, r).total).toBe(0);
    // Eat exactly the reduced target Mon–Thu → no weekend bonus from it
    const next = { "2026-10-05": day("2026-10-05", 1825) };
    expect(dayAdjust("2026-10-09", next, settings, r).share).toBe(0);
    expect(pendingOverage("2026-10-06", over, settings, r)).toBeNull();
  });
});

describe("unused weekend extra goes to the reserve", () => {
  it("moves what wasn't eaten of a used extra, once the day is over", async () => {
    const { reserveBalance, unusedExtra } = await import("./reserve");
    // Fri share 200 → allowed 2200; ate 2080 → 120 unused. Sat ate 1900 → capped at the 200 extra.
    const d = { ...week, "2026-10-02": day("2026-10-02", 2080), "2026-10-03": day("2026-10-03", 1900) };
    const r: ReserveState = { ...EMPTY_RESERVE, choices: { "2026-10-02": "use" } };
    expect(unusedExtra("2026-10-02", d, settings, r)).toBe(120);
    expect(unusedExtra("2026-10-03", d, settings, r)).toBe(200);
    expect(reserveBalance(d, settings, r, "2026-10-03").balance).toBe(120); // Saturday not over yet
    expect(reserveBalance(d, settings, r, "2026-10-05").balance).toBe(320);
  });

  it("never double-counts a stored day or an unlogged one", async () => {
    const { reserveBalance } = await import("./reserve");
    const d = { ...week, "2026-10-02": day("2026-10-02", 1500) };
    const r: ReserveState = { ...EMPTY_RESERVE, choices: { "2026-10-02": "store" } };
    expect(reserveBalance(d, settings, r, "2026-10-05").balance).toBe(200);
  });
});

describe("saving plan (from today, for N days → reserve)", () => {
  it("lowers targets on the plan's days and puts what was really saved in the reserve", async () => {
    const { dayAdjust, reserveBalance, planSaved } = await import("./reserve");
    // Plan from Tue 2026-09-29, 3 days, 200/day. Ate 1800, 1900, 2100.
    const r: ReserveState = { ...EMPTY_RESERVE, savePlans: [{ id: "p", start: "2026-09-29", days: 3, kcal: 200 }] };
    expect(dayAdjust("2026-09-28", {}, settings, r).total).toBe(0);
    expect(dayAdjust("2026-09-29", {}, settings, r).total).toBe(-200);
    expect(dayAdjust("2026-10-01", {}, settings, r).total).toBe(-200);
    expect(dayAdjust("2026-10-02", {}, settings, r).plan).toBe(0);
    const d = { "2026-09-29": day("2026-09-29", 1800), "2026-09-30": day("2026-09-30", 1900), "2026-10-01": day("2026-10-01", 2100) };
    expect(["2026-09-29", "2026-09-30", "2026-10-01"].map((x) => planSaved(x, d, settings, r))).toEqual([200, 100, 0]);
    // Counted once each day is over; not double-counted in the weekend bank.
    expect(reserveBalance(d, settings, r, "2026-09-30").balance).toBe(200);
    expect(reserveBalance(d, settings, r, "2026-10-02").balance).toBe(300);
    expect(dayAdjust("2026-10-03", d, settings, r).share).toBe(0);
  });

  it("weekend bank counts only what went beyond the plan, and overs in full", async () => {
    const { bankDeductFor } = await import("./reserve");
    const { weekBank } = await import("./goals");
    const { fromKey } = await import("./progress");
    const r: ReserveState = { ...EMPTY_RESERVE, savePlans: [{ id: "p", start: "2026-09-28", days: 4, kcal: 200 }] };
    const d = { "2026-09-28": day("2026-09-28", 1500), "2026-09-29": day("2026-09-29", 2100) };
    const b = weekBank(d, settings, fromKey("2026-10-02"), (x) => bankDeductFor(x, d, settings, r));
    expect(b.saveDays.slice(0, 2).map((x) => x.diff)).toEqual([300, -100]);
  });
});
