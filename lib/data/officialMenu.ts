import { FoodItem } from "../types";

/**
 * Official McDonald's UAE nutrition, read from the data feed behind mcdonalds.com/ae/en-ae product pages
 * (/dnaapp/itemDetails?country=AE) on 2026-10-02. Calories are McDonald's lab/supplier values — they are not
 * 4/4/9 from the rounded macros, so they won't add up exactly; keep them as published.
 * McNuggets 6 and 9 pieces aren't linked from the menu, but have their own entries in the same feed (items 200072, 200036).
 */
export const OFFICIAL_DATE = "2026-10-02";
const url = (slug: string) => `https://www.mcdonalds.com/ae/en-ae/product/${slug}.html`;

const item = (id: string, name: string, kcal: number, protein: number, fat: number, carbs: number, slug: string): FoodItem => ({
  id,
  name,
  category: "mcdonalds",
  macros: { kcal, protein, fat, carbs },
  source: url(slug),
  lastVerified: OFFICIAL_DATE,
  verified: true,
  enabled: true,
});

export const OFFICIAL_UAE_MENU: FoodItem[] = [
  item("big-mac", "Big Mac", 564, 23, 30, 46, "big-mac"),
  item("big-tasty", "Big Tasty", 793, 44, 43, 60, "big-tasty"),
  item("mcchicken", "McChicken", 428, 18, 18, 48, "mcchicken"),
  item("chicken-mac", "Chicken Mac", 558, 26, 26, 55, "chicken-mac"),
  item("cheeseburger", "Cheeseburger", 305, 13, 13, 32, "cheeseburger"),
  item("double-cheeseburger", "Double Cheeseburger", 450, 21, 24, 34, "double-cheese-burger"),
  item("mcnuggets-4", "Chicken McNuggets (4 pc)", 153, 10, 8, 10, "chicken-mcnuggets-4-pieces"),
  item("mcnuggets-6", "Chicken McNuggets (6 pc)", 229, 15, 12, 15, "chicken-mcnuggets-4-pieces"),
  item("mcnuggets-9", "Chicken McNuggets (9 pc)", 343, 23, 18, 22, "chicken-mcnuggets-4-pieces"),
  item("beef-burger", "Beef Burger", 254, 11, 9, 31, "beef-burger"),
  item("chickenburger", "Chickenburger", 286, 13, 10, 36, "chicken-burger"),
  item("quarter-pounder-cheese", "Quarter Pounder with Cheese", 536, 33, 27, 41, "quarter-pounder-with-cheese"),
  item("ice-cream-cone", "Ice Cream Cone", 148, 4, 4, 25, "ice-cream-cone"),
  // Added 2026-10-02
  item("chicken-tenders", "Chicken Tenders", 245, 19, 11, 17, "chicken-tenders"),
  item("egg-mcmuffin", "Egg McMuffin", 315, 20, 13, 30, "egg-mcmuffin"),
  item("big-breakfast", "Big Breakfast", 431, 29, 18, 28, "big-breakfast"),
  item("mcarabia-chicken", "McArabia Chicken", 562, 29, 25, 56, "mcarabia-chicken"),
  item("mccrispy", "McCrispy", 619, 28, 30, 58, "mccrispy"),
  item("small-fries", "Small Fries", 250, 3, 12, 33, "small-fries"),
];

const norm = (s: string) => s.toLowerCase().replace(/™/g, "").replace(/[^a-z0-9]/g, "");

const NUGGET_IDS = ["mcnuggets-4", "mcnuggets-6", "mcnuggets-9"];

/** Puts the 4/6/9 McNuggets on the exact official numbers (adding any that are missing); everything else untouched. */
export function applyOfficialNuggets(foods: FoodItem[]): FoodItem[] {
  const official = OFFICIAL_UAE_MENU.filter((f) => NUGGET_IDS.includes(f.id));
  const out = foods.map((f) => {
    const o = official.find((x) => x.id === f.id || norm(x.name) === norm(f.name));
    return o ? { ...f, macros: { ...o.macros }, source: o.source, lastVerified: OFFICIAL_DATE, verified: true } : f;
  });
  for (const o of official) if (!out.some((f) => f.id === o.id || norm(f.name) === norm(o.name))) out.push({ ...o });
  return out;
}

/**
 * Brings a saved menu onto the official numbers: known items get the official macros (and are marked verified),
 * a self-added item with the same name as an official one is updated in place instead of duplicated,
 * missing official items are added, wings are removed. Other self-added items are left alone.
 */
export function applyOfficialMenu(foods: FoodItem[]): FoodItem[] {
  const byId = new Map(OFFICIAL_UAE_MENU.map((f) => [f.id, f]));
  const byName = new Map(OFFICIAL_UAE_MENU.map((f) => [norm(f.name), f]));
  const used = new Set<string>();
  const out: FoodItem[] = [];
  for (const f of foods) {
    if (/wing/i.test(f.name)) continue;
    const official = byId.get(f.id) ?? byName.get(norm(f.name));
    if (official && !used.has(official.id)) {
      used.add(official.id);
      out.push({ ...f, macros: { ...official.macros }, source: official.source, lastVerified: OFFICIAL_DATE, verified: true });
    } else if (!official) out.push(f);
  }
  for (const f of OFFICIAL_UAE_MENU) if (!used.has(f.id)) out.push({ ...f });
  return out;
}
