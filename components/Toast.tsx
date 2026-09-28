"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface ToastData {
  id: number;
  text: string;
  undo?: () => void;
}

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="pointer-events-auto glass rounded-2xl pl-4 pr-2 py-2 flex items-center gap-3 max-w-md w-full"
          >
            <span className="text-sm flex-1">{toast.text}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  onDismiss();
                }}
                className="text-sm font-bold text-gold px-3 py-1.5 rounded-xl hover:bg-white/5"
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
