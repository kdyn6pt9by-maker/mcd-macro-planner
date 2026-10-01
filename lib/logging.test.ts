import { beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryStorage() });
});

let n = 0;
const id = () => `id${n++}`;
const macros = { kcal: 549, protein: 23, fat: 30, carbs: 46 };

describe("logging to past days", () => {
  it("adds food to a past day without touching today", async () => {
    const { appendToDay } = await import("./logging");
    const { loadDay, listDays } = await import("./storage");
    appendToDay("2026-09-20", [{ kind: "custom", label: "Shawarma", macros }], false, id);
    expect(loadDay("2026-09-20").entries.map((e) => e.label)).toEqual(["Shawarma"]);
    expect(listDays().map((d) => d.date)).toEqual(["2026-09-20"]);
  });

  it("groups an order and attaches a payment to that past day", async () => {
    const { appendToDay, setPayment } = await import("./logging");
    const { loadDay } = await import("./storage");
    const { groupId } = appendToDay(
      "2026-09-20",
      [
        { kind: "mcdonalds", label: "Big Mac", macros },
        { kind: "mcdonalds", label: "Big Mac", macros },
      ],
      true,
      id
    );
    setPayment("2026-09-20", groupId!, "2 × Big Mac", 30, id);
    setPayment("2026-09-20", groupId!, "2 × Big Mac", 32, id, { esaad: true });
    const day = loadDay("2026-09-20");
    expect(new Set(day.entries.map((e) => e.groupId)).size).toBe(1);
    expect(day.payments!.map((p) => [p.amount, p.esaad])).toEqual([[32, true]]);
  });

  it("sets totals for a past day, replacing what was there", async () => {
    const { appendToDay, setDayTotals } = await import("./logging");
    const { loadDay } = await import("./storage");
    appendToDay("2026-09-20", [{ kind: "custom", label: "x", macros }], false, id);
    setDayTotals("2026-09-20", "Day totals", { kcal: 2100, protein: 150, fat: 55, carbs: 220 }, id);
    const day = loadDay("2026-09-20");
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0].macros.kcal).toBe(2100);
  });
});

describe("editing a logged order", () => {
  const cheese = { kcal: 295, protein: 13, fat: 13, carbs: 32 };
  it("swaps the burger in place and keeps the payment and Nada", async () => {
    const { appendToDay, setPayment, replaceOrderItems } = await import("./logging");
    const { loadDay } = await import("./storage");
    appendToDay("2026-09-30", [{ kind: "usual", label: "Usual", macros }], false, id);
    const { groupId } = appendToDay(
      "2026-09-30",
      [
        { kind: "mcdonalds", label: "Beef Burger", macros },
        { kind: "nada", label: "Nada Protein Milk", macros },
      ],
      true,
      id
    );
    setPayment("2026-09-30", groupId!, "1 × Beef Burger", 12, id, { esaad: true });
    replaceOrderItems("2026-09-30", groupId!, [{ kind: "mcdonalds", label: "Cheeseburger", macros: cheese }], "1 × Cheeseburger", id);
    const day = loadDay("2026-09-30");
    expect(day.entries.map((e) => e.label)).toEqual(["Usual", "Cheeseburger", "Nada Protein Milk"]);
    expect(day.entries[1].groupId).toBe(groupId);
    expect(day.payments).toHaveLength(1);
    expect(day.payments![0]).toMatchObject({ amount: 12, esaad: true, label: "1 × Cheeseburger" });
  });

  it("builds stats keys from logged entries and moves one use between combos", async () => {
    const { orderKeyFromEntries } = await import("./logging");
    const { recordCombinationUsed, moveHistoryUse, loadHistory } = await import("./storage");
    const foods = [{ id: "beef-burger", name: "Beef Burger" }];
    const key = orderKeyFromEntries(
      [
        { id: "1", kind: "mcdonalds", label: "Beef Burger", macros, at: "" },
        { id: "2", kind: "mcdonalds", label: "Beef Burger", macros, at: "" },
        { id: "3", kind: "nada", label: "Nada", macros, at: "" },
      ],
      foods
    );
    expect(key).toBe("beef-burgerx2|nadax1");
    recordCombinationUsed(key, "2 × Beef Burger + Nada");
    moveHistoryUse(key, "cheeseburgerx1", "1 × Cheeseburger", []);
    expect(loadHistory().map((h) => [h.key, h.count])).toEqual([["cheeseburgerx1", 1]]);
  });
});

describe("editOrder", () => {
  it("swaps items, keeps payment, moves stats, and can be undone", async () => {
    const { appendToDay, setPayment, editOrder, orderQty } = await import("./logging");
    const { loadDay, recordCombinationUsed, loadHistory } = await import("./storage");
    const foods = [
      { id: "beef-burger", name: "Beef Burger", macros },
      { id: "cheeseburger", name: "Cheeseburger", macros: { kcal: 295, protein: 13, fat: 13, carbs: 32 } },
    ];
    const { groupId } = appendToDay("2026-10-01", [{ kind: "mcdonalds", label: "Beef Burger", macros }], true, id);
    setPayment("2026-10-01", groupId!, "1 × Beef Burger", 10, id, { esaad: true });
    recordCombinationUsed("beef-burgerx1", "1 × Beef Burger");
    expect(orderQty(loadDay("2026-10-01"), groupId!, foods)).toEqual({ "beef-burger": 1 });

    const res = editOrder("2026-10-01", groupId!, [{ food: foods[1], qty: 2 }], foods, id);
    expect(res.after.entries.map((e) => e.label)).toEqual(["Cheeseburger", "Cheeseburger"]);
    expect(res.after.payments![0].amount).toBe(10);
    expect(loadHistory().map((h) => [h.key, h.count])).toEqual([["cheeseburgerx2", 1]]);

    res.undo();
    expect(loadDay("2026-10-01").entries.map((e) => e.label)).toEqual(["Beef Burger"]);
    expect(loadHistory().map((h) => [h.key, h.count])).toEqual([["beef-burgerx1", 1]]);
  });
});
