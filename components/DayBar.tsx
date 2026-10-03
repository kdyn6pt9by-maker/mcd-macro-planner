"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { sumMacros } from "@/lib/engine/macros";
import { useI18n } from "@/lib/i18n";
import { loadReserve } from "@/lib/reserve";
import { loadAllDays, loadMode, loadSettings, todayKey } from "@/lib/storage";
import { DATA_EVENT, targetsFor } from "@/lib/targets";
import { Macros, Targets } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * Today's calories, pinned to the top of every page (except settings), just under the iPhone status bar.
 * Tapping it goes to Today.
 */
export function DayBar({ eaten, targets }: { eaten: Macros; targets: Targets }) {
  const { t } = useI18n();
  const left = Math.round(targets.kcal - eaten.kcal);
  const over = left < 0;
  const pct = Math.min(1, targets.kcal > 0 ? eaten.kcal / targets.kcal : 0);
  const proteinHit = eaten.protein >= targets.proteinMin;

  return (
    <div
      className="sticky z-20 -mx-4 px-4 pt-2 pb-2 mb-3 bg-[#0b0405]/90 backdrop-blur-xl"
      style={{ top: "env(safe-area-inset-top)", marginTop: "-1rem" }}
    >
      <Link href="/" className="block rounded-2xl glass px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span>🔥</span>
          <span className="font-black">
            <AnimatedNumber value={Math.round(eaten.kcal)} />
            <span className="text-muted font-bold"> / {targets.kcal.toLocaleString("en-US")}</span>
          </span>
          <span className={`ms-auto text-xs font-black ${over ? "text-[#ff8a7d]" : "text-success"}`}>
            {over ? t(`${-left} over`, `زايد ${-left}`) : t(`${left} left`, `باقي ${left}`)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${over ? "bg-red" : "bg-gold"}`}
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-1 flex gap-3 text-[10px] text-muted">
          <span className={proteinHit ? "text-success font-bold" : ""}>
            P {Math.round(eaten.protein)}/{targets.proteinMin}
            {proteinHit ? " ✓" : ""}
          </span>
          <span className={eaten.fat > targets.fatMax ? "text-[#ff8a7d] font-bold" : ""}>
            F {Math.round(eaten.fat)}/{targets.fatMax}
          </span>
          <span>C {Math.round(eaten.carbs)}/~{targets.carbsRef}</span>
        </div>
      </Link>
    </div>
  );
}

/** DayBar for pages other than home: reads today from storage and refreshes whenever data changes. */
export function DayBarLive() {
  const [data, setData] = useState<{ eaten: Macros; targets: Targets } | null>(null);

  useEffect(() => {
    const load = () => {
      const settings = loadSettings();
      const days = loadAllDays();
      const today = todayKey();
      const eaten = sumMacros(days[today]?.entries.map((e) => e.macros) ?? []);
      setData({ eaten, targets: targetsFor(today, settings, loadMode(), days, loadReserve()) });
    };
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener(DATA_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(DATA_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return data ? <DayBar eaten={data.eaten} targets={data.targets} /> : null;
}
