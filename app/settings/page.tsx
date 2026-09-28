"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearHistory, loadSettings, saveSettings } from "@/lib/storage";
import { DayMode, Settings } from "@/lib/types";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 border-b border-cardBorder/60">
      <span className="text-sm text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-black/30 rounded-lg px-2 py-1 text-right text-sm border border-cardBorder"
      />
    </label>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  if (!settings) return <div className="p-6 text-muted">Loading…</div>;

  const modes: DayMode[] = ["workday", "weekend"];

  return (
    <main className="max-w-md mx-auto px-4 pb-24 pt-6">
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-muted text-sm">
          ← Back
        </Link>
        <h1 className="text-lg font-bold">Settings</h1>
      </header>

      {modes.map((m) => (
        <section key={m} className="rounded-xl2 bg-card border border-cardBorder p-4 mb-4">
          <h2 className="font-semibold capitalize mb-2">{m} targets</h2>
          <NumberField
            label="Calories"
            value={settings.targets[m].kcal}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], kcal: v } } })}
          />
          <NumberField
            label="Protein min (g)"
            value={settings.targets[m].proteinMin}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], proteinMin: v } } })}
          />
          <NumberField
            label="Fat min (g)"
            value={settings.targets[m].fatMin}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], fatMin: v } } })}
          />
          <NumberField
            label="Fat max (g)"
            value={settings.targets[m].fatMax}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], fatMax: v } } })}
          />
          <NumberField
            label="Carbs reference (g)"
            value={settings.targets[m].carbsRef}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], carbsRef: v } } })}
          />
        </section>
      ))}

      <section className="rounded-xl2 bg-card border border-cardBorder p-4 mb-4">
        <h2 className="font-semibold mb-2">Nada Protein Milk</h2>
        <NumberField label="Calories / bottle" value={settings.nada.kcal} onChange={(v) => update({ ...settings, nada: { ...settings.nada, kcal: v } })} />
        <NumberField label="Protein (g)" value={settings.nada.protein} onChange={(v) => update({ ...settings, nada: { ...settings.nada, protein: v } })} />
        <NumberField label="Fat (g)" value={settings.nada.fat} onChange={(v) => update({ ...settings, nada: { ...settings.nada, fat: v } })} />
        <NumberField label="Carbs (g)" value={settings.nada.carbs} onChange={(v) => update({ ...settings, nada: { ...settings.nada, carbs: v } })} />
        <NumberField label="Max bottles/day" value={settings.nada.maxPerDay} onChange={(v) => update({ ...settings, nada: { ...settings.nada, maxPerDay: v } })} />
      </section>

      <section className="rounded-xl2 bg-card border border-cardBorder p-4 mb-4">
        <h2 className="font-semibold mb-2">Usual Meal</h2>
        <NumberField label="Calories" value={settings.usualMeal.kcal} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, kcal: v } })} />
        <NumberField label="Protein (g)" value={settings.usualMeal.protein} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, protein: v } })} />
        <NumberField label="Fat (g)" value={settings.usualMeal.fat} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, fat: v } })} />
        <NumberField label="Carbs (g)" value={settings.usualMeal.carbs} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, carbs: v } })} />
      </section>

      <section className="rounded-xl2 bg-card border border-cardBorder p-4 mb-4">
        <h2 className="font-semibold mb-2">Nutrition Database — McDonald's UAE</h2>
        <p className="text-xs text-muted mb-3">
          Values must come from official mcdonalds.com/ae nutrition pages. Items stay disabled (excluded from
          recommendations) until marked Verified.
        </p>
        {settings.foods.map((food, idx) => (
          <div key={food.id} className="border-b border-cardBorder/60 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{food.name}</span>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={food.enabled}
                  onChange={(e) => {
                    const foods = [...settings.foods];
                    foods[idx] = { ...food, enabled: e.target.checked };
                    update({ ...settings, foods });
                  }}
                />
                Enabled
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {(["kcal", "protein", "fat", "carbs"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  value={food.macros[k]}
                  placeholder={k}
                  onChange={(e) => {
                    const foods = [...settings.foods];
                    foods[idx] = { ...food, macros: { ...food.macros, [k]: Number(e.target.value) } };
                    update({ ...settings, foods });
                  }}
                  className="bg-black/30 rounded-lg px-2 py-1 text-xs border border-cardBorder"
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={food.verified}
                onChange={(e) => {
                  const foods = [...settings.foods];
                  foods[idx] = {
                    ...food,
                    verified: e.target.checked,
                    lastVerified: e.target.checked ? new Date().toISOString().slice(0, 10) : undefined,
                  };
                  update({ ...settings, foods });
                }}
              />
              <span className={food.verified ? "text-success" : "text-red"}>
                {food.verified ? "Verified from official source" : "Not verified — excluded from recommendations"}
              </span>
            </label>
          </div>
        ))}
      </section>

      <section className="rounded-xl2 bg-card border border-cardBorder p-4 mb-4">
        <h2 className="font-semibold mb-2">History</h2>
        <button
          onClick={() => clearHistory()}
          className="btn-tap w-full rounded-xl bg-red/20 text-red border border-red/40 py-2 text-sm font-semibold"
        >
          Clear favorites / history
        </button>
      </section>
    </main>
  );
}
