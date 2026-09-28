"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProgressStat } from "@/components/ProgressStat";
import { RecommendationCard } from "@/components/RecommendationCard";
import {
  loadDay,
  loadMode,
  loadSettings,
  recordCombinationUsed,
  saveDay,
  saveMode,
  wasUsedBefore,
} from "@/lib/storage";
import { DayMode, DayState, Settings } from "@/lib/types";
import { addMacros } from "@/lib/engine/macros";
import { combinationKey, findRecommendations } from "@/lib/engine/optimizer";
import { smartAdvice } from "@/lib/engine/advice";

export default function HomePage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<DayMode>("workday");
  const [day, setDay] = useState<DayState | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const m = loadMode();
    setMode(m);
    setSettings(loadSettings());
    setDay(loadDay(m));
  }, []);

  const targets = settings?.targets[mode];

  function persist(next: DayState) {
    setDay(next);
    saveDay(next);
  }

  function switchMode(next: DayMode) {
    setMode(next);
    saveMode(next);
    if (day) persist({ ...day, mode: next });
  }

  function addUsualMeal() {
    if (!settings || !day || day.usualMealAdded) return;
    const meal = settings.usualMeal;
    persist({
      ...day,
      eaten: addMacros(day.eaten, meal),
      usualMealAdded: true,
      log: [...day.log, `Added usual meal: ${meal.label}`],
    });
  }

  function addNada() {
    if (!settings || !day) return;
    if (day.nadaCount >= settings.nada.maxPerDay) return;
    persist({
      ...day,
      eaten: addMacros(day.eaten, settings.nada),
      nadaCount: day.nadaCount + 1,
      log: [...day.log, "Added Nada bottle"],
    });
  }

  function undoLast() {
    if (!day || day.log.length === 0) return;
    // Simple undo: recompute is not tracked line-by-line, so just clear the day.
    // Kept intentionally simple per spec (no full food log needed).
    const lastAction = day.log[day.log.length - 1];
    const log = day.log.slice(0, -1);
    if (lastAction.startsWith("Added Nada") && settings) {
      persist({
        ...day,
        eaten: {
          kcal: day.eaten.kcal - settings.nada.kcal,
          protein: day.eaten.protein - settings.nada.protein,
          fat: day.eaten.fat - settings.nada.fat,
          carbs: day.eaten.carbs - settings.nada.carbs,
        },
        nadaCount: Math.max(0, day.nadaCount - 1),
        log,
      });
    } else if (lastAction.startsWith("Added usual meal") && settings) {
      persist({
        ...day,
        eaten: {
          kcal: day.eaten.kcal - settings.usualMeal.kcal,
          protein: day.eaten.protein - settings.usualMeal.protein,
          fat: day.eaten.fat - settings.usualMeal.fat,
          carbs: day.eaten.carbs - settings.usualMeal.carbs,
        },
        usualMealAdded: false,
        log,
      });
    } else if (lastAction.startsWith("Ate:") && settings) {
      // reverse a selected recommendation isn't tracked precisely; fall back to log removal only.
      persist({ ...day, log });
    }
  }

  function resetDay() {
    if (!day) return;
    persist({
      date: day.date,
      mode,
      eaten: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      nadaCount: 0,
      usualMealAdded: false,
      log: [],
    });
    setShowResults(false);
  }

  const nadaSynthetic = settings
    ? {
        id: "nada",
        name: "Nada Protein Milk",
        category: "nada" as const,
        macros: {
          kcal: settings.nada.kcal,
          protein: settings.nada.protein,
          fat: settings.nada.fat,
          carbs: settings.nada.carbs,
        },
        verified: true,
        enabled: true,
      }
    : null;

  const recommendations = useMemo(() => {
    if (!settings || !day || !targets) return [];
    const nadaRemaining = settings.nada.maxPerDay - day.nadaCount;
    return findRecommendations({
      eaten: day.eaten,
      targets,
      foods: settings.foods,
      nadaItem: nadaSynthetic,
      nadaBottlesRemaining: nadaRemaining,
    });
  }, [settings, day, targets, nadaSynthetic]);

  function selectCombination(key: string, label: string) {
    if (!day || !settings) return;
    const combo = recommendations.find((c) => combinationKey(c) === key);
    if (!combo) return;
    persist({
      ...day,
      eaten: addMacros(day.eaten, combo.totals),
      log: [...day.log, `Ate: ${label}`],
    });
    recordCombinationUsed(key, label);
    setShowResults(false);
  }

  if (!settings || !day || !targets) {
    return <div className="p-6 text-muted">Loading…</div>;
  }

  const advice = smartAdvice(day.eaten, targets, recommendations.length > 0);

  return (
    <main className="max-w-md mx-auto px-4 pb-24 pt-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            <span className="text-gold">McD</span> Macro
          </h1>
          <p className="text-xs text-muted">Today · {targets.kcal} kcal target</p>
        </div>
        <Link href="/settings" className="text-sm text-muted underline">
          Settings
        </Link>
      </header>

      <div className="flex gap-2 mb-4">
        {(["workday", "weekend"] as DayMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`btn-tap flex-1 rounded-xl py-2 text-sm font-semibold capitalize ${
              mode === m ? "bg-gold text-black" : "bg-card border border-cardBorder text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <ProgressStat label="Calories" value={Math.round(day.eaten.kcal)} target={targets.kcal} unit="kcal" />
        <ProgressStat
          label="Protein"
          value={Math.round(day.eaten.protein)}
          target={targets.proteinMin}
          unit="g"
          variant="success-at-target"
        />
        <ProgressStat
          label="Fat"
          value={Math.round(day.eaten.fat * 10) / 10}
          target={targets.fatMax}
          unit="g"
          variant="warn-near-max"
        />
        <ProgressStat label="Carbs" value={Math.round(day.eaten.carbs)} target={targets.carbsRef} unit="g" />
      </div>

      <div className="rounded-xl2 bg-card border border-cardBorder p-3 text-sm mb-4">{advice}</div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={addUsualMeal} disabled={day.usualMealAdded} className="btn-tap rounded-xl bg-card border border-cardBorder py-3 font-semibold disabled:opacity-40">
          + My Usual Meal
        </button>
        <button onClick={addNada} disabled={day.nadaCount >= settings.nada.maxPerDay} className="btn-tap rounded-xl bg-card border border-cardBorder py-3 font-semibold disabled:opacity-40">
          + Nada {day.nadaCount > 0 ? `× ${day.nadaCount}` : ""}
        </button>
        <button onClick={undoLast} className="btn-tap rounded-xl bg-card border border-cardBorder py-3 text-sm text-muted">
          Undo Last
        </button>
        <button onClick={resetDay} className="btn-tap rounded-xl bg-card border border-cardBorder py-3 text-sm text-muted">
          Reset Day
        </button>
      </div>

      <button
        onClick={() => setShowResults(true)}
        className="btn-tap w-full rounded-xl2 bg-red text-white font-extrabold py-4 text-lg mb-4 shadow-lg shadow-red/20"
      >
        WHAT SHOULD I GET FROM McDONALD'S?
      </button>

      {showResults && (
        <div className="space-y-3">
          {recommendations.length === 0 ? (
            <div className="rounded-xl2 bg-card border border-cardBorder p-4 text-sm">
              <p className="font-semibold mb-2">No exact McDonald's combination fits.</p>
              <p className="text-muted mb-2">
                This usually means no McDonald's items are verified yet — add official nutrition values in
                Settings → Nutrition Database.
              </p>
            </div>
          ) : (
            recommendations.map((combo) => {
              const key = combinationKey(combo);
              return (
                <RecommendationCard
                  key={key}
                  combo={combo}
                  usedBefore={wasUsedBefore(key)}
                  onSelect={() => selectCombination(key, combo.labels[0] ?? "combo")}
                />
              );
            })
          )}
        </div>
      )}

      <footer className="text-center text-xs text-muted mt-10">
        Personal nutrition planning tool. Not affiliated with McDonald's.
      </footer>
    </main>
  );
}
