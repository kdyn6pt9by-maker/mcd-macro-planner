import { describe, expect, it } from "vitest";
import { FoodItem, Targets } from "../types";
import { findRecommendations, sandwichSignature } from "./optimizer";

const targets: Targets = { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 };

function food(id: string, name: string, kcal: number, protein: number, fat: number, carbs: number): FoodItem {
  return {
    id,
    name,
    category: "mcdonalds",
    macros: { kcal, protein, fat, carbs },
    verified: true,
    enabled: true,
  };
}

const testFoods: FoodItem[] = [
  food("beef-burger", "Beef Burger", 250, 13, 9, 30),
  food("chickenburger", "Chickenburger", 275, 12, 11, 37),
  food("big-mac", "Big Mac", 540, 25, 29, 45),
  food("quarter-pounder-cheese", "Quarter Pounder with Cheese", 530, 30, 27, 41),
  food("cheeseburger", "Cheeseburger", 305, 16, 13, 32),
];

const nadaItem: FoodItem = {
  id: "nada",
  name: "Nada Protein Milk",
  category: "nada",
  macros: { kcal: 278.4, protein: 30.4, fat: 0.16, carbs: 32 },
  verified: true,
  enabled: true,
};

describe("findRecommendations", () => {
  it("returns no more than the requested number of combinations", () => {
    const opts = {
      eaten: { kcal: 329, protein: 17, fat: 3, carbs: 56 },
      targets,
      foods: testFoods,
      nadaItem,
      nadaBottlesRemaining: 3,
    };
    expect(findRecommendations(opts).length).toBeLessThanOrEqual(10);
    expect(findRecommendations({ ...opts, maxResults: 3 }).length).toBeLessThanOrEqual(3);
  });

  it("never repeats the same sandwich mix twice (variety)", () => {
    const results = findRecommendations({
      eaten: { kcal: 329, protein: 17, fat: 3, carbs: 56 },
      targets,
      foods: testFoods,
      nadaItem,
      nadaBottlesRemaining: 4,
    });
    const sigs = results.map(sandwichSignature);
    expect(new Set(sigs).size).toBe(sigs.length);
    expect(results.length).toBeGreaterThan(3);
  });

  it("never recommends a combination that pushes fat past the hard max", () => {
    const results = findRecommendations({
      eaten: { kcal: 300, protein: 10, fat: 5, carbs: 30 },
      targets,
      foods: testFoods,
      nadaItem,
      nadaBottlesRemaining: 3,
    });
    for (const combo of results) {
      expect(combo.afterEating.fat).toBeLessThanOrEqual(targets.fatMax);
    }
  });

  it("labels the top-ranked result BEST MATCH", () => {
    const results = findRecommendations({
      eaten: { kcal: 329, protein: 17, fat: 3, carbs: 56 },
      targets,
      foods: testFoods,
      nadaItem,
      nadaBottlesRemaining: 3,
    });
    expect(results[0].labels).toContain("BEST MATCH");
  });

  it("respects the Nada daily bottle cap", () => {
    const results = findRecommendations({
      eaten: { kcal: 300, protein: 10, fat: 5, carbs: 20 },
      targets,
      foods: [],
      nadaItem,
      nadaBottlesRemaining: 1,
    });
    for (const combo of results) {
      const nadaQty = combo.items.find((i) => i.food.id === "nada")?.qty ?? 0;
      expect(nadaQty).toBeLessThanOrEqual(1);
    }
  });

  it("returns an empty list when no verified foods are enabled", () => {
    const unverified: FoodItem = { ...testFoods[0], verified: false };
    const results = findRecommendations({
      eaten: { kcal: 300, protein: 10, fat: 5, carbs: 20 },
      targets,
      foods: [unverified],
      nadaItem: null,
      nadaBottlesRemaining: 0,
    });
    expect(results).toEqual([]);
  });

  it("prioritizes reaching the protein target over calorie minimalism", () => {
    const results = findRecommendations({
      eaten: { kcal: 300, protein: 10, fat: 5, carbs: 20 },
      targets,
      foods: testFoods,
      nadaItem,
      nadaBottlesRemaining: 3,
    });
    expect(results[0].afterEating.protein).toBeGreaterThanOrEqual(targets.proteinMin - 20);
  });
});

describe("show more", () => {
  it("returns more distinct options on request, capped, never more than +50 kcal over", async () => {
    const { MAX_RECOMMENDATIONS, KCAL_OVER_ALLOWANCE } = await import("./optimizer");
    const { defaultSettings } = await import("../data/defaultSettings");
    const targets = { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 };
    const eaten = { kcal: 900, protein: 70, fat: 20, carbs: 100 };
    const base = { eaten, targets, foods: defaultSettings.foods, nadaItem: null, nadaBottlesRemaining: 0 };
    const page = findRecommendations(base);
    const many = findRecommendations({ ...base, maxResults: 999 });
    expect(many.length).toBeGreaterThan(page.length);
    expect(many.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
    expect(new Set(many.map(sandwichSignature)).size).toBe(many.length);
    expect(many.every((c) => c.remainingKcal >= -KCAL_OVER_ALLOWANCE)).toBe(true);
  });
});
