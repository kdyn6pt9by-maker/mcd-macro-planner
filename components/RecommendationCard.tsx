"use client";

import { foodEmoji } from "@/lib/foodEmoji";

import { useI18n } from "@/lib/i18n";

import { motion } from "framer-motion";
import { Combination } from "@/lib/types";
import type { HistoryEntry } from "@/lib/storage";

const LABEL_STYLES: Record<string, string> = {
  "BEST MATCH": "bg-gold text-black",
  "MORE PROTEIN": "bg-success/15 text-success ring-1 ring-success/40",
  "HIGHER FAT": "bg-warn/15 text-warn ring-1 ring-warn/40",
  "LOWER CALORIES": "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40",
  "FEWER SANDWICHES": "bg-white/10 text-[#e8d5d6] ring-1 ring-white/20",
};

export function relativeDay(iso: string, ar = false): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return ar ? "اليوم" : "today";
  if (days === 1) return ar ? "أمس" : "yesterday";
  if (days < 7) return ar ? `قبل ${days} أيام` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(ar ? "ar-AE-u-nu-latn" : "en-US", { month: "short", day: "numeric" });
}

const LABEL_AR: Record<string, string> = {
  "BEST MATCH": "الأفضل",
  "MORE PROTEIN": "بروتين أكثر",
  "HIGHER FAT": "دهون أعلى",
  "LOWER CALORIES": "سعرات أقل",
  "FEWER SANDWICHES": "سندويشات أقل",
};

interface Props {
  combo: Combination;
  index: number;
  history?: HistoryEntry;
  proteinTarget: number;
  onSelect: () => void;
}

export function RecommendationCard({ combo, index, history, proteinTarget, onSelect }: Props) {
  const { t, ar } = useI18n();
  const best = combo.labels.includes("BEST MATCH");
  const proteinHit = combo.afterEating.protein >= proteinTarget;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 260, damping: 24 }}
      className={`relative rounded-xl3 p-[1px] ${
        best ? "bg-gradient-to-br from-gold via-[#ff9f1c] to-red" : "bg-white/[0.06]"
      }`}
    >
      <div className="rounded-[calc(1.75rem-1px)] bg-[#150709]/95 p-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {combo.labels.map((l) => (
            <span key={l} className={`text-[10px] font-black tracking-wider px-2 py-1 rounded-full ${LABEL_STYLES[l] ?? "bg-white/10"}`}>
              {ar ? LABEL_AR[l] ?? l : l}
            </span>
          ))}
          {history && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.08 + 0.25, type: "spring", stiffness: 400 }}
              className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/40"
            >
              {t(`↺ Chosen ${history.count}×`, `↺ اخترته ${history.count}×`)} · {relativeDay(history.lastUsed, ar)}
            </motion.span>
          )}
          <span className="ms-auto text-[11px] text-muted">#{index + 1}</span>
        </div>

        <div className="space-y-1.5 mb-4">
          {combo.items.map(({ food, qty }) => (
            <div key={food.id} className="flex items-center gap-2.5">
              <span className="min-w-[2rem] h-7 px-1.5 rounded-lg bg-gold/15 text-gold text-sm font-black flex items-center justify-center">
                {qty}×
              </span>
              <span className="font-semibold">{foodEmoji(food.id + food.name)} {food.name}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center mb-3">
          {[
            { k: "kcal", v: combo.totals.kcal, c: "text-gold" },
            { k: "protein", v: combo.totals.protein, c: "text-success" },
            { k: "fat", v: combo.totals.fat, c: "text-warn" },
            { k: "carbs", v: combo.totals.carbs, c: "text-carb" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl bg-white/[0.03] py-2">
              <div className={`text-base font-extrabold ${s.c}`}>+{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-black/30 px-3 py-2.5 text-xs text-muted leading-5 mb-3">
          <span className="text-[#e8d5d6] font-semibold">{t("After eating:", "بعد الأكل:")}</span> {combo.afterEating.kcal} kcal ·{" "}
          <span className={proteinHit ? "text-success font-semibold" : ""}>
            {combo.afterEating.protein}g protein{proteinHit ? " ✓" : ""}
          </span>{" "}
          · {combo.afterEating.fat}g fat · {combo.afterEating.carbs}g carbs
          <div className="text-gold font-semibold mt-0.5">
            {combo.remainingKcal >= 0 ? t(`${combo.remainingKcal} kcal remaining`, `باقي ${combo.remainingKcal} سعرة`) : t(`${-combo.remainingKcal} kcal over`, `${-combo.remainingKcal} سعرة زيادة`)}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onSelect}
          className={`w-full rounded-2xl font-extrabold py-3 ${
            best ? "bg-gold text-black" : "bg-white/[0.07] text-[#f7ecec] ring-1 ring-white/10"
          }`}
        >
          {history ? t("I'll eat this again", "باكله مرة ثانية") : t("I'll eat this", "باكل هذا")}
        </motion.button>
      </div>
    </motion.div>
  );
}
