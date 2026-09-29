import { describe, expect, it } from "vitest";
import { cloneEntries, estimateMaintenance, spending, targetFor } from "./insights";
import { fromKey, toKey } from "./progress";
import { DayEntry, DayState } from "./types";

const e = (id: string, protein: number, kcal = 500, groupId?: string): DayEntry => ({
  id,
  kind: "mcdonalds",
  label: id,
  macros: { kcal, protein, fat: 10, carbs: 40 },
  at: "",
  groupId,
});

describe("spending", () => {
  const days: DayState[] = [
    {
      date: "2026-09-28",
      entries: [e("a", 25, 500, "o1"), e("b", 15, 300, "o1"), e("n", 30)],
      payments: [{ id: "p1", orderId: "o1", label: "x", amount: 32, at: "", esaad: true }],
    },
    {
      date: "2026-09-29",
      entries: [e("c", 40, 600, "o2")],
      payments: [{ id: "p2", orderId: "o2", label: "y", amount: 28.5, at: "", points: true }],
    },
    { date: "2026-08-01", entries: [], payments: [{ id: "p3", orderId: "zz", label: "old", amount: 99, at: "" }] },
  ];

  it("totals only the date range and computes per-order and per-10g-protein cost", () => {
    const s = spending(days, "2026-09-01", "2026-09-30");
    expect(s.total).toBe(60.5);
    expect(s.orders).toBe(2);
    expect(s.avgPerOrder).toBe(30.25);
    // 80 g protein in paid orders (Nada not included) → 60.5 / 80 * 10
    expect(s.per10gProtein).toBe(7.56);
    expect([s.esaadOrders, s.fullPriceOrders, s.pointsOrders]).toEqual([1, 1, 1]);
  });

  it("handles no payments", () => {
    expect(spending([], "2026-09-01", "2026-09-30")).toEqual({
      total: 0,
      orders: 0,
      esaadOrders: 0,
      fullPriceOrders: 0,
      pointsOrders: 0,
      avgPerOrder: null,
      per10gProtein: null,
    });
  });
});

describe("estimateMaintenance", () => {
  const today = fromKey("2026-09-29");
  const days: Record<string, DayState> = {};
  for (let i = 1; i <= 20; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = toKey(d);
    days[k] = { date: k, entries: [e(k, 140, 2000)] };
  }
  const weights = [
    { date: "2026-09-01", kg: 90 },
    { date: "2026-09-08", kg: 89.5 },
    { date: "2026-09-15", kg: 89 },
    { date: "2026-09-22", kg: 88.5 },
    { date: "2026-09-29", kg: 88 },
  ];

  it("adds back the deficit implied by weight loss", () => {
    const m = estimateMaintenance(days, weights, today)!;
    expect(m.avgKcal).toBe(2000);
    expect(m.rate).toBe(-0.5);
    expect(m.maintenance).toBe(2550); // 2000 + 0.5*7700/7
  });

  it("needs enough data", () => {
    expect(estimateMaintenance({}, weights, today)).toBeNull();
    expect(estimateMaintenance(days, [], today)).toBeNull();
  });

  it("suggests calories for a weekly goal", () => {
    expect(targetFor(2550, -0.5)).toBe(2000);
    expect(targetFor(2550, 0)).toBe(2550);
  });
});

describe("cloneEntries", () => {
  it("gives new ids and keeps meals grouped", () => {
    let n = 0;
    const out = cloneEntries([e("a", 1, 1, "g"), e("b", 1, 1, "g"), e("c", 1)], () => `id${n++}`);
    expect(new Set(out.map((x) => x.id)).size).toBe(3);
    expect(out[0].groupId).toBe(out[1].groupId);
    expect(out[0].groupId).not.toBe("g");
    expect(out[2].groupId).toBeUndefined();
  });
});

describe("payment helpers", () => {
  it("prunes payments for deleted meals and lists recent amounts", async () => {
    const { prunePayments, recentAmounts } = await import("./insights");
    const day: DayState = {
      date: "2026-09-29",
      entries: [e("a", 20, 400, "keep")],
      payments: [
        { id: "1", orderId: "keep", label: "", amount: 25, at: "2026-09-29T10:00:00Z" },
        { id: "2", orderId: "gone", label: "", amount: 30, at: "2026-09-29T11:00:00Z" },
      ],
    };
    expect(prunePayments(day).payments!.map((p) => p.orderId)).toEqual(["keep"]);
    expect(recentAmounts([day])).toEqual([30, 25]);
  });
});

describe("costs", () => {
  const nadaEntry = (id: string): DayEntry => ({ id, kind: "nada", label: "Nada", macros: { kcal: 278, protein: 30, fat: 0, carbs: 32 }, at: "" });
  const day1: DayState = {
    date: "2026-09-28",
    entries: [e("a", 25, 500, "o1"), nadaEntry("n1"), nadaEntry("n2")],
    payments: [{ id: "p", orderId: "o1", label: "", amount: 24.5, at: "", esaad: true }],
  };
  const day2: DayState = { date: "2026-09-29", entries: [nadaEntry("n3")] };

  it("prices each Nada bottle automatically and adds McDonald's payments", async () => {
    const { dayCost } = await import("./insights");
    expect(dayCost(day1, 6)).toEqual({ mcd: 24.5, nada: 12, nadaBottles: 2, total: 36.5 });
    expect(dayCost(day2, 6)).toEqual({ mcd: 0, nada: 6, nadaBottles: 1, total: 6 });
  });

  it("sums a range and averages per day with spending", async () => {
    const { costSummary } = await import("./insights");
    const s = costSummary([day1, day2], "2026-09-01", "2026-09-30", 6);
    expect(s).toEqual({ mcd: 24.5, nada: 18, nadaBottles: 3, total: 42.5, days: 2, perDay: 21.25 });
  });
});
