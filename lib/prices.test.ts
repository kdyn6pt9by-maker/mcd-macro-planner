import { describe, expect, it } from "vitest";
import { buildPriceBook, orderPrice } from "./prices";
import { DayState } from "./types";

const foods = [
  { id: "big-mac", name: "Big Mac" },
  { id: "mcchicken", name: "McChicken" },
  { id: "cheeseburger", name: "Cheeseburger" },
];
const m = { kcal: 1, protein: 0, fat: 0, carbs: 0 };
function order(date: string, gid: string, items: string[], amount: number, flags: { esaad?: boolean; points?: boolean } = { esaad: true }): DayState {
  return {
    date,
    entries: items.map((label, i) => ({ id: `${gid}${i}`, kind: "mcdonalds" as const, label, macros: m, at: "", groupId: gid })),
    payments: [{ id: "p" + gid, orderId: gid, label: "", amount, at: date, ...flags }],
  };
}

describe("price book", () => {
  it("learns unit prices from single-item and mixed orders, and keeps exact order prices", () => {
    const days = [
      order("2026-09-01", "a", ["Big Mac", "Big Mac"], 30), // Big Mac 15
      order("2026-09-02", "b", ["Big Mac", "McChicken"], 27), // McChicken 12
      order("2026-09-03", "c", ["McChicken", "Cheeseburger", "Cheeseburger"], 26), // Cheeseburger 7
      order("2026-09-04", "d", ["Cheeseburger"], 0, { points: true }), // points: ignored
    ];
    const book = buildPriceBook(days, foods);
    expect(book.item).toEqual({ "big-mac": 15, mcchicken: 12, cheeseburger: 7 });
    expect(orderPrice([{ id: "big-mac", qty: 1 }, { id: "mcchicken", qty: 1 }], 0, 6, book)).toEqual({ amount: 27, exact: true });
    expect(orderPrice([{ id: "cheeseburger", qty: 3 }], 2, 6, book)).toEqual({ amount: 33, exact: false });
    expect(orderPrice([{ id: "quarter", qty: 1 }], 0, 6, book)).toBeNull();
  });

  it("uses Esaad receipts when you've paid with Esaad", () => {
    const days = [order("2026-09-01", "a", ["Big Mac"], 20, {}), order("2026-09-02", "b", ["Big Mac"], 15, { esaad: true })];
    expect(buildPriceBook(days, foods).item["big-mac"]).toBe(15);
  });
});
