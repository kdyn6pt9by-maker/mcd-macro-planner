"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { addMacros, roundMacros, scaleMacros, ZERO_MACROS } from "@/lib/engine/macros";
import { FoodItem, Macros, Targets } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

type Sort = "protein" | "kcal" | "fat";

interface Props {
  open: boolean;
  onClose: () => void;
  foods: FoodItem[];
  eaten: Macros;
  targets: Targets;
  onAdd: (lines: { food: FoodItem; qty: number }[]) => void;
}

const SORTS: { id: Sort; label: string }[] = [
  { id: "protein", label: "💪 Protein/kcal" },
  { id: "kcal", label: "🔥 Lowest kcal" },
  { id: "fat", label: "🥑 Lowest fat" },
];

export function McMenuSheet({ open, onClose, foods, eaten, targets, onAdd }: Props) {
  const dragControls = useDragControls();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<Sort>("protein");

  useEffect(() => {
    if (open) setQty({});
  }, [open]);

  const sorted = useMemo(() => {
    const list = [...foods];
    if (sort === "protein") list.sort((a, b) => b.macros.protein / b.macros.kcal - a.macros.protein / a.macros.kcal);
    if (sort === "kcal") list.sort((a, b) => a.macros.kcal - b.macros.kcal);
    if (sort === "fat") list.sort((a, b) => a.macros.fat - b.macros.fat);
    return list;
  }, [foods, sort]);

  const lines = foods.filter((f) => (qty[f.id] ?? 0) > 0).map((f) => ({ food: f, qty: qty[f.id] }));
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const adds = roundMacros(lines.reduce((s, l) => addMacros(s, scaleMacros(l.food.macros, l.qty)), ZERO_MACROS));
  const after = roundMacros(addMacros(eaten, adds));
  const fatOver = after.fat > targets.fatMax;
  const kcalOver = after.kcal > targets.kcal;
  const proteinHit = after.protein >= targets.proteinMin;

  const bump = (id: string, d: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(9, (q[id] ?? 0) + d)) }));

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
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass flex flex-col"
            style={{ maxHeight: "92dvh" }}
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
            <div className="shrink-0 px-5 pt-3 pb-3 touch-none cursor-grab" onPointerDown={(e) => dragControls.start(e)}>
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20 mb-4" />
              <h2 className="text-xl font-black">
                <span className="gold-text">Build</span> your McDonald&apos;s order
              </h2>
              <p className="text-xs text-muted mt-0.5">Pick exactly what you want — see the impact before you add it.</p>
            </div>

            <div className="shrink-0 px-5 flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`relative shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    sort === s.id ? "text-black" : "text-muted bg-white/5"
                  }`}
                >
                  {sort === s.id && (
                    <motion.span layoutId="menu-sort" className="absolute inset-0 rounded-full bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                  )}
                  <span className="relative">{s.label}</span>
                </button>
              ))}
            </div>

            <motion.ul layout className="flex-1 min-h-0 overflow-y-auto px-5 space-y-2 pb-3 overscroll-contain">
              {sorted.map((f, i) => {
                const q = qty[f.id] ?? 0;
                return (
                  <motion.li
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025, layout: { type: "spring", stiffness: 400, damping: 35 } }}
                    className={`rounded-2xl px-3.5 py-3 flex items-center gap-3 transition-colors ${
                      q > 0 ? "bg-gold/10 ring-1 ring-gold/40" : "bg-white/[0.03] ring-1 ring-white/5"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{f.name}</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        <span className="text-gold">{f.macros.kcal}</span> kcal ·{" "}
                        <span className="text-success">P {f.macros.protein}</span> · <span className="text-warn">F {f.macros.fat}</span> ·{" "}
                        <span className="text-carb">C {f.macros.carbs}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AnimatePresence initial={false}>
                        {q > 0 && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.5, width: 0 }}
                            animate={{ opacity: 1, scale: 1, width: 36 }}
                            exit={{ opacity: 0, scale: 0.5, width: 0 }}
                            whileTap={{ scale: 0.85 }}
                            onClick={() => bump(f.id, -1)}
                            aria-label={`Remove one ${f.name}`}
                            className="h-9 rounded-xl bg-white/10 text-lg font-bold"
                          >
                            −
                          </motion.button>
                        )}
                      </AnimatePresence>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {q > 0 && (
                          <motion.span
                            key={q}
                            initial={{ y: -12, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 12, opacity: 0 }}
                            className="w-5 text-center font-black text-gold"
                          >
                            {q}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => bump(f.id, 1)}
                        aria-label={`Add one ${f.name}`}
                        className={`h-9 w-9 rounded-xl text-lg font-bold ${q > 0 ? "bg-gold text-black" : "bg-white/10"}`}
                      >
                        +
                      </motion.button>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>

            <div
              className="shrink-0 border-t border-white/5 px-5 pt-3 bg-black/30"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { k: "kcal", v: adds.kcal, c: "text-gold" },
                  { k: "protein", v: adds.protein, c: "text-success" },
                  { k: "fat", v: adds.fat, c: "text-warn" },
                  { k: "carbs", v: adds.carbs, c: "text-carb" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl bg-white/[0.04] py-1.5">
                    <div className={`font-extrabold ${s.c}`}>
                      +<AnimatedNumber value={s.v} />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted">{s.k}</div>
                  </div>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {itemCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="text-xs text-muted mt-2.5 leading-5">
                      Day after:{" "}
                      <span className={kcalOver ? "text-[#ff8a7d] font-bold" : "text-[#e8d5d6]"}>
                        {after.kcal}/{targets.kcal} kcal
                      </span>{" "}
                      ·{" "}
                      <span className={proteinHit ? "text-success font-bold" : ""}>
                        {after.protein}g P{proteinHit ? " ✓" : ""}
                      </span>{" "}
                      · <span className={fatOver ? "text-[#ff8a7d] font-bold" : ""}>{after.fat}/{targets.fatMax}g F</span>
                    </div>
                    {(fatOver || kcalOver) && (
                      <motion.div
                        initial={{ x: -6 }}
                        animate={{ x: [6, -4, 2, 0] }}
                        className="mt-1.5 text-xs font-bold text-[#ff8a7d]"
                      >
                        ⚠️ {fatOver ? `Over your fat limit by ${Math.round((after.fat - targets.fatMax) * 10) / 10}g` : ""}
                        {fatOver && kcalOver ? " · " : ""}
                        {kcalOver ? `${Math.round(after.kcal - targets.kcal)} kcal over target` : ""}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={itemCount === 0}
                onClick={() => {
                  onAdd(lines);
                  onClose();
                }}
                className={`mt-3 w-full rounded-2xl font-extrabold py-4 text-lg disabled:opacity-30 transition-colors ${
                  fatOver || kcalOver ? "bg-warn text-black" : "bg-gold text-black"
                }`}
              >
                {itemCount === 0 ? "Pick something" : `Add ${itemCount} item${itemCount > 1 ? "s" : ""} to today`}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
