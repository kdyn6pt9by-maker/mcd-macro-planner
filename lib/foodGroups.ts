import { FoodItem } from "./types";

/** Breakfast-menu items — only recommended when you ask for breakfast. */
export const isBreakfast = (f: FoodItem) => /breakfast|mcmuffin|hotcake|hash ?brown|\begg\b/i.test(f.id + " " + f.name);
