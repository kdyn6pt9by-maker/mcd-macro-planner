import { sumMacros } from "./engine/macros";
import { weeklyRate, type WeightEntry, toKey } from "./progress";
import { DayEntry, DayState } from "./types";

/** ~7,700 kcal per kg of body weight. */
export const KCAL_PER_KG = 7700;

export interface SpendSummary {
  total: number;
  orders: number;
  /** Orders paid with the Esaad discount / without it / using reward points. */
  esaadOrders: number;
  fullPriceOrders: number;
  pointsOrders: number;
  avgPerOrder: number | null;
  /** AED for every 10 g of protein in the orders you paid for. */
  per10gProtein: number | null;
}

export function spending(days: DayState[], from: string, to: string): SpendSummary {
  let total = 0;
  let orders = 0;
  let protein = 0;
  let esaadOrders = 0;
  let pointsOrders = 0;
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    for (const p of d.payments ?? []) {
      total += p.amount;
      orders++;
      if (p.esaad) esaadOrders++;
      if (p.points) pointsOrders++;
      protein += d.entries.filter((e) => e.groupId === p.orderId).reduce((n, e) => n + e.macros.protein, 0);
    }
  }
  total = Math.round(total * 100) / 100;
  return {
    total,
    orders,
    esaadOrders,
    fullPriceOrders: orders - esaadOrders,
    pointsOrders,
    avgPerOrder: orders ? Math.round((total / orders) * 100) / 100 : null,
    per10gProtein: protein > 0 ? Math.round((total / protein) * 10 * 100) / 100 : null,
  };
}

export interface Maintenance {
  maintenance: number;
  avgKcal: number;
  rate: number;
  loggedDays: number;
}

/**
 * Energy balance from your own data: calories you actually ate vs how fast your weight moved.
 * Needs ≥14 logged days and a weight trend over the last 4 weeks.
 */
export function estimateMaintenance(
  days: Record<string, DayState>,
  weights: WeightEntry[],
  today = new Date()
): Maintenance | null {
  const from = new Date(today);
  from.setDate(from.getDate() - 28);
  const fromKey = toKey(from);
  const logged = Object.values(days).filter((d) => d.date >= fromKey && d.date < toKey(today) && d.entries.length);
  if (logged.length < 14) return null;
  const rate = weeklyRate(weights.filter((w) => w.date >= fromKey), today);
  if (rate === null) return null;
  const avgKcal = logged.reduce((n, d) => n + sumMacros(d.entries.map((e) => e.macros)).kcal, 0) / logged.length;
  return {
    maintenance: Math.round((avgKcal - (rate * KCAL_PER_KG) / 7) / 10) * 10,
    avgKcal: Math.round(avgKcal),
    rate,
    loggedDays: logged.length,
  };
}

/** Daily calories for a target weekly change (negative = lose), rounded to 25 kcal. */
export function targetFor(maintenance: number, kgPerWeek: number): number {
  return Math.round((maintenance + (kgPerWeek * KCAL_PER_KG) / 7) / 25) * 25;
}

/** Fresh ids for copied entries, keeping meals grouped together. */
export function cloneEntries(entries: DayEntry[], makeId: () => string, at = new Date().toISOString()): DayEntry[] {
  const groups = new Map<string, string>();
  return entries.map((e) => {
    let groupId: string | undefined;
    if (e.groupId) {
      if (!groups.has(e.groupId)) groups.set(e.groupId, makeId());
      groupId = groups.get(e.groupId);
    }
    return { ...e, id: makeId(), at, groupId };
  });
}

/** Drop payments whose meal no longer exists (e.g. the order was deleted). */
export function prunePayments(day: DayState): DayState {
  if (!day.payments?.length) return day;
  const groups = new Set(day.entries.map((e) => e.groupId).filter(Boolean));
  return { ...day, payments: day.payments.filter((p) => groups.has(p.orderId)) };
}

/** Your most recent distinct amounts, newest first — offered as one-tap chips. */
export function recentAmounts(days: DayState[], limit = 4): number[] {
  const all = days
    .flatMap((d) => d.payments ?? [])
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((p) => p.amount);
  return [...new Set(all)].slice(0, limit);
}

/** A day where at least one order used the Esaad discount — highlighted in the Days list. */
export const hasEsaad = (day: DayState) => (day.payments ?? []).some((p) => p.esaad);

export interface DayCost {
  mcd: number;
  nada: number;
  nadaBottles: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a day cost: McDonald's payments you entered + Nada bottles at a fixed price each. */
export function dayCost(day: DayState, nadaPrice: number): DayCost {
  const mcd = (day.payments ?? []).reduce((n, p) => n + p.amount, 0);
  const nadaBottles = day.entries.filter((e) => e.kind === "nada").length;
  const nada = nadaBottles * nadaPrice;
  return { mcd: round2(mcd), nada: round2(nada), nadaBottles, total: round2(mcd + nada) };
}

export interface CostSummary extends DayCost {
  days: number;
  perDay: number | null;
}

/** Totals over a date range (inclusive), counting only days with any cost. */
export function costSummary(days: DayState[], from: string, to: string, nadaPrice: number): CostSummary {
  let mcd = 0;
  let nada = 0;
  let nadaBottles = 0;
  let counted = 0;
  for (const d of days) {
    if (d.date < from || d.date > to) continue;
    const c = dayCost(d, nadaPrice);
    if (c.total === 0) continue;
    mcd += c.mcd;
    nada += c.nada;
    nadaBottles += c.nadaBottles;
    counted++;
  }
  const total = round2(mcd + nada);
  return { mcd: round2(mcd), nada: round2(nada), nadaBottles, total, days: counted, perDay: counted ? round2(total / counted) : null };
}
