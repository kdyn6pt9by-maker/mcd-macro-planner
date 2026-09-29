import { describe, expect, it } from "vitest";
import { foodEmoji } from "./foodEmoji";

describe("foodEmoji", () => {
  it("uses a chicken piece for nuggets and a burger for sandwiches", () => {
    expect(foodEmoji("mcnuggets-6")).toBe("🍗");
    expect(foodEmoji("Chicken McNuggets (9 pc)")).toBe("🍗");
    expect(foodEmoji("big-mac")).toBe("🍔");
    expect(foodEmoji("McChicken")).toBe("🍔");
    expect(foodEmoji("Chickenburger")).toBe("🍔");
    expect(foodEmoji("nada")).toBe("🥛");
  });
});
