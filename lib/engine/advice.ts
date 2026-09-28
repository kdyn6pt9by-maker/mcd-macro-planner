import { Macros, Targets } from "../types";

export function remainingMacros(eaten: Macros, targets: Targets): Macros {
  return {
    kcal: Math.max(0, targets.kcal - eaten.kcal),
    protein: Math.max(0, targets.proteinMin - eaten.protein),
    fat: Math.max(0, targets.fatMax - eaten.fat),
    carbs: Math.max(0, targets.carbsRef - eaten.carbs),
  };
}

export function smartAdvice(eaten: Macros, targets: Targets, hasRecommendation: boolean): string {
  const remaining = remainingMacros(eaten, targets);
  const proteinDone = eaten.protein >= targets.proteinMin;
  const fatNearLimit = eaten.fat >= targets.fatMax - 5;
  const fatOverLimit = eaten.fat > targets.fatMax;

  if (fatOverLimit) {
    return `You're over your fat limit by ${(eaten.fat - targets.fatMax).toFixed(1)} g. Go lean for the rest of the day.`;
  }
  if (proteinDone && remaining.kcal > 0) {
    return `Protein is already covered. You have ${Math.round(remaining.kcal)} kcal left for anything you want.`;
  }
  if (fatNearLimit) {
    return `You're close to your fat limit. Choose the lower-fat option.`;
  }
  if (!hasRecommendation) {
    return `No available McDonald's combination fits the remaining calories closely. Finish the remaining calories yourself.`;
  }
  if (!proteinDone) {
    const shortfall = Math.round(remaining.protein);
    if (shortfall <= 31) {
      return `You're ${shortfall} g short on protein. One additional Nada would solve it.`;
    }
    return `You're ${shortfall} g short on protein today.`;
  }
  if (remaining.fat > 15) {
    return `Fat is low today. You still have room for approximately ${Math.round(remaining.fat)} g fat.`;
  }
  return `On track — ${Math.round(remaining.kcal)} kcal remaining today.`;
}
