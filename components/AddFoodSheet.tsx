"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useState } from "react";
import { kcalFromMacros } from "@/lib/engine/macros";
import { useI18n } from "@/lib/i18n";
import { todayKey } from "@/lib/storage";
import { Macros, SavedMeal } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { DayPicker } from "./DayPicker";

type Mode = "add" | "set";

interface Props {
  open: boolean;
  initialDate?: string;
  savedMeals: SavedMeal[];
  onClose: () => void;
  onAdd: (label: string, macros: Macros, date: string, saveAsFavorite: boolean) => void;
  onSetTotals: (macros: Macros, date: string) => void;
}

function Field({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="mt-1 relative">
        <input
          inputMode="decimal"
          type="number"
          min={0}
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          className="no-spin w-full bg-black/40 rounded-2xl ps-4 pe-7 py-3.5 text-2xl font-bold outline-none border border-white/5 focus:border-gold/60 transition-colors"
          style={{ caretColor: accent }}
        />
        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-muted text-sm">g</span>
      </div>
    </label>
  );
}

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function AddFoodSheet({ open, initialDate, savedMeals, onClose, onAdd, onSetTotals }: Props) {
  const { t } = useI18n();
  const dragControls = useDragControls();
  const [mode, setMode] = useState<Mode>("add");
  const [date, setDate] = useState(todayKey());
  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [kcalOverride, setKcalOverride] = useState("");
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(initialDate ?? todayKey());
    setName("");
    setProtein("");
    setCarbs("");
    setFat("");
    setKcalOverride("");
    setFavorite(false);
  }, [open, initialDate]);

  const p = num(protein);
  const c = num(carbs);
  const f = num(fat);
  const computed = kcalFromMacros(p, c, f);
  const kcal = num(kcalOverride) || computed;
  const canSubmit = p + c + f > 0 || num(kcalOverride) > 0;
  const split = computed > 0 ? { p: (p * 4) / computed, c: (c * 4) / computed, f: (f * 9) / computed } : null;
  const isToday = date === todayKey();

  function fill(m: SavedMeal) {
    setMode("add");
    setName(m.name);
    setProtein(String(m.macros.protein || ""));
    setCarbs(String(m.macros.carbs || ""));
    setFat(String(m.macros.fat || ""));
    const auto = Math.round(kcalFromMacros(m.macros.protein, m.macros.carbs, m.macros.fat));
    setKcalOverride(Math.round(m.macros.kcal) !== auto ? String(m.macros.kcal) : "");
    setFavorite(false);
  }

  function submit() {
    if (!canSubmit) return;
    const macros = { kcal, protein: p, carbs: c, fat: f };
    if (mode === "add") onAdd(name.trim() || t("Other food", "أكل ثاني"), macros, date, favorite && !!name.trim());
    else onSetTotals(macros, date);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass px-5 pt-3 max-h-[94dvh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="-mx-5 -mt-3 pt-3 pb-4 touch-none cursor-grab" onPointerDown={(e) => dragControls.start(e)}>
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
            </div>

            <div className="relative grid grid-cols-2 p-1 rounded-2xl bg-black/40 mb-4">
              {(["add", "set"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-colors duration-200 ${mode === m ? "bg-gold text-black" : "text-muted"}`}
                >
                  {m === "add" ? t("Add other food", "أضف أكل ثاني") : t("Set day's totals", "حدد مجموع اليوم")}
                </button>
              ))}
            </div>

            <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">{t("Which day?", "أي يوم؟")}</div>
            <DayPicker value={date} onChange={setDate} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode + String(isToday)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`text-xs mt-3 mb-3 ${isToday ? "text-muted" : "text-gold"}`}
              >
                {mode === "add"
                  ? isToday
                    ? t("Enter its macros — calories are calculated for you.", "اكتب الماكروز — السعرات تنحسب لحالها.")
                    : t("Adding to a past day — it'll show in that day's log and your charts.", "بتنضاف ليوم فات — بتطلع في سجل ذاك اليوم وفي الرسوم.")
                  : t("Replaces everything logged that day with these totals.", "يستبدل كل شي مسجل في ذاك اليوم بهذا المجموع.")}
              </motion.p>
            </AnimatePresence>

            {mode === "add" && savedMeals.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">⭐ {t("Saved meals", "وجباتك المحفوظة")}</div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
                  {savedMeals.map((m) => (
                    <motion.button
                      key={m.id}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => fill(m)}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-gold/10 ring-1 ring-gold/30 text-xs font-bold text-gold"
                    >
                      {m.name} · {Math.round(m.macros.kcal)}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {mode === "add" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Name (optional) — e.g. Shawarma", "الاسم (اختياري) — مثلاً شاورما")}
                className="w-full bg-black/40 rounded-2xl px-4 py-3 mb-3 outline-none border border-white/5 focus:border-gold/60 transition-colors"
              />
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <Field label={t("Protein", "بروتين")} value={protein} onChange={setProtein} accent="#34d399" />
              <Field label={t("Carbs", "كارب")} value={carbs} onChange={setCarbs} accent="#d6a15c" />
              <Field label={t("Fat", "دهون")} value={fat} onChange={setFat} accent="#fb923c" />
            </div>

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{t("Calories", "السعرات")}</div>
                  <div className="text-4xl font-black gold-text leading-tight">
                    <AnimatedNumber value={Math.round(kcal)} />
                    <span className="text-base font-semibold text-muted"> kcal</span>
                  </div>
                </div>
                <div className="text-end text-[11px] text-muted leading-4">
                  {num(kcalOverride) ? t("manual", "يدوي") : "4 · 4 · 9 kcal/g"}
                </div>
              </div>
              <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-white/5">
                {split && (
                  <>
                    <motion.div className="bg-success" animate={{ width: `${split.p * 100}%` }} />
                    <motion.div className="bg-carb" animate={{ width: `${split.c * 100}%` }} />
                    <motion.div className="bg-warn" animate={{ width: `${split.f * 100}%` }} />
                  </>
                )}
              </div>
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer">
                  {t("Know the exact calories? Override", "تعرف السعرات بالضبط؟ اكتبها")}
                </summary>
                <input
                  inputMode="decimal"
                  type="number"
                  value={kcalOverride}
                  onChange={(e) => setKcalOverride(e.target.value)}
                  placeholder={`${Math.round(computed)}`}
                  className="no-spin mt-2 w-full bg-black/40 rounded-xl px-3 py-2 outline-none border border-white/5 focus:border-gold/60"
                />
              </details>
            </div>

            {mode === "add" && (
              <label className={`mt-3 flex items-center gap-2.5 text-sm ${name.trim() ? "" : "opacity-40"}`}>
                <input
                  type="checkbox"
                  disabled={!name.trim()}
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="h-5 w-5 accent-[#ffc72c]"
                />
                ⭐ {t("Save as a quick meal (one-tap next time)", "احفظها كوجبة سريعة (بضغطة المرة الجاية)")}
              </label>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!canSubmit}
              onClick={submit}
              className="mt-4 w-full rounded-2xl bg-gold text-black font-extrabold py-4 text-lg disabled:opacity-30 transition-opacity"
            >
              {mode === "add"
                ? isToday
                  ? t("Add to today", "أضف لليوم")
                  : t("Add to that day", "أضف لذاك اليوم")
                : t("Set totals", "احفظ المجموع")}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
