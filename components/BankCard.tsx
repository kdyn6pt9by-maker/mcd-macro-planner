"use client";

import { motion } from "framer-motion";
import { WeekBank } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { fromKey } from "@/lib/progress";
import { todayKey } from "@/lib/storage";
import { DayAdjust, Payback, WeekendChoice } from "@/lib/reserve";

/**
 * Weekly calorie bank, kept dead simple:
 * Mon–Thu shows what you saved each logged day; Fri, Sat, Sun each get an equal share on top of their target.
 */
export function BankCard({
  bank,
  adjust,
  choices,
  payback,
  onToggle,
  plan,
  onPlan,
}: {
  bank: WeekBank;
  adjust: (date: string) => DayAdjust;
  choices: Record<string, WeekendChoice>;
  /** This week's payback of last weekend's overage, if any. */
  payback?: Payback;
  onToggle: (date: string) => void;
  /** Planned saving per day Mon–Thu this week. */
  plan: number;
  onPlan: (kcal: number) => void;
}) {
  const { t, date } = useI18n();
  const today = todayKey();
  const day = (key: string) => date(fromKey(key), { weekday: "short" });
  const fmt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl p-4 ring-1 ring-sky-400/25"
      style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(24,8,10,0.85) 70%)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-black">🏦 {t("Calorie bank", "بنك السعرات")}</div>
        <div className="text-[10px] text-muted">{t("Save Mon–Thu → spend Fri–Sun", "توفّر الاثنين–الخميس ← تصرف الجمعة–الأحد")}</div>
      </div>

      {/* Plan ahead: eat X under target Mon–Thu so the weekend gets more */}
      <div className="mt-3 rounded-xl bg-black/25 px-3 py-2.5">
        <div className="text-[11px] font-bold">🎯 {t("Save each day this week (Mon–Thu)", "وفّر كل يوم هالأسبوع (الاثنين–الخميس)")}</div>
        <div className="flex gap-1.5 mt-2">
          {[0, 100, 200, 300, 400].map((n) => (
            <button
              key={n}
              onClick={() => onPlan(n)}
              className={`btn-tap flex-1 rounded-lg py-1.5 text-xs font-black transition-colors ${
                plan === n ? "bg-sky-400 text-black" : "bg-white/[0.06] text-muted"
              }`}
            >
              {n === 0 ? t("Off", "لا") : `−${n}`}
            </button>
          ))}
        </div>
        {plan > 0 && (
          <div className="text-[11px] text-sky-200 mt-2">
            {t(
              `Target Mon–Thu: ${(bank.saveDays[0]?.target ?? 0) - plan} · stick to it and Fri, Sat, Sun get +${Math.round((plan * 4) / 3)} each.`,
              `هدفك الاثنين–الخميس: ${(bank.saveDays[0]?.target ?? 0) - plan} · إذا التزمت، الجمعة والسبت والأحد كل يوم +${Math.round((plan * 4) / 3)}.`
            )}
          </div>
        )}
      </div>

      {/* Mon–Thu: what each logged day saved */}
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        {bank.saveDays.map((d, i) => (
          <motion.div
            key={d.date}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl py-2 text-center ${d.date === today ? "ring-1 ring-gold/50" : ""} ${
              d.diff === null ? "bg-white/[0.03]" : d.diff >= 0 ? "bg-sky-400/10" : "bg-red/15"
            }`}
          >
            <div className="text-[10px] text-muted">{day(d.date)}</div>
            <div className={`text-sm font-black ${d.diff === null ? "text-muted/50" : d.diff >= 0 ? "text-sky-300" : "text-[#ff8a7d]"}`}>
              {d.diff === null ? "—" : fmt(d.diff)}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 my-2.5 text-sm">
        <span className="text-muted">{t("Saved", "وفّرت")}</span>
        <span className={`font-black text-lg ${bank.saved >= 0 ? "text-sky-300" : "text-[#ff8a7d]"}`}>{fmt(bank.saved)}</span>
        <span className="text-muted">kcal</span>
        {bank.perDay > 0 && <span className="text-muted">÷ 3 = <b className="text-sky-300">+{bank.perDay}</b></span>}
      </div>

      {/* Fri–Sun: target + share; tap a day to switch between using and storing its share */}
      <div className="grid grid-cols-3 gap-1.5">
        {bank.spendDays.map((d) => {
          const a = adjust(d.date);
          const stored = choices[d.date] === "store" && bank.perDay > 0;
          return (
            <button
              key={d.date}
              disabled={bank.perDay <= 0}
              onClick={() => onToggle(d.date)}
              className={`btn-tap rounded-xl py-2 text-center transition-colors ${stored ? "bg-pink-300/10 ring-1 ring-pink-300/30" : "bg-black/30"} ${
                d.date === today ? "ring-2 ring-gold/70" : ""
              }`}
            >
              <div className="text-[10px] text-muted">{day(d.date)}</div>
              <div className="text-base font-black">{(d.target + a.bonus).toLocaleString("en-US")}</div>
              <div className={`text-[10px] ${stored ? "text-pink-200" : "text-muted"}`}>
                {bank.perDay <= 0
                  ? t("normal", "عادي")
                  : stored
                    ? t(`💳 stored ${bank.perDay}`, `💳 خزّنت ${bank.perDay}`)
                    : `${d.target.toLocaleString("en-US")} + ${bank.perDay}${choices[d.date] === "use" ? " ✓" : ""}`}
              </div>
            </button>
          );
        })}
      </div>
      {bank.perDay > 0 && (
        <p className="text-[10px] text-muted/80 mt-1.5 text-center">{t("Tap a day to use or store its extra", "اضغط على اليوم عشان تستخدم الزيادة أو تخزّنها")}</p>
      )}

      {payback?.decision === "reduce" && (
        <div className="mt-2.5 rounded-xl bg-red/10 ring-1 ring-red/30 px-3 py-2 text-[11px]">
          ✂️ {t(
            `Paying back last weekend: −${payback.perDay} kcal a day until Thursday.`,
            `تعويض الويكند اللي طاف: −${payback.perDay} سعرة باليوم لين الخميس.`
          )}
        </div>
      )}

      <p className="text-[11px] text-muted mt-2.5">
        {bank.loggedDays === 0
          ? t("Log Monday to Thursday and whatever you save gets added to Friday, Saturday and Sunday.", "سجّل من الاثنين للخميس، واللي توفره ينضاف للجمعة والسبت والأحد.")
          : bank.saved < 0
            ? t("You're over Mon–Thu, so no bonus this weekend.", "إنت زايد من الاثنين للخميس، فما في زيادة هالويكند.")
            : t(
                `Only days you logged count (${bank.loggedDays}/4). The bonus is added to Fri–Sun automatically.`,
                `تنحسب بس الأيام اللي سجلتها (${bank.loggedDays}/4). الزيادة تنضاف للجمعة–الأحد تلقائياً.`
              )}
      </p>
    </motion.div>
  );
}
