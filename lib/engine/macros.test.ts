import { describe, expect, it } from "vitest";
import { addMacros, roundMacros, scaleMacros, subtractMacros } from "./macros";

describe("macros arithmetic", () => {
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
