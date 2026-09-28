import { DayMode, DayState, Settings } from "./types";
import { SETTINGS_VERSION, defaultSettings } from "./data/defaultSettings";

const SETTINGS_KEY = "mcd-planner:settings";
const DAY_KEY = "mcd-planner:day";
const MODE_KEY = "mcd-planner:mode";
const HISTORY_KEY = "mcd-planner:history";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
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
    version: stored.version ?? 1,
  };
  if (merged.version < 2) {
    // v2 raised the daily Nada allowance from 3 to 4 bottles.
    merged.nada.maxPerDay = Math.max(merged.nada.maxPerDay, 4);
    // v1 installs opened before the nutrition data landed still hold zeroed items.
    if (merged.foods.every((f) => f.macros.kcal === 0)) merged.foods = defaultSettings.foods;
  }
  merged.version = SETTINGS_VERSION;
  return merged;
}

export function loadSettings(): Settings {
  return migrateSettings(safeGet<Partial<Settings> | null>(SETTINGS_KEY, null));
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

export function emptyDay(): DayState {
  return { date: todayKey(), entries: [] };
}

export function loadDay(): DayState {
  const stored = safeGet<DayState | null>(DAY_KEY, null);
  if (stored && stored.date === todayKey() && Array.isArray(stored.entries)) return stored;
  return emptyDay();
}

export function saveDay(day: DayState) {
  safeSet(DAY_KEY, day);
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
}

export function loadHistory(): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(HISTORY_KEY, []);
}

export function recordCombinationUsed(key: string, label: string) {
  const history = loadHistory();
  const existing = history.find((h) => h.key === key);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = new Date().toISOString();
  } else {
    history.push({ key, label, count: 1, lastUsed: new Date().toISOString() });
  }
  safeSet(HISTORY_KEY, history);
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
