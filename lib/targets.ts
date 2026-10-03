import { effectiveTargets } from "./goals";
import { ReserveState, dayAdjust } from "./reserve";
import { DayMode, DayState, Settings, Targets } from "./types";

/**
 * A day's calorie target as the home screen shows it: goal (maintain/cut/bulk), plus the Fri–Sun bank share
 * (unless stored), reserve withdrawals, minus any weekend payback. The extra or missing room goes to carbs.
 */
export function targetsFor(date: string, settings: Settings, mode: DayMode, days: Record<string, DayState>, reserve: ReserveState): Targets {
  const base = effectiveTargets(settings, mode);
  const adj = dayAdjust(date, days, settings, reserve).total;
  return adj ? { ...base, kcal: base.kcal + adj, carbsRef: Math.max(0, base.carbsRef + Math.round(adj / 4)) } : base;
}

export { DATA_EVENT, notifyDataChanged } from "./events";
