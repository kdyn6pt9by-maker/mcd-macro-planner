export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface FoodItem {
  id: string;
  name: string;
  category: "mcdonalds" | "nada" | "usual";
  macros: Macros;
  serving?: string;
  source?: string;
  lastVerified?: string;
  /** false = value is a placeholder and MUST NOT be trusted by the optimizer until confirmed */
  verified: boolean;
  enabled: boolean;
}

export type DayMode = "workday" | "weekend";

export interface Targets {
  kcal: number;
  proteinMin: number;
  fatMin: number;
  fatMax: number;
  carbsRef: number;
}

export interface Settings {
  version: number;
  targets: Record<DayMode, Targets>;
  nada: Macros & { servingMl: number; maxPerDay: number; /** AED per bottle, counted automatically for every Nada logged. */ price: number };
  usualMeal: Macros & { label: string };
  foods: FoodItem[];
  savedMeals: SavedMeal[];
  language: Language;
  /** Maintain / cut / bulk on top of the targets above (which are your maintenance numbers). */
  goal: { mode: "maintain" | "cut" | "bulk"; pct: number };
}

export type Language = "en" | "ar";

export interface SavedMeal {
  id: string;
  name: string;
  macros: Macros;
}

/** Money paid for one McDonald's order (the entries sharing `orderId` as groupId). */
export interface Payment {
  id: string;
  orderId: string;
  label: string;
  amount: number;
  at: string;
  /** Paid with the Esaad card discount. */
  esaad?: boolean;
  /** Paid (fully or partly) with McDonald's reward points. */
  points?: boolean;
  /** How many reward points were redeemed for this order. */
  pointsUsed?: number;
}

export type EntryKind = "usual" | "nada" | "custom" | "mcdonalds";

export interface DayEntry {
  id: string;
  kind: EntryKind;
  label: string;
  macros: Macros;
  at: string;
  /** Entries added in one action (a McDonald's order, a recommendation) share a groupId so they can be deleted as one meal. */
  groupId?: string;
}

export interface DayState {
  date: string;
  entries: DayEntry[];
  payments?: Payment[];
}

export interface Combination {
  items: { food: FoodItem; qty: number }[];
  totals: Macros;
  afterEating: Macros;
  remainingKcal: number;
  labels: string[];
  score: number;
  hasUnverifiedItem: boolean;
}
