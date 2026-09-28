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

describe("history / favorites logic", () => {
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
