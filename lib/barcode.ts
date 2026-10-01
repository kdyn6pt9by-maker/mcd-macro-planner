import { Macros } from "./types";

export interface ScannedProduct {
  code: string;
  name: string;
  brand?: string;
  image?: string;
  /** Macros per 100 g / 100 ml when known. */
  per100: Macros | null;
  /** Macros for one serving as printed on the pack, when known. */
  perServing: Macros | null;
  servingGrams: number | null;
  packageGrams: number | null;
  /** "off" = Open Food Facts, "user" = entered/edited by you on this phone. */
  source: "off" | "user";
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function macrosFrom(n: Record<string, unknown>, suffix: "_100g" | "_serving"): Macros | null {
  let kcal = num(n[`energy-kcal${suffix}`]);
  const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`]);
  if (kcal === null && kj !== null) kcal = kj / 4.184;
  const protein = num(n[`proteins${suffix}`]);
  const carbs = num(n[`carbohydrates${suffix}`]);
  const fat = num(n[`fat${suffix}`]);
  if (kcal === null && protein === null && carbs === null && fat === null) return null;
  const p = protein ?? 0;
  const c = carbs ?? 0;
  const f = fat ?? 0;
  return { kcal: kcal ?? p * 4 + c * 4 + f * 9, protein: p, carbs: c, fat: f };
}

/** Turns an Open Food Facts v2 product response into what the app needs; null if the product isn't there. */
export function parseOpenFoodFacts(code: string, json: unknown): ScannedProduct | null {
  const j = json as { status?: number; product?: Record<string, unknown> };
  if (!j || j.status !== 1 || !j.product) return null;
  const p = j.product;
  const nutr = (p.nutriments ?? {}) as Record<string, unknown>;
  const name = String(p.product_name_ar || p.product_name || p.product_name_en || p.generic_name || "").trim();
  return {
    code,
    name: name || `#${code}`,
    brand: typeof p.brands === "string" ? p.brands.split(",")[0].trim() : undefined,
    image: typeof p.image_front_small_url === "string" ? p.image_front_small_url : undefined,
    per100: macrosFrom(nutr, "_100g"),
    perServing: macrosFrom(nutr, "_serving"),
    servingGrams: num(p.serving_quantity),
    packageGrams: num(p.product_quantity),
    source: "off",
  };
}

const scale = (m: Macros, f: number): Macros => ({ kcal: m.kcal * f, protein: m.protein * f, carbs: m.carbs * f, fat: m.fat * f });

/** Macros for an amount in grams, preferring per-100 g data and falling back to per-serving data. */
export function macrosForGrams(p: ScannedProduct, grams: number): Macros | null {
  if (p.per100) return scale(p.per100, grams / 100);
  if (p.perServing && p.servingGrams) return scale(p.perServing, grams / p.servingGrams);
  return null;
}

/** Macros for N servings (uses the printed per-serving values when there is no gram weight). */
export function macrosForServings(p: ScannedProduct, servings: number): Macros | null {
  if (p.perServing) return scale(p.perServing, servings);
  if (p.per100 && p.servingGrams) return scale(p.per100, (p.servingGrams * servings) / 100);
  return null;
}

export const OFF_FIELDS =
  "product_name,product_name_ar,product_name_en,generic_name,brands,nutriments,serving_quantity,product_quantity,image_front_small_url";

/** Open Food Facts lookup (CORS-enabled, no key needed). */
export async function lookupBarcode(code: string, fetcher: typeof fetch = fetch): Promise<ScannedProduct | null> {
  const res = await fetcher(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
  return parseOpenFoodFacts(code, await res.json());
}

export const isBarcode = (s: string) => /^\d{8,14}$/.test(s.trim());
