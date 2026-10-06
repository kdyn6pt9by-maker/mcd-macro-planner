import { DayState, FoodItem } from "./types";

/**
 * Prices learned from what you've paid. Payments are per McDonald's order, so:
 *  • an order you've paid for before shows exactly what you paid (average if more than once);
 *  • single items are worked out from your receipts: an order of one kind of item gives its unit price directly,
 *    and a mixed order gives the one remaining unknown item once the others are known.
 * Points-paid orders are ignored. If you've paid with Esaad before, Esaad receipts are used (that's how you pay).
 */
export interface PriceBook {
  /** AED per unit, by menu item id. */
  item: Record<string, number>;
  /** By McDonald's-only order key ("big-macx1|mcchickenx2"). */
  orders: Record<string, { avg: number; last: number; count: number }>;
  esaad: boolean;
}

export const EMPTY_PRICES: PriceBook = { item: {}, orders: {}, esaad: false };

type Line = { id: string; qty: number };

export const priceKey = (lines: Line[]) =>
  lines
    .filter((l) => l.qty > 0)
    .map((l) => `${l.id}x${l.qty}`)
    .sort()
    .join("|");

export function buildPriceBook(days: DayState[], foods: Pick<FoodItem, "id" | "name">[]): PriceBook {
  const idOf = (label: string) => foods.find((f) => f.name === label)?.id;
  const paid: { lines: Line[]; amount: number; esaad: boolean; at: string }[] = [];
  for (const day of days) {
    for (const p of day.payments ?? []) {
      if (p.points || !(p.amount > 0)) continue;
      const counts = new Map<string, number>();
      for (const e of day.entries) {
        if (e.groupId !== p.orderId || e.kind !== "mcdonalds") continue;
        const id = idOf(e.label);
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      if (counts.size) paid.push({ lines: Array.from(counts, ([id, qty]) => ({ id, qty })), amount: p.amount, esaad: !!p.esaad, at: p.at });
    }
  }
  const esaad = paid.some((o) => o.esaad);
  const use = esaad ? paid.filter((o) => o.esaad) : paid;

  const orders: PriceBook["orders"] = {};
  for (const o of [...use].sort((a, b) => a.at.localeCompare(b.at))) {
    const k = priceKey(o.lines);
    const cur = orders[k] ?? { avg: 0, last: 0, count: 0 };
    orders[k] = { avg: (cur.avg * cur.count + o.amount) / (cur.count + 1), last: o.amount, count: cur.count + 1 };
  }

  const item: Record<string, number> = {};
  for (let pass = 0; pass < 10; pass++) {
    const samples = new Map<string, number[]>();
    for (const o of use) {
      const unknown = o.lines.filter((l) => item[l.id] === undefined);
      if (unknown.length !== 1) continue;
      const known = o.lines.reduce((n, l) => n + (item[l.id] ?? 0) * (item[l.id] === undefined ? 0 : l.qty), 0);
      const each = (o.amount - known) / unknown[0].qty;
      if (each > 0) samples.set(unknown[0].id, [...(samples.get(unknown[0].id) ?? []), each]);
    }
    if (!samples.size) break;
    for (const [id, xs] of samples) item[id] = xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  return { item, orders, esaad };
}

/**
 * Price of an order (McDonald's lines plus Nada bottles). exact = you've paid for this McDonald's order before.
 * null when some item's price isn't known yet.
 */
export function orderPrice(lines: Line[], nadaQty: number, nadaPrice: number, book: PriceBook): { amount: number; exact: boolean } | null {
  const mcd = lines.filter((l) => l.qty > 0);
  const nada = nadaQty * nadaPrice;
  if (!mcd.length) return nadaQty ? { amount: nada, exact: true } : null;
  const seen = book.orders[priceKey(mcd)];
  if (seen) return { amount: seen.avg + nada, exact: true };
  if (mcd.some((l) => book.item[l.id] === undefined)) return null;
  return { amount: mcd.reduce((n, l) => n + book.item[l.id] * l.qty, 0) + nada, exact: false };
}

export const fmtAed = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
