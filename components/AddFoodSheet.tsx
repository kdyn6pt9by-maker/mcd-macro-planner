"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useState } from "react";
import { kcalFromMacros } from "@/lib/engine/macros";
import { Macros } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

type Mode = "add" | "set";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, macros: Macros) => void;
  onSetTotals: (macros: Macros) => void;
}

function Field({
  label,
  value,
  onChange,
  accent,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <div className="mt-1 relative">
        <input
          inputMode="decimal"
          type="number"
          min={0}
          autoFocus={autoFocus}
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          className="no-spin w-full bg-black/40 rounded-2xl px-4 py-3.5 text-2xl font-bold outline-none border border-white/5 focus:border-gold/60 transition-colors"
          style={{ caretColor: accent }}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm">g</span>
      </div>
    </label>
  );
}

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function AddFoodSheet({ open, onClose, onAdd, onSetTotals }: Props) {
  const dragControls = useDragControls();
  const [mode, setMode] = useState<Mode>("add");
  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [kcalOverride, setKcalOverride] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setProtein("");
    setCarbs("");
    setFat("");
    setKcalOverride("");
  }, [open]);

  const p = num(protein);
  const c = num(carbs);
  const f = num(fat);
  const computed = kcalFromMacros(p, c, f);
  const kcal = num(kcalOverride) || computed;
  const canSubmit = p + c + f > 0 || num(kcalOverride) > 0;

  const split = computed > 0 ? { p: (p * 4) / computed, c: (c * 4) / computed, f: (f * 9) / computed } : null;

  function submit() {
    if (!canSubmit) return;
    const macros = { kcal, protein: p, carbs: c, fat: f };
    if (mode === "add") onAdd(name.trim() || "Other food", macros);
    else onSetTotals(macros);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass px-5 pt-3"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="-mx-5 -mt-3 pt-3 pb-4 touch-none cursor-grab"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
            </div>

            <div className="relative grid grid-cols-2 p-1 rounded-2xl bg-black/40 mb-5">
              <motion.div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gold"
                animate={{ left: mode === "add" ? 4 : "calc(50%)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
              {(["add", "set"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`relative z-10 py-2.5 text-sm font-bold transition-colors ${
                    mode === m ? "text-black" : "text-muted"
                  }`}
                >
                  {m === "add" ? "Add other food" : "Set today's totals"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-muted mb-4"
              >
                {mode === "add"
                  ? "Ate something else? Enter its macros — calories are calculated for you."
                  : "Replaces everything logged today with these totals."}
              </motion.p>
            </AnimatePresence>

            {mode === "add" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional) — e.g. Shawarma"
                className="w-full bg-black/40 rounded-2xl px-4 py-3 mb-3 outline-none border border-white/5 focus:border-gold/60 transition-colors"
              />
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Protein" value={protein} onChange={setProtein} accent="#34d399" autoFocus />
              <Field label="Carbs" value={carbs} onChange={setCarbs} accent="#d6a15c" />
              <Field label="Fat" value={fat} onChange={setFat} accent="#fb923c" />
            </div>

            <div className="mt-5 rounded-2xl bg-black/30 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Calories</div>
                  <div className="text-4xl font-black gold-text leading-tight">
                    <AnimatedNumber value={Math.round(kcal)} />
                    <span className="text-base font-semibold text-muted"> kcal</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted leading-4">
                  {num(kcalOverride) ? "manual" : "4 · 4 · 9 kcal/g"}
                </div>
              </div>
              <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-white/5">
                {split && (
                  <>
                    <motion.div className="bg-success" animate={{ width: `${split.p * 100}%` }} />
                    <motion.div className="bg-carb" animate={{ width: `${split.c * 100}%` }} />
                    <motion.div className="bg-warn" animate={{ width: `${split.f * 100}%` }} />
                  </>
                )}
              </div>
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer">Know the exact calories? Override</summary>
                <input
                  inputMode="decimal"
                  type="number"
                  value={kcalOverride}
                  onChange={(e) => setKcalOverride(e.target.value)}
                  placeholder={`${Math.round(computed)}`}
                  className="no-spin mt-2 w-full bg-black/40 rounded-xl px-3 py-2 outline-none border border-white/5 focus:border-gold/60"
                />
              </details>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!canSubmit}
              onClick={submit}
              className="mt-5 w-full rounded-2xl bg-gold text-black font-extrabold py-4 text-lg disabled:opacity-30 transition-opacity"
            >
              {mode === "add" ? "Add to today" : "Set totals"}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
