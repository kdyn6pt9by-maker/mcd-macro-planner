"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddFoodSheet } from "@/components/AddFoodSheet";
import { McMenuSheet } from "@/components/McMenuSheet";
import { DayLog } from "@/components/DayLog";
import { Celebration } from "@/components/Celebration";
import { UpdateBanner, isUpdateAvailable, reloadApp } from "@/components/UpdateBanner";
import { WeekendCheckIn } from "@/components/WeekendCheckIn";
import { STREAK_MILESTONE, pendingWeekendDays, weekdayStreak } from "@/lib/progress";
import { CalorieRing } from "@/components/CalorieRing";
import { MacroBar } from "@/components/MacroBar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { Toast, ToastData } from "@/components/Toast";
import { smartAdvice } from "@/lib/engine/advice";
import { roundMacros, sumMacros } from "@/lib/engine/macros";
import { combinationKey, combinationLabel, findRecommendations } from "@/lib/engine/optimizer";
import {
  loadDay,
  loadMode,
  loadSettings,
  loadAllDays,
  loadCelebratedStreak,
  loadWeekendSkips,
  recordCombinationUsed,
  requestPersistentStorage,
  saveCelebratedStreak,
  skipWeekendDays,
  todayKey,
  saveDay,
  saveMode,
  historyFor,
  topFavorites,
  type HistoryEntry,
} from "@/lib/storage";
import { Combination, DayEntry, DayMode, DayState, FoodItem, Macros, Settings } from "@/lib/types";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

type Filter = "all" | "beef" | "chicken";
const isChicken = (f: FoodItem) => /chicken|nugget/i.test(f.id + f.name);


export default function HomePage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<DayMode>("workday");
  const [day, setDay] = useState<DayState | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [weekendDates, setWeekendDates] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [favorites, setFavorites] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setMode(loadMode());
    setSettings(loadSettings());
    setDay(loadDay());
    setFavorites(topFavorites());
    requestPersistentStorage();
    // If the app stays open past midnight, roll over to a fresh day (yesterday stays in the archive).
    const checkWeekend = () => setWeekendDates(pendingWeekendDays(loadAllDays(), loadWeekendSkips()));
    checkWeekend();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setDay((d) => (d && d.date !== todayKey() ? loadDay() : d));
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

  const persist = useCallback((next: DayState) => {
    setDay(next);
    saveDay(next);
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

  function saveWeekend(logs: { date: string; macros: Macros }[], skipped: string[]) {
    for (const { date, macros } of logs) {
      saveDay({ date, entries: [{ id: uid(), at: new Date().toISOString(), kind: "custom", label: "Weekend totals", macros }] });
    }
    if (skipped.length) skipWeekendDays(skipped);
    setWeekendDates([]);
    showToast(logs.length ? `Weekend saved · ${logs.length} ${logs.length === 1 ? "day" : "days"} 🌴` : "Got it — weekend skipped");
  }

  const targets = settings?.targets[mode];
  const eaten = useMemo(() => sumMacros(day?.entries.map((e) => e.macros) ?? []), [day]);
  const nadaCount = day?.entries.filter((e) => e.kind === "nada").length ?? 0;
  const usualAdded = day?.entries.some((e) => e.kind === "usual") ?? false;

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
      foods: settings.foods.filter((f) =>
        filter === "all" ? true : filter === "chicken" ? isChicken(f) : !isChicken(f)
      ),
      nadaItem: nadaFood,
      nadaBottlesRemaining: settings.nada.maxPerDay - nadaCount,
    });
  }, [settings, targets, eaten, nadaFood, nadaCount, filter]);

  function addEntries(newEntries: Omit<DayEntry, "id" | "at">[], toastText: string) {
    if (!day) return;
    const groupId = newEntries.length > 1 ? uid() : undefined;
    const stamped = newEntries.map((e) => ({ ...e, id: uid(), at: new Date().toISOString(), groupId }));
    const ids = new Set(stamped.map((e) => e.id));
    const next = { ...day, entries: [...day.entries, ...stamped] };
    persist(next);
    showToast(toastText, () => persist({ ...next, entries: next.entries.filter((e) => !ids.has(e.id)) }));
  }

  function switchMode(next: DayMode) {
    setMode(next);
    saveMode(next);
  }

  function addUsualMeal() {
    if (!settings || usualAdded) return;
    const { label, ...m } = settings.usualMeal;
    addEntries([{ kind: "usual", label, macros: m }], `Usual meal added · +${m.protein}g protein`);
  }

  function addNada() {
    if (!settings || !nadaFood || nadaCount >= settings.nada.maxPerDay) return;
    addEntries(
      [{ kind: "nada", label: "Nada Protein Milk", macros: nadaFood.macros }],
      `Nada ×${nadaCount + 1} · +${settings.nada.protein}g protein`
    );
  }

  function addCustom(label: string, macros: Macros) {
    addEntries([{ kind: "custom", label, macros }], `${label} · +${Math.round(macros.kcal)} kcal`);
  }

  function setTotals(macros: Macros) {
    if (!day) return;
    const prev = day;
    persist({ ...day, entries: [{ id: uid(), at: new Date().toISOString(), kind: "custom", label: "Today's totals", macros }] });
    showToast("Today's totals set", () => persist(prev));
  }

  function removeEntry(id: string) {
    if (!day) return;
    const prev = day;
    persist({ ...day, entries: day.entries.filter((e) => e.id !== id) });
    showToast("Removed", () => persist(prev));
  }

  function removeGroup(groupId: string) {
    if (!day) return;
    const prev = day;
    persist({ ...day, entries: day.entries.filter((e) => e.groupId !== groupId) });
    showToast("Meal deleted", () => persist(prev));
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
    persist({ ...day, entries: [] });
    setShowResults(false);
    showToast("Day reset", () => persist(prev));
  }

  function openResults() {
    setShowResults(true);
    setShowAll(false);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function addFromMenu(lines: { food: FoodItem; qty: number }[]) {
    const entries: Omit<DayEntry, "id" | "at">[] = [];
    for (const { food, qty } of lines) {
      for (let i = 0; i < qty; i++) entries.push({ kind: "mcdonalds", label: food.name, macros: food.macros });
    }
    const key = lines.map((l) => `${l.food.id}x${l.qty}`).sort().join("|");
    const label = lines.map((l) => `${l.qty} × ${l.food.name}`).join(" + ");
    const kcal = Math.round(entries.reduce((n, e) => n + e.macros.kcal, 0));
    addEntries(entries, `🍔 ${label} · +${kcal} kcal`);
    recordCombinationUsed(
      key,
      label,
      lines.map((l) => ({ id: l.food.id, name: l.food.name, qty: l.qty, macros: l.food.macros }))
    );
    setFavorites(topFavorites());
  }

  function selectCombination(combo: Combination) {
    const key = combinationKey(combo);
    const label = combinationLabel(combo);
    const entries: Omit<DayEntry, "id" | "at">[] = [];
    for (const { food, qty } of combo.items) {
      for (let i = 0; i < qty; i++) {
        entries.push({ kind: food.category === "nada" ? "nada" : "mcdonalds", label: food.name, macros: food.macros });
      }
    }
    addEntries(entries, `Enjoy! ${label}`);
    recordCombinationUsed(
      key,
      label,
      combo.items.map(({ food, qty }) => ({ id: food.id, name: food.name, qty, macros: food.macros }))
    );
    setFavorites(topFavorites());
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
  const advice = smartAdvice(eaten, targets, recommendations.length > 0);
  const maxNada = settings.nada.maxPerDay;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <MotionConfig reducedMotion="user">
      <main
        className="max-w-md mx-auto px-4 pb-28"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="gold-text">McD</span> Macro
            </h1>
            <p className="text-xs text-muted mt-0.5">{today}</p>
            <Link href="/progress">
              <motion.span
                whileTap={{ scale: 0.92 }}
                className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  streak > 0 ? "bg-gradient-to-r from-[#ff5a1f]/25 to-gold/20 text-gold ring-1 ring-gold/30" : "bg-white/5 text-muted"
                }`}
              >
                <motion.span animate={streak > 0 ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 1.4, repeat: Infinity }}>
                  🔥
                </motion.span>
                {streak > 0 ? `${streak}-day streak` : "Start a streak"}
              </motion.span>
            </Link>
          </div>
          <div className="flex gap-1.5 shrink-0">
          <motion.button
            whileTap={{ scale: 0.9, rotate: -180 }}
            onClick={async () => {
              showToast((await isUpdateAvailable()) ? "Updating…" : "Refreshing…");
              setTimeout(reloadApp, 350);
            }}
            aria-label="Refresh app"
            className="h-10 w-10 rounded-2xl glass flex items-center justify-center text-lg text-muted"
          >
            ↻
          </motion.button>
          <Link href="/progress" aria-label="Progress">
            <motion.div whileTap={{ scale: 0.9 }} className="h-10 w-10 rounded-2xl glass flex items-center justify-center text-lg">
              📈
            </motion.div>
          </Link>
          <Link href="/stats" aria-label="My stats">
            <motion.div whileTap={{ scale: 0.9 }} className="h-10 w-10 rounded-2xl glass flex items-center justify-center text-lg">
              📊
            </motion.div>
          </Link>
          <Link href="/settings" aria-label="Settings">
            <motion.div
              whileTap={{ scale: 0.9, rotate: 60 }}
              className="h-10 w-10 rounded-2xl glass flex items-center justify-center"
            >
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
              className={`relative py-2.5 text-sm font-bold capitalize transition-colors ${mode === m ? "text-black" : "text-muted"}`}
            >
              {mode === m && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 rounded-xl bg-gold"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative">{m === "workday" ? "💼 Workday" : "🌴 Weekend"}</span>
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
            { label: "Protein", value: Math.round(r.protein), target: targets.proteinMin, kind: "protein" as const },
            { label: "Fat", value: r.fat, target: targets.fatMax, kind: "fat" as const },
            { label: "Carbs", value: Math.round(r.carbs), target: targets.carbsRef, kind: "carbs" as const, suffix: "~" },
          ].map((m) => (
            <motion.div key={m.label} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
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
                <b>{short}g protein</b> to go tonight{streak > 0 ? ` — protect your ${streak}-day streak` : ""}.
                {nadaLeft > 0 && short <= settings.nada.protein * nadaLeft && (
                  <span className="text-muted"> {Math.ceil(short / settings.nada.protein)} Nada would do it.</span>
                )}
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

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addUsualMeal}
            disabled={usualAdded}
            className="glass rounded-2xl p-4 text-left disabled:opacity-40 transition-opacity"
          >
            <div className="text-2xl">🥣</div>
            <div className="font-bold mt-1.5">{usualAdded ? "Usual meal ✓" : "+ Usual Meal"}</div>
            <div className="text-[11px] text-muted">{settings.usualMeal.kcal} kcal · {settings.usualMeal.protein}g P</div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addNada}
            disabled={nadaCount >= maxNada}
            className="glass rounded-2xl p-4 text-left disabled:opacity-40 transition-opacity relative overflow-hidden"
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
            <div className="font-bold mt-1.5">+ Nada</div>
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

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setMenuOpen(true)}
          className="mt-2.5 w-full rounded-2xl p-4 flex items-center gap-3 text-left ring-1 ring-gold/30"
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
            <span className="block font-bold">Pick from McDonald&apos;s menu</span>
            <span className="block text-[11px] text-muted">Choose items yourself — one meal, not the whole day</span>
          </span>
          <span className="text-gold">›</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setSheetOpen(true)}
          className="mt-2.5 w-full glass rounded-2xl p-4 flex items-center gap-3 text-left"
        >
          <span className="h-10 w-10 rounded-xl bg-gold/15 text-gold text-xl font-black flex items-center justify-center">+</span>
          <span className="flex-1">
            <span className="block font-bold">Ate something else?</span>
            <span className="block text-[11px] text-muted">Enter protein · carbs · fat — calories auto-calculated</span>
          </span>
          <span className="text-muted">›</span>
        </motion.button>

        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={undoLast}
            disabled={day.entries.length === 0}
            className="rounded-2xl py-3 text-sm font-semibold text-muted bg-white/[0.03] ring-1 ring-white/5 disabled:opacity-30"
          >
            ↶ Undo Last
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={resetDay}
            disabled={day.entries.length === 0}
            className="rounded-2xl py-3 text-sm font-semibold text-muted bg-white/[0.03] ring-1 ring-white/5 disabled:opacity-30"
          >
            ⟲ Reset Day
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
          <motion.span
            className="inline-block mr-2"
            animate={{ rotate: [0, -12, 12, -6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2.5 }}
          >
            🍔
          </motion.span>
          WHAT SHOULD I GET FROM McDONALD'S?
        </motion.button>

        {/* Results */}
        <div ref={resultsRef} className="scroll-mt-4">
          <AnimatePresence>
            {showResults && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between mt-7 mb-3">
                  <h2 className="text-lg font-black">Your best orders</h2>
                  <button onClick={() => setShowResults(false)} className="text-xs text-muted px-2 py-1">
                    Hide
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
                        <motion.span
                          layoutId="filter-pill"
                          className="absolute inset-0 rounded-xl bg-gold"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <span className="relative">{f === "all" ? "🍔 All" : f === "beef" ? "🥩 Beef" : "🍗 Chicken"}</span>
                    </button>
                  ))}
                </div>
                {recommendations.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl3 p-5">
                    <p className="font-bold mb-3">No exact McDonald's combination fits.</p>
                    <p className="text-xs text-muted mb-2">Remaining:</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { k: "kcal", v: Math.max(0, Math.round(targets.kcal - eaten.kcal)) },
                        { k: "protein", v: Math.max(0, Math.round(targets.proteinMin - eaten.protein)) },
                        { k: "fat", v: Math.max(0, Math.round(targets.fatMax - eaten.fat)) },
                        { k: "carbs", v: Math.max(0, Math.round(targets.carbsRef - eaten.carbs)) },
                      ].map((s) => (
                        <div key={s.k} className="rounded-xl bg-white/[0.04] py-2">
                          <div className="font-extrabold">{s.v}</div>
                          <div className="text-[10px] uppercase text-muted">{s.k}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted mt-3">Finish the remaining macros yourself.</p>
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
                        Show {recommendations.length - 5} more options ↓
                      </motion.button>
                    )}
                  </LayoutGroup>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted uppercase tracking-[0.16em]">⭐ Your Favorites</h2>
              <Link href="/stats" className="text-xs font-bold text-gold">See all →</Link>
            </div>
            <div className="space-y-2">
              {favorites.map((f, i) => (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-gold font-black">{i + 1}</span>
                  <span className="flex-1 text-sm">{f.label}</span>
                  <span className="text-[11px] text-muted">×{f.count}</span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Today's log */}
        {day.entries.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted uppercase tracking-[0.16em]">Today</h2>
              <Link href="/stats?tab=days" className="text-xs font-bold text-gold">
                Past days →
              </Link>
            </div>
            <DayLog entries={day.entries} onRemoveEntry={removeEntry} onRemoveGroup={removeGroup} />
          </section>
        )}

        <footer className="text-center text-[11px] text-muted/70 mt-12">
          Personal nutrition planning tool. Not affiliated with McDonald's.
        </footer>
      </main>

      <McMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        foods={settings.foods.filter((f) => f.enabled && f.verified)}
        eaten={eaten}
        targets={targets}
        onAdd={addFromMenu}
      />
      <AddFoodSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addCustom} onSetTotals={setTotals} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <UpdateBanner />
      <WeekendCheckIn dates={weekendDates} onSave={saveWeekend} />
      <Celebration streak={celebrate} onDone={() => setCelebrate(null)} />
    </MotionConfig>
  );
}
