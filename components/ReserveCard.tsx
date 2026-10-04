"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { fromKey } from "@/lib/progress";
import { ReserveLine } from "@/lib/reserve";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  balance: number;
  lines: ReserveLine[];
  /** Already withdrawn for today. */
  todayWithdrawn: number;
  onWithdraw: (kcal: number) => void;
  onRemove: (id: string) => void;
}

/** The extra-calories reserve: what you stored from weekend days, separate from the weekly bank. */
export function ReserveCard({ balance, lines, todayWithdrawn, onWithdraw, onRemove }: Props) {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const presets = [100, 200, 300, 500].filter((n) => n <= balance);
  const label = (l: ReserveLine) =>
    l.kind === "store"
      ? t("Stored", "تخزين")
      : l.kind === "leftover"
        ? t("Unused weekend extra", "زيادة ما انأكلت")
        : l.kind === "plan"
          ? t("🎯 Saving plan", "🎯 توفير")
        : l.kind === "withdraw"
          ? t("Used", "استخدمت")
          : t("Covered weekend", "غطّيت الويكند");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-2xl p-4 ring-1 ring-pink-300/25"
      style={{ background: "linear-gradient(135deg, rgba(244,114,182,0.12), rgba(24,8,10,0.85) 70%)" }}
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <div className="text-start">
          <div className="text-sm font-black">💳 {t("Extra calories reserve", "مخزون السعرات الإضافية")}</div>
          <div className="text-[10px] text-muted">{t("Separate from the weekend bank", "غير عن بنك الويكند")}</div>
        </div>
        <div className="text-end">
          <div className={`text-2xl font-black ${balance >= 0 ? "text-pink-200" : "text-[#ff8a7d]"}`}>
            <AnimatedNumber value={balance} /> <span className="text-xs text-muted font-bold">kcal</span>
          </div>
          {todayWithdrawn > 0 && <div className="text-[10px] text-pink-200">{t(`+${todayWithdrawn} added today`, `+${todayWithdrawn} مضافة اليوم`)}</div>}
        </div>
      </button>

      {presets.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-muted mb-1.5">{t("Use some today:", "استخدم منها اليوم:")}</div>
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((n) => (
              <button key={n} onClick={() => onWithdraw(n)} className="btn-tap rounded-xl bg-pink-300/15 ring-1 ring-pink-300/30 px-3 py-1.5 text-xs font-black text-pink-100">
                +{n}
              </button>
            ))}
            {!presets.includes(balance) && (
              <button onClick={() => onWithdraw(balance)} className="btn-tap rounded-xl bg-pink-300/15 ring-1 ring-pink-300/30 px-3 py-1.5 text-xs font-black text-pink-100">
                {t(`All (${balance})`, `الكل (${balance})`)}
              </button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-1">
              {lines.length === 0 && <p className="text-[11px] text-muted">{t("Nothing yet.", "ما في شي للحين.")}</p>}
              {lines.slice(0, 12).map((l, i) => (
                <div key={`${l.date}-${l.kind}-${l.id ?? i}`} className="flex items-center justify-between text-xs bg-black/25 rounded-lg px-2.5 py-1.5">
                  <span className="text-muted">
                    {date(fromKey(l.date), { weekday: "short", day: "numeric", month: "short" })} · {label(l)}
                  </span>
                  <span className="flex items-center gap-2">
                    <b className={l.kcal >= 0 ? "text-pink-200" : "text-muted"}>{l.kcal > 0 ? `+${l.kcal}` : `−${Math.abs(l.kcal)}`}</b>
                    {l.id && (
                      <button onClick={() => onRemove(l.id!)} className="text-[#ff8a7d]" aria-label={t("Undo", "تراجع")}>
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
