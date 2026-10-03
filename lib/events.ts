/** Fired after any day or reserve change so the calorie bar on every page stays current. */
export const DATA_EVENT = "mcd:data";

export function notifyDataChanged() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(DATA_EVENT));
}
