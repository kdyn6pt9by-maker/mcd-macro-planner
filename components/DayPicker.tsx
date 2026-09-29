"use client";

import { useI18n } from "@/lib/i18n";
import { fromKey, toKey } from "@/lib/progress";

/** Which day to log to: chips for the last week plus a calendar for anything older. */
// Plain colour transitions on purpose: a shared-layout (layoutId) highlight inside a sheet stalls the
// sheet's exit animation and leaves an invisible backdrop blocking taps.
export function DayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const { t, date } = useI18n();
  const today = new Date();
  const chips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return {
      key: toKey(d),
      label: i === 0 ? t("Today", "اليوم") : i === 1 ? t("Yesterday", "أمس") : `${date(d, { weekday: "short" })} ${d.getDate()}`,
    };
  });
  const older = !chips.some((c) => c.key === value);

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 ${
            value === c.key ? "bg-gold text-black" : "text-muted bg-white/5"
          }`}
        >
          {c.label}
        </button>
      ))}
      <label
        className={`relative shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
          older ? "bg-gold text-black" : "text-muted bg-white/5"
        }`}
      >
        📅 {older ? date(fromKey(value), { month: "short", day: "numeric" }) : t("Older…", "أقدم…")}
        <input
          type="date"
          max={toKey(today)}
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  );
}
