import { Combination, FoodItem, Macros, Targets } from "../types";
import { ZERO_MACROS, addMacros, roundMacros, scaleMacros } from "./macros";

const MAX_ITEMS_PER_COMBO = 5;
const MAX_RESULTS = 10;
const MAX_PER_MAIN_ITEM = 2;
/** ~600 kcal of calorie-gap penalty; keeps variety from dragging in poor fits. */
const DIVERSITY_SCORE_WINDOW = 3000;

interface SearchOptions {
  eaten: Macros;
  targets: Targets;
  foods: FoodItem[];
  /** A synthetic FoodItem representing one Nada bottle, or null if no allowance left. */
  nadaItem: FoodItem | null;
  nadaBottlesRemaining: number;
  maxResults?: number;
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
  return labelCombinations(pickDiverse(candidates, opts.maxResults ?? MAX_RESULTS));
}

/** Which McDonald's items (ignoring quantity and Nada) make up the order. */
export function sandwichSignature(c: Combination): string {
  return c.items
    .filter((i) => i.food.category !== "nada")
    .map((i) => i.food.id)
    .sort()
    .join("|");
}

function mainItem(c: Combination): string {
  const mcd = c.items.filter((i) => i.food.category !== "nada");
  if (mcd.length === 0) return "nada-only";
  return mcd.reduce((a, b) => (b.food.macros.kcal * b.qty > a.food.macros.kcal * a.qty ? b : a)).food.id;
}

/**
 * The raw ranking tends to return near-identical orders (same sandwiches,
 * one Nada more or less). Greedily keep the best order for each distinct
 * sandwich mix, and cap how often one sandwich can headline, so the list
 * shows genuinely different choices. Falls back to plain ranking to fill.
 */
function pickDiverse(sorted: Combination[], limit: number): Combination[] {
  if (sorted.length === 0) return [];
  const ceiling = sorted[0].score + DIVERSITY_SCORE_WINDOW;
  const pool = sorted.filter((c) => c.score <= ceiling);
  const chosen: Combination[] = [];
  const signatures = new Set<string>();
  const mainCounts = new Map<string, number>();

  for (const c of pool) {
    if (chosen.length >= limit) break;
    const sig = sandwichSignature(c);
    const main = mainItem(c);
    if (signatures.has(sig) || (mainCounts.get(main) ?? 0) >= MAX_PER_MAIN_ITEM) continue;
    chosen.push(c);
    signatures.add(sig);
    mainCounts.set(main, (mainCounts.get(main) ?? 0) + 1);
  }
  for (const c of pool) {
    if (chosen.length >= limit) break;
    if (!chosen.includes(c) && !signatures.has(sandwichSignature(c))) {
      chosen.push(c);
      signatures.add(sandwichSignature(c));
    }
  }
  return chosen;
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
