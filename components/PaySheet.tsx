"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface PayRequest {
  date: string;
  orderId: string;
  label: string;
  kcal: number;
  protein: number;
}

interface Props {
  request: PayRequest | null;
  recentAmounts: number[];
  onSave: (amount: number) => void;
  onSkip: () => void;
}

export function PaySheet({ request, recentAmounts, onSave, onSkip }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (request) setValue("");
  }, [request]);

  const amount = parseFloat(value);
  const valid = Number.isFinite(amount) && amount > 0 && amount < 2000;
  const per10 = valid && request && request.protein > 0 ? (amount / request.protein) * 10 : null;

  return (
    <AnimatePresence>
      {request && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onSkip} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass px-5 pt-5"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="flex items-center gap-3">
              <motion.span
                className="text-4xl"
                initial={{ rotate: -20, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                💰
              </motion.span>
              <div>
                <h2 className="text-xl font-black">{t("How much did you pay?", "كم دفعت؟")}</h2>
                <p className="text-xs text-muted line-clamp-1">{request.label}</p>
              </div>
            </div>

            <div className="relative mt-4">
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && valid && onSave(amount)}
                placeholder="0.00"
                className="no-spin w-full bg-black/40 rounded-2xl ps-4 pe-16 py-4 text-4xl font-black outline-none border border-white/5 focus:border-gold/60"
              />
              <span className="absolute end-4 top-1/2 -translate-y-1/2 text-muted font-bold">{t("AED", "درهم")}</span>
            </div>

            {recentAmounts.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {recentAmounts.map((a) => (
                  <motion.button
                    key={a}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setValue(String(a))}
                    className="px-3 py-1.5 rounded-full bg-white/5 ring-1 ring-white/10 text-sm font-bold"
                  >
                    {a} {t("AED", "د")}
                  </motion.button>
                ))}
              </div>
            )}

            <AnimatePresence>
              {per10 !== null && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs text-muted mt-3">
                  ≈ <b className="text-gold">{per10.toFixed(2)} {t("AED", "درهم")}</b> {t("per 10g protein", "لكل 10 جرام بروتين")}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <button onClick={onSkip} className="rounded-2xl py-4 font-bold text-muted bg-white/5">
                {t("Skip", "تخطي")}
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!valid}
                onClick={() => onSave(amount)}
                className="col-span-2 rounded-2xl bg-gold text-black font-extrabold py-4 text-lg disabled:opacity-30"
              >
                {t("Save", "حفظ")}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
