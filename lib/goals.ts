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

export interface WeekBank {
  /** kcal saved (positive) or overspent (negative) on logged days before today this week. */
  saved: number;
  loggedDays: number;
  /** Weekend days still ahead, including today if it's Sat/Sun. */
  weekendDaysLeft: number;
  /** Extra kcal each remaining weekend day can take from the bank. */
  perWeekendDay: number;
  weeklyBudget: number;
  eatenThisWeek: number;
}

/**
 * Calorie bank for the current week (Mon–Sun): what you saved vs target on days already logged
 * this week, spread over the weekend days still to come. Unlogged days don't count either way.
 */
export function weekBank(days: Record<string, DayState>, settings: Settings, today = new Date()): WeekBank {
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const todayKey = toKey(today);
  let saved = 0;
  let loggedDays = 0;
  let weeklyBudget = 0;
  let eatenThisWeek = 0;
  let weekendDaysLeft = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = toKey(d);
    const target = effectiveTargets(settings, isWeekendDate(d) ? "weekend" : "workday").kcal;
    weeklyBudget += target;
    const day = days[key];
    const eaten = day?.entries.length ? sumMacros(day.entries.map((e) => e.macros)).kcal : null;
    if (eaten !== null) eatenThisWeek += eaten;
    if (key < todayKey && eaten !== null) {
      saved += target - eaten;
      loggedDays++;
    }
    if (key >= todayKey && isWeekendDate(fromKey(key))) weekendDaysLeft++;
  }
  saved = Math.round(saved);
  return {
    saved,
    loggedDays,
    weekendDaysLeft,
    perWeekendDay: weekendDaysLeft ? Math.round(saved / weekendDaysLeft) : 0,
    weeklyBudget: Math.round(weeklyBudget),
    eatenThisWeek: Math.round(eatenThisWeek),
  };
}
