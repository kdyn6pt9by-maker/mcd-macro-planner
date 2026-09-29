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
    setPayment("2026-09-20", groupId!, "2 × Big Mac", 32, id);
    const day = loadDay("2026-09-20");
    expect(new Set(day.entries.map((e) => e.groupId)).size).toBe(1);
    expect(day.payments!.map((p) => p.amount)).toEqual([32]);
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
