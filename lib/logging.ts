import { loadDay, moveHistoryUse, saveDay } from "./storage";
import { DayEntry, DayState, Macros } from "./types";
import { prunePayments } from "./insights";

export type NewEntry = Omit<DayEntry, "id" | "at">;

/** Appends entries to any day (past or today). Returns the updated day and the shared groupId if grouped. */
export function appendToDay(date: string, entries: NewEntry[], group: boolean, makeId: () => string): { day: DayState; groupId?: string } {
  const current = loadDay(date);
  const groupId = group ? makeId() : undefined;
  const at = new Date().toISOString();
  const day = { ...current, entries: [...current.entries, ...entries.map((e) => ({ ...e, id: makeId(), at, groupId }))] };
  saveDay(day);
  return { day, groupId };
}

/** Replaces everything logged on a day with a single totals entry (keeps nothing else). */
export function setDayTotals(date: string, label: string, macros: Macros, makeId: () => string): DayState {
  const day: DayState = { date, entries: [{ id: makeId(), at: new Date().toISOString(), kind: "custom", label, macros }], payments: [] };
  saveDay(day);
  return day;
}

/** Records (or replaces) what was paid for one order on a given day. */
export function setPayment(
  date: string,
  orderId: string,
  label: string,
  amount: number,
  makeId: () => string,
  flags: { esaad?: boolean; points?: boolean; pointsUsed?: number } = {}
): DayState {
  const current = loadDay(date);
  const payments = (current.payments ?? []).filter((p) => p.orderId !== orderId);
  const day = prunePayments({ ...current, payments: [...payments, { id: makeId(), orderId, label, amount, at: new Date().toISOString(), ...flags }] });
  saveDay(day);
  return day;
}

/**
 * Swaps the McDonald's items of one logged order (e.g. Beef Burger → Cheeseburger) in place.
 * Keeps the order's groupId so its payment / Esaad flags stay attached; Nada in the same order is kept.
 */
export function replaceOrderItems(date: string, groupId: string, items: NewEntry[], label: string, makeId: () => string): DayState {
  const current = loadDay(date);
  const firstIdx = current.entries.findIndex((e) => e.groupId === groupId && e.kind === "mcdonalds");
  const at = current.entries[firstIdx]?.at ?? new Date().toISOString();
  const kept = current.entries.filter((e) => !(e.groupId === groupId && e.kind === "mcdonalds"));
  const fresh = items.map((e) => ({ ...e, id: makeId(), at, groupId }));
  const insertAt = firstIdx < 0 ? kept.length : current.entries.slice(0, firstIdx).filter((e) => !(e.groupId === groupId && e.kind === "mcdonalds")).length;
  const entries = [...kept.slice(0, insertAt), ...fresh, ...kept.slice(insertAt)];
  const payments = (current.payments ?? []).map((p) => (p.orderId === groupId ? { ...p, label } : p));
  const day = prunePayments({ ...current, entries, payments });
  saveDay(day);
  return day;
}

/** Stats key for a logged order ("big-macx2|nadax1"), mapping entry labels back to menu ids. */
export function orderKeyFromEntries(entries: DayEntry[], foods: { id: string; name: string }[]): string {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const id = e.kind === "nada" ? "nada" : foods.find((f) => f.name === e.label)?.id ?? e.label.toLowerCase().replace(/\s+/g, "-");
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Array.from(counts, ([id, n]) => `${id}x${n}`).sort().join("|");
}

/** Groups an order's entries into items for stats (name, qty, per-item macros). */
function itemsOf(entries: DayEntry[], foods: { id: string; name: string }[]) {
  const map = new Map<string, { id: string; name: string; qty: number; macros: Macros }>();
  for (const e of entries) {
    const id = e.kind === "nada" ? "nada" : foods.find((f) => f.name === e.label)?.id ?? e.label;
    const cur = map.get(id);
    if (cur) cur.qty++;
    else map.set(id, { id, name: e.label, qty: 1, macros: e.macros });
  }
  return Array.from(map.values());
}

/** Full edit of a logged order: swap items, keep payment, move the stats use to the new combination. */
export function editOrder(
  date: string,
  groupId: string,
  lines: { food: { id: string; name: string; macros: Macros }; qty: number }[],
  foods: { id: string; name: string }[],
  makeId: () => string
): { before: DayState; after: DayState; undo: () => void } {
  const before = loadDay(date);
  const oldGroup = before.entries.filter((e) => e.groupId === groupId);
  const oldKey = orderKeyFromEntries(oldGroup, foods);
  const label = lines.map((l) => `${l.qty} × ${l.food.name}`).join(" + ");
  const items: NewEntry[] = lines.flatMap((l) => Array.from({ length: l.qty }, () => ({ kind: "mcdonalds" as const, label: l.food.name, macros: l.food.macros })));
  const after = replaceOrderItems(date, groupId, items, label, makeId);
  const newGroup = after.entries.filter((e) => e.groupId === groupId);
  const newKey = orderKeyFromEntries(newGroup, foods);
  moveHistoryUse(oldKey, newKey, label, itemsOf(newGroup, foods));
  return {
    before,
    after,
    undo: () => {
      saveDay(before);
      moveHistoryUse(newKey, oldKey, oldGroup.map((e) => e.label).join(" + "), itemsOf(oldGroup, foods));
    },
  };
}

/** Quantities of each menu item in a logged order — to prefill the editor. */
export function orderQty(day: DayState, groupId: string, foods: { id: string; name: string }[]): Record<string, number> {
  const qty: Record<string, number> = {};
  for (const e of day.entries) {
    if (e.groupId !== groupId || e.kind !== "mcdonalds") continue;
    const id = foods.find((f) => f.name === e.label)?.id;
    if (id) qty[id] = (qty[id] ?? 0) + 1;
  }
  return qty;
}
