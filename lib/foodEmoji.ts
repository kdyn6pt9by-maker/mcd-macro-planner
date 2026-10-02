/** 🍗 for nuggets/tenders, 🍳 breakfast, 🌯 McArabia, 🥛 for Nada, 🍦 for ice cream, 🍔 for every other McDonald's item. */
export function foodEmoji(idOrName: string): string {
  const s = idOrName.toLowerCase();
  if (s.includes("nugget") || s.includes("tender")) return "🍗";
  if (s.includes("breakfast") || s.includes("mcmuffin")) return "🍳";
  if (s.includes("mcarabia")) return "🌯";
  if (s.includes("nada")) return "🥛";
  if (s.includes("ice-cream") || s.includes("ice cream") || s.includes("mcflurry") || s.includes("sundae")) return "🍦";
  return "🍔";
}
