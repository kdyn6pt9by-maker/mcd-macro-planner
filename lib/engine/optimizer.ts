import { Combination, FoodItem, Macros, Targets } from "../types";
import { ZERO_MACROS, addMacros, roundMacros, scaleMacros } from "./macros";

const MAX_ITEMS_PER_COMBO = 5;
const MAX_RESULTS = 5;

interface SearchOptions {
  eaten: Macros;
  targets: Targets;
  foods: FoodItem[];
  /** A synthetic FoodItem representing one Nada bottle, or null if no allowance left. */
  nadaItem: FoodItem | null;
  nadaBottlesRemaining: number;
}

interface CandidateLine {
  food: FoodItem;
  qty: number;
}

function comboKey(items: CandidateLine[]): string {
  return items
    .filter((i) => i.qty > 0)
    .map((i) => `${i.food.id}x${i.qty}`)
    .sort()
    .join("|");
}

function comboLabel(items: CandidateLine[]): string {
  return items
    .filter((i) => i.qty > 0)
    .map((i) => `${i.qty} × ${i.food.name}`)
    .join(" + ");
}

function comboTotals(items: CandidateLine[]): Macros {
  return items.reduce(
    (sum, i) => addMacros(sum, scaleMacros(i.food.macros, i.qty)),
    ZERO_MACROS
  );
}

/**
 * Deterministic score — lower is better. Priority order encoded via
 * heavily weighted penalty tiers so an earlier priority always dominates
 * a later one, per spec:
 *   1. calories closest to remaining without exceeding
 *   2. protein target reached
 *   3. fat lands in 50-60g ideal band
 *   4. fat never exceeds hard max (candidates violating this are dropped earlier)
 *   5. carbs flexible (tiny tiebreaker only)
 *   6. prefer simpler orders (fewer items) on near-ties
 */
function scoreCombination(
  totals: Macros,
  afterEating: Macros,
  targets: Targets,
  remainingKcal: number,
  itemCount: number
): number {
  const kcalOver = Math.max(0, totals.kcal - remainingKcal);
  const kcalGap = Math.abs(remainingKcal - totals.kcal);
  const proteinShortfall = Math.max(0, targets.proteinMin - afterEating.protein);
  const fatBandPenalty =
    afterEating.fat < targets.fatMin
      ? targets.fatMin - afterEating.fat
      : afterEating.fat > targets.fatMax
        ? (afterEating.fat - targets.fatMax) * 5 // should already be filtered out, extra safety
        : 0;

  return (
    kcalOver * 1000 +
    proteinShortfall * 100 +
    kcalGap * 5 +
    fatBandPenalty * 10 +
    itemCount * 0.5
  );
}

function* generateMultisets(
  pool: FoodItem[],
  maxItems: number
): Generator<CandidateLine[]> {
  function* recurse(startIdx: number, remainingSlots: number, current: CandidateLine[]): Generator<CandidateLine[]> {
    if (current.some((c) => c.qty > 0)) yield current;
    if (remainingSlots === 0) return;
    for (let i = startIdx; i < pool.length; i++) {
      const existing = current.find((c) => c.food.id === pool[i].id);
      const next = existing
        ? current.map((c) => (c.food.id === pool[i].id ? { ...c, qty: c.qty + 1 } : c))
        : [...current, { food: pool[i], qty: 1 }];
      yield* recurse(i, remainingSlots - 1, next);
    }
  }
  yield* recurse(0, maxItems, []);
}

export function findRecommendations(opts: SearchOptions): Combination[] {
  const { eaten, targets, foods, nadaItem, nadaBottlesRemaining } = opts;
  const verifiedFoods = foods.filter((f) => f.enabled && f.verified);
  const pool = nadaItem && nadaBottlesRemaining > 0 ? [...verifiedFoods, nadaItem] : verifiedFoods;

  if (pool.length === 0) return [];

  const remainingKcal = Math.max(0, targets.kcal - eaten.kcal);
  const seen = new Set<string>();
  const candidates: Combination[] = [];

  for (const items of generateMultisets(pool, MAX_ITEMS_PER_COMBO)) {
    const key = comboKey(items);
    if (seen.has(key)) continue;
    seen.add(key);

    const nadaLine = items.find((i) => i.food.id === nadaItem?.id);
    if (nadaLine && nadaLine.qty > nadaBottlesRemaining) continue;

    const totals = comboTotals(items);
    const afterEating = addMacros(eaten, totals);

    // Hard rule: never intentionally recommend over the fat ceiling.
    if (afterEating.fat > targets.fatMax) continue;
    // Don't bother with combos that blow calories way past target.
    if (totals.kcal > remainingKcal + 150) continue;

    const itemCount = items.reduce((n, i) => n + i.qty, 0);
    const score = scoreCombination(totals, afterEating, targets, remainingKcal, itemCount);
    const hasUnverifiedItem = items.some((i) => !i.food.verified);

    candidates.push({
      items,
      totals: roundMacros(totals),
      afterEating: roundMacros(afterEating),
      remainingKcal: Math.round(remainingKcal - totals.kcal),
      labels: [],
      score,
      hasUnverifiedItem,
    });
  }

  candidates.sort((a, b) => a.score - b.score);

  const top = candidates.slice(0, Math.min(MAX_RESULTS * 4, candidates.length));
  return labelCombinations(top).slice(0, MAX_RESULTS);
}

function labelCombinations(sorted: Combination[]): Combination[] {
  if (sorted.length === 0) return sorted;
  const result = sorted.map((c) => ({ ...c, labels: [] as string[] }));

  result[0].labels.push("BEST MATCH");

  const byProtein = [...result].sort((a, b) => b.afterEating.protein - a.afterEating.protein)[0];
  if (byProtein !== result[0]) byProtein.labels.push("MORE PROTEIN");

  const byLowCal = [...result].sort((a, b) => a.totals.kcal - b.totals.kcal)[0];
  if (byLowCal !== result[0] && !byLowCal.labels.length) byLowCal.labels.push("LOWER CALORIES");

  const byHighFat = [...result].sort((a, b) => b.afterEating.fat - a.afterEating.fat)[0];
  if (byHighFat !== result[0] && !byHighFat.labels.length) byHighFat.labels.push("HIGHER FAT");

  const byFewItems = [...result].sort(
    (a, b) =>
      a.items.reduce((n, i) => n + i.qty, 0) - b.items.reduce((n, i) => n + i.qty, 0)
  )[0];
  if (byFewItems !== result[0] && !byFewItems.labels.length) byFewItems.labels.push("FEWER SANDWICHES");

  return result;
}

export function combinationLabel(c: Combination): string {
  return comboLabel(c.items);
}

export function combinationKey(c: Combination): string {
  return comboKey(c.items);
}
