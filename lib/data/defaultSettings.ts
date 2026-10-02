import { FoodItem, Settings } from "../types";

import { OFFICIAL_UAE_MENU } from "./officialMenu";

/** Official McDonald's UAE values — see ./officialMenu.ts for where they come from. */
export const defaultMcDonaldsFoods: FoodItem[] = OFFICIAL_UAE_MENU;

export const SETTINGS_VERSION = 8;

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
    price: 6,
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
  goal: { mode: "maintain", pct: 20 },
};
