"use client";

import { useI18n } from "@/lib/i18n";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { fromKey } from "@/lib/progress";

export interface BarPoint {
  date: string;
  value: number | null;
}

interface Props {
  points: BarPoint[];
  target: number;
  targetLabel: string;
  unit: string;
  color: string;
  /** "max" = staying under target is good (calories); "min" = reaching target is good (protein). */
  goal: "max" | "min";
}

const W = 340;
const H = 170;
const PAD = { top: 14, right: 6, bottom: 22, left: 34 };

function niceMax(v: number) {
  const step = v > 1000 ? 500 : v > 200 ? 50 : 20;
  return Math.ceil((v * 1.08) / step) * step;
}

export function BarChart({ points, target, targetLabel, unit, color, goal }: Props) {
  const { t, date } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.value ?? 0);
  const yMax = niceMax(Math.max(target, ...values));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / points.length;
  const barW = Math.max(3, Math.min(22, slot - (points.length > 14 ? 2 : 6)));
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const ticks = [0, yMax / 2, yMax];
  const dense = points.length > 14;
  const a = active !== null ? points[active] : null;

  return (
    <div className="relative" onPointerLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label={`${targetLabel} chart`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#b39597">
              {Math.round(t).toLocaleString("en-US")}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          if (p.value === null) {
            return <circle key={p.date} cx={cx} cy={y(0) - 2} r={1.6} fill="rgba(255,255,255,0.18)" />;
          }
          const h = Math.max(2, y(0) - y(p.value));
          const dim = active !== null && active !== i;
          return (
            <motion.rect
              key={p.date}
              x={cx - barW / 2}
              width={barW}
              rx={Math.min(4, barW / 2)}
              fill={color}
              initial={{ y: y(0), height: 0 }}
              animate={{ y: y(0) - h, height: h, opacity: dim ? 0.35 : 1 }}
              transition={{
                default: { delay: i * (dense ? 0.012 : 0.04), type: "spring", stiffness: 180, damping: 22 },
                opacity: { duration: 0.15 },
              }}
            />
          );
        })}

        <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke="#f7ecec" strokeOpacity={0.55} strokeDasharray="4 4" />
        <text x={W - PAD.right} y={y(target) - 4} textAnchor="end" fontSize="9" fill="#e8d5d6">
          {targetLabel} {target.toLocaleString("en-US")}
        </text>

        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const show = !dense || i % 5 === 0 || i === points.length - 1;
          return (
            <g key={p.date}>
              {show && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="#b39597">
                  {dense ? fromKey(p.date).getDate() : fromKey(p.date).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
                </text>
              )}
              {/* hit target larger than the bar */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH + PAD.bottom}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {a && (
          <div
            key={a.date}
            className="pointer-events-none absolute top-0"
            style={{
              left: `${((PAD.left + slot * active! + slot / 2) / W) * 100}%`,
              transform: `translateX(${active! > points.length / 2 ? "-100%" : "0"})`,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-black/85 ring-1 ring-white/10 px-2.5 py-1.5 text-[11px] leading-4 whitespace-nowrap"
            >
            <div className="text-muted">{date(fromKey(a.date), { weekday: "short", month: "short", day: "numeric" })}</div>
            {a.value === null ? (
              <div className="text-[#e8d5d6]">{t("Not logged", "ما انسجل")}</div>
            ) : (
              <div className="text-[#f7ecec] font-bold">
                {Math.round(a.value).toLocaleString("en-US")} {unit}{" "}
                <span className="font-medium text-muted">
                  {goal === "min"
                    ? a.value >= target
                      ? t("✓ target hit", "✓ وصلت الهدف")
                      : t(`· ${Math.round(target - a.value)} short`, `· ناقص ${Math.round(target - a.value)}`)
                    : a.value > target
                      ? t(`▲ ${Math.round(a.value - target)} over`, `▲ ${Math.round(a.value - target)} زيادة`)
                      : t(`· ${Math.round(target - a.value)} under`, `· أقل بـ ${Math.round(target - a.value)}`)}
                </span>
              </div>
            )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
