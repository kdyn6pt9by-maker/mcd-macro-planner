"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Item = { id: string; href: string; icon: string; en: string; ar: string };

const ITEMS: Item[] = [
  { id: "today", href: "/", icon: "🏠", en: "Today", ar: "اليوم" },
  { id: "mcd", href: "/?tab=mcd", icon: "🍔", en: "McD", ar: "ماك" },
  { id: "log", href: "/?tab=log", icon: "➕", en: "Log", ar: "سجّل" },
  { id: "progress", href: "/progress", icon: "📈", en: "Progress", ar: "التقدم" },
  { id: "settings", href: "/settings", icon: "⚙️", en: "Settings", ar: "الإعدادات" },
];

/** App-style tab bar. Today / McD / Log are tabs of the home page; Progress covers stats and spending too. */
export function BottomNav() {
  const { t } = useI18n();
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  if (path === "/quick") return null;

  const active =
    path === "/"
      ? tab === "mcd" || tab === "log"
        ? tab
        : "today"
      : path.startsWith("/progress") || path.startsWith("/stats") || path.startsWith("/spending")
        ? "progress"
        : path.startsWith("/settings")
          ? "settings"
          : "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0b0405]/[0.97] backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5">
        {ITEMS.map((it) => {
          const on = active === it.id;
          return (
            <Link key={it.id} href={it.href} className="relative flex flex-col items-center gap-0.5 py-2" aria-current={on ? "page" : undefined}>
              {on && (
                <motion.span layoutId="nav-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <motion.span whileTap={{ scale: 0.85 }} className={`text-xl transition-opacity ${on ? "" : "opacity-50"}`}>
                {it.icon}
              </motion.span>
              <span className={`text-[10px] font-bold ${on ? "text-gold" : "text-muted"}`}>{t(it.en, it.ar)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
