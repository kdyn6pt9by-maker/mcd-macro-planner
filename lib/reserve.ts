import { sumMacros } from "./engine/macros";
import { notifyDataChanged } from "./events";
import { effectiveTargets, weekBank } from "./goals";
import { fromKey, toKey } from "./progress";
import { DayState, Settings } from "./types";

/**
 * Extra-calories reserve — a second bank, separate from the weekly Fri–Sun bank:
 *  • on each Fri/Sat/Sun you choose to use that day's bank share, or keep normal calories and store the share here;
 *  • you can withdraw from it on any day (adds to that day's target) or use it to cover a weekend overage;
 *  • a weekend overage can instead be paid back Mon–Thu of the next week.
 */
export type WeekendChoice = "use" | "store";

export interface ReserveMove {
  id: string;
  date: string;
  /** Always positive; withdraw adds to that day's target, cover just pays off a weekend overage. */
  kcal: number;
  kind: "withdraw" | "cover";
}

export interface Payback {
  decision: "reduce" | "cover" | "skip";
  over: number;
  /** kcal taken off each remaining Mon–Thu day, starting `from`. */
  perDay: number;
  from: string;
}

export interface ReserveState {
  choices: Record<string, WeekendChoice>;
  moves: ReserveMove[];
  /** Keyed by the Monday after the weekend. */
  paybacks: Record<string, Payback>;
  /** Saving plans: eat `kcal` under target for `days` days from `start`; what you actually save goes to the reserve. */
  savePlans?: SavePlan[];
  /** Answers to "you went over yesterday", keyed by the day you went over. perDay 0 = declined. */
  dayCuts?: Record<string, DayCut>;
}

export interface DayCut {
  over: number;
  from: string;
  days: number;
  perDay: number;
}

export interface SavePlan {
  id: string;
  start: string;
  days: number;
  kcal: number;
}

export const EMPTY_RESERVE: ReserveState = { choices: {}, moves: [], paybacks: {}, savePlans: [], dayCuts: {} };
const RESERVE_KEY = "mcd-planner:reserve";
/** Weekend overage under this is noise, not worth asking about. */
export const OVER_TOLERANCE = 100;

export function loadReserve(): ReserveState {
  if (typeof window === "undefined") return EMPTY_RESERVE;
  try {
    const raw = window.localStorage.getItem(RESERVE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return { choices: v?.choices ?? {}, moves: v?.moves ?? [], paybacks: v?.paybacks ?? {}, savePlans: v?.savePlans ?? [], dayCuts: v?.dayCuts ?? {} };
  } catch {
    return EMPTY_RESERVE;
  }
}

export function saveReserve(state: ReserveState) {
  try {
    window.localStorage.setItem(RESERVE_KEY, JSON.stringify(state));
  } catch {}
  notifyDataChanged();
}

const addDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
const dowOf = (key: string) => fromKey(key).getDay();
export const isSpendDate = (key: string) => [5, 6, 0].includes(dowOf(key));
/** Monday of the week containing `key`. */
export const mondayOf = (key: string) => addDays(key, -((dowOf(key) + 6) % 7));

/** Kcal taken off a Mon–Thu date because a weekend overage is being paid back. */
export function paybackFor(date: string, reserve: ReserveState): number {
  const dow = dowOf(date);
  if (dow < 1 || dow > 4) return 0;
  const p = reserve.paybacks[mondayOf(date)];
  return p?.decision === "reduce" && date >= p.from ? p.perDay : 0;
}

/** Last day (inclusive) a plan covers. */
export const planEnd = (p: SavePlan) => addDays(p.start, p.days - 1);

/** kcal taken off a date's target by saving plans that cover it. */
export function planFor(date: string, reserve: ReserveState): number {
  return (reserve.savePlans ?? []).filter((p) => date >= p.start && date <= planEnd(p)).reduce((n, p) => n + p.kcal, 0);
}

/** The plan running today, if any. */
export function activePlan(today: string, reserve: ReserveState): SavePlan | null {
  return (reserve.savePlans ?? []).find((p) => today >= p.start && today <= planEnd(p)) ?? null;
}

/**
 * What the weekly bank leaves out of a Mon–Thu target: a payback, plus whatever a saving plan saved that day
 * (that part goes to the reserve, so it isn't counted twice). Going over is still counted in full.
 */
export function bankDeductFor(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): number {
  const payback = paybackFor(date, reserve);
  const plan = planFor(date, reserve);
  if (!plan) return payback;
  const day = days[date];
  if (!day?.entries.length) return payback;
  const eaten = sumMacros(day.entries.map((e) => e.macros)).kcal;
  const normal = effectiveTargets(settings, "workday").kcal - payback;
  return payback + Math.max(0, Math.min(plan, Math.round(normal - eaten)));
}

/** That day's raw Fri–Sun share from the weekly bank (before the use/store choice). */
export function shareFor(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): number {
  if (!isSpendDate(date)) return 0;
  return weekBank(days, settings, fromKey(date), (d) => bankDeductFor(d, days, settings, reserve)).perDay;
}

export interface DayAdjust {
  share: number;
  /** Bank share actually added today (0 if stored). */
  bonus: number;
  stored: number;
  withdrawn: number;
  payback: number;
  /** Planned saving taken off a Mon–Thu target. */
  plan: number;
  /** Net kcal added to (or, if negative, taken off) the day's target. */
  total: number;
}

export function dayAdjust(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): DayAdjust {
  const share = shareFor(date, days, settings, reserve);
  const stored = reserve.choices[date] === "store" ? share : 0;
  const bonus = share - stored;
  const withdrawn = reserve.moves.filter((m) => m.kind === "withdraw" && m.date === date).reduce((n, m) => n + m.kcal, 0);
  const payback = paybackFor(date, reserve);
  const plan = planFor(date, reserve);
  return { share, bonus, stored, withdrawn, payback, plan, total: bonus + withdrawn - payback - plan };
}

export interface ReserveLine {
  date: string;
  kcal: number;
  /**
   * leftover = a weekend extra you chose to use but didn't eat; plan = what a saving plan actually saved.
   * Both move here automatically once the day is over.
   */
  kind: "store" | "withdraw" | "cover" | "leftover" | "plan";
  id?: string;
}

/** Reserve balance and its history (newest first). */
/**
 * The part of a finished Fri/Sat/Sun's bank extra that wasn't eaten (only when the extra was used, not stored,
 * and the day was logged). Capped at the extra itself, so eating under your normal target never adds more.
 */
export function unusedExtra(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): number {
  if (!isSpendDate(date) || reserve.choices[date] === "store") return 0;
  const day = days[date];
  if (!day?.entries.length) return 0;
  const a = dayAdjust(date, days, settings, reserve);
  if (a.bonus <= 0) return 0;
  const mode = [0, 6].includes(dowOf(date)) ? "weekend" : "workday";
  const allowed = effectiveTargets(settings, mode).kcal + a.total + a.plan;
  const eaten = sumMacros(day.entries.map((e) => e.macros)).kcal;
  return Math.max(0, Math.min(a.bonus, Math.round(allowed - eaten)));
}

/** What a saving plan actually saved on a finished, logged day: up to the planned amount, never more. */
export function planSaved(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): number {
  const plan = planFor(date, reserve);
  const day = days[date];
  if (!plan || !day?.entries.length) return 0;
  const a = dayAdjust(date, days, settings, reserve);
  const mode = [0, 6].includes(dowOf(date)) ? "weekend" : "workday";
  const normal = effectiveTargets(settings, mode).kcal + a.total + a.plan;
  const eaten = sumMacros(day.entries.map((e) => e.macros)).kcal;
  return Math.max(0, Math.min(plan, Math.round(normal - eaten)));
}

export function reserveBalance(
  days: Record<string, DayState>,
  settings: Settings,
  reserve: ReserveState,
  today = toKey(new Date())
): { balance: number; lines: ReserveLine[] } {
  const lines: ReserveLine[] = [];
  for (const [date, choice] of Object.entries(reserve.choices)) {
    if (choice !== "store") continue;
    const kcal = shareFor(date, days, settings, reserve);
    if (kcal > 0) lines.push({ date, kcal, kind: "store" });
  }
  // Weekend extras that went uneaten, and what saving plans saved — counted once the day is over.
  for (const date of Object.keys(days)) {
    if (date >= today) continue;
    const kcal = unusedExtra(date, days, settings, reserve);
    if (kcal > 0) lines.push({ date, kcal, kind: "leftover" });
    const saved = planSaved(date, days, settings, reserve);
    if (saved > 0) lines.push({ date, kcal: saved, kind: "plan" });
  }
  for (const m of reserve.moves) lines.push({ date: m.date, kcal: -m.kcal, kind: m.kind, id: m.id });
  lines.sort((a, b) => b.date.localeCompare(a.date));
  return { balance: lines.reduce((n, l) => n + l.kcal, 0), lines };
}

/** Net kcal over (positive) the weekend's allowance, for the Fri–Sun before `monday`; logged days only. */
export function weekendOver(monday: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): number {
  let over = 0;
  for (const date of [addDays(monday, -3), addDays(monday, -2), addDays(monday, -1)]) {
    const day = days[date];
    if (!day?.entries.length) continue;
    const eaten = sumMacros(day.entries.map((e) => e.macros)).kcal;
    const mode = [0, 6].includes(dowOf(date)) ? "weekend" : "workday";
    const a = dayAdjust(date, days, settings, reserve);
    const allowed = effectiveTargets(settings, mode).kcal + a.total + a.plan;
    over += eaten - allowed;
  }
  return Math.round(over);
}

/** The weekend-overage question to ask now (Mon–Thu, not yet answered), or null. */
export function pendingOverage(today: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState) {
  const dow = dowOf(today);
  if (dow < 1 || dow > 4) return null;
  const monday = mondayOf(today);
  if (reserve.paybacks[monday]) return null;
  const over = weekendOver(monday, days, settings, reserve);
  if (over <= OVER_TOLERANCE) return null;
  const remaining = 5 - dow; // Mon → 4 days … Thu → 1 day
  return { monday, over, remaining, perDay: Math.round(over / remaining) };
}

/** Today's Fri/Sat/Sun use-or-store question, or null once answered or when there's no share. */
export function pendingWeekendChoice(today: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState) {
  if (!isSpendDate(today) || reserve.choices[today]) return null;
  const share = shareFor(today, days, settings, reserve);
  return share > 0 ? { date: today, share } : null;
}

/** kcal taken off a date's target to make up for going over on an earlier day (from fat and carbs, never protein). */
export function cutFor(date: string, reserve: ReserveState): number {
  return Object.values(reserve.dayCuts ?? {})
    .filter((c) => c.perDay > 0 && date >= c.from && date <= addDays(c.from, c.days - 1))
    .reduce((n, c) => n + c.perDay, 0);
}

/**
 * "You went over yesterday — make it up today?" Asked Tue–Fri about a logged Mon–Thu
 * (weekends have their own weekend-overage question), once, when it's more than OVER_TOLERANCE.
 */
export function pendingYesterdayOver(today: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState) {
  const yesterday = addDays(today, -1);
  const dow = dowOf(yesterday);
  if (dow < 1 || dow > 4 || reserve.dayCuts?.[yesterday]) return null;
  const day = days[yesterday];
  if (!day?.entries.length) return null;
  const a = dayAdjust(yesterday, days, settings, reserve);
  // Judged against that day's real target (with any make-up cut), but not against a voluntary saving plan.
  const allowed = effectiveTargets(settings, "workday").kcal + a.total + a.plan - cutFor(yesterday, reserve);
  const over = Math.round(sumMacros(day.entries.map((e) => e.macros)).kcal - allowed);
  return over > OVER_TOLERANCE ? { date: yesterday, over } : null;
}
