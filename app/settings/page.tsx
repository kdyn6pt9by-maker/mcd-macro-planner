"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearHistory, exportBackup, importBackup, listDays, loadSettings, requestPersistentStorage, saveSettings } from "@/lib/storage";
import { kcalFromMacros } from "@/lib/engine/macros";
import { DayMode, FoodItem, Settings } from "@/lib/types";

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

function AddItemForm({ onAdd }: { onAdd: (food: FoodItem) => void }) {
  const [name, setName] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [k, setK] = useState("");
  const n = (v: string) => Math.max(0, parseFloat(v) || 0);
  const kcal = n(k) || Math.round(kcalFromMacros(n(p), n(c), n(f)));
  const valid = name.trim().length > 0 && kcal > 0;

  return (
    <div className="mt-4 rounded-2xl bg-black/25 p-3">
      <div className="text-sm font-bold mb-2">+ Add McDonald&apos;s item</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Grand Chicken Spicy"
        className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm border border-cardBorder mb-2"
      />
      <div className="grid grid-cols-4 gap-2">
        {[
          { v: p, s: setP, ph: "protein" },
          { v: c, s: setC, ph: "carbs" },
          { v: f, s: setF, ph: "fat" },
          { v: k, s: setK, ph: `${kcal || "kcal"}` },
        ].map((x) => (
          <input
            key={x.ph + "-in"}
            type="number"
            inputMode="decimal"
            value={x.v}
            placeholder={x.ph}
            onChange={(e) => x.s(e.target.value)}
            className="no-spin bg-black/30 rounded-lg px-2 py-1.5 text-xs border border-cardBorder"
          />
        ))}
      </div>
      <div className="text-[11px] text-muted mt-1.5">Calories: {kcal} kcal {n(k) ? "(manual)" : "(auto 4·4·9)"}</div>
      <button
        disabled={!valid}
        onClick={() => {
          onAdd({
            id: `custom-${Date.now().toString(36)}`,
            name: name.trim(),
            category: "mcdonalds",
            macros: { kcal, protein: n(p), carbs: n(c), fat: n(f) },
            source: "Added manually",
            lastVerified: new Date().toISOString().slice(0, 10),
            verified: true,
            enabled: true,
          });
          setName("");
          setP("");
          setC("");
          setF("");
          setK("");
        }}
        className="mt-2 w-full rounded-xl bg-gold text-black font-bold py-2 text-sm disabled:opacity-30"
      >
        Add item
      </button>
    </div>
  );
}

function BackupSection() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    requestPersistentStorage().then(setPersisted);
  }, []);

  function download() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mcd-macro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`Backup saved (${listDays().length} days).`);
  }

  async function restore(file: File) {
    try {
      if (!window.confirm("Restore this backup? It replaces the data currently on this device.")) return;
      if (importBackup(await file.text())) {
        setMsg("Backup restored — reloading…");
        setTimeout(() => window.location.reload(), 600);
      } else setMsg("That file isn't a McD Macro backup.");
    } catch {
      setMsg("Couldn't read that file.");
    }
  }

  return (
    <section className="rounded-xl3 glass p-4 mb-4">
      <h2 className="font-semibold mb-1">Your data</h2>
      <p className="text-xs text-muted mb-3 leading-5">
        Everything is saved on this device and survives app updates. Days are kept until you delete them.
        {persisted === true && <span className="text-success"> Storage is protected from automatic cleanup ✓</span>}
        <br />
        Tip: the Home Screen app and Safari keep separate data — always open it from the same place, and save a
        backup now and then.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={download} className="btn-tap rounded-xl bg-gold text-black font-bold py-2.5 text-sm">
          ⬇ Save backup
        </button>
        <label className="btn-tap rounded-xl bg-white/10 font-bold py-2.5 text-sm text-center cursor-pointer">
          ⬆ Restore
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {msg && <p className="text-xs text-gold mt-2">{msg}</p>}
    </section>
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
        <section key={m} className="rounded-xl3 glass p-4 mb-4">
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

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">Nada Protein Milk</h2>
        <NumberField label="Calories / bottle" value={settings.nada.kcal} onChange={(v) => update({ ...settings, nada: { ...settings.nada, kcal: v } })} />
        <NumberField label="Protein (g)" value={settings.nada.protein} onChange={(v) => update({ ...settings, nada: { ...settings.nada, protein: v } })} />
        <NumberField label="Fat (g)" value={settings.nada.fat} onChange={(v) => update({ ...settings, nada: { ...settings.nada, fat: v } })} />
        <NumberField label="Carbs (g)" value={settings.nada.carbs} onChange={(v) => update({ ...settings, nada: { ...settings.nada, carbs: v } })} />
        <NumberField label="Max bottles/day" value={settings.nada.maxPerDay} onChange={(v) => update({ ...settings, nada: { ...settings.nada, maxPerDay: v } })} />
      </section>

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">Usual Meal</h2>
        <NumberField label="Calories" value={settings.usualMeal.kcal} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, kcal: v } })} />
        <NumberField label="Protein (g)" value={settings.usualMeal.protein} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, protein: v } })} />
        <NumberField label="Fat (g)" value={settings.usualMeal.fat} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, fat: v } })} />
        <NumberField label="Carbs (g)" value={settings.usualMeal.carbs} onChange={(v) => update({ ...settings, usualMeal: { ...settings.usualMeal, carbs: v } })} />
      </section>

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">Nutrition Database — McDonald's UAE</h2>
        <p className="text-xs text-muted mb-3">
          Only items that are both Enabled and Verified are used in recommendations. Add new McDonald&apos;s
          items at the bottom — calories are auto-calculated from the macros.
        </p>
        <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-muted px-0.5">
          <span>kcal</span>
          <span>protein</span>
          <span>fat</span>
          <span>carbs</span>
        </div>
        {settings.foods.map((food, idx) => (
          <div key={food.id} className="border-b border-cardBorder/60 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm flex items-center gap-2">
                {food.name}
                {food.source?.startsWith("http") && (
                  <a href={food.source} target="_blank" rel="noreferrer" className="text-[10px] text-gold/80 underline">
                    source
                  </a>
                )}
                {food.id.startsWith("custom-") && (
                  <button
                    onClick={() => update({ ...settings, foods: settings.foods.filter((f) => f.id !== food.id) })}
                    className="text-[10px] text-[#ff8a7d] underline"
                  >
                    delete
                  </button>
                )}
              </span>
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
        <AddItemForm
          onAdd={(food) => update({ ...settings, foods: [...settings.foods, food] })}
        />
      </section>

      <BackupSection />

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">History</h2>
        <button
          onClick={() => {
            if (window.confirm("Clear all favorites / order history? Logged days are kept.")) clearHistory();
          }}
          className="btn-tap w-full rounded-xl bg-red/20 text-red border border-red/40 py-2 text-sm font-semibold"
        >
          Clear favorites / history
        </button>
      </section>
    </main>
  );
}
