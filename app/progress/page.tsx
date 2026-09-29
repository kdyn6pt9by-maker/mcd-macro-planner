"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { BarChart } from "@/components/BarChart";
import { StreakCard } from "@/components/StreakCard";
import { WeightChart } from "@/components/WeightChart";
import {
  dailySeries,
  fromKey,
  reminderIcs,
  summarize,
  toKey,
  weekStrip,
  weekdayStreak,
  weeklyRate,
  weightTrend,
  type WeightEntry,
} from "@/lib/progress";
import { deleteWeight, loadAllDays, loadSettings, loadWeights, saveWeight } from "@/lib/storage";
import { DayState, Settings } from "@/lib/types";

const RANGES = [7, 30] as const;

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 24 }}
      className="glass rounded-xl3 p-4 mb-4"
    >
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted mb-3">{title}</h2>
      {children}
    </motion.section>
  );
}

export default function ProgressPage() {
  const [days, setDays] = useState<Record<string, DayState> | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [kg, setKg] = useState("");
  const [showAllWeights, setShowAllWeights] = useState(false);

  useEffect(() => {
    setDays(loadAllDays());
    setSettings(loadSettings());
    setWeights(loadWeights());
  }, []);

  const targets = settings?.targets.workday;
  const points = useMemo(() => (days && targets ? dailySeries(days, range, targets) : []), [days, targets, range]);
  const weekPoints = useMemo(() => (days && targets ? dailySeries(days, 7, targets) : []), [days, targets]);

  if (!days || !settings || !targets) return null;

  const summary = summarize(points, targets);
  const week = summarize(weekPoints, targets);
  const weekdaysLogged = weekPoints.filter((p) => p.totals && fromKey(p.date).getDay() % 6 !== 0);
  const streak = weekdayStreak(days, targets);
  const trend = weightTrend(weights);
  const rate = weeklyRate(weights);
  const latest = weights[weights.length - 1];
  const todayKey = toKey(new Date());

  function logWeight() {
    const v = parseFloat(kg);
    if (!Number.isFinite(v) || v < 25 || v > 350) return;
    saveWeight({ date: todayKey, kg: Math.round(v * 10) / 10 });
    setWeights(loadWeights());
    setKg("");
  }

  function downloadReminder() {
    const blob = new Blob([reminderIcs(window.location.origin)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mcd-macro-reminders.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="max-w-md mx-auto px-4 pb-24" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="h-11 w-11 rounded-2xl glass flex items-center justify-center text-muted" aria-label="Back">
          ←
        </Link>
        <h1 className="text-2xl font-black">
          <span className="gold-text">Progress</span>
        </h1>
      </header>

      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
        <StreakCard streak={streak} week={weekStrip(days, targets)} />
      </motion.div>

      <Section title="This week" delay={0.05}>
        {week.loggedDays === 0 ? (
          <p className="text-sm text-muted">Nothing logged in the last 7 days yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-black/25 py-3">
                <div className="text-2xl font-black text-[#f7ecec]">
                  <AnimatedNumber value={Math.round(week.avg!.kcal)} />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">avg kcal</div>
              </div>
              <div className="rounded-2xl bg-black/25 py-3">
                <div className="text-2xl font-black text-[#f7ecec]">
                  <AnimatedNumber value={Math.round(week.avg!.protein)} />
                  <span className="text-sm">g</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">avg protein</div>
              </div>
              <div className="rounded-2xl bg-black/25 py-3">
                <div className="text-2xl font-black text-[#f7ecec]">
                  {weekdaysLogged.filter((p) => p.totals!.protein >= targets.proteinMin).length}
                  <span className="text-sm text-muted">/5</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">protein ✓ days</div>
              </div>
            </div>
            {week.bestDay && (
              <div className="mt-3 rounded-2xl bg-gold/10 ring-1 ring-gold/25 px-3.5 py-2.5 text-sm flex items-center gap-2.5">
                <span className="text-lg">⭐</span>
                <span className="flex-1">
                  Best day:{" "}
                  <b>{fromKey(week.bestDay.date).toLocaleDateString("en-US", { weekday: "long" })}</b>
                  <span className="text-muted">
                    {" "}
                    · {Math.round(week.bestDay.totals!.kcal)} kcal · {Math.round(week.bestDay.totals!.protein)}g P
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </Section>

      <div className="relative grid grid-cols-2 p-1 rounded-2xl glass mb-4">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`relative py-2.5 text-sm font-bold transition-colors ${range === r ? "text-black" : "text-muted"}`}
          >
            {range === r && (
              <motion.span layoutId="range-pill" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
            )}
            <span className="relative">Last {r} days</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={range} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <Section title={`Calories · avg ${summary.avg ? Math.round(summary.avg.kcal).toLocaleString("en-US") : "—"} kcal`}>
            <BarChart
              points={points.map((p) => ({ date: p.date, value: p.totals ? p.totals.kcal : null }))}
              target={targets.kcal}
              targetLabel="Target"
              unit="kcal"
              color="#ffc72c"
              goal="max"
            />
          </Section>
          <Section title={`Protein · hit on ${summary.proteinHitDays} of ${summary.loggedDays} logged days`}>
            <BarChart
              points={points.map((p) => ({ date: p.date, value: p.totals ? p.totals.protein : null }))}
              target={targets.proteinMin}
              targetLabel="Goal"
              unit="g"
              color="#34d399"
              goal="min"
            />
          </Section>
        </motion.div>
      </AnimatePresence>

      <Section title="Weight" delay={0.1}>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
              placeholder={latest ? String(latest.kg) : "e.g. 82.5"}
              className="no-spin w-full bg-black/40 rounded-2xl px-4 py-3 text-xl font-bold outline-none border border-white/5 focus:border-gold/60"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm">kg</span>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={logWeight} className="rounded-2xl bg-gold text-black font-extrabold px-5">
            {latest?.date === todayKey ? "Update" : "Log"}
          </motion.button>
        </div>

        {weights.length === 0 ? (
          <p className="text-sm text-muted">Log your weight once a week (same day, morning) to see your trend here.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3 text-center">
              <div className="rounded-2xl bg-black/25 py-2.5">
                <div className="text-xl font-black">{trend[trend.length - 1].avg} kg</div>
                <div className="text-[10px] uppercase tracking-wider text-muted">trend weight</div>
              </div>
              <div className="rounded-2xl bg-black/25 py-2.5">
                <div className="text-xl font-black">
                  {rate === null ? "—" : `${rate > 0 ? "▲ +" : rate < 0 ? "▼ " : ""}${rate} kg`}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">per week (8 wks)</div>
              </div>
            </div>
            {weights.length >= 2 ? (
              <WeightChart data={trend} />
            ) : (
              <p className="text-xs text-muted">One more weigh-in and your trend line appears.</p>
            )}
            <ul className="mt-3 space-y-1.5">
              <AnimatePresence initial={false}>
                {[...weights]
                  .reverse()
                  .slice(0, showAllWeights ? undefined : 4)
                  .map((w) => (
                    <motion.li
                      key={w.date}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, x: 40 }}
                      className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2 overflow-hidden"
                    >
                      <span className="text-sm flex-1 text-muted">
                        {fromKey(w.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span className="font-bold">{w.kg} kg</span>
                      <button
                        onClick={() => {
                          deleteWeight(w.date);
                          setWeights(loadWeights());
                        }}
                        aria-label={`Delete weigh-in ${w.date}`}
                        className="h-7 w-7 rounded-full bg-white/5 text-muted text-xs"
                      >
                        ✕
                      </button>
                    </motion.li>
                  ))}
              </AnimatePresence>
            </ul>
            {weights.length > 4 && (
              <button onClick={() => setShowAllWeights((s) => !s)} className="mt-2 text-xs font-bold text-gold">
                {showAllWeights ? "Show less" : `Show all ${weights.length}`}
              </button>
            )}
          </>
        )}
      </Section>

      <Section title="Reminders" delay={0.15}>
        <p className="text-sm text-[#e8d5d6] leading-5">
          Adds two repeating reminders to your iPhone Calendar — they fire even when the app is closed:
        </p>
        <ul className="text-xs text-muted mt-2 space-y-1">
          <li>🔔 Mon–Fri 9:00 PM — log today &amp; protect your streak</li>
          <li>🌴 Sunday 9:00 PM — weekend check-in</li>
        </ul>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={downloadReminder}
          className="mt-3 w-full rounded-2xl bg-white/[0.07] ring-1 ring-white/10 font-bold py-3"
        >
          📅 Add reminders to Calendar
        </motion.button>
        <p className="text-[10px] text-muted/70 mt-2">On iPhone: tap the button, then “Add All”. Edit or delete them anytime in the Calendar app.</p>
      </Section>
    </main>
  );
}
