"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannedProduct, isBarcode, lookupBarcode, macrosForGrams, macrosForServings } from "@/lib/barcode";
import { kcalFromMacros, roundMacros } from "@/lib/engine/macros";
import { useI18n } from "@/lib/i18n";
import { useKeyboardSheetStyle } from "@/lib/useKeyboardInset";
import { loadBarcodeCache, saveBarcodeProduct, todayKey } from "@/lib/storage";
import { Macros } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { DayPicker } from "./DayPicker";

type Stage = "scan" | "loading" | "found" | "notfound";
type Portion = "serving" | "pack" | "grams";

interface Props {
  open: boolean;
  initialDate?: string;
  onClose: () => void;
  onAdd: (label: string, macros: Macros, date: string) => void;
}

const n = (s: string) => Math.max(0, parseFloat(s) || 0);

export function BarcodeSheet({ open, initialDate, onClose, onAdd }: Props) {
  const { t } = useI18n();
  const sheetStyle = useKeyboardSheetStyle({ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" });
  const [stage, setStage] = useState<Stage>("scan");
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [camError, setCamError] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [date, setDate] = useState(todayKey());
  const [portion, setPortion] = useState<Portion>("serving");
  const [count, setCount] = useState(1);
  const [grams, setGrams] = useState("100");
  const [name, setName] = useState("");
  const [edit, setEdit] = useState({ protein: "", carbs: "", fat: "", kcal: "", serving: "" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const stopCamera = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const show = useCallback((p: ScannedProduct) => {
    setProduct(p);
    setName(p.name);
    setPortion(p.perServing || p.servingGrams ? "serving" : p.packageGrams ? "pack" : "grams");
    setCount(1);
    setGrams(String(p.servingGrams ?? 100));
    setStage("found");
  }, []);

  const lookup = useCallback(
    async (c: string) => {
      stopCamera();
      setCode(c);
      const cached = loadBarcodeCache()[c];
      if (cached) return show(cached);
      setStage("loading");
      try {
        const p = await lookupBarcode(c);
        if (p && (p.per100 || p.perServing)) show(p);
        else {
          setName(p?.name && !p.name.startsWith("#") ? p.name : "");
          setEdit({ protein: "", carbs: "", fat: "", kcal: "", serving: "" });
          setStage("notfound");
        }
      } catch {
        setName("");
        setStage("notfound");
      }
    },
    [show, stopCamera]
  );

  // Reset each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setStage("scan");
    setTyped("");
    setCode("");
    setCamError(null);
    setProduct(null);
    setDate(initialDate ?? todayKey());
  }, [open, initialDate]);

  // Camera runs only while on the scan stage.
  useEffect(() => {
    if (!open || stage !== "scan") return;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              navigator.vibrate?.(40);
              lookup(result.getText());
            }
          }
        );
        if (cancelled) controls.stop();
        else stopRef.current = () => controls.stop();
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setCamError(
          denied
            ? t("Camera access was blocked. Allow it in Settings → Safari → Camera, or type the number below.", "الكاميرا مقفلة. فعّلها من الإعدادات ← سفاري ← الكاميرا، أو اكتب الرقم تحت.")
            : t("Couldn't start the camera — type the barcode number below.", "ما قدرت أشغل الكاميرا — اكتب رقم الباركود تحت.")
        );
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stage, lookup, stopCamera, t]);

  function close() {
    stopCamera();
    onClose();
  }

  // Values typed in "edit / not found" become a per-100 g product saved on this phone.
  function productFromEdit(base: ScannedProduct | null): ScannedProduct {
    const p = n(edit.protein);
    const c = n(edit.carbs);
    const f = n(edit.fat);
    const per100 = { protein: p, carbs: c, fat: f, kcal: n(edit.kcal) || kcalFromMacros(p, c, f) };
    return {
      code,
      name: name.trim() || base?.name || `#${code}`,
      brand: base?.brand,
      image: base?.image,
      per100,
      perServing: null,
      servingGrams: n(edit.serving) || base?.servingGrams || null,
      packageGrams: base?.packageGrams ?? null,
      source: "user",
    };
  }

  const amount: Macros | null = product
    ? portion === "grams"
      ? macrosForGrams(product, n(grams))
      : portion === "pack"
        ? macrosForGrams(product, (product.packageGrams ?? 0) * count)
        : macrosForServings(product, count)
    : null;
  const shown = amount ? roundMacros(amount) : null;

  function add() {
    if (!product || !amount || amount.kcal <= 0) return;
    const saved = { ...product, name: name.trim() || product.name };
    saveBarcodeProduct(saved);
    const qty =
      portion === "grams" ? `${n(grams)}g` : portion === "pack" ? `${count}× ${t("pack", "عبوة")}` : `${count}× ${t("serving", "حصة")}`;
    onAdd(`📷 ${saved.name} (${qty})`, amount, date);
    close();
  }

  const canSaveEdit = n(edit.protein) + n(edit.carbs) + n(edit.fat) + n(edit.kcal) > 0;
  const field = (k: keyof typeof edit, label: string) => (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={edit[k]}
        placeholder="0"
        onChange={(e) => setEdit((v) => ({ ...v, [k]: e.target.value }))}
        className="no-spin mt-1 w-full bg-black/40 rounded-xl px-2.5 py-2.5 text-lg font-bold outline-none border border-white/5 focus:border-gold/60"
      />
    </label>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[2rem] glass px-5 pt-4 max-h-[94dvh] overflow-y-auto overscroll-contain"
            style={sheetStyle}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20 mb-4" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-black">
                📷 <span className="gold-text">{t("Scan barcode", "امسح الباركود")}</span>
              </h2>
              <button onClick={close} className="h-9 w-9 rounded-full bg-white/5 text-muted" aria-label={t("Close", "إغلاق")}>
                ✕
              </button>
            </div>

            {stage === "scan" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-black ring-1 ring-white/10">
                  <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
                  {!camError && (
                    <>
                      <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-32 rounded-2xl ring-2 ring-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                      <motion.div
                        className="absolute inset-x-10 h-0.5 bg-red shadow-[0_0_12px_2px_rgba(218,41,28,0.8)]"
                        initial={{ top: "36%" }}
                        animate={{ top: ["36%", "64%", "36%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="absolute bottom-3 inset-x-0 text-center text-xs text-white/80">
                        {t("Point at the barcode — it scans automatically", "وجّه الكاميرا على الباركود — يقراه لحاله")}
                      </div>
                    </>
                  )}
                  {camError && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#e8d5d6]">{camError}</div>}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    inputMode="numeric"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && isBarcode(typed) && lookup(typed)}
                    placeholder={t("…or type the number", "…أو اكتب الرقم")}
                    className="flex-1 bg-black/40 rounded-2xl px-4 py-3 font-bold tracking-widest outline-none border border-white/5 focus:border-gold/60"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={!isBarcode(typed)}
                    onClick={() => lookup(typed)}
                    className="rounded-2xl bg-gold text-black font-extrabold px-5 disabled:opacity-30"
                  >
                    {t("Find", "ابحث")}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {stage === "loading" && (
              <div className="py-16 flex flex-col items-center gap-4">
                <motion.div
                  className="h-12 w-12 rounded-full border-2 border-gold/20 border-t-gold"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                <div className="text-sm text-muted">
                  {t("Looking up", "أدور على")} <b className="tracking-widest">{code}</b>…
                </div>
              </div>
            )}

            {stage === "notfound" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="rounded-2xl bg-white/[0.04] p-4 mb-4">
                  <div className="font-bold">🤷 {t("Not in the database yet", "مو موجود بقاعدة البيانات")}</div>
                  <div className="text-xs text-muted mt-1">
                    {t(
                      `Enter it once from the label (per 100 g) — next time ${code} scans instantly.`,
                      `دخّله مرة وحدة من الملصق (لكل 100 جرام) — المرة الجاية ${code} يطلع على طول.`
                    )}
                  </div>
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Product name", "اسم المنتج")}
                  className="w-full bg-black/40 rounded-2xl px-4 py-3 mb-3 outline-none border border-white/5 focus:border-gold/60"
                />
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">{t("Per 100 g", "لكل 100 جرام")}</div>
                <div className="grid grid-cols-4 gap-2">
                  {field("protein", t("protein", "بروتين"))}
                  {field("carbs", t("carbs", "كارب"))}
                  {field("fat", t("fat", "دهون"))}
                  {field("kcal", t("kcal", "سعرات"))}
                </div>
                <div className="mt-2 w-1/2">{field("serving", t("1 serving = g (opt.)", "الحصة = جرام (اختياري)"))}</div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button onClick={() => setStage("scan")} className="rounded-2xl py-3.5 font-bold text-muted bg-white/5">
                    {t("Rescan", "امسح ثاني")}
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={!canSaveEdit}
                    onClick={() => {
                      const p = productFromEdit(null);
                      saveBarcodeProduct(p);
                      show(p);
                    }}
                    className="col-span-2 rounded-2xl bg-gold text-black font-extrabold py-3.5 disabled:opacity-30"
                  >
                    {t("Save product", "احفظ المنتج")}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {stage === "found" && product && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-3 mb-4">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="h-16 w-16 rounded-2xl object-cover bg-white" />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl">📦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent font-black text-lg outline-none border-b border-transparent focus:border-gold/50"
                    />
                    <div className="text-[11px] text-muted">
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.source === "user" ? t("saved on this phone", "محفوظ على جوالك") : "Open Food Facts"} · {product.code}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/40">
                  {(
                    [
                      ["serving", t(`Serving${product.servingGrams ? ` ${product.servingGrams}g` : ""}`, `حصة${product.servingGrams ? ` ${product.servingGrams}g` : ""}`), !!(product.perServing || product.servingGrams)],
                      ["pack", t(`Pack${product.packageGrams ? ` ${product.packageGrams}g` : ""}`, `عبوة${product.packageGrams ? ` ${product.packageGrams}g` : ""}`), !!(product.packageGrams && product.per100)],
                      ["grams", t("Grams", "جرامات"), !!(product.per100 || product.servingGrams)],
                    ] as [Portion, string, boolean][]
                  ).map(([id, label, ok]) => (
                    <button
                      key={id}
                      disabled={!ok}
                      onClick={() => {
                        setPortion(id);
                        setCount(1);
                      }}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-colors duration-200 disabled:opacity-25 ${portion === id ? "bg-gold text-black" : "text-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-center gap-4">
                  {portion === "grams" ? (
                    <div className="relative w-40">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={grams}
                        onChange={(e) => setGrams(e.target.value)}
                        className="no-spin w-full bg-black/40 rounded-2xl ps-4 pe-10 py-3 text-3xl font-black text-center outline-none border border-white/5 focus:border-gold/60"
                      />
                      <span className="absolute end-4 top-1/2 -translate-y-1/2 text-muted">g</span>
                    </div>
                  ) : (
                    <>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCount((c) => Math.max(0.5, c - 0.5))} className="h-12 w-12 rounded-2xl bg-white/10 text-2xl font-bold">
                        −
                      </motion.button>
                      <motion.span key={count} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="text-4xl font-black w-16 text-center">
                        {count}
                      </motion.span>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCount((c) => Math.min(20, c + 0.5))} className="h-12 w-12 rounded-2xl bg-gold text-black text-2xl font-bold">
                        +
                      </motion.button>
                    </>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { k: t("kcal", "سعرة"), v: shown?.kcal ?? 0, c: "text-gold" },
                    { k: t("protein", "بروتين"), v: shown?.protein ?? 0, c: "text-success" },
                    { k: t("fat", "دهون"), v: shown?.fat ?? 0, c: "text-warn" },
                    { k: t("carbs", "كارب"), v: shown?.carbs ?? 0, c: "text-carb" },
                  ].map((s) => (
                    <div key={s.k} className="rounded-xl bg-white/[0.04] py-2">
                      <div className={`text-lg font-extrabold ${s.c}`}>
                        <AnimatedNumber value={s.v} decimals={s.v % 1 ? 1 : 0} />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted">{s.k}</div>
                    </div>
                  ))}
                </div>

                <details
                  className="mt-3"
                  onToggle={(e) => {
                    if ((e.target as HTMLDetailsElement).open && product.per100) {
                      const p = product.per100;
                      setEdit({ protein: String(p.protein), carbs: String(p.carbs), fat: String(p.fat), kcal: String(Math.round(p.kcal)), serving: String(product.servingGrams ?? "") });
                    }
                  }}
                >
                  <summary className="text-xs text-muted cursor-pointer">{t("Numbers look wrong? Fix them (per 100 g)", "الأرقام غلط؟ عدّلها (لكل 100 جرام)")}</summary>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {field("protein", t("protein", "بروتين"))}
                    {field("carbs", t("carbs", "كارب"))}
                    {field("fat", t("fat", "دهون"))}
                    {field("kcal", t("kcal", "سعرات"))}
                  </div>
                  <button
                    disabled={!canSaveEdit}
                    onClick={() => {
                      const p = productFromEdit(product);
                      saveBarcodeProduct(p);
                      show(p);
                    }}
                    className="mt-2 w-full rounded-xl bg-white/10 py-2 text-sm font-bold disabled:opacity-30"
                  >
                    {t("Save corrected values", "احفظ التعديل")}
                  </button>
                </details>

                <div className="text-[11px] uppercase tracking-[0.14em] text-muted mt-4 mb-2">{t("Which day?", "أي يوم؟")}</div>
                <DayPicker value={date} onChange={setDate} />

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button onClick={() => setStage("scan")} className="rounded-2xl py-4 font-bold text-muted bg-white/5">
                    {t("Rescan", "امسح ثاني")}
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={!amount || amount.kcal <= 0}
                    onClick={add}
                    className="col-span-2 rounded-2xl bg-gold text-black font-extrabold py-4 text-lg disabled:opacity-30"
                  >
                    {date === todayKey() ? t("Add to today", "أضف لليوم") : t("Add to that day", "أضف لذاك اليوم")}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
