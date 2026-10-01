"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Goal, GoalMode, applyGoal, pctForCalories } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { Settings } from "@/lib/types";

const PRESETS = [10, 15, 20, 25];

/** Maintain / cut / bulk on top of your maintenance targets. */
export function GoalSection({ settings, onChange }: { settings: Settings; onChange: (goal: Goal) => void }) {
  const { t } = useI18n();
  const goal = settings.goal;
  const [by, setBy] = useState<"pct" | "kcal">("pct");
  const [kcalText, setKcalText] = useState("");
  const base = settings.targets.workday;
  const eff = applyGoal(base, goal);
  const effWeekend = applyGoal(settings.targets.weekend, goal);

  const modes: { id: GoalMode; label: string; icon: string; color: string }[] = [
    { id: "maintain", label: t("Maintain", "ثبات"), icon: "⚖️", color: "bg-gold" },
    { id: "cut", label: t("Cut / fat loss", "تنشيف"), icon: "✂️", color: "bg-sky-400" },
    { id: "bulk", label: t("Bulk", "تضخيم"), icon: "💪", color: "bg-emerald-400" },
  ];

  const row = (label: string, a: number, b: number, unit = "") => {
    const diff = b - a;
    return (
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5 border-b border-white/5 last:border-0 text-sm">
        <span className="text-muted">{label}</span>
        <span className={`text-muted ${diff !== 0 ? "line-through decoration-white/20" : "opacity-0"}`}>{a}{unit}</span>
        <span className="font-black min-w-[4.5rem] text-end">
          {b}{unit}
          {diff !== 0 && <span className={`ms-1 text-[10px] ${diff < 0 ? "text-sky-300" : "text-emerald-300"}`}>{diff > 0 ? "+" : ""}{diff}</span>}
        </span>
      </div>
    );
  };

  return (
    <section className="rounded-xl3 glass p-4 mb-4">
      <h2 className="font-semibold mb-1">🎯 {t("Goal", "الهدف")}</h2>
      <p className="text-[11px] text-muted mb-3 leading-4">
        {t(
          "Your targets below are your maintenance numbers. Cut or bulk adjusts calories by a %; protein stays the same, fat scales (never under 20% of calories), carbs take the rest.",
          "أهدافك تحت هي أرقام الثبات. التنشيف أو التضخيم يغير السعرات بنسبة؛ البروتين يبقى نفسه، الدهون تتعدل (ما تنزل عن 20% من السعرات)، والكارب ياخذ الباقي."
        )}
      </p>

      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/40">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange({ mode: m.id, pct: m.id === "maintain" ? goal.pct : goal.pct || 20 })}
            className={`py-2.5 rounded-xl text-xs font-bold transition-colors duration-200 ${goal.mode === m.id ? `${m.color} text-black` : "text-muted"}`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {goal.mode !== "maintain" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex gap-1.5 mt-3">
              {(["pct", "kcal"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBy(b)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${by === b ? "bg-white/15 text-[#f7ecec]" : "bg-white/5 text-muted"}`}
                >
                  {b === "pct" ? t("By percentage", "بالنسبة %") : t("I'll type the calories", "أكتب السعرات بنفسي")}
                </button>
              ))}
            </div>

            {by === "pct" ? (
              <div className="mt-3">
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => onChange({ ...goal, pct: p })}
                      className={`py-2 rounded-xl text-sm font-black transition-colors ${goal.pct === p ? "bg-gold text-black" : "bg-black/30 text-muted"}`}
                    >
                      {goal.mode === "cut" ? "−" : "+"}
                      {p}%
                    </button>
                  ))}
                  <label className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={PRESETS.includes(goal.pct) ? "" : goal.pct}
                      placeholder={t("other", "غير")}
                      onChange={(e) => {
                        const v = Math.min(50, Math.max(0, parseFloat(e.target.value) || 0));
                        onChange({ ...goal, pct: v });
                      }}
                      className="no-spin w-full h-full bg-black/30 rounded-xl px-2 text-sm font-black text-center outline-none border border-white/5 focus:border-gold/60"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="mt-3 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={kcalText}
                  placeholder={String(eff.kcal)}
                  onChange={(e) => {
                    setKcalText(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v) && v > 800 && v < 6000) onChange(pctForCalories(base.kcal, v));
                  }}
                  className="no-spin w-full bg-black/40 rounded-2xl ps-4 pe-28 py-3 text-2xl font-black outline-none border border-white/5 focus:border-gold/60"
                />
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs text-muted">{t("kcal / workday", "سعرة / يوم دوام")}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 rounded-2xl bg-black/25 px-3.5 py-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">
          {goal.mode === "maintain"
            ? t("Workday targets", "أهداف يوم الدوام")
            : t(`Workday: maintenance → ${goal.mode === "cut" ? "cut" : "bulk"} ${goal.pct}%`, `يوم الدوام: الثبات ← ${goal.mode === "cut" ? "تنشيف" : "تضخيم"} ${goal.pct}%`)}
        </div>
        {row(t("Calories", "السعرات"), base.kcal, eff.kcal)}
        {row(t("Protein", "بروتين"), base.proteinMin, eff.proteinMin, "g")}
        {row(t("Fat max", "أعلى دهون"), base.fatMax, eff.fatMax, "g")}
        {row(t("Carbs", "كارب"), base.carbsRef, eff.carbsRef, "g")}
        {goal.mode !== "maintain" && (
          <div className="text-[11px] text-muted pt-1.5">
            {t(`Weekend: ${settings.targets.weekend.kcal} → ${effWeekend.kcal} kcal`, `الويكند: ${settings.targets.weekend.kcal} ← ${effWeekend.kcal} سعرة`)}
          </div>
        )}
      </div>
    </section>
  );
}
