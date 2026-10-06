"use client";

import { DayBarLive } from "@/components/DayBar";
import { buildPriceBook, fmtAed, orderPrice } from "@/lib/prices";
import { ProgressTabs } from "@/components/ProgressTabs";
import { effectiveTargets } from "@/lib/goals";
import { foodEmoji } from "@/lib/foodEmoji";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { DayLog } from "@/components/DayLog";
import { DayCostBar } from "@/components/DayCostBar";
import { BarcodeSheet } from "@/components/BarcodeSheet";
import { relativeDay } from "@/components/RecommendationCard";
import { Toast, ToastData } from "@/components/Toast";
import { roundMacros, scaleMacros, sumMacros } from "@/lib/engine/macros";
import {
  deleteDay,
  deleteHistoryEntry,
  itemTotals,
  listDays,
  loadHistory,
  loadSettings,
  orderItems,
  recordCombinationUsed,
  saveDay,
  saveSettings,
  todayKey,
  type HistoryEntry,
} from "@/lib/storage";
import { DayState, FoodItem, Macros, Settings } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { hasEsaad, prunePayments, recentAmounts } from "@/lib/insights";
import { appendToDay, editOrder, orderQty, setDayTotals, setPayment, type NewEntry } from "@/lib/logging";
import { AddFoodSheet } from "@/components/AddFoodSheet";
import { McMenuSheet } from "@/components/McMenuSheet";
import { PayRequest, PaySheet } from "@/components/PaySheet";
import { fromKey, toKey } from "@/lib/progress";
import { useCallback, useMemo } from "react";

type Tab = "items" | "orders" | "days";
const MEDALS = ["🥇", "🥈", "🥉"];

function MacroGrid({ m }: { m: Macros }) {
  const { t } = useI18n();
  const r = roundMacros(m);
  return (
    <div className="grid grid-cols-4 gap-1.5 text-center">
      {[
        { k: t("kcal", "سعرة"), v: r.kcal, c: "text-gold" },
        { k: t("protein", "بروتين"), v: r.protein, c: "text-success" },
        { k: t("fat", "دهون"), v: r.fat, c: "text-warn" },
        { k: t("carbs", "كارب"), v: r.carbs, c: "text-carb" },
      ].map((s) => (
        <div key={s.k} className="rounded-xl bg-white/[0.04] py-1.5">
          <div className={`font-extrabold ${s.c}`}>{s.v}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted">{s.k}</div>
        </div>
      ))}
    </div>
  );
}

function Rank({ i }: { i: number }) {
  return (
    <span className="w-7 text-center text-lg">
      {MEDALS[i] ?? <span className="text-sm text-muted font-bold">{i + 1}</span>}
    </span>
  );
}

function dayTitle(date: string, ar = false) {
  if (date === todayKey()) return ar ? "اليوم" : "Today";
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString(ar ? "ar-AE-u-nu-latn" : "en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function StatsPage() {
  const { t, ar } = useI18n();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [days, setDays] = useState<DayState[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [logDate, setLogDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toKey(d);
  });
  const [sheet, setSheet] = useState<"food" | "menu" | "scan" | null>(null);
  const [pay, setPay] = useState<PayRequest | null>(null);
  const [editing, setEditing] = useState<{ date: string; groupId: string; qty: Record<string, number> } | null>(null);
  const prices = useMemo(() => (settings ? buildPriceBook(days, settings.foods) : null), [days, settings]);
  const eatenOn = useCallback((date: string) => sumMacros(listDays().find((d) => d.date === date)?.entries.map((e) => e.macros) ?? []), []);

  const refresh = () => {
    setHistory(loadHistory());
    setDays(listDays());
  };

  useEffect(() => {
    refresh();
    setSettings(loadSettings());
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "orders" || t === "days" || t === "items") setTab(t);
  }, []);

  function afterLog(date: string, text: string) {
    refresh();
    setTab("days");
    setOpen(date);
    showToast(text);
  }

  if (!history || !settings) return null;

  const showToast = (text: string, undo?: () => void) => {
    setToast({ id: Date.now(), text, undo });
    setTimeout(() => setToast((cur) => (cur?.text === text ? null : cur)), 3500);
  };

  const nameOf = (id: string) =>
    id === "nada" ? t("Nada Protein Milk", "حليب ندى بروتين") : settings.foods.find((f) => f.id === id)?.name ?? id;
  const items = itemTotals(history);
  const orders = [...history].sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed));
  const totalOrders = history.reduce((n, h) => n + h.count, 0);
  const maxItem = items[0]?.count ?? 1;

  function removeOrder(o: HistoryEntry) {
    deleteHistoryEntry(o.key);
    refresh();
    showToast(t("Order removed from stats", "انشال الطلب من الإحصائيات"), () => {
      for (let i = 0; i < o.count; i++) recordCombinationUsed(o.key, o.label, o.items);
      refresh();
    });
  }

  function removeDay(d: DayState) {
    deleteDay(d.date);
    refresh();
    showToast(t(`${dayTitle(d.date)} deleted`, `انحذف ${dayTitle(d.date, true)}`), () => {
      saveDay(d);
      refresh();
    });
  }

  function updateDay(d: DayState, entries: DayState["entries"]) {
    saveDay(prunePayments({ ...d, entries }));
    refresh();
    showToast(t("Removed", "انحذف"), () => {
      saveDay(d);
      refresh();
    });
  }

  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const dayName = (date: string) => dayTitle(date, ar);

  function addFood(label: string, macros: Macros, date: string, saveAsFavorite: boolean) {
    appendToDay(date, [{ kind: "custom", label, macros }], false, uid);
    if (saveAsFavorite && !settings!.savedMeals.some((m) => m.name === label)) {
      const next = { ...settings!, savedMeals: [...settings!.savedMeals, { id: uid(), name: label, macros }] };
      saveSettings(next);
      setSettings(next);
    }
    afterLog(date, t(`${label} → ${dayName(date)}`, `${label} ← ${dayName(date)}`));
  }

  function setTotals(macros: Macros, date: string) {
    setDayTotals(date, t("Day totals", "مجموع اليوم"), macros, uid);
    afterLog(date, t(`Totals saved for ${dayName(date)}`, `انحفظ مجموع ${dayName(date)}`));
  }

  function addOrder(lines: { food: FoodItem; qty: number }[], date: string) {
    const entries: NewEntry[] = lines.flatMap((l) => Array.from({ length: l.qty }, () => ({ kind: "mcdonalds" as const, label: l.food.name, macros: l.food.macros })));
    const { groupId } = appendToDay(date, entries, true, uid);
    const label = lines.map((l) => `${l.qty} × ${l.food.name}`).join(" + ");
    recordCombinationUsed(
      lines.map((l) => `${l.food.id}x${l.qty}`).sort().join("|"),
      label,
      lines.map((l) => ({ id: l.food.id, name: l.food.name, qty: l.qty, macros: l.food.macros }))
    );
    afterLog(date, t(`🍔 Added to ${dayName(date)}`, `🍔 انضاف لـ ${dayName(date)}`));
    setPay({
      date,
      orderId: groupId!,
      label,
      kcal: entries.reduce((n, e) => n + e.macros.kcal, 0),
      protein: entries.reduce((n, e) => n + e.macros.protein, 0),
    });
  }


  function addNada(date: string) {
    const n = settings!.nada;
    appendToDay(date, [{ kind: "nada", label: "Nada Protein Milk", macros: { kcal: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs } }], false, uid);
    afterLog(date, t(`🥛 Nada → ${dayName(date)}`, `🥛 ندى ← ${dayName(date)}`));
  }

  /** Same one-tap buttons as the home screen, for any day. */
  function QuickRow({ date }: { date: string }) {
    const entries = days.find((d) => d.date === date)?.entries ?? [];
    const nadaCount = entries.filter((e) => e.kind === "nada").length;
    const max = settings!.nada.maxPerDay;
    return (
      <div className="grid grid-cols-1 gap-2 mt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          disabled={nadaCount >= max}
          onClick={() => addNada(date)}
          className="rounded-2xl bg-black/30 ring-1 ring-white/10 px-3 py-2.5 text-start disabled:opacity-40"
        >
          <div className="text-sm font-bold flex items-center justify-between">
            <span>🥛 {t("+ Nada", "+ ندى")}</span>
            {nadaCount > 0 && <span className="text-gold">×{nadaCount}</span>}
          </div>
          <div className="flex gap-1 mt-1.5">
            {Array.from({ length: max }).map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < nadaCount ? "bg-gold" : "bg-white/10"}`} />
            ))}
          </div>
        </motion.button>
      </div>
    );
  }

  function openLog(date: string, kind: "food" | "menu" | "scan") {
    setLogDate(date);
    setSheet(kind);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "items", label: t("Sandwiches", "السندويشات") },
    { id: "orders", label: t("Orders", "الطلبات") },
    { id: "days", label: t("Days", "الأيام") },
  ];

  return (
    <main className="max-w-md mx-auto px-4 pb-24" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <DayBarLive />
      <ProgressTabs />
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="h-11 w-11 rounded-2xl glass flex items-center justify-center text-muted" aria-label={t("Back", "رجوع")}>
          <span className="rtl:rotate-180">←</span>
        </Link>
        <h1 className="text-2xl font-black">
          {t("My", "")} <span className="gold-text">{t("Stats", "إحصائياتي")}</span>
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { label: t("Orders", "الطلبات"), value: totalOrders },
          { label: t("Unique", "مختلفة"), value: history.length },
          { label: t("Days logged", "أيام مسجلة"), value: days.length },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass rounded-2xl p-3.5 text-center"
          >
            <div className="text-3xl font-black gold-text">
              <AnimatedNumber value={s.value} />
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="relative grid grid-cols-3 p-1 rounded-2xl glass mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setOpen(null);
            }}
            className={`relative py-2.5 text-sm font-bold transition-colors ${tab === t.id ? "text-black" : "text-muted"}`}
          >
            {tab === t.id && (
              <motion.span layoutId="stats-tab" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "days" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl3 p-4 mb-3 ring-1 ring-gold/30"
          style={{ background: "linear-gradient(135deg,rgba(255,199,44,0.14),rgba(218,41,28,0.10))" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📅</span>
            <div className="flex-1">
              <div className="font-black">{t("Log a past day", "سجّل يوم فات")}</div>
              <div className="text-[11px] text-muted">{t("Forgot to log? Pick the date and add what you ate.", "نسيت تسجل؟ اختار التاريخ وأضف اللي أكلته.")}</div>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-2xl bg-black/35 px-4 py-3 border border-white/5 focus-within:border-gold/60">
            <span className="text-sm text-muted">{t("Date", "التاريخ")}</span>
            <input
              type="date"
              max={toKey(new Date())}
              value={logDate}
              onChange={(e) => e.target.value && setLogDate(e.target.value)}
              className="flex-1 bg-transparent text-end font-bold outline-none [color-scheme:dark]"
            />
          </label>
          <div className="text-xs text-gold mt-1.5 text-center">
            {fromKey(logDate).toLocaleDateString(ar ? "ar-AE-u-nu-latn" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => openLog(logDate, "food")} className="rounded-2xl bg-gold text-black font-extrabold py-3 text-sm">
              {t("+ Macros / food", "+ ماكروز / أكل")}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => openLog(logDate, "menu")} className="rounded-2xl bg-white/10 font-extrabold py-3 text-sm">
              {t("🍟 McDonald's", "🍟 ماكدونالدز")}
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => openLog(logDate, "scan")}
            className="mt-2 w-full rounded-2xl bg-black/30 ring-1 ring-white/10 py-2.5 text-sm font-bold"
          >
            📷 {t("Scan a barcode", "امسح باركود")}
          </motion.button>
          <QuickRow date={logDate} />
        </motion.div>
      )}

      {(tab === "days" ? days.length === 0 : history.length === 0) ? (
        <motion.div key={tab} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-xl3 p-8 text-center">
          <motion.div className="text-5xl mb-3" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            {tab === "days" ? "📅" : "🍔"}
          </motion.div>
          <p className="font-bold">{tab === "days" ? t("No days logged yet", "ما في أيام مسجلة") : t("No orders yet", "ما في طلبات للحين")}</p>
          <p className="text-sm text-muted mt-1">
            {tab === "days"
              ? t("Everything you log is kept here, day by day.", "كل شي تسجله ينحفظ هنا، يوم بيوم.")
              : t("Pick from the menu or tap “I'll eat this” on a recommendation.", "اختار من المنيو أو اضغط “باكل هذا” على أي توصية.")}
          </p>
        </motion.div>
      ) : tab === "items" ? (
        <div className="space-y-2.5">
          {items.map((it, i) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Rank i={i} />
                <span className="flex-1 font-semibold">{foodEmoji(it.id)} {nameOf(it.id)}</span>
                <span className="font-black text-gold">×{it.count}</span>
              </div>
              <div className="mt-2 ms-10 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg,#ff9f1c,#ffc72c)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(it.count / maxItem) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      ) : tab === "orders" ? (
        <div className="space-y-2.5">
          {orders.map((o, i) => {
            const isOpen = open === o.key;
            const lines = orderItems(o, settings.foods, settings.nada);
            const total = sumMacros(lines.map((l) => scaleMacros(l.macros, l.qty)));
            return (
              <motion.div
                key={o.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, layout: { type: "spring", stiffness: 400, damping: 35 } }}
                className={`glass rounded-2xl overflow-hidden ${isOpen ? "ring-1 ring-gold/40" : ""}`}
              >
                <button onClick={() => setOpen(isOpen ? null : o.key)} className="w-full px-4 py-3 flex items-center gap-3 text-start">
                  <Rank i={i} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{o.label}</div>
                    <div className="text-[11px] text-muted">
                      {Math.round(total.kcal)} kcal · {t("last", "آخر مرة")} {relativeDay(o.lastUsed, ar)}
                      {(() => {
                        const pr =
                          prices &&
                          orderPrice(
                            lines.filter((l) => l.id !== "nada").map((l) => ({ id: l.id, qty: l.qty })),
                            lines.find((l) => l.id === "nada")?.qty ?? 0,
                            settings.nada.price,
                            prices
                          );
                        return pr ? (
                          <span className="text-emerald-300 font-bold">
                            {" "}
                            · {pr.exact ? "" : "≈ "}
                            {fmtAed(pr.amount)} {t("AED", "درهم")}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <span className="font-black text-gold">×{o.count}</span>
                  <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="text-muted">
                    ›
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 34 }}
                    >
                      <div className="px-4 pb-4">
                        <div className="space-y-1.5 mb-3">
                          {lines.map((l, j) => {
                            const m = roundMacros(scaleMacros(l.macros, l.qty));
                            return (
                              <motion.div
                                key={l.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05 + j * 0.05 }}
                                className="rounded-xl bg-black/25 px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="min-w-[2rem] h-6 px-1 rounded-lg bg-gold/15 text-gold text-xs font-black flex items-center justify-center">
                                    {l.qty}×
                                  </span>
                                  <span className="flex-1 text-sm font-semibold">{foodEmoji(l.id + l.name)} {l.name}</span>
                                  <span className="text-sm font-bold text-gold">{m.kcal}</span>
                                </div>
                                <div className="text-[11px] text-muted mt-0.5 ms-10">
                                  <span className="text-success">P {m.protein}g</span> · <span className="text-warn">F {m.fat}g</span> ·{" "}
                                  <span className="text-carb">C {m.carbs}g</span>
                                  {l.qty > 1 && <span> · {t("each", "الواحد")} {Math.round(l.macros.kcal)} kcal</span>}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">{t("Order total", "مجموع الطلب")}</div>
                        <MacroGrid m={total} />
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => removeOrder(o)}
                          className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold bg-red/15 text-[#ff8a7d] ring-1 ring-red/30"
                        >
                          {t("Remove this order from stats", "شيل هذا الطلب من الإحصائيات")}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {days.map((d, i) => {
              const isOpen = open === d.date;
              const total = sumMacros(d.entries.map((e) => e.macros));
              const target = effectiveTargets(settings, "workday");
              return (
                <motion.div
                  key={d.date}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 60, height: 0 }}
                  transition={{ delay: i * 0.04, layout: { type: "spring", stiffness: 400, damping: 35 } }}
                  className={`rounded-2xl overflow-hidden ${
                    hasEsaad(d) ? "ring-1 ring-emerald-400/50" : isOpen ? "glass ring-1 ring-gold/40" : "glass"
                  }`}
                  style={
                    hasEsaad(d)
                      ? { background: "linear-gradient(150deg, rgba(16,185,129,0.20), rgba(24,8,10,0.85) 60%)" }
                      : undefined
                  }
                >
                  <button onClick={() => setOpen(isOpen ? null : d.date)} className="w-full px-4 py-3 flex items-center gap-3 text-start">
                    <span className="text-lg">{hasEsaad(d) ? "💚" : "📅"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold flex flex-wrap items-center gap-x-2 gap-y-1">
                        {dayTitle(d.date, ar)}
                        {hasEsaad(d) && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-400/20 text-emerald-300">
                            {t("ESAAD", "إسعاد")}
                          </span>
                        )}
                        {d.payments?.some((p) => p.points) && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-violet-400/20 text-violet-300">
                            ⭐ {t("POINTS", "نقاط")}
                          </span>
                        )}
                        {!!d.payments?.length && (
                          <span className="text-[11px] font-bold text-success">
                            💰 {Math.round(d.payments.reduce((n, p) => n + p.amount, 0) * 100) / 100} {t("AED", "د")}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted">
                        {Math.round(total.kcal)} kcal ·{" "}
                        <span className={total.protein >= target.proteinMin ? "text-success" : ""}>P {Math.round(total.protein)}</span> ·{" "}
                        <span className={total.fat > target.fatMax ? "text-[#ff8a7d]" : ""}>F {Math.round(total.fat)}</span> · C{" "}
                        {Math.round(total.carbs)}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted">{d.entries.length} {d.entries.length === 1 ? t("log", "عنصر") : t("logs", "عناصر")}</span>
                    <motion.span animate={{ rotate: isOpen ? 90 : 0 }} className="text-muted">
                      ›
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 34 }}
                      >
                        <div className="px-3 pb-3">
                          <MacroGrid m={total} />
                          <div className="mt-3">
                            <DayLog
                              entries={d.entries}
                              payments={d.payments}
                              onEditOrder={(groupId) => setEditing({ date: d.date, groupId, qty: orderQty(d, groupId, settings.foods) })}
                              onEditPayment={(orderId, label) => {
                                const es = d.entries.filter((e) => e.groupId === orderId && e.kind === "mcdonalds");
                                setPay({
                                  date: d.date,
                                  orderId,
                                  label,
                                  kcal: es.reduce((n, e) => n + e.macros.kcal, 0),
                                  protein: es.reduce((n, e) => n + e.macros.protein, 0),
                                });
                              }}
                              onRemoveEntry={(id) => updateDay(d, d.entries.filter((e) => e.id !== id))}
                              onRemoveGroup={(g) => updateDay(d, d.entries.filter((e) => e.groupId !== g))}
                            />
                          </div>
                          <DayCostBar day={d} nadaPrice={settings.nada.price} />
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => openLog(d.date, "food")}
                              className="rounded-xl py-2.5 text-xs font-bold bg-gold/15 text-gold ring-1 ring-gold/30"
                            >
                              {t("+ Add food to this day", "+ أضف أكل لهذا اليوم")}
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => openLog(d.date, "menu")}
                              className="rounded-xl py-2.5 text-xs font-bold bg-white/5 ring-1 ring-white/10"
                            >
                              {t("+ McDonald's order", "+ طلب ماكدونالدز")}
                            </motion.button>
                          </div>
                          <QuickRow date={d.date} />
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => removeDay(d)}
                            className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold bg-red/15 text-[#ff8a7d] ring-1 ring-red/30"
                          >
                            {t("Delete whole day", "احذف اليوم كامل")}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AddFoodSheet
        open={sheet === "food"}
        initialDate={logDate}
        savedMeals={settings.savedMeals}
        onClose={() => setSheet(null)}
        onAdd={addFood}
        onSetTotals={setTotals}
      />
      <BarcodeSheet
        open={sheet === "scan"}
        initialDate={logDate}
        onClose={() => setSheet(null)}
        onAdd={(label, macros, date) => addFood(label, macros, date, false)}
      />
      <McMenuSheet
        open={sheet === "menu"}
        initialDate={logDate}
        onClose={() => setSheet(null)}
        foods={settings.foods.filter((f) => f.enabled)}
        eatenOn={eatenOn}
        targets={effectiveTargets(settings, "workday")}
        prices={prices ?? undefined}
        nadaPrice={settings.nada.price}
        onAdd={addOrder}
      />
      <McMenuSheet
        open={!!editing}
        initialDate={editing?.date}
        initialQty={editing?.qty}
        onClose={() => setEditing(null)}
        foods={settings.foods.filter((f) => f.enabled)}
        eatenOn={eatenOn}
        targets={effectiveTargets(settings, "workday")}
        prices={prices ?? undefined}
        nadaPrice={settings.nada.price}
        onAdd={(lines) => {
          if (!editing) return;
          const res = editOrder(editing.date, editing.groupId, lines, settings.foods, uid);
          refresh();
          showToast(t("✏️ Order updated", "✏️ انعدّل الطلب"), () => {
            res.undo();
            refresh();
          });
        }}
      />
      <PaySheet
        request={pay}
        recentAmounts={pay ? recentAmounts(listDays()) : []}
        onSkip={() => setPay(null)}
        onSave={(amount, flags) => {
          setPayment(pay!.date, pay!.orderId, pay!.label, amount, uid, flags);
          setPay(null);
          refresh();
          showToast(t(`💰 ${amount} AED saved`, `💰 انحفظ ${amount} درهم`));
        }}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
