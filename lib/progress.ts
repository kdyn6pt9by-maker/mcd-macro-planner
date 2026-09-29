import { sumMacros } from "./engine/macros";
import { DayState, Macros, Targets } from "./types";

/** A day "counts" when protein is hit, fat stays under the ceiling, and calories are within a small buffer. */
export const KCAL_TOLERANCE = 100;

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;

export function dayTotals(day: DayState | undefined): Macros | null {
  if (!day || day.entries.length === 0) return null;
  return sumMacros(day.entries.map((e) => e.macros));
}

export function isCommitted(t: Macros | null, targets: Targets): boolean {
  return !!t && t.protein >= targets.proteinMin && t.fat <= targets.fatMax && t.kcal <= targets.kcal + KCAL_TOLERANCE;
}

export interface DailyPoint {
  date: string;
  totals: Macros | null;
  committed: boolean;
}

export function dailySeries(days: Record<string, DayState>, count: number, targets: Targets, today = new Date()): DailyPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const date = toKey(addDays(today, i - count + 1));
    const totals = dayTotals(days[date]);
    return { date, totals, committed: isCommitted(totals, targets) };
  });
}

/**
 * Consecutive committed weekdays (Mon–Fri) ending at today. Weekends are skipped, never break it.
 * Today only adds once it's committed — an unfinished today doesn't break the streak either.
 */
export function weekdayStreak(days: Record<string, DayState>, targets: Targets, today = new Date()): number {
  let streak = 0;
  let cursor = new Date(today);
  if (isWeekday(cursor) && isCommitted(dayTotals(days[toKey(cursor)]), targets)) streak++;
  cursor = addDays(cursor, -1);
  for (let guard = 0; guard < 3660; guard++, cursor = addDays(cursor, -1)) {
    if (!isWeekday(cursor)) continue;
    if (!isCommitted(dayTotals(days[toKey(cursor)]), targets)) break;
    streak++;
  }
  return streak;
}

export type WeekdayStatus = "done" | "missed" | "today" | "future";

/** Monday–Friday of the current week (on weekends: the week just finished). */
export function weekStrip(days: Record<string, DayState>, targets: Targets, today = new Date()) {
  const dow = today.getDay();
  const monday = addDays(today, dow === 0 ? -6 : 1 - dow);
  const todayKey = toKey(today);
  return Array.from({ length: 5 }, (_, i) => {
    const d = addDays(monday, i);
    const key = toKey(d);
    const committed = isCommitted(dayTotals(days[key]), targets);
    const status: WeekdayStatus = committed ? "done" : key === todayKey ? "today" : key > todayKey ? "future" : "missed";
    return { date: key, label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2), status };
  });
}

export const STREAK_MILESTONE = 5;

export function nextMilestone(streak: number): number {
  return (Math.floor(streak / STREAK_MILESTONE) + 1) * STREAK_MILESTONE;
}

export interface Summary {
  loggedDays: number;
  avg: Macros | null;
  proteinHitDays: number;
  committedDays: number;
  bestDay: DailyPoint | null;
}

export function summarize(points: DailyPoint[], targets: Targets): Summary {
  const logged = points.filter((p) => p.totals);
  const avg = logged.length
    ? (Object.fromEntries(
        (["kcal", "protein", "fat", "carbs"] as const).map((k) => [k, logged.reduce((n, p) => n + p.totals![k], 0) / logged.length])
      ) as unknown as Macros)
    : null;
  // Best = committed day closest to the calorie target; otherwise highest protein.
  const best =
    [...logged].filter((p) => p.committed).sort((a, b) => Math.abs(targets.kcal - a.totals!.kcal) - Math.abs(targets.kcal - b.totals!.kcal))[0] ??
    [...logged].sort((a, b) => b.totals!.protein - a.totals!.protein)[0] ??
    null;
  return {
    loggedDays: logged.length,
    avg,
    proteinHitDays: logged.filter((p) => p.totals!.protein >= targets.proteinMin).length,
    committedDays: logged.filter((p) => p.committed).length,
    bestDay: best,
  };
}

export interface WeightEntry {
  date: string;
  kg: number;
}

/** Trailing average over the previous 14 days of weigh-ins — smooths out water-weight noise. */
export function weightTrend(entries: WeightEntry[]): (WeightEntry & { avg: number })[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((e) => {
    const from = toKey(addDays(fromKey(e.date), -13));
    const window = sorted.filter((x) => x.date >= from && x.date <= e.date);
    return { ...e, avg: Math.round((window.reduce((n, x) => n + x.kg, 0) / window.length) * 10) / 10 };
  });
}

/** Least-squares slope in kg/week over the last 8 weeks; null with fewer than 2 weigh-ins spanning 7+ days. */
export function weeklyRate(entries: WeightEntry[], today = new Date()): number | null {
  const from = toKey(addDays(today, -56));
  const pts = entries
    .filter((e) => e.date >= from)
    .map((e) => ({ x: (fromKey(e.date).getTime() - fromKey(from).getTime()) / (7 * 86_400_000), y: e.kg }));
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < 1) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return Math.round((num / den) * 100) / 100;
}

/**
 * Weekend days (Sat/Sun) still unlogged that should be asked about: from Sunday 18:00 through Monday,
 * minus any the user explicitly skipped.
 */
export function pendingWeekendDays(days: Record<string, DayState>, skipped: string[], now = new Date()): string[] {
  const dow = now.getDay();
  let sat: Date;
  if (dow === 0 && now.getHours() >= 18) sat = addDays(now, -1);
  else if (dow === 1) sat = addDays(now, -2);
  else return [];
  const sun = addDays(sat, 1);
  const todayKey = toKey(now);
  return [toKey(sat), toKey(sun)].filter(
    (k) => !(days[k]?.entries.length) && !skipped.includes(k) && !(k === todayKey && now.getHours() < 18)
  );
}

/** iCalendar file for a weekday evening reminder — iPhone adds it to Calendar, so it fires even with the app closed. */
export function reminderIcs(url: string, hour = 21, minute = 0, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const start = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}T${p(hour)}${p(minute)}00`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//McD Macro//Reminder//EN",
    "BEGIN:VEVENT",
    `UID:mcd-macro-reminder-${stamp}@mcd-macro`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    "DURATION:PT5M",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "SUMMARY:🍔 Log today in McD Macro",
    `DESCRIPTION:Did you hit your protein? Log the day to keep your streak. ${url}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Log today in McD Macro",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    `UID:mcd-macro-weekend-${stamp}@mcd-macro`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    "DURATION:PT5M",
    "RRULE:FREQ=WEEKLY;BYDAY=SU",
    "SUMMARY:🍔 Weekend check-in — log Saturday & Sunday",
    `DESCRIPTION:Add your weekend totals so your averages stay accurate. ${url}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Weekend check-in in McD Macro",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
