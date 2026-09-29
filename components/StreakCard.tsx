"use client";

import { motion } from "framer-motion";
import { nextMilestone, STREAK_MILESTONE, WeekdayStatus } from "@/lib/progress";
import { AnimatedNumber } from "./AnimatedNumber";

const STYLE: Record<WeekdayStatus, string> = {
  done: "bg-gradient-to-b from-[#ffb020] to-[#ff5a1f] text-black shadow-[0_6px_18px_-6px_rgba(255,120,30,0.8)]",
  missed: "bg-white/[0.04] text-muted/60 ring-1 ring-white/5",
  today: "bg-gold/10 text-gold ring-2 ring-gold/60",
  future: "bg-white/[0.03] text-muted/50 ring-1 ring-dashed ring-white/10",
};

const MESSAGES = [
  (n: number) => (n === 0 ? "Start today — hit protein, stay under fat." : ""),
  (n: number) => (n % STREAK_MILESTONE === 0 ? `🏆 ${n}-day milestone reached! Next stop: ${n + STREAK_MILESTONE}.` : ""),
  (n: number, left: number) => (left === 1 ? `One more weekday to ${n + 1}! 🔥` : ""),
  (n: number, left: number) => `${left} weekdays to your next milestone.`,
];

export function StreakCard({
  streak,
  week,
  compact = false,
}: {
  streak: number;
  week: { date: string; label: string; status: WeekdayStatus }[];
  compact?: boolean;
}) {
  const next = nextMilestone(streak);
  const left = next - streak;
  const pct = ((STREAK_MILESTONE - left) / STREAK_MILESTONE) * 100;
  const message = MESSAGES.map((m) => m(streak, left)).find(Boolean);

  return (
    <div className="glass rounded-xl3 p-4 relative overflow-hidden">
      <div className="flex items-center gap-3">
        <motion.div
          className="text-4xl"
          animate={streak > 0 ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] } : { opacity: 0.4 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          🔥
        </motion.div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Weekday streak</div>
          <div className="text-3xl font-black leading-none mt-0.5">
            <AnimatedNumber value={streak} />
            <span className="text-sm font-semibold text-muted"> {streak === 1 ? "day" : "days"}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted">Next</div>
          <div className="text-lg font-black gold-text">🏆 {next}</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {week.map((d, i) => (
          <motion.div
            key={d.date}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.07, type: "spring", stiffness: 400, damping: 20 }}
            className={`rounded-2xl py-2 flex flex-col items-center gap-0.5 ${STYLE[d.status]}`}
            aria-label={`${d.label}: ${d.status}`}
          >
            <span className="text-[10px] font-bold uppercase">{d.label}</span>
            <span className="text-base leading-none">
              {d.status === "done" ? "🔥" : d.status === "missed" ? "·" : d.status === "today" ? "◎" : "○"}
            </span>
          </motion.div>
        ))}
      </div>

      {!compact && (
        <>
          <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#ff5a1f,#ffc72c)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="text-xs text-muted mt-2">{message}</p>
          <p className="text-[10px] text-muted/70 mt-1">
            Mon–Fri only · a day counts when protein is hit, fat ≤ max and calories ≤ target +100. Weekends never break it.
          </p>
        </>
      )}
    </div>
  );
}
