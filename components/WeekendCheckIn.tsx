"use client";

import { useI18n } from "@/lib/i18n";
import { useKeyboardSheetStyle } from "@/lib/useKeyboardInset";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { kcalFromMacros } from "@/lib/engine/macros";
import { fromKey } from "@/lib/progress";
import { Macros } from "@/lib/types";

type Fields = { protein: string; carbs: string; fat: string; kcal: string };
const empty: Fields = { protein: "", carbs: "", fat: "", kcal: "" };
const n = (s: string) => Math.max(0, parseFloat(s) || 0);

function toMacros(f: Fields): Macros | null {
  const p = n(f.protein);
  const c = n(f.carbs);
  const fat = n(f.fat);
  const kcal = n(f.kcal) || Math.round(kcalFromMacros(p, c, fat));
  return kcal > 0 ? { kcal, protein: p, carbs: c, fat } : null;
}

interface Props {
  dates: string[];
  onSave: (logs: { date: string; macros: Macros }[], skipped: string[]) => void;
}

export function WeekendCheckIn({ dates, onSave }: Props) {
  const { t, date } = useI18n();
  const sheetStyle = useKeyboardSheetStyle({ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" });
  const [values, setValues] = useState<Record<string, Fields>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setValues(Object.fromEntries(dates.map((d) => [d, empty])));
    setSkip({});
  }, [dates]);

  const open = dates.length > 0;
  const ready = dates.every((d) => skip[d] || toMacros(values[d] ?? empty));

  function submit() {
    const logs = dates.filter((d) => !skip[d]).flatMap((d) => {
      const m = toMacros(values[d] ?? empty);
      return m ? [{ date: d, macros: m }] : [];
    });
    onSave(logs, dates.filter((d) => skip[d]));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass px-5 pt-5 max-h-[92dvh] overflow-y-auto"
            style={sheetStyle}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <motion.div
              className="text-4xl"
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.5 }}
            >
              🌴
            </motion.div>
            <h2 className="text-2xl font-black mt-1">
              {t("Weekend", "تسجيل")} <span className="gold-text">{t("check-in", "الويكند")}</span>
            </h2>
            <p className="text-xs text-muted mt-1 mb-4 leading-5">
              {t(
                `You didn't log ${dates.length === 2 ? "Saturday and Sunday" : "this day"}. Rough totals are fine — calories are calculated for you. Weekends never affect your streak, but they keep your averages honest.`,
                `ما سجلت ${dates.length === 2 ? "السبت والأحد" : "هذا اليوم"}. تقريبي يكفي — السعرات تنحسب لحالها. الويكند ما يأثر على السلسلة، بس يخلي متوسطاتك دقيقة.`
              )}
            </p>

            <div className="space-y-3">
              {dates.map((d, i) => {
                const f = values[d] ?? empty;
                const m = toMacros(f);
                const skipped = !!skip[d];
                return (
                  <motion.div
                    key={d}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                    className={`rounded-2xl p-3.5 ring-1 transition-colors ${skipped ? "bg-white/[0.02] ring-white/5" : "bg-black/30 ring-gold/20"}`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-bold">{date(fromKey(d), { weekday: "long", month: "short", day: "numeric" })}</span>
                      <button
                        onClick={() => setSkip((s) => ({ ...s, [d]: !s[d] }))}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${skipped ? "bg-white/15 text-[#f7ecec]" : "bg-white/5 text-muted"}`}
                      >
                        {skipped ? t("✓ Didn't track", "✓ ما سجلت") : t("Didn't track", "ما سجلت")}
                      </button>
                    </div>
                    <motion.div animate={{ opacity: skipped ? 0.3 : 1 }} className={skipped ? "pointer-events-none" : ""}>
                      <div className="grid grid-cols-4 gap-2">
                        {(["protein", "carbs", "fat", "kcal"] as const).map((k) => (
                          <label key={k} className="block">
                            <span className="text-[10px] uppercase tracking-wider text-muted">{k === "kcal" ? t("kcal (opt.)", "سعرات (اختياري)") : k === "protein" ? t("protein", "بروتين") : k === "carbs" ? t("carbs", "كارب") : t("fat", "دهون")}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={f[k]}
                              placeholder={k === "kcal" && m ? String(m.kcal) : "0"}
                              onChange={(e) => setValues((v) => ({ ...v, [d]: { ...(v[d] ?? empty), [k]: e.target.value } }))}
                              className="no-spin mt-1 w-full bg-black/40 rounded-xl px-2.5 py-2.5 text-lg font-bold outline-none border border-white/5 focus:border-gold/60"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="text-xs mt-2 text-muted">
                        = <span className="text-gold font-bold">{m ? m.kcal.toLocaleString("en-US") : 0} kcal</span>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!ready}
              onClick={submit}
              className="mt-5 w-full rounded-2xl bg-gold text-black font-extrabold py-4 text-lg disabled:opacity-30 transition-opacity"
            >
              {ready ? t("Save weekend", "احفظ الويكند") : t("Fill in or mark “Didn't track”", "عبّي أو اختار “ما سجلت”")}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
