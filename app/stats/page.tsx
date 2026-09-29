"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { DayLog } from "@/components/DayLog";
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
  todayKey,
  type HistoryEntry,
} from "@/lib/storage";
import { DayState, Macros, Settings } from "@/lib/types";

type Tab = "items" | "orders" | "days";
const MEDALS = ["🥇", "🥈", "🥉"];

function MacroGrid({ m }: { m: Macros }) {
  const r = roundMacros(m);
  return (
    <div className="grid grid-cols-4 gap-1.5 text-center">
      {[
        { k: "kcal", v: r.kcal, c: "text-gold" },
        { k: "protein", v: r.protein, c: "text-success" },
        { k: "fat", v: r.fat, c: "text-warn" },
        { k: "carbs", v: r.carbs, c: "text-carb" },
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

function dayTitle(date: string) {
  if (date === todayKey()) return "Today";
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function StatsPage() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [days, setDays] = useState<DayState[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

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

  if (!history || !settings) return null;

  const showToast = (text: string, undo?: () => void) => {
    setToast({ id: Date.now(), text, undo });
    setTimeout(() => setToast((cur) => (cur?.text === text ? null : cur)), 3500);
  };

  const nameOf = (id: string) =>
    id === "nada" ? "Nada Protein Milk" : settings.foods.find((f) => f.id === id)?.name ?? id;
  const items = itemTotals(history);
  const orders = [...history].sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed));
  const totalOrders = history.reduce((n, h) => n + h.count, 0);
  const maxItem = items[0]?.count ?? 1;

  function removeOrder(o: HistoryEntry) {
    deleteHistoryEntry(o.key);
    refresh();
    showToast("Order removed from stats", () => {
      for (let i = 0; i < o.count; i++) recordCombinationUsed(o.key, o.label, o.items);
      refresh();
    });
  }

  function removeDay(d: DayState) {
    deleteDay(d.date);
    refresh();
    showToast(`${dayTitle(d.date)} deleted`, () => {
      saveDay(d);
      refresh();
    });
  }

  function updateDay(d: DayState, entries: DayState["entries"]) {
    saveDay({ ...d, entries });
    refresh();
    showToast("Removed", () => {
      saveDay(d);
      refresh();
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "items", label: "Sandwiches" },
    { id: "orders", label: "Orders" },
    { id: "days", label: "Days" },
  ];

  return (
    <main className="max-w-md mx-auto px-4 pb-24" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="h-11 w-11 rounded-2xl glass flex items-center justify-center text-muted" aria-label="Back">
          ←
        </Link>
        <h1 className="text-2xl font-black">
          My <span className="gold-text">Stats</span>
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { label: "Orders", value: totalOrders },
          { label: "Unique", value: history.length },
          { label: "Days logged", value: days.length },
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

      {(tab === "days" ? days.length === 0 : history.length === 0) ? (
        <motion.div key={tab} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-xl3 p-8 text-center">
          <motion.div className="text-5xl mb-3" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            {tab === "days" ? "📅" : "🍔"}
          </motion.div>
          <p className="font-bold">{tab === "days" ? "No days logged yet" : "No orders yet"}</p>
          <p className="text-sm text-muted mt-1">
            {tab === "days"
              ? "Everything you log is kept here, day by day."
              : "Pick from the menu or tap “I'll eat this” on a recommendation."}
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
                <span className="flex-1 font-semibold">{nameOf(it.id)}</span>
                <span className="font-black text-gold">×{it.count}</span>
              </div>
              <div className="mt-2 ml-10 h-1.5 rounded-full bg-white/5 overflow-hidden">
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
                <button onClick={() => setOpen(isOpen ? null : o.key)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                  <Rank i={i} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{o.label}</div>
                    <div className="text-[11px] text-muted">
                      {Math.round(total.kcal)} kcal · last {relativeDay(o.lastUsed)}
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
                                  <span className="flex-1 text-sm font-semibold">{l.name}</span>
                                  <span className="text-sm font-bold text-gold">{m.kcal}</span>
                                </div>
                                <div className="text-[11px] text-muted mt-0.5 ml-10">
                                  <span className="text-success">P {m.protein}g</span> · <span className="text-warn">F {m.fat}g</span> ·{" "}
                                  <span className="text-carb">C {m.carbs}g</span>
                                  {l.qty > 1 && <span> · each {Math.round(l.macros.kcal)} kcal</span>}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Order total</div>
                        <MacroGrid m={total} />
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => removeOrder(o)}
                          className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold bg-red/15 text-[#ff8a7d] ring-1 ring-red/30"
                        >
                          Remove this order from stats
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
              const target = settings.targets.workday;
              return (
                <motion.div
                  key={d.date}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 60, height: 0 }}
                  transition={{ delay: i * 0.04, layout: { type: "spring", stiffness: 400, damping: 35 } }}
                  className={`glass rounded-2xl overflow-hidden ${isOpen ? "ring-1 ring-gold/40" : ""}`}
                >
                  <button onClick={() => setOpen(isOpen ? null : d.date)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                    <span className="text-lg">📅</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{dayTitle(d.date)}</div>
                      <div className="text-[11px] text-muted">
                        {Math.round(total.kcal)} kcal ·{" "}
                        <span className={total.protein >= target.proteinMin ? "text-success" : ""}>P {Math.round(total.protein)}</span> ·{" "}
                        <span className={total.fat > target.fatMax ? "text-[#ff8a7d]" : ""}>F {Math.round(total.fat)}</span> · C{" "}
                        {Math.round(total.carbs)}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted">{d.entries.length} {d.entries.length === 1 ? "log" : "logs"}</span>
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
                              onRemoveEntry={(id) => updateDay(d, d.entries.filter((e) => e.id !== id))}
                              onRemoveGroup={(g) => updateDay(d, d.entries.filter((e) => e.groupId !== g))}
                            />
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => removeDay(d)}
                            className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold bg-red/15 text-[#ff8a7d] ring-1 ring-red/30"
                          >
                            Delete whole day
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

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
