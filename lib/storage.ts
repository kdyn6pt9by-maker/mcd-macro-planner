import { DayMode, DayState, FoodItem, Macros, Settings } from "./types";
import { SETTINGS_VERSION, defaultSettings } from "./data/defaultSettings";
import { applyOfficialMenu, applyOfficialNuggets } from "./data/officialMenu";
import type { WeightEntry } from "./progress";

const SETTINGS_KEY = "mcd-planner:settings";
const DAY_KEY = "mcd-planner:day";
const MODE_KEY = "mcd-planner:mode";
const HISTORY_KEY = "mcd-planner:history";

const DAYS_KEY = "mcd-planner:days";
const WEIGHTS_KEY = "mcd-planner:weights";
const WEEKEND_SKIP_KEY = "mcd-planner:weekend-skipped";
const CELEBRATED_KEY = "mcd-planner:celebrated-streak";
const BACKUP_FORMAT = "mcd-macro-backup";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Never silently lose data: park the unreadable value before anything overwrites it.
    if (raw) {
      try {
        window.localStorage.setItem(`${key}:corrupt-${Date.now()}`, raw);
      } catch {}
    }
    return fallback;
  }
}

/** Ask the browser not to evict our storage under pressure (best effort; iOS home-screen apps are already exempt). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode, quota) — app still works for this session
  }
}

export function migrateSettings(stored: Partial<Settings> | null): Settings {
  if (!stored) return defaultSettings;
  const merged: Settings = {
    ...defaultSettings,
    ...stored,
    targets: { ...defaultSettings.targets, ...stored.targets },
    nada: { ...defaultSettings.nada, ...stored.nada },
    usualMeal: { ...defaultSettings.usualMeal, ...stored.usualMeal },
    foods: stored.foods?.length ? stored.foods : defaultSettings.foods,
    savedMeals: stored.savedMeals ?? [],
    language: stored.language ?? "en",
    goal: stored.goal ?? defaultSettings.goal,
    version: stored.version ?? 1,
  };
  if (merged.version < 2) {
    // v2 raised the daily Nada allowance from 3 to 4 bottles.
    merged.nada.maxPerDay = Math.max(merged.nada.maxPerDay, 4);
    // v1 installs opened before the nutrition data landed still hold zeroed items.
    if (merged.foods.every((f) => f.macros.kcal === 0)) merged.foods = defaultSettings.foods;
  }
  if (merged.version < 5) {
    // v5 added the Ice Cream Cone; keep the user's own edits to existing items.
    const have = new Set(merged.foods.map((f) => f.id));
    merged.foods = [...merged.foods, ...defaultSettings.foods.filter((f) => !have.has(f.id))];
  }
  if (merged.version < 6) {
    // v6: official McDonald's UAE numbers for every known item, new items added, wings removed.
    merged.foods = applyOfficialMenu(merged.foods);
  }
  if (merged.version < 7) {
    // v7: McNuggets 4 / 6 / 9 on the exact official numbers (4 pieces newly added).
    merged.foods = applyOfficialNuggets(merged.foods);
  }
  if (merged.version < 8) {
    // v8 added Small Fries — only adds what's missing.
    const have = new Set(merged.foods.map((f) => f.id));
    merged.foods = [...merged.foods, ...defaultSettings.foods.filter((f) => !have.has(f.id))];
  }
  merged.version = SETTINGS_VERSION;
  return merged;
}

export function loadSettings(): Settings {
  const stored = safeGet<Partial<Settings> | null>(SETTINGS_KEY, null);
  const settings = migrateSettings(stored);
  if (stored && (stored.version ?? 1) < SETTINGS_VERSION) {
    // Official menu updates also rewrite past days, matched by the name each item was logged under
    // (items whose numbers didn't change are left as they are).
    for (const before of stored.foods ?? []) {
      const after = settings.foods.find((f) => f.id === before.id) ?? settings.foods.find((f) => f.name === before.name);
      if (after && before.category === "mcdonalds") updateProductEverywhere({ kind: "mcdonalds", id: after.id, name: before.name }, after.macros);
    }
    saveSettings(settings);
  }
  return settings;
}

export function saveSettings(settings: Settings) {
  safeSet(SETTINGS_KEY, settings);
}

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function emptyDay(date = todayKey()): DayState {
  return { date, entries: [] };
}

/** Every logged day, keyed by local date. Days are kept forever unless you delete them. */
export function loadAllDays(): Record<string, DayState> {
  const days = safeGet<Record<string, DayState>>(DAYS_KEY, {});
  // One-time move of the pre-archive single-day slot, so the last logged day isn't lost.
  const legacy = safeGet<DayState | null>(DAY_KEY, null);
  if (legacy && Array.isArray(legacy.entries) && legacy.entries.length && !days[legacy.date]) {
    days[legacy.date] = legacy;
    safeSet(DAYS_KEY, days);
  }
  if (legacy && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(DAY_KEY);
    } catch {}
  }
  return days;
}

export function loadDay(date = todayKey()): DayState {
  const day = loadAllDays()[date];
  return day && Array.isArray(day.entries) ? day : emptyDay(date);
}

export function saveDay(day: DayState) {
  const days = loadAllDays();
  if (day.entries.length === 0) delete days[day.date];
  else days[day.date] = day;
  safeSet(DAYS_KEY, days);
}

export function deleteDay(date: string) {
  const days = loadAllDays();
  delete days[date];
  safeSet(DAYS_KEY, days);
}

/** Past days, newest first. */
export function listDays(): DayState[] {
  return Object.values(loadAllDays())
    .filter((d) => d.entries.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function loadMode(): DayMode {
  return safeGet<DayMode>(MODE_KEY, "workday");
}

export function saveMode(mode: DayMode) {
  safeSet(MODE_KEY, mode);
}

export interface HistoryEntry {
  key: string;
  label: string;
  count: number;
  lastUsed: string;
  /** Snapshot of what was in the order when it was chosen, so details survive later menu edits. */
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  macros: Macros;
}

export function loadHistory(): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(HISTORY_KEY, []);
}

export function recordCombinationUsed(key: string, label: string, items?: OrderItem[]) {
  const history = loadHistory();
  const existing = history.find((h) => h.key === key);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = new Date().toISOString();
    if (items) existing.items = items;
  } else {
    history.push({ key, label, count: 1, lastUsed: new Date().toISOString(), items });
  }
  safeSet(HISTORY_KEY, history);
}

export function deleteHistoryEntry(key: string) {
  safeSet(
    HISTORY_KEY,
    loadHistory().filter((h) => h.key !== key)
  );
}

/** Items in an order: the saved snapshot, or rebuilt from the key + current menu for older records. */
export function orderItems(entry: HistoryEntry, foods: FoodItem[], nada: Macros): OrderItem[] {
  if (entry.items?.length) return entry.items;
  return entry.key.split("|").flatMap((part) => {
    const m = /^(.+)x(\d+)$/.exec(part);
    if (!m) return [];
    const id = m[1];
    const food = id === "nada" ? { name: "Nada Protein Milk", macros: nada } : foods.find((f) => f.id === id);
    if (!food) return [];
    return [{ id, name: food.name, qty: Number(m[2]), macros: food.macros }];
  });
}

interface Backup {
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportBackup(): Backup {
  const data: Record<string, unknown> = {};
  for (const key of [SETTINGS_KEY, DAYS_KEY, MODE_KEY, HISTORY_KEY, WEIGHTS_KEY, WEEKEND_SKIP_KEY, CELEBRATED_KEY, "mcd-planner:barcodes", "mcd-planner:reserve"]) data[key] = safeGet<unknown>(key, null);
  return { format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), data };
}

export function importBackup(json: string): boolean {
  const parsed = JSON.parse(json) as Backup;
  if (parsed?.format !== BACKUP_FORMAT || typeof parsed.data !== "object") return false;
  for (const [key, value] of Object.entries(parsed.data)) {
    if (key.startsWith("mcd-planner:") && value !== null) safeSet(key, value);
  }
  return true;
}

export function clearHistory() {
  safeSet(HISTORY_KEY, []);
}

export function wasUsedBefore(key: string): boolean {
  return loadHistory().some((h) => h.key === key);
}

export function topFavorites(limit = 3): HistoryEntry[] {
  return [...loadHistory()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function historyFor(key: string): HistoryEntry | undefined {
  return loadHistory().find((h) => h.key === key);
}

/** How many of each item you've eaten across all chosen orders (keys look like "big-macx2|nadax1"). */
export function itemTotals(history: HistoryEntry[] = loadHistory()): { id: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const h of history) {
    for (const part of h.key.split("|")) {
      const m = /^(.+)x(\d+)$/.exec(part);
      if (!m) continue;
      totals.set(m[1], (totals.get(m[1]) ?? 0) + Number(m[2]) * h.count);
    }
  }
  return Array.from(totals, ([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}

export function loadWeights(): WeightEntry[] {
  return safeGet<WeightEntry[]>(WEIGHTS_KEY, []).sort((a, b) => a.date.localeCompare(b.date));
}

/** One weigh-in per date; logging again the same day replaces it. */
export function saveWeight(entry: WeightEntry) {
  safeSet(WEIGHTS_KEY, [...loadWeights().filter((w) => w.date !== entry.date), entry]);
}

export function deleteWeight(date: string) {
  safeSet(
    WEIGHTS_KEY,
    loadWeights().filter((w) => w.date !== date)
  );
}

export function loadWeekendSkips(): string[] {
  return safeGet<string[]>(WEEKEND_SKIP_KEY, []);
}

export function skipWeekendDays(dates: string[]) {
  // Keep the list short: only the last ~3 months matter.
  const keep = [...new Set([...loadWeekendSkips(), ...dates])].sort().slice(-30);
  safeSet(WEEKEND_SKIP_KEY, keep);
}

export function loadCelebratedStreak(): number {
  return safeGet<number>(CELEBRATED_KEY, 0);
}

export function saveCelebratedStreak(n: number) {
  safeSet(CELEBRATED_KEY, n);
}

/** After editing an order: one use moves from the old combination to the new one. */
export function moveHistoryUse(oldKey: string, newKey: string, newLabel: string, items: OrderItem[]) {
  if (oldKey === newKey) return;
  const history = loadHistory();
  const old = history.find((h) => h.key === oldKey);
  if (old) {
    old.count -= 1;
    safeSet(
      HISTORY_KEY,
      history.filter((h) => h.count > 0)
    );
  }
  recordCombinationUsed(newKey, newLabel, items);
}

const BARCODES_KEY = "mcd-planner:barcodes";

/** Products you've scanned (or typed in), so the next scan is instant and works offline. */
export function loadBarcodeCache(): Record<string, import("./barcode").ScannedProduct> {
  return safeGet(BARCODES_KEY, {});
}

export function saveBarcodeProduct(p: import("./barcode").ScannedProduct) {
  safeSet(BARCODES_KEY, { ...loadBarcodeCache(), [p.code]: p });
}

export type ProductRef = { kind: "mcdonalds"; id: string; name: string } | { kind: "nada" } | { kind: "usual" };

/**
 * Rewrites the macros of every logged entry of one product (all past days) and the order snapshots in history.
 * McDonald's entries are one per item, matched by name; Nada entries are one bottle; usual meal by kind.
 */
export function updateProductEverywhere(ref: ProductRef, macros: Macros): { entries: number; days: number } {
  const days = loadAllDays();
  let entries = 0;
  let touchedDays = 0;
  const same = (a: Macros, b: Macros) => a.kcal === b.kcal && a.protein === b.protein && a.fat === b.fat && a.carbs === b.carbs;
  for (const [date, day] of Object.entries(days)) {
    if (!Array.isArray(day.entries)) continue;
    let touched = false;
    day.entries = day.entries.map((e) => {
      const match = ref.kind === "mcdonalds" ? e.kind === "mcdonalds" && e.label === ref.name : e.kind === ref.kind;
      if (!match || same(e.macros, macros)) return e;
      entries++;
      touched = true;
      return { ...e, macros: { ...macros } };
    });
    if (touched) {
      touchedDays++;
      days[date] = day;
    }
  }
  if (touchedDays) safeSet(DAYS_KEY, days);

  if (ref.kind !== "usual") {
    const itemId = ref.kind === "nada" ? "nada" : ref.id;
    const history = loadHistory();
    let changed = false;
    for (const h of history)
      for (const it of h.items ?? [])
        if (it.id === itemId && !same(it.macros, macros)) {
          it.macros = { ...macros };
          changed = true;
        }
    if (changed) safeSet(HISTORY_KEY, history);
  }
  return { entries, days: touchedDays };
}
