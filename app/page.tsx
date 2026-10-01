"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddFoodSheet } from "@/components/AddFoodSheet";
import { CalorieRing } from "@/components/CalorieRing";
import { Celebration } from "@/components/Celebration";
import { DayLog } from "@/components/DayLog";
import { DayCostBar } from "@/components/DayCostBar";
import { MacroBar } from "@/components/MacroBar";
import { McMenuSheet } from "@/components/McMenuSheet";
import { PayFlags, PayRequest, PaySheet } from "@/components/PaySheet";
import { RecommendationCard } from "@/components/RecommendationCard";
import { Toast, ToastData } from "@/components/Toast";
import { UpdateBanner, isUpdateAvailable, reloadApp } from "@/components/UpdateBanner";
import { WeekendCheckIn } from "@/components/WeekendCheckIn";
import { smartAdvice } from "@/lib/engine/advice";
import { roundMacros, scaleMacros, sumMacros } from "@/lib/engine/macros";
import { combinationKey, combinationLabel, findRecommendations } from "@/lib/engine/optimizer";
import { useI18n } from "@/lib/i18n";
import { cloneEntries, costSummary, prunePayments, recentAmounts } from "@/lib/insights";
import { editOrder, orderQty } from "@/lib/logging";
import { STREAK_MILESTONE, fromKey, pendingWeekendDays, toKey, weekdayStreak } from "@/lib/progress";
import {
  historyFor,
  listDays,
  loadAllDays,
  loadCelebratedStreak,
  loadDay,
  loadMode,
  loadSettings,
  loadWeekendSkips,
  orderItems,
  recordCombinationUsed,
  requestPersistentStorage,
  saveCelebratedStreak,
  saveDay,
  saveMode,
  saveSettings,
  skipWeekendDays,
  todayKey,
  topFavorites,
  type HistoryEntry,
  type OrderItem,
} from "@/lib/storage";
import { Combination, DayEntry, DayMode, DayState, FoodItem, Macros, Settings } from "@/lib/types";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type Filter = "all" | "beef" | "chicken";
const isChicken = (f: FoodItem) => /chicken|nugget/i.test(f.id + f.name);
type NewEntry = Omit<DayEntry, "id" | "at">;

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toKey(d);
}

export default function HomePage() {
  const { t, lang, date: fmtDate } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<DayMode>("workday");
  const [day, setDay] = useState<DayState | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<{ date: string; groupId: string; qty: Record<string, number> } | null>(null);
  const [pay, setPay] = useState<PayRequest | null>(null);
  const [weekendDates, setWeekendDates] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [favorites, setFavorites] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [yesterday, setYesterday] = useState<DayState | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setMode(loadMode());
    setSettings(loadSettings());
    setDay(loadDay());
    setYesterday(loadDay(yesterdayKey()));
    setFavorites(topFavorites());
    requestPersistentStorage();
    const checkWeekend = () => setWeekendDates(pendingWeekendDays(loadAllDays(), loadWeekendSkips()));
    checkWeekend();
    // If the app stays open past midnight, roll over to a fresh day (yesterday stays in the archive).
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setDay((d) => (d && d.date !== todayKey() ? loadDay() : d));
      setYesterday(loadDay(yesterdayKey()));
      checkWeekend();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const showToast = useCallback((text: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /** Saves any day; keeps the on-screen day in sync when it's today. */
  const persistDay = useCallback((next: DayState) => {
    const clean = prunePayments(next);
    saveDay(clean);
    if (clean.date === todayKey()) setDay(clean);
  }, []);

  // Streak uses workday targets (it only counts Mon–Fri). Celebrate each new multiple of 5 once.
  useEffect(() => {
    if (!settings || !day) return;
    const s = weekdayStreak(loadAllDays(), settings.targets.workday);
    setStreak(s);
    const celebrated = loadCelebratedStreak();
    if (s < celebrated) saveCelebratedStreak(s - (s % STREAK_MILESTONE));
    else if (s > 0 && s % STREAK_MILESTONE === 0 && s > celebrated) {
      saveCelebratedStreak(s);
      setCelebrate(s);
    }
  }, [settings, day]);

  const targets = settings?.targets[mode];
  const eaten = useMemo(() => sumMacros(day?.entries.map((e) => e.macros) ?? []), [day]);
  const nadaCount = day?.entries.filter((e) => e.kind === "nada").length ?? 0;
  const usualAdded = day?.entries.some((e) => e.kind === "usual") ?? false;
  const eatenOn = useCallback(
    (date: string) => (date === day?.date ? eaten : sumMacros(loadDay(date).entries.map((e) => e.macros))),
    [day, eaten]
  );

  const nadaFood: FoodItem | null = useMemo(
    () =>
      settings && {
        id: "nada",
        name: "Nada Protein Milk",
        category: "nada",
        macros: { kcal: settings.nada.kcal, protein: settings.nada.protein, fat: settings.nada.fat, carbs: settings.nada.carbs },
        verified: true,
        enabled: true,
      },
    [settings]
  );

  const recommendations = useMemo<Combination[]>(() => {
    if (!settings || !targets) return [];
    return findRecommendations({
      eaten,
      targets,
      foods: settings.foods.filter((f) => (filter === "all" ? true : filter === "chicken" ? isChicken(f) : !isChicken(f))),
      nadaItem: nadaFood,
      nadaBottlesRemaining: settings.nada.maxPerDay - nadaCount,
    });
  }, [settings, targets, eaten, nadaFood, nadaCount, filter]);

  const dayName = (date: string) =>
    date === todayKey()
      ? t("today", "اليوم")
      : date === yesterdayKey()
        ? t("yesterday", "أمس")
        : fmtDate(fromKey(date), { weekday: "short", month: "short", day: "numeric" });

  /** Adds entries to any day. `group` forces a shared groupId (McDonald's orders, so they can carry a payment). */
  function addEntries(date: string, newEntries: NewEntry[], toastText: string, group = newEntries.length > 1): string | undefined {
    const target = date === day?.date ? day : loadDay(date);
    const groupId = group ? uid() : undefined;
    const stamped = newEntries.map((e) => ({ ...e, id: uid(), at: new Date().toISOString(), groupId }));
    const ids = new Set(stamped.map((e) => e.id));
    const next = { ...target, entries: [...target.entries, ...stamped] };
    persistDay(next);
    showToast(date === todayKey() ? toastText : `${toastText} → ${dayName(date)}`, () =>
      persistDay({ ...next, entries: next.entries.filter((e) => !ids.has(e.id)) })
    );
    return groupId;
  }

  function switchMode(next: DayMode) {
    setMode(next);
    saveMode(next);
  }

  function addUsualMeal() {
    if (!settings || usualAdded) return;
    const { label, ...m } = settings.usualMeal;
    addEntries(todayKey(), [{ kind: "usual", label, macros: m }], t(`Usual meal added · +${m.protein}g protein`, `أُضيفت وجبتك المعتادة · +${m.protein} جرام بروتين`));
  }

  function addNada() {
    if (!settings || !nadaFood || nadaCount >= settings.nada.maxPerDay) return;
    addEntries(
      todayKey(),
      [{ kind: "nada", label: "Nada Protein Milk", macros: nadaFood.macros }],
      t(`Nada ×${nadaCount + 1} · +${settings.nada.protein}g protein`, `ندى ×${nadaCount + 1} · +${settings.nada.protein} جرام بروتين`)
    );
  }

  function addCustom(label: string, macros: Macros, date: string, saveAsFavorite: boolean) {
    addEntries(date, [{ kind: "custom", label, macros }], `${label} · +${Math.round(macros.kcal)} kcal`);
    if (saveAsFavorite && settings && !settings.savedMeals.some((m) => m.name === label)) {
      const next = { ...settings, savedMeals: [...settings.savedMeals, { id: uid(), name: label, macros }] };
      setSettings(next);
      saveSettings(next);
    }
  }

  function setTotals(macros: Macros, date: string) {
    const prev = date === day?.date ? day : loadDay(date);
    persistDay({ ...prev, entries: [{ id: uid(), at: new Date().toISOString(), kind: "custom", label: t("Day totals", "مجموع اليوم"), macros }] });
    showToast(t("Totals set", "تم حفظ المجموع"), () => persistDay(prev));
  }

  function removeEntry(id: string) {
    if (!day) return;
    const prev = day;
    persistDay({ ...day, entries: day.entries.filter((e) => e.id !== id) });
    showToast(t("Removed", "انحذف"), () => persistDay(prev));
  }

  function removeGroup(groupId: string) {
    if (!day) return;
    const prev = day;
    persistDay({ ...day, entries: day.entries.filter((e) => e.groupId !== groupId) });
    showToast(t("Meal deleted", "انحذفت الوجبة"), () => persistDay(prev));
  }

  function undoLast() {
    if (!day || day.entries.length === 0) return;
    const last = day.entries[day.entries.length - 1];
    if (last.groupId) removeGroup(last.groupId);
    else removeEntry(last.id);
  }

  function resetDay() {
    if (!day || day.entries.length === 0) return;
    const prev = day;
    persistDay({ ...day, entries: [], payments: [] });
    setShowResults(false);
    showToast(t("Day reset", "انمسح اليوم"), () => persistDay(prev));
  }

  function copyYesterday() {
    if (!day || !yesterday?.entries.length) return;
    const prev = day;
    persistDay({ ...day, entries: [...day.entries, ...cloneEntries(yesterday.entries, uid)] });
    showToast(t("Copied yesterday 📋", "نسخت يوم أمس 📋"), () => persistDay(prev));
  }

  function openResults() {
    setShowResults(true);
    setShowAll(false);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** Logs a McDonald's order, remembers it for stats, then asks what it cost. */
  function logOrder(date: string, items: OrderItem[], nadaAsKind = true) {
    const entries: NewEntry[] = items.flatMap((it) =>
      Array.from({ length: it.qty }, () => ({
        kind: (it.id === "nada" && nadaAsKind ? "nada" : "mcdonalds") as DayEntry["kind"],
        label: it.name,
        macros: it.macros,
      }))
    );
    const key = items.map((i) => `${i.id}x${i.qty}`).sort().join("|");
    const label = items.map((i) => `${i.qty} × ${i.name}`).join(" + ");
    const total = sumMacros(items.map((i) => scaleMacros(i.macros, i.qty)));
    const orderId = addEntries(date, entries, `🍔 ${label} · +${Math.round(total.kcal)} kcal`, true)!;
    recordCombinationUsed(key, label, items);
    setFavorites(topFavorites());
    const mcdProtein = items.filter((i) => i.id !== "nada").reduce((n, i) => n + i.macros.protein * i.qty, 0);
    if (items.some((i) => i.id !== "nada")) {
      setPay({ date, orderId, label, kcal: total.kcal, protein: mcdProtein });
    }
  }

  function savePayment(amount: number, flags: PayFlags) {
    if (!pay) return;
    const target = pay.date === day?.date ? day : loadDay(pay.date);
    const payments = (target.payments ?? []).filter((p) => p.orderId !== pay.orderId);
    persistDay({ ...target, payments: [...payments, { id: uid(), orderId: pay.orderId, label: pay.label, amount, at: new Date().toISOString(), ...flags }] });
    setPay(null);
    showToast(t(`💰 ${amount} AED saved`, `💰 انحفظ ${amount} درهم`));
  }

  function selectCombination(combo: Combination) {
    logOrder(
      todayKey(),
      combo.items.map(({ food, qty }) => ({ id: food.id, name: food.name, qty, macros: food.macros }))
    );
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!settings || !day || !targets) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="h-10 w-10 rounded-full border-2 border-gold/20 border-t-gold"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  const r = roundMacros(eaten);
  const advice = smartAdvice(eaten, targets, recommendations.length > 0, lang);
  const maxNada = settings.nada.maxPerDay;
  const todayLabel = fmtDate(new Date(), { weekday: "long", month: "short", day: "numeric" });
  const yesterdayKcal = yesterday ? Math.round(sumMacros(yesterday.entries.map((e) => e.macros)).kcal) : 0;
  const iconBtn = "h-10 w-10 rounded-2xl glass flex items-center justify-center text-lg";
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekSpend = Math.round(costSummary(listDays(), toKey(weekAgo), todayKey(), settings.nada.price).total);

  return (
    <MotionConfig reducedMotion="user">
      <main className="max-w-md mx-auto px-4 pb-28" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-5">
          <div dir="ltr" className={lang === "ar" ? "text-right" : ""}>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="gold-text">McD</span> Macro
            </h1>
            <p className="text-xs text-muted mt-0.5" dir="auto">
              {todayLabel}
            </p>
            <Link href="/progress">
              <motion.span
                whileTap={{ scale: 0.92 }}
                dir="auto"
                className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  streak > 0 ? "bg-gradient-to-r from-[#ff5a1f]/25 to-gold/20 text-gold ring-1 ring-gold/30" : "bg-white/5 text-muted"
                }`}
              >
                <motion.span animate={streak > 0 ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 1.4, repeat: Infinity }}>
                  🔥
                </motion.span>
                {streak > 0 ? t(`${streak}-day streak`, `سلسلة ${streak} أيام`) : t("Start a streak", "ابدأ سلسلة")}
              </motion.span>
            </Link>
            <Link href="/spending" className="ms-1.5">
              <motion.span
                whileTap={{ scale: 0.92 }}
                dir="auto"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/25"
              >
                💰 {weekSpend} {t("AED · 7d", "درهم · 7 أيام")}
              </motion.span>
            </Link>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <motion.button
              whileTap={{ scale: 0.9, rotate: -180 }}
              onClick={async () => {
                showToast((await isUpdateAvailable()) ? t("Updating…", "جاري التحديث…") : t("Refreshing…", "جاري التحديث…"));
                setTimeout(reloadApp, 350);
              }}
              aria-label={t("Refresh app", "تحديث التطبيق")}
              className={`${iconBtn} text-muted`}
            >
              ↻
            </motion.button>
            <Link href="/progress" aria-label={t("Progress", "التقدم")}>
              <motion.div whileTap={{ scale: 0.9 }} className={iconBtn}>
                📈
              </motion.div>
            </Link>
            <Link href="/stats" aria-label={t("My stats", "إحصائياتي")}>
              <motion.div whileTap={{ scale: 0.9 }} className={iconBtn}>
                📊
              </motion.div>
            </Link>
            <Link href="/settings" aria-label={t("Settings", "الإعدادات")}>
              <motion.div whileTap={{ scale: 0.9, rotate: 60 }} className={iconBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </motion.div>
            </Link>
          </div>
        </motion.header>

        {/* Mode toggle */}
        <div className="relative grid grid-cols-2 p-1 rounded-2xl glass mb-6">
          {(["workday", "weekend"] as DayMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`relative py-2.5 text-sm font-bold transition-colors ${mode === m ? "text-black" : "text-muted"}`}
            >
              {mode === m && (
                <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <span className="relative">{m === "workday" ? t("💼 Workday", "💼 يوم دوام") : t("🌴 Weekend", "🌴 ويكند")}</span>
            </button>
          ))}
        </div>

        {/* Ring */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 20 }}>
          <CalorieRing eaten={r.kcal} target={targets.kcal} />
        </motion.div>

        {/* Macros */}
        <motion.div
          className="grid grid-cols-3 gap-2.5 mt-6"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}
        >
          {[
            { label: t("Protein", "بروتين"), value: Math.round(r.protein), target: targets.proteinMin, kind: "protein" as const },
            { label: t("Fat", "دهون"), value: r.fat, target: targets.fatMax, kind: "fat" as const },
            { label: t("Carbs", "كارب"), value: Math.round(r.carbs), target: targets.carbsRef, kind: "carbs" as const, suffix: "~" },
          ].map((m) => (
            <motion.div key={m.kind} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <MacroBar {...m} />
            </motion.div>
          ))}
        </motion.div>

        {/* Evening nudge: weekday after 7pm with protein still short */}
        {(() => {
          const now = new Date();
          const short = Math.round(targets.proteinMin - eaten.protein);
          if (now.getDay() % 6 === 0 || now.getHours() < 19 || short <= 0) return null;
          const nadaLeft = settings.nada.maxPerDay - nadaCount;
          const need = Math.ceil(short / settings.nada.protein);
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 rounded-2xl px-4 py-3 text-sm flex gap-3 items-center ring-1 ring-violet-400/30"
              style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(30,10,40,0.5))" }}
            >
              <motion.span className="text-2xl" animate={{ rotate: [0, -12, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                🌙
              </motion.span>
              <span className="flex-1 leading-5">
                <b>{t(`${short}g protein`, `${short} جرام بروتين`)}</b> {t("to go tonight", "باقية الليلة")}
                {streak > 0 ? t(` — protect your ${streak}-day streak`, ` — حافظ على سلسلة ${streak} أيام`) : ""}.
                {nadaLeft >= need && <span className="text-muted"> {t(`${need} Nada would do it.`, `${need} ندى تكفي.`)}</span>}
              </span>
            </motion.div>
          );
        })()}

        {/* Advice */}
        <AnimatePresence mode="wait">
          <motion.div
            key={advice}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
            className="mt-4 glass rounded-2xl px-4 py-3 text-sm flex gap-2.5 items-start"
          >
            <span className="text-gold">💡</span>
            <span className="leading-5">{advice}</span>
          </motion.div>
        </AnimatePresence>

        {/* Copy yesterday */}
        <AnimatePresence>
          {day.entries.length === 0 && !!yesterday?.entries.length && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={copyYesterday}
              className="mt-3 w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-start ring-1 ring-sky-400/30 bg-sky-400/10 overflow-hidden"
            >
              <span className="text-2xl">📋</span>
              <span className="flex-1">
                <span className="block font-bold text-sm">{t("Same as yesterday?", "نفس أمس؟")}</span>
                <span className="block text-[11px] text-muted">
                  {t(`Copy ${yesterday.entries.length} items · ${yesterdayKcal} kcal`, `انسخ ${yesterday.entries.length} عناصر · ${yesterdayKcal} سعرة`)}
                </span>
              </span>
              <span className="text-sky-300 font-bold text-sm">{t("Copy", "انسخ")}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addUsualMeal}
            disabled={usualAdded}
            className="glass rounded-2xl p-4 text-start disabled:opacity-40 transition-opacity"
          >
            <div className="text-2xl">🥣</div>
            <div className="font-bold mt-1.5">{usualAdded ? t("Usual meal ✓", "الوجبة المعتادة ✓") : t("+ Usual Meal", "+ وجبتي المعتادة")}</div>
            <div className="text-[11px] text-muted">
              {settings.usualMeal.kcal} kcal · {settings.usualMeal.protein}g P
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addNada}
            disabled={nadaCount >= maxNada}
            className="glass rounded-2xl p-4 text-start disabled:opacity-40 transition-opacity relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">🥛</span>
              <AnimatePresence mode="popLayout">
                {nadaCount > 0 && (
                  <motion.span
                    key={nadaCount}
                    initial={{ scale: 0.3, opacity: 0, y: -10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 1.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="text-xl font-black text-gold"
                  >
                    ×{nadaCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="font-bold mt-1.5">{t("+ Nada", "+ ندى")}</div>
            <div className="flex gap-1 mt-1.5">
              {Array.from({ length: maxNada }).map((_, i) => (
                <motion.span
                  key={i}
                  className="h-1.5 flex-1 rounded-full"
                  animate={{ backgroundColor: i < nadaCount ? "#ffc72c" : "rgba(255,255,255,0.1)", scaleY: i === nadaCount - 1 ? [1, 2, 1] : 1 }}
                  transition={{ duration: 0.4 }}
                />
              ))}
            </div>
          </motion.button>
        </div>

        {/* Saved quick meals */}
        {settings.savedMeals.length > 0 && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {settings.savedMeals.map((m, i) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => addEntries(todayKey(), [{ kind: "custom", label: m.name, macros: m.macros }], `⭐ ${m.name} · +${Math.round(m.macros.kcal)} kcal`)}
                className="shrink-0 glass rounded-2xl px-3.5 py-2.5 text-start"
              >
                <div className="text-sm font-bold whitespace-nowrap">⭐ {m.name}</div>
                <div className="text-[10px] text-muted whitespace-nowrap">
                  {Math.round(m.macros.kcal)} kcal · {Math.round(m.macros.protein)}g P
                </div>
              </motion.button>
            ))}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setMenuOpen(true)}
          className="mt-2.5 w-full rounded-2xl p-4 flex items-center gap-3 text-start ring-1 ring-gold/30"
          style={{ background: "linear-gradient(135deg,rgba(255,199,44,0.16),rgba(218,41,28,0.12))" }}
        >
          <motion.span
            className="h-10 w-10 rounded-xl bg-gold text-xl flex items-center justify-center"
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 3 }}
          >
            🍟
          </motion.span>
          <span className="flex-1">
            <span className="block font-bold">{t("Pick from McDonald's menu", "اختار من منيو ماك")}</span>
            <span className="block text-[11px] text-muted">
              {t("Choose items yourself — today or a past day", "اختار الأصناف بنفسك — لليوم أو ليوم فات")}
            </span>
          </span>
          <span className="text-gold rtl:rotate-180">›</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setSheetOpen(true)}
          className="mt-2.5 w-full glass rounded-2xl p-4 flex items-center gap-3 text-start"
        >
          <span className="h-10 w-10 rounded-xl bg-gold/15 text-gold text-xl font-black flex items-center justify-center">+</span>
          <span className="flex-1">
            <span className="block font-bold">{t("Ate something else?", "أكلت شي ثاني؟")}</span>
            <span className="block text-[11px] text-muted">
              {t("Protein · carbs · fat — calories auto. Any day.", "بروتين · كارب · دهون — السعرات تلقائي. لأي يوم.")}
            </span>
          </span>
          <span className="text-muted rtl:rotate-180">›</span>
        </motion.button>

        <Link href="/stats?tab=days" className="block mt-2.5">
          <motion.div whileTap={{ scale: 0.97 }} className="w-full glass rounded-2xl p-4 flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-sky-400/15 text-xl flex items-center justify-center">📅</span>
            <span className="flex-1">
              <span className="block font-bold">{t("Log a past day", "سجّل يوم فات")}</span>
              <span className="block text-[11px] text-muted">
                {t("Forgot a day? Add what you ate on any date", "نسيت يوم؟ أضف اللي أكلته لأي تاريخ")}
              </span>
            </span>
            <span className="text-muted rtl:rotate-180">›</span>
          </motion.div>
        </Link>

        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={undoLast}
            disabled={day.entries.length === 0}
            className="rounded-2xl py-3 text-sm font-semibold text-muted bg-white/[0.03] ring-1 ring-white/5 disabled:opacity-30"
          >
            {t("↶ Undo Last", "↶ تراجع")}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetDay}
            disabled={day.entries.length === 0}
            className="rounded-2xl py-3 text-sm font-semibold text-muted bg-white/[0.03] ring-1 ring-white/5 disabled:opacity-30"
          >
            {t("⟲ Reset Day", "⟲ امسح اليوم")}
          </motion.button>
        </div>

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.01 }}
          onClick={openResults}
          className="cta-shimmer mt-6 w-full rounded-xl3 py-5 font-black text-lg text-white tracking-tight shadow-[0_18px_40px_-12px_rgba(218,41,28,0.7)]"
          style={{ background: "linear-gradient(135deg,#ff4d3d 0%,#da291c 50%,#a3160c 100%)" }}
        >
          <motion.span className="inline-block me-2" animate={{ rotate: [0, -12, 12, -6, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2.5 }}>
            🍔
          </motion.span>
          {t("WHAT SHOULD I GET FROM McDONALD'S?", "وش آخذ من ماكدونالدز؟")}
        </motion.button>
        <Link href="/quick" className="block mt-2.5">
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-2xl py-3 text-center text-sm font-bold text-gold ring-1 ring-gold/25 bg-gold/5"
          >
            ⚡ {t("In the queue? Quick mode — top 3, big text", "واقف بالطابور؟ الوضع السريع — أفضل 3 بخط كبير")}
          </motion.div>
        </Link>

        {/* Results */}
        <div ref={resultsRef} className="scroll-mt-4">
          <AnimatePresence>
            {showResults && (
              <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center justify-between mt-7 mb-3">
                  <h2 className="text-lg font-black">{t("Your best orders", "أفضل طلبات لك")}</h2>
                  <button onClick={() => setShowResults(false)} className="text-xs text-muted px-2 py-1">
                    {t("Hide", "إخفاء")}
                  </button>
                </div>
                <div className="relative grid grid-cols-3 p-1 rounded-2xl glass mb-4">
                  {(["all", "beef", "chicken"] as Filter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFilter(f);
                        setShowAll(false);
                      }}
                      className={`relative py-2 text-xs font-bold transition-colors ${filter === f ? "text-black" : "text-muted"}`}
                    >
                      {filter === f && (
                        <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                      )}
                      <span className="relative">
                        {f === "all" ? t("🍔 All", "🍔 الكل") : f === "beef" ? t("🥩 Beef", "🥩 لحم") : t("🍗 Chicken", "🍗 دجاج")}
                      </span>
                    </button>
                  ))}
                </div>
                {recommendations.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl3 p-5">
                    <p className="font-bold mb-3">{t("No exact McDonald's combination fits.", "ما في طلب من ماك يناسب بالضبط.")}</p>
                    <p className="text-xs text-muted mb-2">{t("Remaining:", "الباقي:")}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { k: t("kcal", "سعرة"), v: Math.max(0, Math.round(targets.kcal - eaten.kcal)) },
                        { k: t("protein", "بروتين"), v: Math.max(0, Math.round(targets.proteinMin - eaten.protein)) },
                        { k: t("fat", "دهون"), v: Math.max(0, Math.round(targets.fatMax - eaten.fat)) },
                        { k: t("carbs", "كارب"), v: Math.max(0, Math.round(targets.carbsRef - eaten.carbs)) },
                      ].map((s) => (
                        <div key={s.k} className="rounded-xl bg-white/[0.04] py-2">
                          <div className="font-extrabold">{s.v}</div>
                          <div className="text-[10px] uppercase text-muted">{s.k}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted mt-3">{t("Finish the remaining macros yourself.", "كمّل الماكروز الباقية بنفسك.")}</p>
                  </motion.div>
                ) : (
                  <LayoutGroup>
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {recommendations.slice(0, showAll ? undefined : 5).map((combo, i) => (
                          <RecommendationCard
                            key={`${filter}:${combinationKey(combo)}`}
                            combo={combo}
                            index={showAll && i >= 5 ? i - 5 : i}
                            proteinTarget={targets.proteinMin}
                            history={historyFor(combinationKey(combo))}
                            onSelect={() => selectCombination(combo)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                    {!showAll && recommendations.length > 5 && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowAll(true)}
                        className="mt-3 w-full rounded-2xl py-3.5 text-sm font-bold text-gold ring-1 ring-gold/30 bg-gold/5"
                      >
                        {t(`Show ${recommendations.length - 5} more options ↓`, `اعرض ${recommendations.length - 5} خيارات زيادة ↓`)}
                      </motion.button>
                    )}
                  </LayoutGroup>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Favorites — tap + to order again */}
        {favorites.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted uppercase tracking-[0.16em]">⭐ {t("Your Favorites", "مفضلاتك")}</h2>
              <Link href="/stats?tab=orders" className="text-xs font-bold text-gold">
                {t("See all →", "الكل ←")}
              </Link>
            </div>
            <div className="space-y-2">
              {favorites.map((f, i) => {
                const items = orderItems(f, settings.foods, settings.nada);
                const kcal = Math.round(sumMacros(items.map((it) => scaleMacros(it.macros, it.qty))).kcal);
                return (
                  <motion.div
                    key={f.key}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass rounded-2xl ps-4 pe-2 py-2.5 flex items-center gap-3"
                  >
                    <span className="text-gold font-black">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm">{f.label}</span>
                      <span className="block text-[11px] text-muted">
                        {kcal} kcal · ×{f.count}
                      </span>
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      disabled={!items.length}
                      onClick={() => logOrder(todayKey(), items)}
                      className="rounded-xl bg-gold text-black text-xs font-extrabold px-3 py-2 disabled:opacity-30"
                    >
                      {t("↻ Again", "↻ مرة ثانية")}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Today's log */}
        {day.entries.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted uppercase tracking-[0.16em]">{t("Today", "اليوم")}</h2>
              <Link href="/stats?tab=days" className="text-xs font-bold text-gold">
                {t("Past days →", "الأيام السابقة ←")}
              </Link>
            </div>
            <DayLog
              entries={day.entries}
              payments={day.payments}
              onRemoveEntry={removeEntry}
              onRemoveGroup={removeGroup}
              onEditOrder={(groupId) => setEditing({ date: day.date, groupId, qty: orderQty(day, groupId, settings.foods) })}
              onEditPayment={(orderId, label) => {
                const items = day.entries.filter((e) => e.groupId === orderId && e.kind === "mcdonalds");
                setPay({
                  date: day.date,
                  orderId,
                  label,
                  kcal: sumMacros(items.map((e) => e.macros)).kcal,
                  protein: items.reduce((n, e) => n + e.macros.protein, 0),
                });
              }}
            />
            <DayCostBar day={day} nadaPrice={settings.nada.price} />
          </section>
        )}

        <footer className="text-center text-[11px] text-muted/70 mt-12">
          {t("Personal nutrition planning tool. Not affiliated with McDonald's.", "أداة شخصية لتخطيط التغذية. غير تابعة لماكدونالدز.")}
        </footer>
      </main>

      <McMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        foods={settings.foods.filter((f) => f.enabled && f.verified)}
        eatenOn={eatenOn}
        targets={targets}
        onAdd={(lines, date) =>
          logOrder(
            date,
            lines.map((l) => ({ id: l.food.id, name: l.food.name, qty: l.qty, macros: l.food.macros }))
          )
        }
      />
      <McMenuSheet
        open={!!editing}
        initialDate={editing?.date}
        initialQty={editing?.qty}
        onClose={() => setEditing(null)}
        foods={settings.foods.filter((f) => f.enabled && f.verified)}
        eatenOn={eatenOn}
        targets={targets}
        onAdd={(lines) => {
          if (!editing) return;
          const res = editOrder(editing.date, editing.groupId, lines, settings.foods, uid);
          if (editing.date === todayKey()) setDay(res.after);
          setFavorites(topFavorites());
          showToast(t("✏️ Order updated", "✏️ انعدّل الطلب"), () => {
            res.undo();
            setDay(loadDay());
            setFavorites(topFavorites());
          });
        }}
      />
      <AddFoodSheet
        open={sheetOpen}
        savedMeals={settings.savedMeals}
        onClose={() => setSheetOpen(false)}
        onAdd={addCustom}
        onSetTotals={setTotals}
      />
      <PaySheet request={pay} recentAmounts={pay ? recentAmounts(listDays()) : []} onSave={savePayment} onSkip={() => setPay(null)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <UpdateBanner />
      <WeekendCheckIn dates={weekendDates} onSave={saveWeekend} />
      <Celebration streak={celebrate} onDone={() => setCelebrate(null)} />
    </MotionConfig>
  );

  function saveWeekend(logs: { date: string; macros: Macros }[], skipped: string[]) {
    for (const { date, macros } of logs) {
      saveDay({ date, entries: [{ id: uid(), at: new Date().toISOString(), kind: "custom", label: t("Weekend totals", "مجموع الويكند"), macros }] });
    }
    if (skipped.length) skipWeekendDays(skipped);
    setWeekendDates([]);
    showToast(
      logs.length
        ? t(`Weekend saved · ${logs.length} ${logs.length === 1 ? "day" : "days"} 🌴`, `انحفظ الويكند · ${logs.length} ${logs.length === 1 ? "يوم" : "أيام"} 🌴`)
        : t("Got it — weekend skipped", "تمام — تخطينا الويكند")
    );
  }
}
