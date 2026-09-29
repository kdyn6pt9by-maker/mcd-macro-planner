/** 🍗 for nuggets, 🥛 for Nada, 🍔 for every other McDonald's item. */
export function foodEmoji(idOrName: string): string {
  const s = idOrName.toLowerCase();
  if (s.includes("nugget")) return "🍗";
  if (s.includes("nada")) return "🥛";
  return "🍔";
}
