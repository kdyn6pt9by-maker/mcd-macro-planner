"use client";

interface Props {
  label: string;
  value: number;
  target: number;
  unit: string;
  variant?: "default" | "success-at-target" | "warn-near-max";
}

export function ProgressStat({ label, value, target, unit, variant = "default" }: Props) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const isProteinDone = variant === "success-at-target" && value >= target;
  const isFatWarning = variant === "warn-near-max" && value >= target - 10 && value <= target;
  const isFatOver = variant === "warn-near-max" && value > target;

  const barColor = isFatOver ? "bg-red" : isFatWarning ? "bg-warn" : isProteinDone ? "bg-success" : "bg-gold";

  return (
    <div className="rounded-xl2 bg-card border border-cardBorder p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-muted uppercase tracking-wide">{label}</span>
        {isProteinDone && (
          <span className="text-success text-xs font-semibold animate-pop">DONE ✓</span>
        )}
      </div>
      <div className="text-2xl font-bold mb-2">
        {value}
        <span className="text-muted text-base font-normal"> / {target} {unit}</span>
      </div>
      <div className="h-2 rounded-full bg-black/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
