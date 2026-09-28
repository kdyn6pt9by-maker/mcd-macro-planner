import { describe, expect, it } from "vitest";
import { Targets } from "../types";
import { remainingMacros, smartAdvice } from "./advice";

const targets: Targets = { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 };

describe("remainingMacros", () => {
  it("never returns negative values", () => {
    const remaining = remainingMacros({ kcal: 2500, protein: 200, fat: 80, carbs: 300 }, targets);
    expect(remaining).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });

  it("computes remaining calories/protein/fat/carbs", () => {
    const remaining = remainingMacros({ kcal: 1164, protein: 108, fat: 4, carbs: 152 }, targets);
    expect(remaining).toEqual({ kcal: 836, protein: 32, fat: 56, carbs: 73 });
  });
});

describe("smartAdvice", () => {
  it("flags fat overage first", () => {
    const msg = smartAdvice({ kcal: 1800, protein: 150, fat: 65, carbs: 200 }, targets, true);
    expect(msg).toMatch(/over your fat limit/i);
  });

  it("celebrates protein completion when calories remain", () => {
    const msg = smartAdvice({ kcal: 1600, protein: 145, fat: 40, carbs: 180 }, targets, true);
    expect(msg).toMatch(/protein is already covered/i);
  });

  it("tells the user to finish manually when nothing fits", () => {
    const msg = smartAdvice({ kcal: 300, protein: 10, fat: 5, carbs: 20 }, targets, false);
    expect(msg).toMatch(/finish the remaining calories yourself/i);
  });

  it("suggests a Nada bottle when protein shortfall is small", () => {
    const msg = smartAdvice({ kcal: 1000, protein: 128, fat: 20, carbs: 100 }, targets, true);
    expect(msg).toMatch(/nada/i);
  });
});
