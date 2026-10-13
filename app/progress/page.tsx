"use client";

import { DayBarLive } from "@/components/DayBar";
import { ProgressTabs } from "@/components/ProgressTabs";
import { effectiveTargets, pctForCalories } from "@/lib/goals";
import { dayAdjust, loadReserve } from "@/lib/reserve";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { BarChart } from "@/components/BarChart";
import { StreakCard } from "@/components/StreakCard";
import { WeightChart } from "@/components/WeightChart";
import { useI18n } from "@/lib/i18n";
import { KCAL_PER_KG, estimateMaintenance, spending, targetFor } from "@/lib/insights";
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
import { renderWeekReport, shareOrDownload } from "@/lib/reportImage";
import { renderFoodLog } from "@/lib/foodLogImage";
import { targetsFor } from "@/lib/targets";
import { sumMacros } from "@/lib/engine/macros";
import { deleteWeight, loadAllDays, loadSettings, loadWeights, saveSettings, saveWeight } from "@/lib/storage";
import { DayState, Settings } from "@/lib/types";

const RANGES = [7, 30] as const;
const GOALS = [-0.75, -0.5, -0.25, 0] as const;

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 24 }}
      className="glass rounded-xl3 p-4 mb-4 relative"
    >
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted mb-3">{title}</h2>
      {children}
    </motion.section>
  );
}

function Tile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-black/25 py-3 px-1 text-center">
      <div className="text-2xl font-black text-[#f7ecec] leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">{label}</div>
    </div>
  );
}

export default function ProgressPage() {
  const { t, date, ar } = useI18n();
  const [days, setDays] = useState<Record<string, DayState> | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [kg, setKg] = useState("");
  const [showAllWeights, setShowAllWeights] = useState(false);
  const [goal, setGoal] = useState<(typeof GOALS)[number]>(-0.5);
  const [flash, setFlash] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareDays, setShareDays] = useState(3);

  useEffect(() => {
    setDays(loadAllDays());
    setSettings(loadSettings());
    setWeights(loadWeights());
  }, []);

  const targets = settings ? effectiveTargets(settings, "workday") : undefined;
  const points = useMemo(() => (days && targets ? dailySeries(days, range, targets) : []), [days, targets, range]);
  const weekPoints = useMemo(() => (days && targets ? dailySeries(days, 7, targets) : []), [days, targets]);

  if (!days || !settings || !targets) return null;

  const summary = summarize(points, targets);
  const week = summarize(weekPoints, targets);
  const weekdaysLogged = weekPoints.filter((p) => p.totals && fromKey(p.date).getDay() % 6 !== 0);
  const proteinWeekdays = weekdaysLogged.filter((p) => p.totals!.protein >= targets.proteinMin).length;
  const reserve = loadReserve();
  const streak = weekdayStreak(days, targets, new Date(), (d) => { const a = dayAdjust(d, days, settings, reserve); return a.total + a.plan; });
  const strip = weekStrip(days, targets);
  const trend = weightTrend(weights);
  const rate = weeklyRate(weights);
  const latest = weights[weights.length - 1];
  const today = new Date();
  const todayKey = toKey(today);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const allDays = Object.values(days);
  const spendWeek = spending(allDays, toKey(weekAgo), todayKey);
  const spendMonth = spending(allDays, `${todayKey.slice(0, 7)}-01`, todayKey);
  const maint = estimateMaintenance(days, weights);
  const loggedLast28 = allDays.filter((d) => {
    const from = new Date(today);
    from.setDate(from.getDate() - 28);
    return d.date >= toKey(from) && d.date < todayKey && d.entries.length;
  }).length;
  const aed = t("AED", "درهم");

  function say(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

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

  function applyTarget(kcal: number) {
    // The estimate is your real maintenance: store it as the base, and express the weekly goal as cut/bulk %.
    const next = {
      ...settings!,
      targets: { ...settings!.targets, workday: { ...settings!.targets.workday, kcal: maint!.maintenance } },
      goal: pctForCalories(maint!.maintenance, kcal),
    };
    saveSettings(next);
    setSettings(next);
    say(t(`Workday target set to ${kcal.toLocaleString("en-US")} kcal ✓`, `هدف يوم الدوام صار ${kcal.toLocaleString("en-US")} سعرة ✓`));
  }

  async function shareFood() {
    if (!days || !settings) return;
    setSharing(true);
    try {
      const res = loadReserve();
      const list = Array.from({ length: shareDays }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (shareDays - 1 - i));
        const key = toKey(d);
        const entries = days[key]?.entries ?? [];
        const grouped = new Map<string, { label: string; qty: number; kcal: number }>();
        for (const e of entries) {
          const g = grouped.get(e.label) ?? { label: e.label, qty: 0, kcal: 0 };
          g.qty++;
          g.kcal += e.macros.kcal;
          grouped.set(e.label, g);
        }
        const mode = d.getDay() === 0 || d.getDay() === 6 ? "weekend" : "workday";
        return {
          title: date(d, { weekday: "long", day: "numeric", month: "short" }),
          items: Array.from(grouped.values()),
          totals: sumMacros(entries.map((e) => e.macros)),
          target: targetsFor(key, settings, mode, days, res).kcal,
        };
      });
      const blob = await renderFoodLog({
        rtl: ar,
        title: t("What I ate", "اللي أكلته"),
        subtitle: t(`Last ${shareDays} days`, `آخر ${shareDays} أيام`),
        days: list,
        labels: { p: t("Protein", "بروتين"), f: t("Fat", "دهون"), c: t("Carbs", "كارب"), kcal: "kcal", none: t("Nothing logged", "ما في تسجيل") },
        footer: t("McD Macro · by Mohammad Almansoori", "McD Macro · صُنع بواسطة Mohammad Almansoori"),
      });
      const r = await shareOrDownload(blob, `what-i-ate-${todayKey}.png`);
      if (r === "downloaded") say(t("Image saved ✓", "انحفظت الصورة ✓"));
    } finally {
      setSharing(false);
    }
  }

  async function shareWeek() {
    setSharing(true);
    try {
      const weightChange = trend.length >= 2 ? trend[trend.length - 1].avg - trend[Math.max(0, trend.length - 2)].avg : null;
      const blob = await renderWeekReport({
        rtl: ar,
        title: t("My week · McD Macro", "أسبوعي · McD Macro"),
        range: `${date(weekAgo, { month: "short", day: "numeric" })} – ${date(today, { month: "short", day: "numeric" })}`,
        streak,
        streakLabel: t("weekday streak", "سلسلة أيام الدوام"),
        week: strip.map((d) => ({ label: date(fromKey(d.date), { weekday: "short" }).slice(0, ar ? 6 : 2), status: d.status })),
        stats: [
          { label: t("avg kcal", "متوسط السعرات"), value: week.avg ? Math.round(week.avg.kcal).toLocaleString("en-US") : "—" },
          { label: t("avg protein", "متوسط البروتين"), value: week.avg ? `${Math.round(week.avg.protein)}g` : "—" },
          { label: t("protein ✓ weekdays", "أيام البروتين ✓"), value: `${proteinWeekdays}/5` },
          { label: t("days on target", "أيام ملتزمة"), value: `${week.committedDays}/${week.loggedDays}` },
          {
            label: t("weight trend", "اتجاه الوزن"),
            value: latest ? `${trend[trend.length - 1].avg}kg${weightChange ? ` ${weightChange > 0 ? "▲" : "▼"}${Math.abs(Math.round(weightChange * 10) / 10)}` : ""}` : "—",
          },
          { label: t("spent at McD", "صرفت في ماك"), value: spendWeek.orders ? `${Math.round(spendWeek.total)} ${aed}` : "—" },
        ],
        footer: t("McD Macro · by Mohammad Almansoori", "McD Macro · صُنع بواسطة Mohammad Almansoori"),
      });
      const res = await shareOrDownload(blob, `my-week-${todayKey}.png`);
      if (res === "downloaded") say(t("Image saved ✓", "انحفظت الصورة ✓"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 pb-24" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <DayBarLive />
      <ProgressTabs />
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="h-11 w-11 rounded-2xl glass flex items-center justify-center text-muted" aria-label={t("Back", "رجوع")}>
          <span className="rtl:rotate-180">←</span>
        </Link>
        <h1 className="text-2xl font-black flex-1">
          <span className="gold-text">{t("Progress", "التقدم")}</span>
        </h1>
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={shareWeek}
          disabled={sharing}
          className="rounded-2xl bg-gold text-black text-xs font-extrabold px-3.5 py-2.5 disabled:opacity-50"
        >
          {sharing ? "…" : t("🖼️ Share week", "🖼️ شارك أسبوعي")}
        </motion.button>
      </header>

      <section className="mb-4 rounded-2xl glass p-4">
        <div className="text-sm font-black">📸 {t("Share what I ate", "شارك اللي أكلته")}</div>
        <div className="text-[11px] text-muted mt-0.5">{t("An image of every food, with each day's calories and macros", "صورة فيها كل أكلك، وسعرات وماكروز كل يوم")}</div>
        <div className="flex gap-1.5 mt-3">
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => setShareDays(n)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-black ${shareDays === n ? "bg-gold text-black" : "bg-white/[0.06] text-muted"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={shareFood}
          disabled={sharing}
          className="mt-3 w-full rounded-xl bg-gold text-black font-black py-2.5 text-sm disabled:opacity-50"
        >
          {sharing ? "…" : t(`Share last ${shareDays} days`, `شارك آخر ${shareDays} أيام`)}
        </motion.button>
      </section>

      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
        <StreakCard streak={streak} week={strip} />
      </motion.div>

      <Section title={t("This week", "هذا الأسبوع")} delay={0.05}>
        {week.loggedDays === 0 ? (
          <p className="text-sm text-muted">{t("Nothing logged in the last 7 days yet.", "ما في شي مسجل آخر 7 أيام.")}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile value={<AnimatedNumber value={Math.round(week.avg!.kcal)} />} label={t("avg kcal", "متوسط سعرات")} />
              <Tile
                value={
                  <>
                    <AnimatedNumber value={Math.round(week.avg!.protein)} />
                    <span className="text-sm">g</span>
                  </>
                }
                label={t("avg protein", "متوسط بروتين")}
              />
              <Tile
                value={
                  <>
                    {proteinWeekdays}
                    <span className="text-sm text-muted">/5</span>
                  </>
                }
                label={t("protein ✓ days", "أيام البروتين ✓")}
              />
            </div>
            {week.bestDay && (
              <div className="mt-3 rounded-2xl bg-gold/10 ring-1 ring-gold/25 px-3.5 py-2.5 text-sm flex items-center gap-2.5">
                <span className="text-lg">⭐</span>
                <span className="flex-1">
                  {t("Best day:", "أفضل يوم:")} <b>{date(fromKey(week.bestDay.date), { weekday: "long" })}</b>
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
            <span className="relative">{t(`Last ${r} days`, `آخر ${r} يوم`)}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={range} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <Section
            title={t(
              `Calories · avg ${summary.avg ? Math.round(summary.avg.kcal).toLocaleString("en-US") : "—"} kcal`,
              `السعرات · المتوسط ${summary.avg ? Math.round(summary.avg.kcal).toLocaleString("en-US") : "—"}`
            )}
          >
            <div dir="ltr">
              <BarChart
                points={points.map((p) => ({ date: p.date, value: p.totals ? p.totals.kcal : null }))}
                target={targets.kcal}
                targetLabel={t("Target", "الهدف")}
                unit="kcal"
                color="#ffc72c"
                goal="max"
              />
            </div>
          </Section>
          <Section
            title={t(
              `Protein · hit on ${summary.proteinHitDays} of ${summary.loggedDays} logged days`,
              `البروتين · وصلت الهدف ${summary.proteinHitDays} من ${summary.loggedDays} يوم`
            )}
          >
            <div dir="ltr">
              <BarChart
                points={points.map((p) => ({ date: p.date, value: p.totals ? p.totals.protein : null }))}
                target={targets.proteinMin}
                targetLabel={t("Goal", "الهدف")}
                unit="g"
                color="#34d399"
                goal="min"
              />
            </div>
          </Section>
        </motion.div>
      </AnimatePresence>

      <Section title={t("💰 McDonald's spending", "💰 مصروف ماكدونالدز")} delay={0.05}>
        <Link href="/spending" className="absolute top-4 end-4 text-xs font-bold text-gold">
          {t("Full spending →", "كل المصاريف ←")}
        </Link>
        {spendMonth.orders === 0 ? (
          <p className="text-sm text-muted">
            {t(
              "After each McDonald's order you'll be asked what you paid — your totals show up here.",
              "بعد كل طلب من ماك بيسألك كم دفعت — ومجموعك يطلع هنا."
            )}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tile
                value={
                  <>
                    <AnimatedNumber value={Math.round(spendWeek.total)} /> <span className="text-sm text-muted">{aed}</span>
                  </>
                }
                label={t(`last 7 days · ${spendWeek.orders} orders`, `آخر 7 أيام · ${spendWeek.orders} طلبات`)}
              />
              <Tile
                value={
                  <>
                    <AnimatedNumber value={Math.round(spendMonth.total)} /> <span className="text-sm text-muted">{aed}</span>
                  </>
                }
                label={t(`this month · ${spendMonth.orders} orders`, `هذا الشهر · ${spendMonth.orders} طلبات`)}
              />
              <Tile value={spendMonth.avgPerOrder !== null ? `${spendMonth.avgPerOrder.toFixed(1)}` : "—"} label={t(`${aed} per order`, `${aed} لكل طلب`)} />
              <Tile
                value={spendMonth.per10gProtein !== null ? `${spendMonth.per10gProtein.toFixed(2)}` : "—"}
                label={t(`${aed} per 10g protein`, `${aed} لكل 10 جرام بروتين`)}
              />
            </div>
            <div className="mt-3 rounded-2xl bg-black/25 p-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-2">{t("This month's orders", "طلبات هذا الشهر")}</div>
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                <motion.div
                  className="bg-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(spendMonth.esaadOrders / spendMonth.orders) * 100}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.div
                  className="bg-white/30"
                  initial={{ width: 0 }}
                  animate={{ width: `${(spendMonth.fullPriceOrders / spendMonth.orders) * 100}%` }}
                  transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                <div>
                  <div className="text-xl font-black text-emerald-300">{spendMonth.esaadOrders}</div>
                  <div className="text-[10px] text-muted">💚 {t("with Esaad", "بخصم إسعاد")}</div>
                </div>
                <div>
                  <div className="text-xl font-black">{spendMonth.fullPriceOrders}</div>
                  <div className="text-[10px] text-muted">{t("without discount", "بدون خصم")}</div>
                </div>
                <div>
                  <div className="text-xl font-black text-violet-300">{spendMonth.pointsOrders}</div>
                  <div className="text-[10px] text-muted">⭐ {t("used points", "بالنقاط")}</div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-2">
              {t("Tap the 💰 on any order in your log to add or fix a price.", "اضغط 💰 على أي طلب في سجلك عشان تضيف أو تعدل السعر.")}
            </p>
          </>
        )}
      </Section>

      <Section title={t("Weight", "الوزن")} delay={0.1}>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
              placeholder={latest ? String(latest.kg) : t("e.g. 82.5", "مثلاً 82.5")}
              className="no-spin w-full bg-black/40 rounded-2xl ps-4 pe-12 py-3 text-xl font-bold outline-none border border-white/5 focus:border-gold/60"
            />
            <span className="absolute end-4 top-1/2 -translate-y-1/2 text-muted text-sm">kg</span>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={logWeight} className="rounded-2xl bg-gold text-black font-extrabold px-5">
            {latest?.date === todayKey ? t("Update", "تحديث") : t("Log", "سجّل")}
          </motion.button>
        </div>

        {weights.length === 0 ? (
          <p className="text-sm text-muted">
            {t(
              "Log your weight once a week (same day, morning) to see your trend here.",
              "سجل وزنك مرة بالأسبوع (نفس اليوم، الصبح) عشان تشوف الاتجاه هنا."
            )}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Tile value={`${trend[trend.length - 1].avg} kg`} label={t("trend weight", "الوزن (الاتجاه)")} />
              <Tile
                value={rate === null ? "—" : `${rate > 0 ? "▲ +" : rate < 0 ? "▼ " : ""}${rate} kg`}
                label={t("per week (8 wks)", "بالأسبوع (8 أسابيع)")}
              />
            </div>
            {weights.length >= 2 ? (
              <div dir="ltr">
                <WeightChart data={trend} />
              </div>
            ) : (
              <p className="text-xs text-muted">{t("One more weigh-in and your trend line appears.", "وزن واحد زيادة ويطلع لك الخط.")}</p>
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
                      <span className="text-sm flex-1 text-muted">{date(fromKey(w.date), { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="font-bold">{w.kg} kg</span>
                      <button
                        onClick={() => {
                          deleteWeight(w.date);
                          setWeights(loadWeights());
                        }}
                        aria-label={t(`Delete weigh-in ${w.date}`, `احذف وزن ${w.date}`)}
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
                {showAllWeights ? t("Show less", "أقل") : t(`Show all ${weights.length}`, `اعرض الكل (${weights.length})`)}
              </button>
            )}
          </>
        )}
      </Section>

      <Section title={t("🎯 Smart calorie target", "🎯 الهدف الذكي للسعرات")} delay={0.12}>
        {!maint ? (
          <>
            <p className="text-sm text-[#e8d5d6] leading-5">
              {t(
                "Once you have ~2 weeks of logs and weigh-ins, this works out your real maintenance calories from your own data — then suggests a target.",
                "لما يصير عندك أسبوعين تقريباً من التسجيل والوزن، يحسب سعرات الثبات الحقيقية من بياناتك — ويقترح لك هدف."
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-xl bg-black/25 p-2.5">
                <div className="text-[11px] text-muted">{t("Logged days (4 wks)", "أيام مسجلة (4 أسابيع)")}</div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="h-full bg-gold rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (loggedLast28 / 14) * 100)}%` }} />
                </div>
                <div className="text-xs font-bold mt-1">{Math.min(loggedLast28, 14)}/14</div>
              </div>
              <div className="rounded-xl bg-black/25 p-2.5">
                <div className="text-[11px] text-muted">{t("Weigh-ins over 1+ week", "أوزان على مدى أسبوع+")}</div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="h-full bg-gold rounded-full" initial={{ width: 0 }} animate={{ width: `${rate !== null ? 100 : Math.min(100, weights.length * 50)}%` }} />
                </div>
                <div className="text-xs font-bold mt-1">{rate !== null ? "✓" : `${Math.min(weights.length, 2)}/2`}</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tile value={maint.maintenance.toLocaleString("en-US")} label={t("maintenance kcal", "سعرات الثبات")} />
              <Tile value={`${maint.rate > 0 ? "+" : ""}${maint.rate} kg`} label={t(`per week at ~${maint.avgKcal}`, `بالأسبوع على ~${maint.avgKcal}`)} />
            </div>
            <p className="text-xs text-muted mt-3 mb-2">{t("Pick a weekly goal:", "اختار هدفك بالأسبوع:")}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`relative rounded-xl py-2 text-xs font-bold transition-colors ${goal === g ? "text-black" : "text-muted bg-white/5"}`}
                >
                  {goal === g && <motion.span layoutId="goal-pill" className="absolute inset-0 rounded-xl bg-gold" />}
                  <span className="relative">{g === 0 ? t("Maintain", "ثبات") : `${g} kg`}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-2xl bg-gold/10 ring-1 ring-gold/25 p-3.5 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[11px] text-muted">{t("Suggested workday target", "الهدف المقترح ليوم الدوام")}</div>
                <div className="text-2xl font-black gold-text">
                  <AnimatedNumber value={targetFor(maint.maintenance, goal)} /> kcal
                </div>
                <div className="text-[11px] text-muted">
                  {t(`now: ${targets.kcal.toLocaleString("en-US")}`, `الحالي: ${targets.kcal.toLocaleString("en-US")}`)} ·{" "}
                  {t(
                    `at current target: ${(((targets.kcal - maint.maintenance) * 7) / KCAL_PER_KG).toFixed(2)} kg/wk`,
                    `على هدفك الحالي: ${(((targets.kcal - maint.maintenance) * 7) / KCAL_PER_KG).toFixed(2)} كجم/أسبوع`
                  )}
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.93 }}
                disabled={targetFor(maint.maintenance, goal) === targets.kcal}
                onClick={() => applyTarget(targetFor(maint.maintenance, goal))}
                className="rounded-xl bg-gold text-black font-extrabold text-sm px-3.5 py-2.5 disabled:opacity-30"
              >
                {t("Apply", "طبّق")}
              </motion.button>
            </div>
            <p className="text-[10px] text-muted/70 mt-2">
              {t(
                `Based on ${maint.loggedDays} logged days and your weight trend. Estimates improve as you log more.`,
                `مبني على ${maint.loggedDays} يوم مسجل واتجاه وزنك. يصير أدق كل ما سجلت أكثر.`
              )}
            </p>
          </>
        )}
      </Section>

      <Section title={t("Reminders", "التذكيرات")} delay={0.15}>
        <p className="text-sm text-[#e8d5d6] leading-5">
          {t(
            "Adds two repeating reminders to your iPhone Calendar — they fire even when the app is closed:",
            "يضيف تذكيرين متكررين لتقويم الآيفون — يشتغلون حتى والتطبيق مسكّر:"
          )}
        </p>
        <ul className="text-xs text-muted mt-2 space-y-1">
          <li>🔔 {t("Mon–Fri 9:00 PM — log today & protect your streak", "الاثنين–الجمعة 9 بالليل — سجّل يومك وحافظ على السلسلة")}</li>
          <li>🌴 {t("Sunday 9:00 PM — weekend check-in", "الأحد 9 بالليل — تسجيل الويكند")}</li>
        </ul>
        <motion.button whileTap={{ scale: 0.97 }} onClick={downloadReminder} className="mt-3 w-full rounded-2xl bg-white/[0.07] ring-1 ring-white/10 font-bold py-3">
          📅 {t("Add reminders to Calendar", "أضف التذكيرات للتقويم")}
        </motion.button>
        <p className="text-[10px] text-muted/70 mt-2">
          {t(
            "On iPhone: tap the button, then “Add All”. Edit or delete them anytime in the Calendar app.",
            "في الآيفون: اضغط الزر، بعدين “Add All”. تقدر تعدلها أو تحذفها من تطبيق التقويم."
          )}
        </p>
      </Section>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-4 z-30 mx-auto max-w-md glass rounded-2xl px-4 py-3 text-sm font-semibold text-center"
            style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
