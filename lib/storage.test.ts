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
    expect(migrated.version).toBe(2);
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
