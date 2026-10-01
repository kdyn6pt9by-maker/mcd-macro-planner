import { sumMacros } from "./engine/macros";
import { fromKey, toKey } from "./progress";
import { DayMode, DayState, Settings, Targets } from "./types";

export type GoalMode = "maintain" | "cut" | "bulk";

export interface Goal {
  mode: GoalMode;
  /** How far from maintenance, in percent (e.g. 20 = cut 20% / bulk 20%). */
  pct: number;
}

/** Fat never drops below 20% of calories — the usual floor for hormones and satiety. */
const FAT_FLOOR_SHARE = 0.2;

/**
 * Derives cut/bulk targets from your maintenance targets:
 * calories move by the chosen %, protein stays exactly the same, fat scales with calories (with a 20% floor),
 * and carbs take whatever is left — so cuts come mostly out of carbs and bulks go mostly into carbs.
 */
export function applyGoal(base: Targets, goal: Goal): Targets {
  if (goal.mode === "maintain" || goal.pct === 0) return base;
  const ratio = goal.mode === "cut" ? 1 - goal.pct / 100 : 1 + goal.pct / 100;
  const kcal = Math.round((base.kcal * ratio) / 10) * 10;
  const floor = (kcal * FAT_FLOOR_SHARE) / 9;
  const fatMax = Math.round(Math.max(base.fatMax * ratio, floor));
  const fatMin = Math.min(fatMax, Math.round(Math.max(base.fatMin * ratio, floor)));
  const proteinMin = base.proteinMin;
  const carbsRef = Math.max(0, Math.round((kcal - proteinMin * 4 - fatMax * 9) / 4));
  return { kcal, proteinMin, fatMin, fatMax, carbsRef };
}

/** % change that turns maintenance calories into the calories you typed. */
export function pctForCalories(maintenanceKcal: number, kcal: number): Goal {
  const diff = (kcal / maintenanceKcal - 1) * 100;
  const pct = Math.round(Math.abs(diff) * 10) / 10;
  return { mode: pct === 0 ? "maintain" : diff < 0 ? "cut" : "bulk", pct };
}

export function effectiveTargets(settings: Settings, mode: DayMode): Targets {
  return applyGoal(settings.targets[mode], settings.goal);
}

const isWeekendDate = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export interface BankSaveDay {
  date: string;
  target: number;
  /** null = not logged, so it doesn't count. */
  eaten: number | null;
  diff: number | null;
}

export interface BankSpendDay {
  date: string;
  target: number;
  bonus: number;
}

export interface WeekBank {
  /** Saved (positive) or over (negative), from logged Mon–Thu days only. */
  saved: number;
  loggedDays: number;
  saveDays: BankSaveDay[];
  /** Friday, Saturday, Sunday — each gets an equal share of what you saved. */
  spendDays: BankSpendDay[];
  perDay: number;
}

/**
 * Simple weekly calorie bank: Monday–Thursday you save (target − eaten, only for days you logged),
 * and the total is split evenly over Friday, Saturday and Sunday. Overspending gives no bonus.
 */
export function weekBank(days: Record<string, DayState>, settings: Settings, today = new Date()): WeekBank {
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const at = (i: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  };
  const saveDays: BankSaveDay[] = [0, 1, 2, 3].map((i) => {
    const d = at(i);
    const key = toKey(d);
    const target = effectiveTargets(settings, "workday").kcal;
    const day = days[key];
    const eaten = day?.entries.length ? Math.round(sumMacros(day.entries.map((e) => e.macros)).kcal) : null;
    return { date: key, target, eaten, diff: eaten === null ? null : target - eaten };
  });
  const saved = saveDays.reduce((n, d) => n + (d.diff ?? 0), 0);
  const perDay = saved > 0 ? Math.round(saved / 3) : 0;
  const spendDays: BankSpendDay[] = [4, 5, 6].map((i) => {
    const d = at(i);
    return { date: toKey(d), target: effectiveTargets(settings, isWeekendDate(d) ? "weekend" : "workday").kcal, bonus: perDay };
  });
  return { saved, loggedDays: saveDays.filter((d) => d.eaten !== null).length, saveDays, spendDays, perDay };
}

/** Extra kcal allowed on a given date from this week's bank (Fri–Sun only). */
export function bankBonusFor(date: string, days: Record<string, DayState>, settings: Settings): number {
  const d = fromKey(date);
  if (![5, 6, 0].includes(d.getDay())) return 0;
  return weekBank(days, settings, d).perDay;
}
