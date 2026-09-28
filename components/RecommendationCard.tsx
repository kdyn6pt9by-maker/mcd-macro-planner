"use client";

import { Combination } from "@/lib/types";
import { combinationLabel } from "@/lib/engine/optimizer";

const LABEL_STYLES: Record<string, string> = {
  "BEST MATCH": "bg-gold text-black",
  "MORE PROTEIN": "bg-success/20 text-success border border-success/50",
  "HIGHER FAT": "bg-warn/20 text-warn border border-warn/50",
  "LOWER CALORIES": "bg-blue-500/20 text-blue-300 border border-blue-500/50",
  "FEWER SANDWICHES": "bg-white/10 text-muted border border-white/20",
};

interface Props {
  combo: Combination;
  usedBefore: boolean;
  onSelect: () => void;
}

export function RecommendationCard({ combo, usedBefore, onSelect }: Props) {
  return (
    <div className="rounded-xl2 bg-card border border-cardBorder p-4 animate-card-in">
      <div className="flex flex-wrap gap-2 mb-2">
        {combo.labels.map((l) => (
          <span key={l} className={`text-xs font-bold px-2 py-1 rounded-full ${LABEL_STYLES[l] ?? "bg-white/10"}`}>
            {l}
          </span>
        ))}
        {usedBefore && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/10 text-muted">Used before ✓</span>
        )}
        {combo.hasUnverifiedItem && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-red/20 text-red border border-red/40">
            unverified nutrition
          </span>
        )}
      </div>

      <div className="text-lg font-semibold mb-3">{combinationLabel(combo)}</div>

      <div className="text-sm text-muted mb-1">Adds:</div>
      <div className="text-sm mb-3">
        {combo.totals.kcal} kcal · {combo.totals.protein} g protein · {combo.totals.fat} g fat · {combo.totals.carbs} g carbs
      </div>

      <div className="text-sm text-muted mb-1">Day after eating:</div>
      <div className="text-sm mb-3">
        {combo.afterEating.kcal} kcal · {combo.afterEating.protein} g protein · {combo.afterEating.fat} g fat ·{" "}
        {combo.afterEating.carbs} g carbs
      </div>

      <div className="text-sm text-gold font-medium mb-3">
        {Math.max(0, combo.remainingKcal)} kcal remaining
      </div>

      <button
        onClick={onSelect}
        className="btn-tap w-full rounded-xl bg-gold text-black font-bold py-2.5"
      >
        I'll eat this
      </button>
    </div>
  );
}
