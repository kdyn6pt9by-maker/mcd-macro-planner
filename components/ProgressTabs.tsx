"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/** Progress, Stats and Spending share the bottom bar's 📈 tab; this switches between them. */
export function ProgressTabs() {
  const { t } = useI18n();
  const path = usePathname();
  const tabs = [
    { href: "/progress", label: t("📈 Progress", "📈 التقدم") },
    { href: "/stats", label: t("📊 Stats", "📊 الإحصائيات") },
    { href: "/spending", label: t("💰 Spending", "💰 المصروف") },
  ];
  return (
    <div className="grid grid-cols-3 p-1 rounded-2xl glass mb-4">
      {tabs.map((x) => (
        <Link
          key={x.href}
          href={x.href}
          className={`py-2 text-center text-xs font-bold rounded-xl transition-colors ${path.startsWith(x.href) ? "bg-gold text-black" : "text-muted"}`}
        >
          {x.label}
        </Link>
      ))}
    </div>
  );
}
