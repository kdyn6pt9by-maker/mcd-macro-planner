import { describe, expect, it } from "vitest";
import { isBarcode, lookupBarcode, macrosForGrams, macrosForServings, parseOpenFoodFacts } from "./barcode";

const offResponse = {
  status: 1,
  product: {
    product_name: "Protein Bar Chocolate",
    brands: "FitBar, Other",
    serving_quantity: 60,
    product_quantity: 60,
    nutriments: {
      "energy-kcal_100g": 350,
      proteins_100g: 33.3,
      carbohydrates_100g: 40,
      fat_100g: 10,
      "energy-kcal_serving": 210,
      proteins_serving: 20,
      carbohydrates_serving: 24,
      fat_serving: 6,
    },
  },
};

describe("parseOpenFoodFacts", () => {
  it("reads name, brand, per-100g and per-serving macros", () => {
    const p = parseOpenFoodFacts("6291234567890", offResponse)!;
    expect(p.name).toBe("Protein Bar Chocolate");
    expect(p.brand).toBe("FitBar");
    expect(p.per100).toEqual({ kcal: 350, protein: 33.3, carbs: 40, fat: 10 });
    expect(p.perServing!.protein).toBe(20);
    expect(p.servingGrams).toBe(60);
  });

  it("prefers the Arabic name and converts kJ when kcal is missing", () => {
    const p = parseOpenFoodFacts("1", {
      status: 1,
      product: { product_name: "Laban", product_name_ar: "لبن", nutriments: { energy_100g: 418.4, proteins_100g: 3, fat_100g: 1 } },
    })!;
    expect(p.name).toBe("لبن");
    expect(p.per100!.kcal).toBeCloseTo(100);
    expect(p.per100!.carbs).toBe(0);
  });

  it("returns null when the product is unknown", () => {
    expect(parseOpenFoodFacts("1", { status: 0 })).toBeNull();
  });
});

describe("portions", () => {
  const p = parseOpenFoodFacts("x", offResponse)!;
  it("scales per 100 g", () => {
    expect(macrosForGrams(p, 30)!.protein).toBeCloseTo(9.99);
  });
  it("uses printed serving values", () => {
    expect(macrosForServings(p, 2)).toEqual({ kcal: 420, protein: 40, carbs: 48, fat: 12 });
  });
  it("falls back to per-serving when only that exists", () => {
    const onlyServing = { ...p, per100: null };
    expect(macrosForGrams(onlyServing, 30)!.protein).toBe(10);
  });
});

describe("lookupBarcode", () => {
  it("calls Open Food Facts and parses the result", async () => {
    let url = "";
    const fake = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify(offResponse), { status: 200 });
    }) as unknown as typeof fetch;
    const p = await lookupBarcode("6291234567890", fake);
    expect(url).toContain("world.openfoodfacts.org/api/v2/product/6291234567890.json");
    expect(p!.name).toBe("Protein Bar Chocolate");
  });

  it("returns null on 404", async () => {
    const fake = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    expect(await lookupBarcode("000", fake)).toBeNull();
  });
});

describe("isBarcode", () => {
  it("accepts EAN/UPC lengths only", () => {
    expect(isBarcode("6291234567890")).toBe(true);
    expect(isBarcode("1234567")).toBe(false);
    expect(isBarcode("abc12345678")).toBe(false);
  });
});
