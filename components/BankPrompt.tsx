"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { fromKey } from "@/lib/progress";
import { Payback, WeekendChoice } from "@/lib/reserve";

interface Props {
  choice: { date: string; share: number } | null;
  overage: { monday: string; over: number; remaining: number; perDay: number } | null;
  balance: number;
  onChoose: (date: string, choice: WeekendChoice) => void;
  onOverage: (monday: string, decision: Payback["decision"]) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Weekend "use the extra or store it?" and Monday "you went over — pay it back?" questions. */
export function BankPrompt({ choice, overage, balance, onChoose, onOverage }: Props) {
  const { t, date } = useI18n();
  const open = !!(choice || overage);
  const canCover = !!overage && balance >= overage.over;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass px-5 pt-6"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {choice ? (
              <>
                <div className="text-4xl text-center">🏦</div>
                <h2 className="text-xl font-black text-center mt-2">
                  {t(`${date(fromKey(choice.date), { weekday: "long" })}: you have +${fmt(choice.share)} kcal`, `${date(fromKey(choice.date), { weekday: "long" })}: عندك +${fmt(choice.share)} سعرة`)}
                </h2>
                <p className="text-sm text-muted text-center mt-1.5">
                  {t("From what you saved Mon–Thu. Use them today, or keep normal calories and store them for later?", "من اللي وفرته من الاثنين للخميس. تستخدمها اليوم، ولا تمشي على سعراتك العادية وتخزّنها لبعدين؟")}
                </p>
                <div className="grid gap-2.5 mt-5">
                  <button onClick={() => onChoose(choice.date, "use")} className="btn-tap rounded-2xl bg-gold text-ink py-3.5 font-black">
                    🍔 {t(`Use them today (+${fmt(choice.share)})`, `استخدمها اليوم (+${fmt(choice.share)})`)}
                  </button>
                  <button onClick={() => onChoose(choice.date, "store")} className="btn-tap rounded-2xl bg-sky-400/15 ring-1 ring-sky-400/40 text-sky-200 py-3.5 font-black">
                    💳 {t("Normal calories — store them", "سعرات عادية — خزّنها")}
                  </button>
                </div>
              </>
            ) : overage ? (
              <>
                <div className="text-4xl text-center">⚖️</div>
                <h2 className="text-xl font-black text-center mt-2">
                  {t(`You went ${fmt(overage.over)} kcal over this weekend`, `زدت ${fmt(overage.over)} سعرة في الويكند`)}
                </h2>
                <p className="text-sm text-muted text-center mt-1.5">
                  {t("Want to balance it out this week?", "تبا تعوّضها هالأسبوع؟")}
                </p>
                <div className="grid gap-2.5 mt-5">
                  <button onClick={() => onOverage(overage.monday, "reduce")} className="btn-tap rounded-2xl bg-gold text-ink py-3.5 font-black">
                    ✂️{" "}
                    {t(
                      `Reduce −${fmt(overage.perDay)} a day until Thursday (${overage.remaining} day${overage.remaining === 1 ? "" : "s"})`,
                      `نقّص −${fmt(overage.perDay)} باليوم لين الخميس (${overage.remaining} ${overage.remaining === 1 ? "يوم" : "أيام"})`
                    )}
                  </button>
                  {canCover && (
                    <button onClick={() => onOverage(overage.monday, "cover")} className="btn-tap rounded-2xl bg-sky-400/15 ring-1 ring-sky-400/40 text-sky-200 py-3.5 font-black">
                      💳 {t(`Cover it from my reserve (${fmt(balance)} stored)`, `غطّيها من المخزون (عندك ${fmt(balance)})`)}
                    </button>
                  )}
                  <button onClick={() => onOverage(overage.monday, "skip")} className="btn-tap rounded-2xl glass py-3.5 font-bold text-muted">
                    {t("No, carry on normally", "لا، كمّل طبيعي")}
                  </button>
                </div>
              </>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
