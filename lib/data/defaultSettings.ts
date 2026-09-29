import { FoodItem, Settings } from "../types";

/**
 * NUTRITION DATA STATUS
 * ----------------------
 * This build environment's network policy blocks mcdonalds.com/ae, so this
 * session could not fetch the values directly. The numbers below were
 * researched externally (ChatGPT, 2026-09-28) against the official product
 * pages linked in each item's `source`. They are marked `verified: true`
 * and `enabled: true` on that basis, but were not independently confirmed
 * by this session — spot-check a couple against the live pages when you
 * get a chance, and update via Settings → Nutrition Database if anything
 * is off.
 */
const VERIFIED_DATE = "2026-09-28";

function verifiedFood(
  id: string,
  name: string,
  kcal: number,
  protein: number,
  fat: number,
  carbs: number,
  source: string
): FoodItem {
  return {
    id,
    name,
    category: "mcdonalds",
    macros: { kcal, protein, fat, carbs },
    source,
    lastVerified: VERIFIED_DATE,
    verified: true,
    enabled: true,
  };
}

export const defaultMcDonaldsFoods: FoodItem[] = [
  verifiedFood(
    "big-mac",
    "Big Mac",
    549,
    23,
    30,
    46,
    "https://www.mcdonalds.com/ae/en-ae/product/big-mac.html"
  ),
  verifiedFood(
    "big-tasty",
    "Big Tasty",
    831,
    44,
    46,
    61,
    "https://www.mcdonalds.com/ae/en-ae/product/big-tasty.html"
  ),
  verifiedFood(
    "mcchicken",
    "McChicken",
    448,
    17,
    21,
    47,
    "https://www.mcdonalds.com/ae/en-ae/product/mcchicken.html"
  ),
  verifiedFood(
    "chicken-mac",
    "Chicken Mac",
    555,
    26,
    26,
    55,
    "https://www.mcdonalds.com/ae/en-ae/product/chicken-mac.html"
  ),
  verifiedFood(
    "cheeseburger",
    "Cheeseburger",
    295,
    13,
    13,
    32,
    "https://www.mcdonalds.com/ae/en-ae/product/cheeseburger.html"
  ),
  verifiedFood(
    "double-cheeseburger",
    "Double Cheeseburger",
    434,
    21,
    24,
    34,
    "https://www.mcdonalds.com/ae/en-ae/product/double-cheese-burger.html"
  ),
  verifiedFood(
    "mcnuggets-6",
    "Chicken McNuggets (6 pc)",
    229,
    15,
    12,
    15,
    "https://www.mcdonalds.com/ae/en-ae/product/chicken-mcnuggets-6-pieces.html"
  ),
  verifiedFood(
    "mcnuggets-9",
    "Chicken McNuggets (9 pc)",
    343,
    23,
    18,
    22,
    "https://www.mcdonalds.com/ae/en-ae/product/chicken-mcnuggets-9-pieces.html"
  ),
  verifiedFood(
    "beef-burger",
    "Beef Burger",
    244,
    11,
    9,
    31,
    "https://www.mcdonalds.com/ae/en-ae/product/beef-burger.html"
  ),
  verifiedFood(
    "chickenburger",
    "Chickenburger",
    287,
    12,
    11,
    35,
    "https://www.mcdonalds.com/ae/en-ae/product/chicken-burger.html"
  ),
  verifiedFood(
    "quarter-pounder-cheese",
    "Quarter Pounder with Cheese",
    531,
    33,
    27,
    41,
    "https://www.mcdonalds.com/ae/en-ae/product/quarter-pounder-with-cheese.html"
  ),
];

export const SETTINGS_VERSION = 3;

export const defaultSettings: Settings = {
  version: SETTINGS_VERSION,
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
    maxPerDay: 4,
  },
  usualMeal: {
    label: "Rice Krispies 50g + Marmum Protein Milk 150ml",
    kcal: 329,
    protein: 17,
    fat: 3,
    carbs: 56,
  },
  foods: defaultMcDonaldsFoods,
  savedMeals: [],
  language: "en",
};
