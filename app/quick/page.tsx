"use client";

import { effectiveTargets } from "@/lib/goals";
import { foodEmoji } from "@/lib/foodEmoji";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PayFlags, PayRequest, PaySheet } from "@/components/PaySheet";
import { roundMacros, sumMacros } from "@/lib/engine/macros";
import { combinationKey, combinationLabel, findRecommendations } from "@/lib/engine/optimizer";
import { useI18n } from "@/lib/i18n";
import { recentAmounts } from "@/lib/insights";
import { historyFor, listDays, loadDay, loadMode, loadSettings, recordCombinationUsed, saveDay } from "@/lib/storage";
import { Combination, DayState, FoodItem, Settings } from "@/lib/types";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Queue mode: the top 3 orders, huge and nothing else — readable at arm's length at the counter. */
export default function QuickPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [day, setDay] = useState<DayState | null>(null);
  const [picked, setPicked] = useState<Combination | null>(null);
  const [pay, setPay] = useState<PayRequest | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setDay(loadDay());
  }, []);

  const eaten = useMemo(() => sumMacros(day?.entries.map((e) => e.macros) ?? []), [day]);

  const top = useMemo(() => {
    if (!settings || !day) return [];
    const targets = effectiveTargets(settings, loadMode());
    const nada: FoodItem = {
      id: "nada",
      name: "Nada Protein Milk",
      category: "nada",
      macros: { kcal: settings.nada.kcal, protein: settings.nada.protein, fat: settings.nada.fat, carbs: settings.nada.carbs },
      verified: true,
      enabled: true,
    };
    return findRecommendations({
      eaten,
      targets,
      foods: settings.foods,
      nadaItem: nada,
      nadaBottlesRemaining: settings.nada.maxPerDay - day.entries.filter((e) => e.kind === "nada").length,
      maxResults: 3,
    });
  }, [settings, day, eaten]);

  function eat(c: Combination) {
    if (!day) return;
    const orderId = uid();
    const at = new Date().toISOString();
    const entries = c.items.flatMap(({ food, qty }) =>
      Array.from({ length: qty }, () => ({
        id: uid(),
        at,
        groupId: orderId,
        kind: (food.category === "nada" ? "nada" : "mcdonalds") as "nada" | "mcdonalds",
        label: food.name,
        macros: food.macros,
      }))
    );
    const next = { ...day, entries: [...day.entries, ...entries] };
    saveDay(next);
    setDay(next);
    const label = combinationLabel(c);
    recordCombinationUsed(
      combinationKey(c),
      label,
      c.items.map(({ food, qty }) => ({ id: food.id, name: food.name, qty, macros: food.macros }))
    );
    setPicked(null);
    const protein = c.items.filter((i) => i.food.category !== "nada").reduce((n, i) => n + i.food.macros.protein * i.qty, 0);
    setPay({ date: day.date, orderId, label, kcal: c.totals.kcal, protein });
  }

  function savePayment(amount: number, flags: PayFlags) {
    if (!pay || !day) return;
    const next = {
      ...day,
      payments: [...(day.payments ?? []), { id: uid(), orderId: pay.orderId, label: pay.label, amount, at: new Date().toISOString(), ...flags }],
    };
    saveDay(next);
    setDay(next);
    setPay(null);
    setDone(true);
  }

  if (!settings || !day) return null;
  const r = roundMacros(eaten);

  return (
    <main className="max-w-md mx-auto px-4 pb-10 min-h-screen flex flex-col" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="h-12 w-12 rounded-2xl glass flex items-center justify-center text-xl text-muted" aria-label={t("Back", "رجوع")}>
          <span className="rtl:rotate-180">←</span>
        </Link>
        <div className="text-end">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">⚡ {t("Quick mode", "الوضع السريع")}</div>
          <div className="text-sm font-bold">
            {r.kcal} kcal · {Math.round(r.protein)}g P · {r.fat}g F
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <motion.div className="text-8xl" animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              🍔
            </motion.div>
            <div className="text-3xl font-black mt-4 gold-text">{t("Enjoy!", "بالعافية!")}</div>
            <p className="text-muted mt-2">{t("Logged and saved.", "انسجل وانحفظ.")}</p>
            <Link href="/" className="mt-8 rounded-2xl bg-gold text-black font-extrabold px-8 py-4 text-lg">
              {t("Back home", "للرئيسية")}
            </Link>
          </motion.div>
        ) : top.length === 0 ? (
          <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl">🤷</div>
            <p className="text-xl font-bold mt-4">{t("No McDonald's order fits right now.", "ما في طلب من ماك يناسب الحين.")}</p>
          </motion.div>
        ) : (
          <motion.div key="list" className="flex-1 flex flex-col gap-3">
            {top.map((c, i) => {
              const h = historyFor(combinationKey(c));
              return (
                <motion.button
                  key={combinationKey(c)}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 240, damping: 22 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPicked(c)}
                  className={`flex-1 rounded-[1.75rem] p-5 text-start flex flex-col justify-center ${
                    i === 0 ? "bg-gradient-to-br from-gold to-[#ff9f1c] text-black" : "glass"
                  }`}
                >
                  <div className={`text-xs font-black tracking-widest ${i === 0 ? "text-black/60" : "text-muted"}`}>
                    #{i + 1} {i === 0 ? t("· BEST MATCH", "· الأفضل") : ""} {h ? t(`· ↺ ${h.count}×`, `· ↺ ${h.count}×`) : ""}
                  </div>
                  <div className="mt-2 space-y-1">
                    {c.items.map(({ food, qty }) => (
                      <div key={food.id} className="text-2xl font-black leading-tight">
                        {qty}× {foodEmoji(food.id + food.name)} {food.name}
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 text-base font-bold ${i === 0 ? "text-black/70" : "text-muted"}`}>
                    +{c.totals.kcal} kcal · +{c.totals.protein}g P · +{c.totals.fat}g F
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {picked && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicked(null)} />
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md glass rounded-[2rem] p-6"
            >
              <div className="text-sm text-muted">{t("Order this?", "تطلب هذا؟")}</div>
              <div className="text-2xl font-black mt-1">{combinationLabel(picked)}</div>
              <div className="text-sm text-muted mt-2">
                {t("Day after:", "يومك بعدها:")} {picked.afterEating.kcal} kcal · {picked.afterEating.protein}g P · {picked.afterEating.fat}g F
              </div>
              <div className="grid grid-cols-3 gap-2 mt-6">
                <button onClick={() => setPicked(null)} className="rounded-2xl py-4 font-bold text-muted bg-white/5">
                  {t("Back", "رجوع")}
                </button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => eat(picked)} className="col-span-2 rounded-2xl bg-gold text-black font-extrabold py-4 text-lg">
                  {t("I'll eat this ✓", "باكل هذا ✓")}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PaySheet
        request={pay}
        recentAmounts={pay ? recentAmounts(listDays()) : []}
        onSave={savePayment}
        onSkip={() => {
          setPay(null);
          setDone(true);
        }}
      />
    </main>
  );
}
