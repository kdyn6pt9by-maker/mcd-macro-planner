"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { dayCost } from "@/lib/insights";
import { DayState } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

/** McDonald's + Nada = total for one day, shown under that day's log. */
export function DayCostBar({ day, nadaPrice, link = true }: { day: DayState; nadaPrice: number; link?: boolean }) {
  const { t } = useI18n();
  const c = dayCost(day, nadaPrice);
  if (c.total === 0) return null;
  const aed = t("AED", "درهم");
  const paid = new Set((day.payments ?? []).map((p) => p.orderId));
  const unpriced = new Set(day.entries.filter((e) => e.kind === "mcdonalds" && !(e.groupId && paid.has(e.groupId))).map((e) => e.groupId ?? e.id)).size;

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2.5 rounded-2xl px-4 py-3 ring-1 ring-gold/25"
      style={{ background: "linear-gradient(135deg,rgba(255,199,44,0.10),rgba(52,211,153,0.06))" }}
    >
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="text-muted">🍔 {t("McD", "ماك")}</span>
        <b>{c.mcd}</b>
        <span className="text-muted">+</span>
        <span className="text-muted">
          🥛 {t("Nada", "ندى")} <span className="text-[11px]">({c.nadaBottles}×{nadaPrice})</span>
        </span>
        <b>{c.nada}</b>
        <span className="text-muted">=</span>
        <span className="ms-auto text-lg font-black gold-text">
          <AnimatedNumber value={c.total} decimals={c.total % 1 ? 1 : 0} /> {aed}
        </span>
      </div>
      {unpriced > 0 && (
        <div className="text-[10px] text-muted mt-1">
          {t(`${unpriced} McDonald's meal${unpriced > 1 ? "s" : ""} without a price — tap “+ price” to include it.`, `${unpriced} وجبة ماك بدون سعر — اضغط “+ السعر” عشان تنحسب.`)}
        </div>
      )}
    </motion.div>
  );

  return link ? <Link href="/spending">{body}</Link> : body;
}
