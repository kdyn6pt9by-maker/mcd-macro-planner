import { FoodItem, Settings } from "../types";

/**
 * IMPORTANT — NUTRITION DATA STATUS
 * ----------------------------------
 * McDonald's UAE (mcdonalds.com/ae) could not be reached from this build
 * environment (network policy blocked the domain). Per the project spec,
 * NO nutrition values may be invented or substituted from another country's
 * menu. Every McDonald's item below therefore starts as `verified: false`
 * with zeroed macros and `enabled: false`, so the recommendation engine
 * ignores it until a human fills in official numbers.
 *
 * To activate an item:
 *  1. Open Settings → Nutrition Database in the app, or
 *  2. Edit the `macros` values below directly and flip `verified: true`.
 * Always record `source` and `lastVerified` when you do.
 */
const unverified = (id: string, name: string): FoodItem => ({
  id,
  name,
  category: "mcdonalds",
  macros: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  serving: undefined,
  source: "NOT YET VERIFIED — enter official mcdonalds.com/ae values",
  lastVerified: undefined,
  verified: false,
  enabled: false,
});

export const defaultMcDonaldsFoods: FoodItem[] = [
  unverified("big-mac", "Big Mac"),
  unverified("big-tasty", "Big Tasty"),
  unverified("mcchicken", "McChicken"),
  unverified("chicken-mac", "Chicken Mac"),
  unverified("cheeseburger", "Cheeseburger"),
  unverified("double-cheeseburger", "Double Cheeseburger"),
  unverified("mcnuggets-6", "Chicken McNuggets (6 pc)"),
  unverified("mcnuggets-9", "Chicken McNuggets (9 pc)"),
  unverified("beef-burger", "Beef Burger"),
  unverified("chickenburger", "Chickenburger"),
  unverified("quarter-pounder-cheese", "Quarter Pounder with Cheese"),
];

export const defaultSettings: Settings = {
  targets: {
    workday: { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 },
    weekend: { kcal: 2000, proteinMin: 140, fatMin: 50, fatMax: 60, carbsRef: 225 },
  },
  nada: {
    kcal: 278.4,
    protein: 30.4,
    fat: 0.16,
    carbs: 32,
    servingMl: 320,
    maxPerDay: 3,
  },
  usualMeal: {
    label: "Rice Krispies 50g + Marmum Protein Milk 150ml",
    kcal: 329,
    protein: 17,
    fat: 3,
    carbs: 56,
  },
  foods: defaultMcDonaldsFoods,
};
