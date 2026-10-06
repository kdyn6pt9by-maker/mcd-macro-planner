"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductRef, clearHistory, exportBackup, importBackup, listDays, loadAllDays, loadHistory, loadSettings, requestPersistentStorage, saveSettings, updateProductEverywhere } from "@/lib/storage";
import { Toast, ToastData } from "@/components/Toast";
import { kcalFromMacros } from "@/lib/engine/macros";
import { DayMode, FoodItem, Macros, Settings } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { GoalSection } from "@/components/GoalSection";
import { motion, AnimatePresence } from "framer-motion";

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
        className="w-24 bg-black/30 rounded-lg px-2 py-1 text-end text-sm border border-cardBorder"
      />
    </label>
  );
}

const MACRO_KEYS = ["kcal", "protein", "fat", "carbs"] as const;
const macrosOf = (m: Macros): Macros => ({ kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs });
const sameMacros = (a: Macros, b: Macros) => MACRO_KEYS.every((k) => a[k] === b[k]);

/** Save / cancel for a product whose fields are being edited; saving also rewrites every past day that has it. */
function SaveBar({ dirty, onSave, onCancel }: { dirty: boolean; onSave: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <AnimatePresence initial={false}>
      {dirty && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex gap-2 pt-2">
            <button onClick={onSave} className="btn-tap flex-1 rounded-xl bg-gold text-ink py-2 text-sm font-black">
              💾 {t("Save & update past days", "حفظ وتحديث الأيام السابقة")}
            </button>
            <button onClick={onCancel} className="btn-tap rounded-xl glass px-3 py-2 text-sm text-muted">
              {t("Cancel", "إلغاء")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FoodRow({
  food,
  onSave,
  onToggle,
  onDelete,
}: {
  food: FoodItem;
  onSave: (macros: Macros) => void;
  onToggle: (patch: Partial<FoodItem>) => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Macros>(macrosOf(food.macros));
  useEffect(() => setDraft(macrosOf(food.macros)), [food.macros]);
  const dirty = !sameMacros(draft, food.macros);
  return (
    <div className={`border-b border-cardBorder/60 py-3 ${dirty ? "bg-gold/[0.04] -mx-2 px-2 rounded-xl" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm flex items-center gap-2">
          {food.name}
          {food.source?.startsWith("http") && (
            <a href={food.source} target="_blank" rel="noreferrer" className="text-[10px] text-gold/80 underline">
              {t("source", "المصدر")}
            </a>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-[10px] text-[#ff8a7d] underline">
              {t("delete", "احذف")}
            </button>
          )}
        </span>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={food.enabled} onChange={(e) => onToggle({ enabled: e.target.checked })} />
          {t("Enabled", "مفعّل")}
        </label>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {MACRO_KEYS.map((k) => (
          <input
            key={k}
            type="number"
            inputMode="decimal"
            value={draft[k]}
            placeholder={k}
            onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
            className={`bg-black/30 rounded-lg px-2 py-1 text-xs border ${draft[k] !== food.macros[k] ? "border-gold" : "border-cardBorder"}`}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={food.verified}
          onChange={(e) =>
            onToggle({ verified: e.target.checked, lastVerified: e.target.checked ? new Date().toISOString().slice(0, 10) : undefined })
          }
        />
        <span className={food.verified ? "text-success" : "text-red"}>
          {food.verified ? t("Verified from official source", "موثّق من المصدر الرسمي") : t("Not verified — excluded from recommendations", "غير موثّق — ما يدخل التوصيات")}
        </span>
      </label>
      <SaveBar dirty={dirty} onSave={() => onSave(draft)} onCancel={() => setDraft(macrosOf(food.macros))} />
    </div>
  );
}

function AddItemForm({ onAdd }: { onAdd: (food: FoodItem) => void }) {
  const { t } = useI18n();
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
      <div className="text-sm font-bold mb-2">{t("+ Add McDonald's item", "+ أضف صنف من ماك")}</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("e.g. Grand Chicken Spicy", "مثلاً Grand Chicken Spicy")}
        className="w-full bg-black/30 rounded-lg px-3 py-2 text-sm border border-cardBorder mb-2"
      />
      <div className="grid grid-cols-4 gap-2">
        {[
          { v: p, s: setP, ph: t("protein", "بروتين") },
          { v: c, s: setC, ph: t("carbs", "كارب") },
          { v: f, s: setF, ph: t("fat", "دهون") },
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
      <div className="text-[11px] text-muted mt-1.5">{t("Calories:", "السعرات:")} {kcal} kcal {n(k) ? t("(manual)", "(يدوي)") : t("(auto 4·4·9)", "(تلقائي 4·4·9)")}</div>
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
        {t("Add item", "أضف الصنف")}
      </button>
    </div>
  );
}

function BackupSection() {
  const { t } = useI18n();
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
    setMsg(t(`Backup saved (${listDays().length} days).`, `انحفظت النسخة (${listDays().length} يوم).`));
  }

  async function restore(file: File) {
    try {
      if (!window.confirm(t("Restore this backup? It replaces the data currently on this device.", "ترجع هذي النسخة؟ بتستبدل البيانات الحالية على الجهاز."))) return;
      if (importBackup(await file.text())) {
        setMsg(t("Backup restored — reloading…", "رجعت النسخة — جاري التحديث…"));
        setTimeout(() => window.location.reload(), 600);
      } else setMsg(t("That file isn't a McD Macro backup.", "هذا الملف مو نسخة من التطبيق."));
    } catch {
      setMsg(t("Couldn't read that file.", "ما قدرت أقرأ الملف."));
    }
  }

  return (
    <section className="rounded-xl3 glass p-4 mb-4">
      <h2 className="font-semibold mb-1">{t("Your data", "بياناتك")}</h2>
      <p className="text-xs text-muted mb-3 leading-5">
        {t(
          "Everything is saved on this device and survives app updates. Days are kept until you delete them.",
          "كل شي محفوظ على جهازك ويبقى مع التحديثات. الأيام تبقى لين تحذفها."
        )}
        {persisted === true && <span className="text-success"> {t("Storage is protected from automatic cleanup ✓", "التخزين محمي من المسح التلقائي ✓")}</span>}
        <br />
        {t(
          "Tip: the Home Screen app and Safari keep separate data — always open it from the same place, and save a backup now and then. Never delete the Home Screen app — that erases its data; use ↻ to update.",
          "نصيحة: التطبيق اللي على الشاشة الرئيسية وسفاري بيانات كل واحد منفصلة — افتحه دايماً من نفس المكان، واحفظ نسخة كل فترة. لا تمسح التطبيق من الشاشة — يمسح بياناته؛ استخدم ↻ للتحديث."
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={download} className="btn-tap rounded-xl bg-gold text-black font-bold py-2.5 text-sm">
          {t("⬇ Save backup", "⬇ احفظ نسخة")}
        </button>
        <label className="btn-tap rounded-xl bg-white/10 font-bold py-2.5 text-sm text-center cursor-pointer">
          {t("⬆ Restore", "⬆ استرجاع")}
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
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const [toast, setToast] = useState<ToastData | null>(null);
  const [nadaDraft, setNadaDraft] = useState<Settings["nada"] | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  function update(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  /** Saves new settings and, if a product's macros changed, rewrites it in every logged day (with undo). */
  function saveProduct(next: Settings, ref: ProductRef | null, macros: Macros) {
    const prevSettings = settings!;
    const prevDays = JSON.stringify(loadAllDays());
    const prevHistory = JSON.stringify(loadHistory());
    update(next);
    const res = ref ? updateProductEverywhere(ref, macros) : { entries: 0, days: 0 };
    setToast({
      id: Date.now(),
      text: res.entries
        ? t(`💾 Saved · updated ${res.entries} item${res.entries === 1 ? "" : "s"} in ${res.days} day${res.days === 1 ? "" : "s"}`, `💾 انحفظ · تحدّث ${res.entries} صنف في ${res.days} يوم`)
        : t("💾 Saved", "💾 انحفظ"),
      undo: () => {
        update(prevSettings);
        try {
          window.localStorage.setItem("mcd-planner:days", prevDays);
          window.localStorage.setItem("mcd-planner:history", prevHistory);
        } catch {}
        setNadaDraft(null);
        setToast(null);
      },
    });
  }

  if (!settings) return <div className="p-6 text-muted">{t("Loading…", "جاري التحميل…")}</div>;

  const modes: DayMode[] = ["workday", "weekend"];

  return (
    <main className="max-w-md mx-auto px-4 pb-24" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <header className="flex items-center gap-3 mb-6">
        <Link href="/" className="h-11 w-11 rounded-2xl glass flex items-center justify-center text-muted" aria-label={t("Back", "رجوع")}>
          <span className="rtl:rotate-180">←</span>
        </Link>
        <h1 className="text-2xl font-black gold-text">{t("Settings", "الإعدادات")}</h1>
      </header>

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">🌐 {t("Language", "اللغة")}</h2>
        <div className="relative grid grid-cols-2 p-1 rounded-2xl bg-black/40">
          {(["en", "ar"] as const).map((l) => (
            <button
              key={l}
              onClick={() => {
                update({ ...settings, language: l });
                setLang(l);
              }}
              className={`relative py-2.5 text-sm font-bold transition-colors ${lang === l ? "text-black" : "text-muted"}`}
            >
              {lang === l && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-xl bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
              <span className="relative">{l === "en" ? "English" : "العربية"}</span>
            </button>
          ))}
        </div>
      </section>

      <GoalSection settings={settings} onChange={(goal) => update({ ...settings, goal })} />

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-1">⭐ {t("Saved quick meals", "الوجبات السريعة المحفوظة")}</h2>
        {settings.savedMeals.length === 0 ? (
          <p className="text-xs text-muted leading-5">
            {t(
              "In “Ate something else?”, give the food a name and tick “Save as a quick meal” — it becomes a one-tap button on the home screen.",
              "في “أكلت شي ثاني؟” اكتب اسم الأكل واختار “احفظها كوجبة سريعة” — تصير زر بضغطة وحدة في الصفحة الرئيسية."
            )}
          </p>
        ) : (
          <ul className="space-y-1.5 mt-2">
            <AnimatePresence initial={false}>
              {settings.savedMeals.map((m) => (
                <motion.li
                  key={m.id}
                  layout
                  exit={{ opacity: 0, height: 0, x: 40 }}
                  className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 overflow-hidden"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{m.name}</span>
                    <span className="block text-[11px] text-muted">
                      {Math.round(m.macros.kcal)} kcal · P {m.macros.protein} · F {m.macros.fat} · C {m.macros.carbs}
                    </span>
                  </span>
                  <button
                    onClick={() => update({ ...settings, savedMeals: settings.savedMeals.filter((x) => x.id !== m.id) })}
                    aria-label={t(`Delete ${m.name}`, `احذف ${m.name}`)}
                    className="h-8 w-8 rounded-full bg-white/5 text-muted text-xs"
                  >
                    ✕
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {modes.map((m) => (
        <section key={m} className="rounded-xl3 glass p-4 mb-4">
          <h2 className="font-semibold mb-2">{m === "workday" ? t("💼 Workday maintenance targets", "💼 أهداف الثبات · يوم الدوام") : t("🌴 Weekend maintenance targets", "🌴 أهداف الثبات · الويكند")}</h2>
          <NumberField
            label={t("Calories", "السعرات")}
            value={settings.targets[m].kcal}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], kcal: v } } })}
          />
          <NumberField
            label={t("Protein min (g)", "أقل بروتين (جرام)")}
            value={settings.targets[m].proteinMin}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], proteinMin: v } } })}
          />
          <NumberField
            label={t("Fat min (g)", "أقل دهون (جرام)")}
            value={settings.targets[m].fatMin}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], fatMin: v } } })}
          />
          <NumberField
            label={t("Fat max (g)", "أعلى دهون (جرام)")}
            value={settings.targets[m].fatMax}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], fatMax: v } } })}
          />
          <NumberField
            label={t("Carbs reference (g)", "مرجع الكارب (جرام)")}
            value={settings.targets[m].carbsRef}
            onChange={(v) => update({ ...settings, targets: { ...settings.targets, [m]: { ...settings.targets[m], carbsRef: v } } })}
          />
        </section>
      ))}

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">🥛 {t("Nada Protein Milk", "حليب ندى بروتين")}</h2>
        {(() => {
          const n = nadaDraft ?? settings.nada;
          const set = (patch: Partial<Settings["nada"]>) => setNadaDraft({ ...n, ...patch });
          return (
            <>
              <NumberField label={t("Calories / bottle", "سعرات / علبة")} value={n.kcal} onChange={(v) => set({ kcal: v })} />
              <NumberField label={t("Protein (g)", "بروتين (جرام)")} value={n.protein} onChange={(v) => set({ protein: v })} />
              <NumberField label={t("Fat (g)", "دهون (جرام)")} value={n.fat} onChange={(v) => set({ fat: v })} />
              <NumberField label={t("Carbs (g)", "كارب (جرام)")} value={n.carbs} onChange={(v) => set({ carbs: v })} />
              <NumberField label={t("Max bottles/day", "أقصى علب/يوم")} value={n.maxPerDay} onChange={(v) => set({ maxPerDay: v })} />
              <NumberField label={t("Price / bottle (AED)", "السعر / علبة (درهم)")} value={n.price} onChange={(v) => set({ price: v })} />
              <SaveBar
                dirty={!!nadaDraft && JSON.stringify(nadaDraft) !== JSON.stringify(settings.nada)}
                onCancel={() => setNadaDraft(null)}
                onSave={() => {
                  const macrosChanged = !sameMacros(n, settings.nada);
                  saveProduct({ ...settings, nada: n }, macrosChanged ? { kind: "nada" } : null, macrosOf(n));
                  setNadaDraft(null);
                }}
              />
            </>
          );
        })()}
      </section>


      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">🍔 {t("Nutrition Database — McDonald's UAE", "قاعدة بيانات ماكدونالدز الإمارات")}</h2>
        <p className="text-xs text-muted mb-3">
          {t(
            "Only items that are both Enabled and Verified are used in recommendations. Add new McDonald's items at the bottom — calories are auto-calculated from the macros.",
            "التوصيات تستخدم بس الأصناف المفعّلة والموثّقة. تقدر تضيف أصناف جديدة تحت — السعرات تنحسب من الماكروز."
          )}
        </p>
        <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-muted px-0.5">
          <span>kcal</span>
          <span>protein</span>
          <span>fat</span>
          <span>carbs</span>
        </div>
        {settings.foods.map((food, idx) => (
          <FoodRow
            key={food.id}
            food={food}
            onToggle={(patch) => {
              const foods = [...settings.foods];
              foods[idx] = { ...food, ...patch };
              update({ ...settings, foods });
            }}
            onDelete={food.id.startsWith("custom-") ? () => update({ ...settings, foods: settings.foods.filter((f) => f.id !== food.id) }) : undefined}
            onSave={(macros) => {
              const foods = [...settings.foods];
              foods[idx] = { ...food, macros };
              saveProduct({ ...settings, foods }, { kind: "mcdonalds", id: food.id, name: food.name }, macros);
            }}
          />
        ))}
        <AddItemForm
          onAdd={(food) => update({ ...settings, foods: [...settings.foods, food] })}
        />
      </section>

      <BackupSection />

      <section className="rounded-xl3 glass p-4 mb-4">
        <h2 className="font-semibold mb-2">{t("History", "السجل")}</h2>
        <button
          onClick={() => {
            if (window.confirm(t("Clear all favorites / order history? Logged days are kept.", "تمسح المفضلة وسجل الطلبات؟ الأيام المسجلة تبقى."))) clearHistory();
          }}
          className="btn-tap w-full rounded-xl bg-red/20 text-red border border-red/40 py-2 text-sm font-semibold"
        >
          {t("Clear favorites / history", "امسح المفضلة / السجل")}
        </button>
      </section>
      <footer className="text-center text-[12px] text-muted/80 mt-8 font-bold">
        {t("Made by", "صُنع بواسطة")} <span className="gold-text">Mohammad Almansoori</span>
      </footer>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
