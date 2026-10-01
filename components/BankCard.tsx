"use client";

import { motion } from "framer-motion";
import { WeekBank } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  bank: WeekBank;
  isWeekend: boolean;
  using: boolean;
  onToggle: (v: boolean) => void;
}

/** Weekly calorie bank: weekday savings become extra room on the weekend. */
export function BankCard({ bank, isWeekend, using, onToggle }: Props) {
  const { t } = useI18n();
  const positive = bank.saved >= 0;
  const usedPct = bank.weeklyBudget ? Math.min(100, (bank.eatenThisWeek / bank.weeklyBudget) * 100) : 0;
  if (bank.loggedDays === 0 && !isWeekend) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl p-4 ring-1"
      style={{
        background: positive
          ? "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(24,8,10,0.85) 70%)"
          : "linear-gradient(135deg, rgba(218,41,28,0.18), rgba(24,8,10,0.85) 70%)",
        borderColor: "transparent",
      }}
    >
      <div className="flex items-center gap-3">
        <motion.span
          className="text-2xl"
          animate={positive && bank.saved > 0 ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
        >
          🏦
        </motion.span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{t("Calorie bank · this week", "بنك السعرات · هالأسبوع")}</div>
          <div className={`text-xl font-black ${positive ? "text-sky-300" : "text-[#ff8a7d]"}`}>
            {positive ? "+" : "−"}
            <AnimatedNumber value={Math.abs(bank.saved)} /> <span className="text-sm font-bold text-muted">kcal</span>
          </div>
        </div>
        {bank.weekendDaysLeft > 0 && bank.saved > 0 && (
          <div className="text-end">
            <div className="text-[10px] text-muted">{t("per weekend day", "لكل يوم ويكند")}</div>
            <div className="text-lg font-black text-sky-300">+{bank.perWeekendDay}</div>
          </div>
        )}
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${usedPct > 100 ? "bg-red" : "bg-sky-300"}`}
          initial={{ width: 0 }}
          animate={{ width: `${usedPct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-muted">
        {t(
          `${bank.eatenThisWeek.toLocaleString("en-US")} of ${bank.weeklyBudget.toLocaleString("en-US")} kcal this week · ${bank.loggedDays} day${bank.loggedDays === 1 ? "" : "s"} counted`,
          `${bank.eatenThisWeek.toLocaleString("en-US")} من ${bank.weeklyBudget.toLocaleString("en-US")} سعرة هالأسبوع · ${bank.loggedDays} أيام محسوبة`
        )}
      </div>

      {isWeekend && bank.saved > 0 ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onToggle(!using)}
          role="switch"
          aria-checked={using}
          className={`mt-3 w-full rounded-xl px-3 py-2.5 flex items-center gap-3 text-start ring-1 transition-colors ${
            using ? "bg-sky-400/15 ring-sky-400/40" : "bg-black/25 ring-white/10"
          }`}
        >
          <span className={`relative h-6 w-11 rounded-full transition-colors ${using ? "bg-sky-400" : "bg-white/15"}`}>
            <motion.span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
              animate={{ insetInlineStart: using ? 22 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </span>
          <span className="flex-1 text-sm font-bold">
            {using
              ? t(`Spending the bank today: +${bank.perWeekendDay} kcal`, `تصرف من البنك اليوم: +${bank.perWeekendDay} سعرة`)
              : t(`Use the bank today (+${bank.perWeekendDay} kcal)`, `استخدم البنك اليوم (+${bank.perWeekendDay} سعرة)`)}
          </span>
        </motion.button>
      ) : (
        <p className="mt-2 text-xs text-[#e8d5d6]">
          {bank.saved > 0
            ? t(
                `Nice — that's +${Math.round(bank.saved / 2)} kcal for each weekend day if you keep it.`,
                `حلو — يعني +${Math.round(bank.saved / 2)} سعرة لكل يوم ويكند إذا حافظت عليها.`
              )
            : bank.saved < 0
              ? t("You're over for the week so far — a lighter day pays it back.", "إنت زايد هالأسبوع للحين — يوم أخف يرجعها.")
              : t("Right on target so far this week.", "على الهدف بالضبط هالأسبوع للحين.")}
        </p>
      )}
    </motion.div>
  );
}
