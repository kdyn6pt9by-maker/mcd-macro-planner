import { beforeEach, describe, expect, it, vi } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: createMemoryStorage() });
});

describe("settings migration", () => {
  it("raises a v1 Nada cap of 3 to 4", async () => {
    const { migrateSettings } = await import("./storage");
    const { defaultSettings } = await import("./data/defaultSettings");
    const v1 = { ...defaultSettings, version: undefined, nada: { ...defaultSettings.nada, maxPerDay: 3 } };
    const migrated = migrateSettings(v1 as never);
    expect(migrated.nada.maxPerDay).toBe(4);
    expect(migrated.version).toBe(3);
    expect(migrated.savedMeals).toEqual([]);
    expect(migrated.language).toBe("en");
  });

  it("keeps a user's custom targets through migration", async () => {
    const { migrateSettings } = await import("./storage");
    const { defaultSettings } = await import("./data/defaultSettings");
    const custom = {
      ...defaultSettings,
      version: 1,
      targets: { ...defaultSettings.targets, weekend: { ...defaultSettings.targets.weekend, kcal: 2400 } },
    };
    expect(migrateSettings(custom).targets.weekend.kcal).toBe(2400);
  });
});

const entry = (id: string, kcal: number) => ({
  id,
  kind: "custom" as const,
  label: id,
  macros: { kcal, protein: 0, fat: 0, carbs: 0 },
  at: "2026-09-01T10:00:00Z",
});

describe("day archive", () => {
  it("keeps previous days when a new day is saved", async () => {
    const { saveDay, loadDay, listDays } = await import("./storage");
    saveDay({ date: "2026-09-01", entries: [entry("a", 100)] });
    saveDay({ date: "2026-09-02", entries: [entry("b", 200)] });
    expect(loadDay("2026-09-01").entries[0].id).toBe("a");
    expect(listDays().map((d) => d.date)).toEqual(["2026-09-02", "2026-09-01"]);
  });

  it("deletes a single day without touching others", async () => {
    const { saveDay, deleteDay, listDays } = await import("./storage");
    saveDay({ date: "2026-09-01", entries: [entry("a", 100)] });
    saveDay({ date: "2026-09-02", entries: [entry("b", 200)] });
    deleteDay("2026-09-01");
    expect(listDays().map((d) => d.date)).toEqual(["2026-09-02"]);
  });

  it("migrates the old single-day slot into the archive", async () => {
    const { loadDay } = await import("./storage");
    window.localStorage.setItem("mcd-planner:day", JSON.stringify({ date: "2026-08-30", entries: [entry("old", 50)] }));
    expect(loadDay("2026-08-30").entries[0].id).toBe("old");
    expect(window.localStorage.getItem("mcd-planner:day")).toBeNull();
  });

  it("parks unreadable data instead of losing it", async () => {
    const { listDays } = await import("./storage");
    window.localStorage.setItem("mcd-planner:days", "{broken");
    expect(listDays()).toEqual([]);
    const keys = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i));
    expect(keys.some((k) => k?.startsWith("mcd-planner:days:corrupt-"))).toBe(true);
  });
});

describe("backup", () => {
  it("round-trips days and history through export/import", async () => {
    const { saveDay, recordCombinationUsed, exportBackup, importBackup, listDays, loadHistory } = await import("./storage");
    saveDay({ date: "2026-09-01", entries: [entry("a", 100)] });
    recordCombinationUsed("big-macx1", "1 × Big Mac");
    const json = JSON.stringify(exportBackup());
    window.localStorage.clear();
    expect(listDays()).toEqual([]);
    expect(importBackup(json)).toBe(true);
    expect(listDays()).toHaveLength(1);
    expect(loadHistory()[0].key).toBe("big-macx1");
  });

  it("rejects files that are not backups", async () => {
    const { importBackup } = await import("./storage");
    expect(importBackup(JSON.stringify({ hello: 1 }))).toBe(false);
  });
});

describe("order details", () => {
  it("rebuilds items for old records from the menu, and deletes records", async () => {
    const { recordCombinationUsed, loadHistory, orderItems, deleteHistoryEntry } = await import("./storage");
    const { defaultSettings } = await import("./data/defaultSettings");
    recordCombinationUsed("big-macx2|nadax1", "2 × Big Mac + 1 × Nada");
    const items = orderItems(loadHistory()[0], defaultSettings.foods, defaultSettings.nada);
    expect(items.map((i) => [i.id, i.qty, i.macros.kcal])).toEqual([
      ["big-mac", 2, 549],
      ["nada", 1, 278.4],
    ]);
    deleteHistoryEntry("big-macx2|nadax1");
    expect(loadHistory()).toEqual([]);
  });
});

describe("history / favorites logic", () => {
  it("totals individual items across chosen orders", async () => {
    const { recordCombinationUsed, itemTotals } = await import("./storage");
    recordCombinationUsed("big-macx2|nadax1", "2 × Big Mac + 1 × Nada");
    recordCombinationUsed("big-macx2|nadax1", "2 × Big Mac + 1 × Nada");
    recordCombinationUsed("big-macx1|mcchickenx1", "1 × Big Mac + 1 × McChicken");
    expect(itemTotals()).toEqual([
      { id: "big-mac", count: 5 },
      { id: "nada", count: 2 },
      { id: "mcchicken", count: 1 },
    ]);
  });

  it("ranks favorites by use count", async () => {
    const { recordCombinationUsed, topFavorites } = await import("./storage");
    recordCombinationUsed("a", "A");
    recordCombinationUsed("b", "B");
    recordCombinationUsed("b", "B");
    expect(topFavorites(1)[0].key).toBe("b");
  });

  it("records a new combination once", async () => {
    const { recordCombinationUsed, loadHistory } = await import("./storage");
    recordCombinationUsed("beef-burger x2", "2 × Beef Burger");
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].count).toBe(1);
  });

  it("increments count when the same combination is used again", async () => {
    const { recordCombinationUsed, loadHistory } = await import("./storage");
    recordCombinationUsed("beef-burger x2", "2 × Beef Burger");
    recordCombinationUsed("beef-burger x2", "2 × Beef Burger");
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].count).toBe(2);
  });

  it("reports wasUsedBefore correctly", async () => {
    const { recordCombinationUsed, wasUsedBefore } = await import("./storage");
    expect(wasUsedBefore("x")).toBe(false);
    recordCombinationUsed("x", "X combo");
    expect(wasUsedBefore("x")).toBe(true);
  });

  it("clears history", async () => {
    const { recordCombinationUsed, clearHistory, loadHistory } = await import("./storage");
    recordCombinationUsed("x", "X combo");
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
