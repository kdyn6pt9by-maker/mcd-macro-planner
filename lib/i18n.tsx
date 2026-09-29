"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "./storage";
import { Language } from "./types";

const LANG_EVENT = "mcd-lang-change";

interface I18n {
  lang: Language;
  ar: boolean;
  /** Inline pair: t("Add", "أضف") — keeps both languages next to each other in the component. */
  t: (en: string, ar: string) => string;
  setLang: (l: Language) => void;
  /** Locale for dates and numbers (Latin digits in Arabic too, to match nutrition labels). */
  locale: string;
  date: (d: Date, opts: Intl.DateTimeFormatOptions) => string;
  num: (n: number, digits?: number) => string;
}

const Ctx = createContext<I18n | null>(null);

function build(lang: Language, setLang: (l: Language) => void): I18n {
  const locale = lang === "ar" ? "ar-AE-u-nu-latn" : "en-US";
  return {
    lang,
    ar: lang === "ar",
    t: (en, ar) => (lang === "ar" ? ar : en),
    setLang,
    locale,
    date: (d, opts) => d.toLocaleDateString(locale, opts),
    num: (n, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 }),
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    setLangState(loadSettings().language);
    const onChange = (e: Event) => setLangState((e as CustomEvent<Language>).detail);
    window.addEventListener(LANG_EVENT, onChange);
    return () => window.removeEventListener(LANG_EVENT, onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Language) => {
    saveSettings({ ...loadSettings(), language: l });
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: l }));
  }, []);

  return <Ctx.Provider value={build(lang, setLang)}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  return useContext(Ctx) ?? build("en", () => {});
}
