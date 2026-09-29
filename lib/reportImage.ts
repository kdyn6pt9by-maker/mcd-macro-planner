import type { WeekdayStatus } from "./progress";

export interface WeekReport {
  title: string;
  range: string;
  streak: number;
  streakLabel: string;
  week: { label: string; status: WeekdayStatus }[];
  stats: { label: string; value: string }[];
  footer: string;
  rtl: boolean;
}

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws a shareable 4:5 story card of the week (Instagram/WhatsApp friendly). */
export async function renderWeekReport(r: WeekReport): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (w: number, s: number) => `${w} ${s}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif`;
  ctx.direction = r.rtl ? "rtl" : "ltr";
  const start = r.rtl ? W - 80 : 80;
  ctx.textAlign = r.rtl ? "right" : "left";

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a0a0e");
  bg.addColorStop(1, "#0b0405");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 520);
  glow.addColorStop(0, "rgba(255,199,44,0.28)");
  glow.addColorStop(1, "rgba(255,199,44,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffc72c";
  ctx.font = font(900, 64);
  ctx.fillText(r.title, start, 150);
  ctx.fillStyle = "#b39597";
  ctx.font = font(500, 34);
  ctx.fillText(r.range, start, 205);

  // Streak hero
  roundRect(ctx, 60, 260, W - 120, 330, 48);
  const hero = ctx.createLinearGradient(60, 260, W - 60, 590);
  hero.addColorStop(0, "rgba(255,90,31,0.35)");
  hero.addColorStop(1, "rgba(255,199,44,0.18)");
  ctx.fillStyle = hero;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = font(900, 150);
  ctx.fillStyle = "#f7ecec";
  ctx.fillText(`🔥 ${r.streak}`, W / 2, 440);
  ctx.font = font(700, 36);
  ctx.fillStyle = "#ffc72c";
  ctx.fillText(r.streakLabel, W / 2, 500);

  // Week strip
  const cell = (W - 120 - 4 * 20) / 5;
  const days = r.rtl ? [...r.week].reverse() : r.week;
  days.forEach((d, i) => {
    const x = 60 + i * (cell + 20);
    roundRect(ctx, x, 630, cell, 150, 32);
    if (d.status === "done") {
      const g = ctx.createLinearGradient(x, 630, x, 780);
      g.addColorStop(0, "#ffb020");
      g.addColorStop(1, "#ff5a1f");
      ctx.fillStyle = g;
    } else ctx.fillStyle = d.status === "today" ? "rgba(255,199,44,0.15)" : "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.fillStyle = d.status === "done" ? "#1a0a0c" : "#b39597";
    ctx.font = font(800, 30);
    ctx.fillText(d.label, x + cell / 2, 685);
    ctx.font = font(700, 44);
    ctx.fillText(d.status === "done" ? "🔥" : d.status === "missed" ? "·" : "○", x + cell / 2, 750);
  });

  // Stat grid (2 columns)
  r.stats.slice(0, 6).forEach((s, i) => {
    const col = r.rtl ? 1 - (i % 2) : i % 2;
    const row = Math.floor(i / 2);
    const x = 60 + col * ((W - 140) / 2 + 20);
    const y = 820 + row * 150;
    const w = (W - 140) / 2;
    roundRect(ctx, x, y, w, 130, 32);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.fillStyle = "#f7ecec";
    ctx.font = font(900, 50);
    ctx.fillText(s.value, x + w / 2, y + 68);
    ctx.fillStyle = "#b39597";
    ctx.font = font(600, 26);
    ctx.fillText(s.label, x + w / 2, y + 108);
  });

  ctx.fillStyle = "rgba(179,149,151,0.8)";
  ctx.font = font(600, 28);
  ctx.fillText(r.footer, W / 2, H - 50);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png"));
}

/** Opens the iOS share sheet (Save Image / WhatsApp / …); falls back to a download. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return "downloaded";
}
