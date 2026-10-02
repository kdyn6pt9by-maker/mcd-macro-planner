"use client";

import { CSSProperties, useEffect, useState } from "react";

/**
 * iOS Safari doesn't shrink the layout for the on-screen keyboard, so a sheet pinned to bottom: 0 ends up
 * behind it. This tracks the keyboard through visualViewport and returns styles that lift the sheet above it
 * and cap its height to the visible area (the sheet should scroll).
 */
export function useKeyboardSheetStyle(base: CSSProperties = {}): CSSProperties {
  const [kb, setKb] = useState({ inset: 0, height: 0 });

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKb({ inset: inset > 60 ? inset : 0, height: Math.round(vv.height) });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  if (!kb.inset) return base;
  return {
    ...base,
    bottom: kb.inset,
    maxHeight: kb.height - 12,
    overflowY: "auto",
    paddingBottom: "1rem",
  };
}
