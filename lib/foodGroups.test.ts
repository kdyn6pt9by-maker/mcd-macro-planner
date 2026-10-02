import { describe, expect, it } from "vitest";
import { defaultSettings } from "./data/defaultSettings";
import { isBreakfast } from "./foodGroups";

describe("isBreakfast", () => {
  it("picks only the breakfast items", () => {
    expect(defaultSettings.foods.filter(isBreakfast).map((f) => f.id)).toEqual(["egg-mcmuffin", "big-breakfast"]);
    expect(isBreakfast({ ...defaultSettings.foods[0], id: "custom-x", name: "Veggie Burger" })).toBe(false);
  });
});
