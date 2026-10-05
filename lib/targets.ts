import { effectiveTargets } from "./goals";
import { ReserveState, cutFor, dayAdjust } from "./reserve";
import { DayMode, DayState, Settings, Targets } from "./types";

/**
 * A day's calorie target as the home screen shows it: goal (maintain/cut/bulk), plus the Fri–Sun bank share
 * (unless stored), reserve withdrawals, minus any weekend payback. The extra or missing room goes to carbs.
 */
export function targetsFor(date: string, settings: Settings, mode: DayMode, days: Record<string, DayState>, reserve: ReserveState): Targets {
  const base = effectiveTargets(settings, mode);
  const adj = dayAdjust(date, days, settings, reserve).total;
  const withAdj = adj ? { ...base, kcal: base.kcal + adj, carbsRef: Math.max(0, base.carbsRef + Math.round(adj / 4)) } : base;
  return applyCut(withAdj, cutFor(date, reserve));
}

/**
 * Takes `cut` kcal off from fat and carbs together (protein untouched): fat shrinks in proportion to calories,
 * never below 20% of calories, and carbs absorb the rest.
 */
export function applyCut(t: Targets, cut: number): Targets {
  if (cut <= 0) return t;
  const kcal = t.kcal - cut;
  const ratio = kcal / t.kcal;
  const floor = (kcal * 0.2) / 9;
  const fatMax = Math.round(Math.max(t.fatMax * ratio, Math.min(t.fatMax, floor)));
  const fatMin = Math.min(fatMax, Math.round(Math.max(t.fatMin * ratio, Math.min(t.fatMin, floor))));
  const carbsRef = Math.max(0, Math.round(t.carbsRef - (cut - (t.fatMax - fatMax) * 9) / 4));
  return { ...t, kcal, fatMax, fatMin, carbsRef };
}

export { DATA_EVENT, notifyDataChanged } from "./events";
