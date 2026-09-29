"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface PayFlags {
  esaad: boolean;
  points: boolean;
}

function Check({ checked, onChange, title, hint, color }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string; color: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      className={`w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-start ring-1 transition-colors ${
        checked ? "bg-white/[0.07] ring-white/20" : "bg-black/25 ring-white/5"
      }`}
    >
      <motion.span
        animate={{ backgroundColor: checked ? color : "rgba(255,255,255,0)", borderColor: checked ? color : "rgba(255,255,255,0.3)" }}
        className="h-6 w-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-black text-sm font-black"
      >
        <AnimatePresence>
          {checked && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 20 }}>
              ✓
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </motion.button>
  );
}

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
  onSave: (amount: number, flags: PayFlags) => void;
  onSkip: () => void;
}

export function PaySheet({ request, recentAmounts, onSave, onSkip }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [esaad, setEsaad] = useState(true);
  const [points, setPoints] = useState(false);

  useEffect(() => {
    if (request) {
      setValue("");
      setEsaad(true);
      setPoints(false);
    }
  }, [request]);

  const parsed = parseFloat(value);
  // Paying fully with points can mean 0 AED.
  const amount = Number.isFinite(parsed) ? parsed : points ? 0 : NaN;
  const valid = Number.isFinite(amount) && amount < 2000 && (amount > 0 || (points && amount === 0));
  const save = () => valid && onSave(amount, { esaad, points });
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
                onKeyDown={(e) => e.key === "Enter" && save()}
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

            <div className="mt-3 space-y-2">
              <Check
                checked={esaad}
                onChange={setEsaad}
                color="#34d399"
                title={t("Esaad discount", "خصم إسعاد")}
                hint={t("Paid with the Esaad card discount", "دفعت بخصم بطاقة إسعاد")}
              />
              <Check
                checked={points}
                onChange={setPoints}
                color="#a78bfa"
                title={t("Used reward points", "استخدمت النقاط")}
                hint={t("Paid with McDonald's points (amount can be 0)", "دفعت بنقاط ماكدونالدز (المبلغ ممكن يكون 0)")}
              />
            </div>

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
                onClick={save}
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
