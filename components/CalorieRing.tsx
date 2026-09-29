"use client";

import { useI18n } from "@/lib/i18n";

import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";

const SIZE = 220;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const { t } = useI18n();
  const pct = target > 0 ? Math.min(1, eaten / target) : 0;
  const over = eaten > target;
  const remaining = Math.round(target - eaten);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <motion.div
        className="absolute inset-6 rounded-full"
        style={{ background: over ? "rgba(218,41,28,0.25)" : "rgba(255,199,44,0.14)", filter: "blur(28px)" }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg width={SIZE} height={SIZE} className="-rotate-90 relative">
        <defs>
          <linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe08a" />
            <stop offset="55%" stopColor="#ffc72c" />
            <stop offset="100%" stopColor="#ff8a1c" />
          </linearGradient>
          <linearGradient id="ringRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b5b" />
            <stop offset="100%" stopColor="#da291c" />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} fill="none" />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={over ? "url(#ringRed)" : "url(#ringGold)"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{t("Calories", "السعرات")}</div>
        <div className="text-5xl font-black tracking-tight leading-none mt-1">
          <AnimatedNumber value={Math.round(eaten)} />
        </div>
        <div className="text-sm text-muted mt-1">{t(`of ${target.toLocaleString("en-US")} kcal`, `من ${target.toLocaleString("en-US")} سعرة`)}</div>
        <motion.div
          key={over ? "over" : "left"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${
            over ? "bg-red/25 text-[#ff8a7d]" : "bg-gold/15 text-gold"
          }`}
        >
          {over ? t(`${Math.abs(remaining)} over`, `${Math.abs(remaining)} زيادة`) : t(`${remaining} left`, `باقي ${remaining}`)}
        </motion.div>
      </div>
    </div>
  );
}
