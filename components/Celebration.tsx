"use client";

import { useI18n } from "@/lib/i18n";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#ffc72c", "#ff9f1c", "#da291c", "#ffe08a", "#34d399", "#f7ecec"];

export function Celebration({ streak, onDone }: { streak: number | null; onDone: () => void }) {
  const { t } = useI18n();
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 360,
        y: -(220 + Math.random() * 320),
        r: Math.random() * 720 - 360,
        w: 6 + Math.random() * 6,
        c: COLORS[i % COLORS.length],
        d: Math.random() * 0.25,
      })),
    // regenerate per celebration
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streak]
  );

  return (
    <AnimatePresence>
      {streak !== null && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          <div className="absolute left-1/2 top-[62%]">
            {pieces.map((p) => (
              <motion.span
                key={p.id}
                className="absolute rounded-sm"
                style={{ width: p.w, height: p.w * 0.45, background: p.c }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{ x: p.x, y: [0, p.y, p.y + 520], rotate: p.r, opacity: [1, 1, 0] }}
                transition={{ duration: 2.4, delay: p.d, ease: "easeOut", times: [0, 0.35, 1] }}
              />
            ))}
          </div>
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
            className="relative glass rounded-[2rem] px-8 py-7 text-center mx-6"
          >
            <motion.div
              className="text-6xl"
              animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              🏆
            </motion.div>
            <div className="text-4xl font-black gold-text mt-2">{t(`${streak} weekdays!`, `${streak} أيام دوام!`)}</div>
            <p className="text-sm text-[#e8d5d6] mt-2">
              {streak! >= 20
                ? t("Machine mode. Absolutely locked in.", "وضع الآلة. ملتزم مية بالمية.")
                : streak! >= 10
                  ? t("Two full weeks. This is a habit now.", "أسبوعين كاملين. صارت عادة.")
                  : t("A full week on target. Keep the fire going 🔥", "أسبوع كامل على الهدف. كمّل 🔥")}
            </p>
            <p className="text-[11px] text-muted mt-4">{t("Tap to continue", "اضغط للمتابعة")}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
