"use client";

import { AnimatePresence, motion } from "framer-motion";
import { sumMacros } from "@/lib/engine/macros";
import { DayEntry, EntryKind } from "@/lib/types";

const KIND_ICON: Record<EntryKind, string> = { usual: "🥣", nada: "🥛", custom: "🍽️", mcdonalds: "🍔" };

const fmt = (e: { kcal: number; protein: number; fat: number; carbs: number }) =>
  `${Math.round(e.kcal)} kcal · P ${Math.round(e.protein)} · F ${Math.round(e.fat * 10) / 10} · C ${Math.round(e.carbs)}`;

interface Group {
  key: string;
  entries: DayEntry[];
}

function groupEntries(entries: DayEntry[]): Group[] {
  const groups: Group[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (e.groupId && last?.key === e.groupId) last.entries.push(e);
    else groups.push({ key: e.groupId ?? e.id, entries: [e] });
  }
  return groups;
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 shrink-0 rounded-full bg-white/5 text-muted flex items-center justify-center hover:bg-red/20 hover:text-[#ff8a7d] transition-colors"
    >
      ✕
    </motion.button>
  );
}

export function DayLog({
  entries,
  onRemoveEntry,
  onRemoveGroup,
}: {
  entries: DayEntry[];
  onRemoveEntry: (id: string) => void;
  onRemoveGroup: (groupId: string) => void;
}) {
  return (
    <motion.ul layout className="space-y-2">
      <AnimatePresence initial={false}>
        {groupEntries(entries).map((g) => {
          const single = g.entries.length === 1;
          const e = g.entries[0];
          return (
            <motion.li
              key={g.key}
              layout
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, x: 60 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="overflow-hidden"
            >
              {single ? (
                <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-lg">{KIND_ICON[e.kind]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{e.label}</div>
                    <div className="text-[11px] text-muted">{fmt(e.macros)}</div>
                  </div>
                  <RemoveButton label={`Remove ${e.label}`} onClick={() => onRemoveEntry(e.id)} />
                </div>
              ) : (
                <div className="glass rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🍱</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">Meal · {g.entries.length} items</div>
                      <div className="text-[11px] text-gold">{fmt(sumMacros(g.entries.map((x) => x.macros)))}</div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onRemoveGroup(g.key)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-red/15 text-[#ff8a7d] ring-1 ring-red/30"
                    >
                      Delete meal
                    </motion.button>
                  </div>
                  <ul className="mt-2 space-y-1 border-l border-white/10 ml-2.5 pl-3">
                    <AnimatePresence initial={false}>
                      {g.entries.map((x) => (
                        <motion.li
                          key={x.id}
                          layout
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 overflow-hidden"
                        >
                          <span className="text-sm">{KIND_ICON[x.kind]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{x.label}</div>
                            <div className="text-[10px] text-muted">{fmt(x.macros)}</div>
                          </div>
                          <RemoveButton label={`Remove ${x.label}`} onClick={() => onRemoveEntry(x.id)} />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </motion.ul>
  );
}
