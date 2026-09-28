import { DayMode, DayState, Settings } from "./types";
import { defaultSettings } from "./data/defaultSettings";

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
    // storage unavailable (private mode, quota, etc.) — ignore
  }
}

export function loadSettings(): Settings {
  return safeGet(SETTINGS_KEY, defaultSettings);
}

export function saveSettings(settings: Settings) {
  safeSet(SETTINGS_KEY, settings);
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyDay(mode: DayMode): DayState {
  return {
    date: todayKey(),
    mode,
    eaten: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    nadaCount: 0,
    usualMealAdded: false,
    log: [],
  };
}

export function loadDay(mode: DayMode): DayState {
  const stored = safeGet<DayState | null>(DAY_KEY, null);
  if (stored && stored.date === todayKey()) return stored;
  return emptyDay(mode);
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
