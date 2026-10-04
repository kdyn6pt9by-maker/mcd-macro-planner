"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { fromKey } from "@/lib/progress";
import { SavePlan, planEnd } from "@/lib/reserve";

interface Props {
  today: string;
  active: SavePlan | null;
  /** What the active plan has already saved (finished days). */
  savedSoFar: number;
  /** Today's target without the plan. */
  normalTarget: number;
  onStart: (kcal: number, days: number) => void;
  onStop: () => void;
}

const KCAL = [100, 200, 300, 400];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Save X a day for N days starting today; what you really save goes to the 💳 reserve. */
export function SavePlanCard({ today, active, savedSoFar, normalTarget, onStart, onStop }: Props) {
  const { t, date } = useI18n();
  const [kcal, setKcal] = useState(200);
  const [days, setDays] = useState(4);
  const [open, setOpen] = useState(false);
  const day = (k: string) => date(fromKey(k), { weekday: "short", day: "numeric" });

  if (active) {
    const n = Math.round((fromKey(today).getTime() - fromKey(active.start).getTime()) / 86_400_000) + 1;
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl p-4 ring-1 ring-sky-400/30 bg-sky-400/[0.07]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-black">🎯 {t(`Saving ${active.kcal} a day`, `توفّر ${active.kcal} باليوم`)}</div>
          <div className="text-[11px] text-sky-200 font-bold">{t(`Day ${n} of ${active.days}`, `يوم ${n} من ${active.days}`)}</div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-sky-400 rounded-full" style={{ width: `${(n / active.days) * 100}%` }} />
        </div>
        <div className="mt-2 text-[11px] text-muted leading-5">
          {t(
            `Today's target ${normalTarget - active.kcal} (normally ${normalTarget}) · until ${day(planEnd(active))} · saved so far `,
            `هدف اليوم ${normalTarget - active.kcal} (العادي ${normalTarget}) · لين ${day(planEnd(active))} · وفّرت لين الحين `
          )}
          <b className="text-sky-200">{savedSoFar}</b> {t("kcal → 💳 reserve", "سعرة ← 💳 المخزون")}
        </div>
        <button onClick={onStop} className="mt-2 text-[11px] text-[#ff8a7d] underline">
          {t("Stop saving", "وقّف التوفير")}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl ring-1 ring-sky-400/25 bg-sky-400/[0.05]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-start">
        <span>
          <span className="block text-sm font-black">🎯 {t("Save calories for later", "وفّر سعرات لبعدين")}</span>
          <span className="block text-[11px] text-muted">{t("Eat a bit less from today — spend it when you want", "كل أقل شوي من اليوم — واستخدمها وقت ما تبا")}</span>
        </span>
        <span className={`text-sky-300 transition-transform ${open ? "rotate-90" : "rtl:rotate-180"}`}>›</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">
              <div className="text-[11px] text-muted mb-1.5">{t("Less per day", "أقل كل يوم")}</div>
              <div className="flex gap-1.5">
                {KCAL.map((k) => (
                  <button key={k} onClick={() => setKcal(k)} className={`btn-tap flex-1 rounded-lg py-1.5 text-xs font-black ${kcal === k ? "bg-sky-400 text-black" : "bg-white/[0.06] text-muted"}`}>
                    −{k}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-muted mt-3 mb-1.5">{t("For how many days (from today)", "كم يوم (من اليوم)")}</div>
              <div className="flex gap-1.5">
                {DAYS.map((d) => (
                  <button key={d} onClick={() => setDays(d)} className={`btn-tap flex-1 rounded-lg py-1.5 text-xs font-black ${days === d ? "bg-sky-400 text-black" : "bg-white/[0.06] text-muted"}`}>
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-sky-200 mt-3 leading-5">
                {t(
                  `Target ${normalTarget - kcal} a day for ${days} day${days === 1 ? "" : "s"} → up to ${kcal * days} kcal into your 💳 reserve.`,
                  `هدفك ${normalTarget - kcal} باليوم لمدة ${days} ${days === 1 ? "يوم" : "أيام"} ← لين ${kcal * days} سعرة في 💳 المخزون.`
                )}
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  onStart(kcal, days);
                  setOpen(false);
                }}
                className="mt-3 w-full rounded-xl bg-sky-400 text-black font-black py-2.5 text-sm"
              >
                {t("Start today", "ابدا من اليوم")}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
