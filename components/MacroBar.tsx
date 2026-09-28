"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  label: string;
  value: number;
  target: number;
  suffix?: string;
  kind: "protein" | "fat" | "carbs";
}

export function MacroBar({ label, value, target, suffix, kind }: Props) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const proteinDone = kind === "protein" && value >= target;
  const fatOver = kind === "fat" && value > target;
  const fatNear = kind === "fat" && !fatOver && value >= target - 8;

  const fill = proteinDone
    ? "linear-gradient(90deg,#10b981,#34d399)"
    : fatOver
      ? "linear-gradient(90deg,#b91c1c,#ef4444)"
      : fatNear
        ? "linear-gradient(90deg,#ea580c,#fb923c)"
        : kind === "carbs"
          ? "linear-gradient(90deg,#8b5a2b,#d6a15c)"
          : "linear-gradient(90deg,#ff9f1c,#ffc72c)";

  return (
    <div className="glass rounded-xl2 p-3.5">
      <div className="flex items-center justify-between h-5">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</span>
        <AnimatePresence>
          {proteinDone && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className="text-[10px] font-black bg-success/20 text-success px-1.5 py-0.5 rounded-full"
            >
              DONE ✓
            </motion.span>
          )}
          {(fatNear || fatOver) && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className={`text-[10px] font-black ${fatOver ? "text-[#ff8a7d]" : "text-warn"}`}
            >
              {fatOver ? "OVER" : "CLOSE"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-1.5 text-2xl font-extrabold tracking-tight">
        <AnimatedNumber value={value} decimals={kind === "fat" && value % 1 !== 0 ? 1 : 0} />
        <span className="text-xs text-muted font-medium">
          {" "}
          / {suffix ?? ""}
          {target}g
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: fill }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
