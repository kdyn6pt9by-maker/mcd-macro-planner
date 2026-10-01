import { describe, expect, it } from "vitest";
import { defaultSettings } from "./data/defaultSettings";
import { applyGoal, bankBonusFor, pctForCalories, weekBank } from "./goals";
import { fromKey } from "./progress";
import { DayState, Settings, Targets } from "./types";

const base: Targets = { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 };

describe("applyGoal", () => {
  it("maintain returns your current targets untouched", () => {
    expect(applyGoal(base, { mode: "maintain", pct: 20 })).toEqual(base);
  });

  it("cut 20%: same protein, fat scaled, carbs take the rest", () => {
    const t = applyGoal(base, { mode: "cut", pct: 20 });
    expect(t.kcal).toBe(1600);
    expect(t.proteinMin).toBe(140);
    expect(t.fatMax).toBe(48);
    expect(t.fatMin).toBe(40);
    expect(t.carbsRef).toBe(Math.round((1600 - 140 * 4 - 48 * 9) / 4));
    // calories still add up
    expect(t.proteinMin * 4 + t.fatMax * 9 + t.carbsRef * 4).toBeCloseTo(1600, -1);
  });

  it("bulk 15%: protein same, more fat and carbs", () => {
    const t = applyGoal(base, { mode: "bulk", pct: 15 });
    expect(t.kcal).toBe(2300);
    expect(t.proteinMin).toBe(140);
    expect(t.fatMax).toBe(69);
    expect(t.carbsRef).toBeGreaterThan(base.carbsRef);
  });

  it("never lets fat fall under 20% of calories on a hard cut", () => {
    const t = applyGoal({ ...base, fatMax: 30, fatMin: 25 }, { mode: "cut", pct: 30 });
    expect(t.fatMax).toBe(Math.round((1400 * 0.2) / 9));
  });

  it("turns typed calories into a goal", () => {
    expect(pctForCalories(2000, 1700)).toEqual({ mode: "cut", pct: 15 });
    expect(pctForCalories(2000, 2200)).toEqual({ mode: "bulk", pct: 10 });
    expect(pctForCalories(2000, 2000)).toEqual({ mode: "maintain", pct: 0 });
  });
});

describe("weekBank (Mon–Thu save → Fri/Sat/Sun spend)", () => {
  const settings: Settings = { ...defaultSettings, goal: { mode: "maintain", pct: 0 } };
  const day = (date: string, kcal: number): DayState => ({
    date,
    entries: [{ id: date, kind: "custom", label: "x", macros: { kcal, protein: 0, fat: 0, carbs: 0 }, at: "" }],
  });
  // Week of Mon 2026-09-28 … Sun 2026-10-04; Wednesday not logged.
  const days = {
    "2026-09-28": day("2026-09-28", 1700),
    "2026-09-29": day("2026-09-29", 1800),
    "2026-10-01": day("2026-10-01", 1900),
    "2026-10-02": day("2026-10-02", 2500), // Friday: never counted as saving
  };

  it("counts only logged Mon–Thu days and splits the total over Fri, Sat, Sun", () => {
    const b = weekBank(days, settings, fromKey("2026-10-02"));
    expect(b.saveDays.map((d) => d.diff)).toEqual([300, 200, null, 100]);
    expect(b.saved).toBe(600);
    expect(b.loggedDays).toBe(3);
    expect(b.perDay).toBe(200);
    expect(b.spendDays.map((d) => [d.date, d.target + d.bonus])).toEqual([
      ["2026-10-02", 2200],
      ["2026-10-03", 2200],
      ["2026-10-04", 2200],
    ]);
  });

  it("is the same whichever day of the week you look", () => {
    expect(weekBank(days, settings, fromKey("2026-09-28")).saveDays[0].diff).toBe(300);
    expect(weekBank(days, settings, fromKey("2026-10-04")).perDay).toBe(200);
  });

  it("gives no bonus when you went over", () => {
    const over = { "2026-09-28": day("2026-09-28", 2600) };
    const b = weekBank(over, settings, fromKey("2026-10-03"));
    expect(b.saved).toBe(-600);
    expect(b.perDay).toBe(0);
  });

  it("follows the active goal's targets", () => {
    const cut = { ...settings, goal: { mode: "cut" as const, pct: 10 } };
    expect(weekBank(days, cut, fromKey("2026-10-02")).saved).toBe(1800 * 3 - (1700 + 1800 + 1900));
  });

  it("bonus only on Fri–Sun", () => {
    expect(bankBonusFor("2026-10-01", days, settings)).toBe(0);
    expect(bankBonusFor("2026-10-02", days, settings)).toBe(200);
    expect(bankBonusFor("2026-10-04", days, settings)).toBe(200);
  });
});
