import { Language, Macros, Targets } from "../types";

export function remainingMacros(eaten: Macros, targets: Targets): Macros {
  return {
    kcal: Math.max(0, targets.kcal - eaten.kcal),
    protein: Math.max(0, targets.proteinMin - eaten.protein),
    fat: Math.max(0, targets.fatMax - eaten.fat),
    carbs: Math.max(0, targets.carbsRef - eaten.carbs),
  };
}

export function smartAdvice(eaten: Macros, targets: Targets, hasRecommendation: boolean, lang: Language = "en"): string {
  const ar = lang === "ar";
  const remaining = remainingMacros(eaten, targets);
  const proteinDone = eaten.protein >= targets.proteinMin;
  const fatNearLimit = eaten.fat >= targets.fatMax - 5;
  const fatOverLimit = eaten.fat > targets.fatMax;
  const kcalLeft = Math.round(remaining.kcal);

  if (fatOverLimit) {
    const over = (eaten.fat - targets.fatMax).toFixed(1);
    return ar
      ? `تعديت حد الدهون بـ ${over} جرام. خلك على الخفيف باقي اليوم.`
      : `You're over your fat limit by ${over} g. Go lean for the rest of the day.`;
  }
  if (proteinDone && remaining.kcal > 0) {
    return ar
      ? `البروتين خلص ✓ باقي لك ${kcalLeft} سعرة لأي شي تبيه.`
      : `Protein is already covered. You have ${kcalLeft} kcal left for anything you want.`;
  }
  if (fatNearLimit) {
    return ar ? `قربت من حد الدهون. اختار الخيار الأقل دهون.` : `You're close to your fat limit. Choose the lower-fat option.`;
  }
  if (!hasRecommendation) {
    return ar
      ? `ما في طلب من ماك يناسب السعرات الباقية بالضبط. كمّل الباقي بنفسك.`
      : `No available McDonald's combination fits the remaining calories closely. Finish the remaining calories yourself.`;
  }
  if (!proteinDone) {
    const shortfall = Math.round(remaining.protein);
    if (shortfall <= 31) {
      return ar ? `ناقصك ${shortfall} جرام بروتين. علبة ندى وحدة تكفي.` : `You're ${shortfall} g short on protein. One additional Nada would solve it.`;
    }
    return ar ? `ناقصك ${shortfall} جرام بروتين اليوم.` : `You're ${shortfall} g short on protein today.`;
  }
  if (remaining.fat > 15) {
    const fat = Math.round(remaining.fat);
    return ar
      ? `الدهون قليلة اليوم. باقي لك تقريباً ${fat} جرام دهون.`
      : `Fat is low today. You still have room for approximately ${fat} g fat.`;
  }
  return ar ? `ماشي صح — باقي ${kcalLeft} سعرة اليوم.` : `On track — ${kcalLeft} kcal remaining today.`;
}
