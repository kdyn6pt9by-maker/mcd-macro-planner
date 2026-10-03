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
}

export const EMPTY_RESERVE: ReserveState = { choices: {}, moves: [], paybacks: {} };
const RESERVE_KEY = "mcd-planner:reserve";
/** Weekend overage under this is noise, not worth asking about. */
export const OVER_TOLERANCE = 100;

export function loadReserve(): ReserveState {
  if (typeof window === "undefined") return EMPTY_RESERVE;
  try {
    const raw = window.localStorage.getItem(RESERVE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return { choices: v?.choices ?? {}, moves: v?.moves ?? [], paybacks: v?.paybacks ?? {} };
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

/** That day's raw Fri–Sun share from the weekly bank (before the use/store choice). */
export function shareFor(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): number {
  if (!isSpendDate(date)) return 0;
  return weekBank(days, settings, fromKey(date), (d) => paybackFor(d, reserve)).perDay;
}

export interface DayAdjust {
  share: number;
  /** Bank share actually added today (0 if stored). */
  bonus: number;
  stored: number;
  withdrawn: number;
  payback: number;
  /** Net kcal added to (or, if negative, taken off) the day's target. */
  total: number;
}

export function dayAdjust(date: string, days: Record<string, DayState>, settings: Settings, reserve: ReserveState): DayAdjust {
  const share = shareFor(date, days, settings, reserve);
  const stored = reserve.choices[date] === "store" ? share : 0;
  const bonus = share - stored;
  const withdrawn = reserve.moves.filter((m) => m.kind === "withdraw" && m.date === date).reduce((n, m) => n + m.kcal, 0);
  const payback = paybackFor(date, reserve);
  return { share, bonus, stored, withdrawn, payback, total: bonus + withdrawn - payback };
}

export interface ReserveLine {
  date: string;
  kcal: number;
  kind: "store" | "withdraw" | "cover";
  id?: string;
}

/** Reserve balance and its history (newest first). */
export function reserveBalance(days: Record<string, DayState>, settings: Settings, reserve: ReserveState): { balance: number; lines: ReserveLine[] } {
  const lines: ReserveLine[] = [];
  for (const [date, choice] of Object.entries(reserve.choices)) {
    if (choice !== "store") continue;
    const kcal = shareFor(date, days, settings, reserve);
    if (kcal > 0) lines.push({ date, kcal, kind: "store" });
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
    const allowed = effectiveTargets(settings, mode).kcal + dayAdjust(date, days, settings, reserve).total;
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
