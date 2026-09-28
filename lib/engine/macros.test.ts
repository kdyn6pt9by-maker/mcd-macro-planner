import { describe, expect, it } from "vitest";
import { addMacros, kcalFromMacros, roundMacros, scaleMacros, subtractMacros, sumMacros } from "./macros";

describe("macros arithmetic", () => {
  it("computes calories from macros with 4/4/9 factors", () => {
    expect(kcalFromMacros(30, 50, 10)).toBe(30 * 4 + 50 * 4 + 10 * 9);
    expect(kcalFromMacros(0, 0, 0)).toBe(0);
  });

  it("sums a list of macros (usual meal + 2 Nada)", () => {
    const usual = { kcal: 329, protein: 17, fat: 3, carbs: 56 };
    const nada = { kcal: 278.4, protein: 30.4, fat: 0.16, carbs: 32 };
    const total = sumMacros([usual, nada, nada]);
    expect(total.kcal).toBeCloseTo(885.8);
    expect(total.protein).toBeCloseTo(77.8);
    expect(total.fat).toBeCloseTo(3.32);
    expect(total.carbs).toBeCloseTo(120);
  });

  it("adds macros component-wise", () => {
    expect(addMacros({ kcal: 100, protein: 5, fat: 2, carbs: 10 }, { kcal: 50, protein: 5, fat: 1, carbs: 5 })).toEqual({
      kcal: 150,
      protein: 10,
      fat: 3,
      carbs: 15,
    });
  });

  it("scales macros by quantity", () => {
    expect(scaleMacros({ kcal: 100, protein: 5, fat: 2, carbs: 10 }, 3)).toEqual({
      kcal: 300,
      protein: 15,
      fat: 6,
      carbs: 30,
    });
  });

  it("subtracts macros component-wise", () => {
    expect(subtractMacros({ kcal: 150, protein: 10, fat: 3, carbs: 15 }, { kcal: 50, protein: 5, fat: 1, carbs: 5 })).toEqual({
      kcal: 100,
      protein: 5,
      fat: 2,
      carbs: 10,
    });
  });

  it("rounds calories to whole numbers and macros to one decimal", () => {
    expect(roundMacros({ kcal: 123.456, protein: 12.34, fat: 5.678, carbs: 20.05 })).toEqual({
      kcal: 123,
      protein: 12.3,
      fat: 5.7,
      carbs: 20.1,
    });
  });
});
