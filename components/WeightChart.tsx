"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { fromKey, WeightEntry } from "@/lib/progress";

const W = 340;
const H = 170;
const PAD = { top: 14, right: 10, bottom: 22, left: 34 };

export function WeightChart({ data }: { data: (WeightEntry & { avg: number })[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const t0 = fromKey(data[0].date).getTime();
  const t1 = Math.max(fromKey(data[data.length - 1].date).getTime(), t0 + 7 * 86_400_000);
  const all = data.flatMap((d) => [d.kg, d.avg]);
  const lo = Math.floor(Math.min(...all) - 0.5);
  const hi = Math.ceil(Math.max(...all) + 0.5);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (date: string) => PAD.left + ((fromKey(date).getTime() - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(d.date).toFixed(1)},${y(d.avg).toFixed(1)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  const a = active !== null ? data[active] : null;

  return (
    <div className="relative" onPointerLeave={() => setActive(null)}>
      <div className="flex gap-4 text-[11px] text-muted mb-1">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-gold" /> Trend (14-day avg)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#e8d5d6]" /> Weigh-in
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label="Weight trend chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#b39597">
              {t.toFixed(t % 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        <motion.path
          d={path}
          fill="none"
          stroke="#ffc72c"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        {data.map((d, i) => (
          <motion.circle
            key={d.date}
            cx={x(d.date)}
            cy={y(d.kg)}
            r={active === i ? 5.5 : 4}
            fill="#e8d5d6"
            stroke="#150709"
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05, type: "spring", stiffness: 400 }}
          />
        ))}
        {[data[0], data[data.length - 1]].map((d, i) => (
          <text key={i} x={x(d.date)} y={H - 6} textAnchor={i ? "end" : "start"} fontSize="9" fill="#b39597">
            {fromKey(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        ))}
        {data.map((d, i) => (
          <circle
            key={`hit-${d.date}`}
            cx={x(d.date)}
            cy={y(d.kg)}
            r={16}
            fill="transparent"
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          />
        ))}
      </svg>
      <AnimatePresence>
        {a && (
          <div
            key={a.date}
            className="pointer-events-none absolute top-5"
            style={{
              left: `${(x(a.date) / W) * 100}%`,
              transform: `translateX(${active! > data.length / 2 ? "-100%" : "0"})`,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-black/85 ring-1 ring-white/10 px-2.5 py-1.5 text-[11px] leading-4 whitespace-nowrap"
            >
            <div className="text-muted">{fromKey(a.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
            <div className="text-[#f7ecec] font-bold">
              {a.kg} kg <span className="font-medium text-muted">· trend {a.avg}</span>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
