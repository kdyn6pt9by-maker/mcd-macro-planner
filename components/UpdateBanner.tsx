"use client";

import { useI18n } from "@/lib/i18n";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID;

export async function isUpdateAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    const { id } = (await res.json()) as { id?: string };
    return !!id && id !== CURRENT;
  } catch {
    return false;
  }
}

/** Reloads the app in place — data lives in local storage, so nothing is lost (unlike deleting the Home Screen app). */
export function reloadApp() {
  window.location.reload();
}

export function UpdateBanner() {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const check = () => isUpdateAvailable().then(setAvailable);
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {available && (
        <motion.button
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          onClick={reloadApp}
          className="fixed left-1/2 -translate-x-1/2 z-[55] rounded-full bg-gold text-black font-extrabold text-sm px-5 py-2.5 shadow-[0_10px_30px_-8px_rgba(255,199,44,0.7)] flex items-center gap-2"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}>
            ↻
          </motion.span>
          {t("New version ready — tap to update", "في تحديث جديد — اضغط للتحديث")}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
