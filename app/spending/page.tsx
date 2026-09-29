"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { BarChart } from "@/components/BarChart";
import { useI18n } from "@/lib/i18n";
import { costSummary, dayCost, hasEsaad, spending } from "@/lib/insights";
import { fromKey, toKey } from "@/lib/progress";
import { listDays, loadSettings } from "@/lib/storage";
import { DayState, Settings } from "@/lib/types";

type Range = "week" | "month" | "all";

function startOf(range: Range, today: Date): string {
  if (range === "all") return "0000-00-00";
  if (range === "month") return `${toKey(today).slice(0, 7)}-01`;
  const d = new Date(today);
  d.setDate(d.getDate() - 6);
  return toKey(d);
}

export default function SpendingPage() {
  const { t, ar, date } = useI18n();
  const [days, setDays] = useState<DayState[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    setDays(listDays());
    setSettings(loadSettings());
  }, []);

  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);
  const from = startOf(range, today);

  const chartPoints = useMemo(() => {
    if (!days || !settings) return [];
    const n = range === "week" ? 7 : range === "month" ? today.getDate() : 30;
    const byDate = new Map(days.map((d) => [d.date, d]));
    return Array.from({ length: Math.max(n, 1) }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (Math.max(n, 1) - 1 - i));
      const k = toKey(d);
      const day = byDate.get(k);
      const c = day ? dayCost(day, settings.nada.price).total : 0;
      return { date: k, value: c > 0 ? c : null };
    });
  }, [days, settings, range, today]);

  if (!days || !settings) return null;

  const price = settings.nada.price;
  const sum = costSummary(days, from, todayKey, price);
  const orders = spending(days, from, todayKey);
  const listed = days.filter((d) => d.date >= from && dayCost(d, price).total > 0);
  const aed = t("AED", "درهم");
  const mcdPct = sum.total ? (sum.mcd / sum.total) * 100 : 0;
  const ranges: { id: Range; label: string }[] = [
    { id: "week", label: t("7 days", "7 أيام") },
    { id: "month", label: t("This month", "هذا الشهر") },
    { id: "all", label: t("All time", "الكل") },
  ];

  return (
    <main className="max-w-md mx-auto px-4 pb-24" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="h-11 w-11 rounded-2xl glass flex items-center justify-center text-muted" aria-label={t("Back", "رجوع")}>
          <span className="rtl:rotate-180">←</span>
        </Link>
        <h1 className="text-2xl font-black">
          💰 <span className="gold-text">{t("Spending", "المصاريف")}</span>
        </h1>
      </header>

      <div className="relative grid grid-cols-3 p-1 rounded-2xl glass mb-4">
        {ranges.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`relative py-2.5 text-sm font-bold transition-colors ${range === r.id ? "text-black" : "text-muted"}`}
          >
            {range === r.id && (
              <motion.span layoutId="spend-range" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
            )}
            <span className="relative">{r.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={range} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {/* Hero total */}
          <div className="glass rounded-xl3 p-5 text-center relative overflow-hidden">
            <motion.div
              className="absolute -top-16 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-gold/20 blur-3xl"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <div className="relative text-[11px] uppercase tracking-[0.16em] text-muted">{t("Total spent", "المجموع")}</div>
            <div className="relative text-5xl font-black gold-text mt-1">
              <AnimatedNumber value={sum.total} decimals={sum.total % 1 ? 1 : 0} />
              <span className="text-xl text-muted font-bold"> {aed}</span>
            </div>
            <div className="relative text-xs text-muted mt-1.5">
              {sum.perDay !== null
                ? t(`${sum.perDay} ${aed} per day · ${sum.days} days`, `${sum.perDay} ${aed} باليوم · ${sum.days} أيام`)
                : t("Nothing spent in this period yet", "ما في مصاريف بهالفترة")}
            </div>

            {/* McD vs Nada split */}
            <div className="relative mt-5 flex h-3 rounded-full overflow-hidden bg-white/5">
              <motion.div className="bg-gold" initial={{ width: 0 }} animate={{ width: `${mcdPct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
              <motion.div
                className="bg-sky-300"
                initial={{ width: 0 }}
                animate={{ width: `${sum.total ? 100 - mcdPct : 0}%` }}
                transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="relative grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-2xl bg-black/25 py-3">
                <div className="text-2xl font-black">
                  <AnimatedNumber value={sum.mcd} decimals={sum.mcd % 1 ? 1 : 0} />
                </div>
                <div className="text-[11px] text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-gold me-1" />
                  🍔 {t(`McDonald's · ${orders.orders} orders`, `ماكدونالدز · ${orders.orders} طلبات`)}
                </div>
              </div>
              <div className="rounded-2xl bg-black/25 py-3">
                <div className="text-2xl font-black">
                  <AnimatedNumber value={sum.nada} />
                </div>
                <div className="text-[11px] text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-300 me-1" />
                  🥛 {t(`Nada · ${sum.nadaBottles} × ${price}`, `ندى · ${sum.nadaBottles} × ${price}`)}
                </div>
              </div>
            </div>
          </div>

          {/* Discounts */}
          {orders.orders > 0 && (
            <div className="glass rounded-xl3 p-4 mt-4">
              <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted mb-3">{t("McDonald's orders", "طلبات ماكدونالدز")}</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-400/30 py-3">
                  <div className="text-2xl font-black text-emerald-300">{orders.esaadOrders}</div>
                  <div className="text-[10px] text-muted">💚 {t("with Esaad", "بخصم إسعاد")}</div>
                </div>
                <div className="rounded-2xl bg-black/25 py-3">
                  <div className="text-2xl font-black">{orders.fullPriceOrders}</div>
                  <div className="text-[10px] text-muted">{t("without discount", "بدون خصم")}</div>
                </div>
                <div className="rounded-2xl bg-violet-400/10 ring-1 ring-violet-400/30 py-3">
                  <div className="text-2xl font-black text-violet-300">{orders.pointsOrders}</div>
                  <div className="text-[10px] text-muted">⭐ {t("used points", "بالنقاط")}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                <div className="rounded-2xl bg-black/25 py-2.5">
                  <div className="text-lg font-black">{orders.avgPerOrder !== null ? orders.avgPerOrder.toFixed(1) : "—"}</div>
                  <div className="text-[10px] text-muted">{t(`${aed} per order`, `${aed} لكل طلب`)}</div>
                </div>
                <div className="rounded-2xl bg-black/25 py-2.5">
                  <div className="text-lg font-black">{orders.per10gProtein !== null ? orders.per10gProtein.toFixed(2) : "—"}</div>
                  <div className="text-[10px] text-muted">{t(`${aed} per 10g protein`, `${aed} لكل 10 جرام بروتين`)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Daily chart */}
          {sum.total > 0 && (
            <div className="glass rounded-xl3 p-4 mt-4">
              <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted mb-3">{t("Per day", "باليوم")}</h2>
              <div dir="ltr">
                <BarChart
                  points={chartPoints}
                  target={sum.perDay ?? 0}
                  targetLabel={t("Avg", "المتوسط")}
                  unit={aed}
                  color="#ffc72c"
                  goal="max"
                />
              </div>
            </div>
          )}

          {/* Day list */}
          <div className="mt-4 space-y-2">
            {listed.map((d, i) => {
              const c = dayCost(d, price);
              const esaad = hasEsaad(d);
              return (
                <motion.div
                  key={d.date}
                  initial={{ opacity: 0, x: ar ? 16 : -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.035 }}
                >
                  <Link
                    href="/stats?tab=days"
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${esaad ? "ring-1 ring-emerald-400/50" : "glass"}`}
                    style={esaad ? { background: "linear-gradient(150deg, rgba(16,185,129,0.20), rgba(24,8,10,0.85) 60%)" } : undefined}
                  >
                    <span className="text-lg">{esaad ? "💚" : "📅"}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold">
                        {d.date === todayKey ? t("Today", "اليوم") : date(fromKey(d.date), { weekday: "short", month: "short", day: "numeric" })}
                        {esaad && (
                          <span className="ms-2 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-400/20 text-emerald-300">{t("ESAAD", "إسعاد")}</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted">
                        🍔 {c.mcd} · 🥛 {c.nada}
                        {c.nadaBottles ? ` (${c.nadaBottles}×${price})` : ""}
                      </span>
                    </span>
                    <span className="font-black text-gold">
                      {c.total} <span className="text-[11px] text-muted font-bold">{aed}</span>
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <p className="text-[10px] text-muted/70 mt-4 text-center">
        {t(
          `Nada is counted automatically at ${price} ${aed} a bottle (change it in Settings). McDonald's uses what you entered.`,
          `ندى تنحسب تلقائياً ${price} ${aed} للعلبة (تقدر تغيرها من الإعدادات). ماك حسب المبلغ اللي دخلته.`
        )}
      </p>
    </main>
  );
}
