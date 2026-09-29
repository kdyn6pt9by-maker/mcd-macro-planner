import { loadDay, saveDay } from "./storage";
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
  flags: { esaad?: boolean; points?: boolean } = {}
): DayState {
  const current = loadDay(date);
  const payments = (current.payments ?? []).filter((p) => p.orderId !== orderId);
  const day = prunePayments({ ...current, payments: [...payments, { id: makeId(), orderId, label, amount, at: new Date().toISOString(), ...flags }] });
  saveDay(day);
  return day;
}
