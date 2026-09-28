"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { relativeDay } from "@/components/RecommendationCard";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { itemTotals, loadHistory, loadSettings, type HistoryEntry } from "@/lib/storage";
import { Settings } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function StatsPage() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<"items" | "orders">("items");

  useEffect(() => {
    setHistory(loadHistory());
    setSettings(loadSettings());
  }, []);

  if (!history || !settings) return null;

  const nameOf = (id: string) =>
    id === "nada" ? "Nada Protein Milk" : settings.foods.find((f) => f.id === id)?.name ?? id;
  const items = itemTotals(history);
  const orders = [...history].sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed));
  const totalOrders = history.reduce((n, h) => n + h.count, 0);
  const maxItem = items[0]?.count ?? 1;

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
          { label: "Items", value: items.reduce((n, i) => n + i.count, 0) },
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
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {history.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-xl3 p-8 text-center">
          <motion.div
            className="text-5xl mb-3"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            🍔
          </motion.div>
          <p className="font-bold">No orders yet</p>
          <p className="text-sm text-muted mt-1">Tap “I'll eat this” on a recommendation and it will show up here.</p>
        </motion.div>
      ) : (
        <>
          <div className="relative grid grid-cols-2 p-1 rounded-2xl glass mb-4">
            {(["items", "orders"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative py-2.5 text-sm font-bold transition-colors ${tab === t ? "text-black" : "text-muted"}`}
              >
                {tab === t && (
                  <motion.span layoutId="stats-tab" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                )}
                <span className="relative">{t === "items" ? "Top Sandwiches" : "Top Orders"}</span>
              </button>
            ))}
          </div>

          {tab === "items" ? (
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
                    <span className="w-7 text-center text-lg">{MEDALS[i] ?? <span className="text-sm text-muted font-bold">{i + 1}</span>}</span>
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
          ) : (
            <div className="space-y-2.5">
              {orders.map((o, i) => (
                <motion.div
                  key={o.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="w-7 text-center text-lg">{MEDALS[i] ?? <span className="text-sm text-muted font-bold">{i + 1}</span>}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{o.label}</div>
                    <div className="text-[11px] text-muted">last {relativeDay(o.lastUsed)}</div>
                  </div>
                  <span className="font-black text-gold">×{o.count}</span>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
